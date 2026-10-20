import { accepts } from '../types'
import type { GeneratorContext } from '../types'

const SOURCE = 'generator:classifier'
const TOPIC = '量词搭配'
const SEED = 20261026
const LIMIT = 200

interface ClassifierRow {
  id: number
  noun: string
  classifier: string
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function difficultyOf(grade: number): number {
  if (grade <= 2) return 1
  if (grade <= 4) return 2
  return 3
}

function gradeOf(id: number): number {
  return ((id - 1) % 6) + 1
}

export function generateClassifier(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare('SELECT rowid AS id, noun, classifier FROM ref_classifier ORDER BY rowid')
    .all() as ClassifierRow[]

  const entries = rows
    .map((row) => ({
      id: row.id,
      noun: row.noun.trim(),
      classifier: row.classifier.trim()
    }))
    .filter((row) => row.noun.length > 0 && row.classifier.length > 0)

  const validFor = new Map<string, Set<string>>()
  for (const entry of entries) {
    const set = validFor.get(entry.noun)
    if (set) set.add(entry.classifier)
    else validFor.set(entry.noun, new Set([entry.classifier]))
  }
  const classifiers = [...new Set(entries.map((entry) => entry.classifier))]

  const groups = new Map<number, typeof entries>()
  for (const entry of entries) {
    const grade = gradeOf(entry.id)
    const group = groups.get(grade)
    if (group) group.push(entry)
    else groups.set(grade, [entry])
  }

  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  let count = 0

  for (const grade of [...groups.keys()].sort((a, b) => a - b)) {
    if (!accepts(ctx.options, 'single', grade)) continue
    let generated = 0
    for (const entry of shuffle(groups.get(grade) ?? [], rand)) {
      if (generated >= limit) break
      const allowed = validFor.get(entry.noun) ?? new Set<string>()
      const excluded = new Set([entry.classifier, ...allowed])
      const distractors: string[] = []
      const start = Math.floor(rand() * classifiers.length)
      for (let step = 0; step < classifiers.length && distractors.length < 3; step += 1) {
        const value = classifiers[(start + step) % classifiers.length]
        if (excluded.has(value)) continue
        excluded.add(value)
        distractors.push(value)
      }
      if (distractors.length < 3) continue

      const options = shuffle([entry.classifier, ...distractors], rand)
      const inserted = ctx.insert({
        subject: '语文',
        grade,
        topic: TOPIC,
        type: 'single',
        difficulty: difficultyOf(grade),
        stem: `一（  ）${entry.noun}`,
        options,
        answer: options.indexOf(entry.classifier),
        solution: `"${entry.noun}"应搭配量词"${entry.classifier}"。`,
        score: 2,
        source: SOURCE
      })
      if (inserted) {
        generated += 1
        count += 1
      }
    }
  }

  return count
}
