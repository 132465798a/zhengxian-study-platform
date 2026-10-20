import { accepts } from '../types'
import type { GeneratorContext } from '../types'

const SOURCE = 'generator:synonym'
const TOPIC = '近义反义'
const SEED = 20261023
const LIMIT = 1000

interface SynonymRow {
  id: number
  words: string
}

interface Entry {
  id: number
  list: string[]
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

function parseWords(raw: string): string[] {
  const text = raw.includes('=') ? raw.slice(raw.indexOf('=') + 1) : raw
  return [
    ...new Set(
      text
        .split(/\s+/)
        .map((item) => item.trim())
        .filter((item) => /^[\u4e00-\u9fa5]+$/.test(item))
    )
  ]
}

export function generateSynonym(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare('SELECT id, words FROM ref_synonym ORDER BY id')
    .all() as SynonymRow[]

  const entries: Entry[] = []
  for (const row of rows) {
    const list = parseWords(row.words)
    if (list.length >= 2) entries.push({ id: row.id, list })
  }

  const pool = entries.flatMap((entry) => entry.list.map((word) => ({ id: entry.id, word })))
  const groups = new Map<number, Entry[]>()
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
    if (grade <= 2) continue
    if (!accepts(ctx.options, 'single', grade)) continue
    let generated = 0
    for (const entry of shuffle(groups.get(grade) ?? [], rand)) {
      if (generated >= limit) break
      const first = entry.list[0]
      const second = entry.list[1]
      if (!first || !second || first === second) continue

      const excluded = new Set(entry.list)
      const distractors: string[] = []
      const start = Math.floor(rand() * pool.length)
      for (let step = 0; step < pool.length && distractors.length < 3; step += 1) {
        const item = pool[(start + step) % pool.length]
        if (item.id === entry.id || excluded.has(item.word)) continue
        excluded.add(item.word)
        distractors.push(item.word)
      }
      if (distractors.length < 3) continue

      const options = shuffle([second, ...distractors], rand)
      const inserted = ctx.insert({
        subject: '语文',
        grade,
        topic: TOPIC,
        type: 'single',
        difficulty: difficultyOf(grade),
        stem: `与"${first}"意思最接近的是？`,
        options,
        answer: options.indexOf(second),
        solution: `"${first}"的近义词是"${second}"。`,
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
