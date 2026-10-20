import { accepts } from '../types'
import type { GeneratorContext } from '../types'
import { numberParam } from './params'

const SOURCE = 'generator:english-judge'
const SEED = 20261018
const LIMIT = 250
const MAX_ATTEMPTS = 20000

interface WordRow {
  word: string
  grade: number
  meaning: string
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

function int(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1))
}

function difficultyOf(grade: number): number {
  return grade <= 4 ? 2 : 3
}

function uniqueByWord(rows: WordRow[]): WordRow[] {
  const seen = new Set<string>()
  const result: WordRow[] = []
  for (const row of rows) {
    if (!row.word || !row.meaning || seen.has(row.word)) continue
    seen.add(row.word)
    result.push(row)
  }
  return result
}

function isPhonetic(value: string | null): value is string {
  const text = value?.trim() ?? ''
  return text.length > 0 && text !== '-'
}

interface JudgeItem {
  stem: string
  solution: string
}

function buildMeaning(
  row: WordRow,
  pool: WordRow[],
  wantTrue: boolean,
  rand: () => number
): JudgeItem | null {
  if (wantTrue) {
    return {
      stem: `判断："${row.word}" 的意思是"${row.meaning}"。`,
      solution: `"${row.word}" 的意思是"${row.meaning}"。`
    }
  }
  const others = pool.filter((item) => item.meaning !== row.meaning)
  if (others.length === 0) return null
  const other = others[int(rand, 0, others.length - 1)]
  return {
    stem: `判断："${row.word}" 的意思是"${other.meaning}"。`,
    solution: `"${row.word}" 的意思是"${row.meaning}"。`
  }
}

function buildPhonetic(
  row: WordRow,
  pool: WordRow[],
  wantTrue: boolean,
  rand: () => number
): JudgeItem | null {
  if (!isPhonetic(row.phonetic)) return null
  if (wantTrue) {
    return {
      stem: `判断："${row.word}" 的音标是 ${row.phonetic}。`,
      solution: `"${row.word}" 的音标是 ${row.phonetic}。`
    }
  }
  const others = pool.filter((item) => isPhonetic(item.phonetic) && item.phonetic !== row.phonetic)
  if (others.length === 0) return null
  const other = others[int(rand, 0, others.length - 1)]
  if (!isPhonetic(other.phonetic)) return null
  return {
    stem: `判断："${row.word}" 的音标是 ${other.phonetic}。`,
    solution: `"${row.word}" 的音标是 ${row.phonetic}。`
  }
}

export function generateEnglishJudge(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare('SELECT word, grade, meaning, phonetic FROM ref_english_word ORDER BY grade, rowid')
    .all() as WordRow[]

  const groups = new Map<number, WordRow[]>()
  for (const row of rows) {
    if (!row.word || !row.meaning) continue
    const group = groups.get(row.grade)
    if (group) group.push(row)
    else groups.set(row.grade, [row])
  }

  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  const trueRatio = numberParam(ctx.options, 'trueRatio', 50, 50, 70)
  const customRatio = ctx.options?.params?.trueRatio !== undefined
  let count = 0

  for (const grade of [...groups.keys()].sort((a, b) => a - b)) {
    if (!accepts(ctx.options, 'judge', grade)) continue
    const pool = uniqueByWord(groups.get(grade) ?? [])
    const seen = new Set<string>()
    let generated = 0
    let attempts = 0
    while (generated < limit && attempts < MAX_ATTEMPTS) {
      attempts += 1
      const wantTrue = customRatio ? rand() * 100 < trueRatio : generated % 2 === 0
      const row = pool[int(rand, 0, pool.length - 1)]
      const item =
        grade < 3
          ? buildMeaning(row, pool, wantTrue, rand)
          : rand() < 0.5
            ? buildMeaning(row, pool, wantTrue, rand)
            : buildPhonetic(row, pool, wantTrue, rand)
      if (!item || seen.has(item.stem)) continue
      seen.add(item.stem)
      const inserted = ctx.insert({
        subject: '英语',
        grade,
        topic: '词汇',
        type: 'judge',
        difficulty: difficultyOf(grade),
        stem: item.stem,
        options: ['正确', '错误'],
        answer: wantTrue ? 0 : 1,
        solution: item.solution,
        score: 3,
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
