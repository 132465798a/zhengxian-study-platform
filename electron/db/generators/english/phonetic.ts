import { accepts } from '../types'
import type { GeneratorContext } from '../types'
import { numberParam } from './params'

const SOURCE = 'generator:phonetic'
const TOPIC = '字母与语音'
const SEED = 20261107
const LIMIT = 100

interface WordRow {
  word: string
  grade: number
  phonetic: string | null
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
  return grade <= 4 ? 2 : 3
}

function isPhonetic(value: string | null): value is string {
  const text = value?.trim() ?? ''
  return text.length > 0 && text !== '-'
}

export function generatePhonetic(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare('SELECT word, grade, phonetic FROM ref_english_word ORDER BY grade, rowid')
    .all() as WordRow[]

  const groups = new Map<number, WordRow[]>()
  for (const row of rows) {
    if (!row.word || !isPhonetic(row.phonetic)) continue
    const group = groups.get(row.grade)
    if (group) group.push(row)
    else groups.set(row.grade, [row])
  }

  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  const optionCount = numberParam(ctx.options, 'optionCount', 4, 3, 4)
  let count = 0

  for (const grade of [...groups.keys()].sort((a, b) => a - b)) {
    if (!accepts(ctx.options, 'single', grade)) continue
    const pool = groups.get(grade) ?? []
    const seen = new Set<string>()
    let generated = 0

    for (const row of shuffle(pool, rand)) {
      if (generated >= limit) break
      const phonetic = row.phonetic
      if (!isPhonetic(phonetic)) continue
      const stem = `"${row.word}" 的音标是？`
      if (seen.has(stem)) continue

      const used = new Set([phonetic])
      const choices: string[] = []
      for (const other of shuffle(pool, rand)) {
        if (!isPhonetic(other.phonetic) || used.has(other.phonetic)) continue
        used.add(other.phonetic)
        choices.push(other.phonetic)
        if (choices.length === optionCount - 1) break
      }
      if (choices.length < optionCount - 1) continue

      seen.add(stem)
      const options = shuffle([phonetic, ...choices], rand)
      const inserted = ctx.insert({
        subject: '英语',
        grade,
        topic: TOPIC,
        type: 'single',
        difficulty: difficultyOf(grade),
        stem,
        options,
        answer: options.indexOf(phonetic),
        solution: `"${row.word}" 的音标是 ${phonetic}。`,
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
