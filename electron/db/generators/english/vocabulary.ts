import { accepts } from '../types'
import type { GeneratorContext, GeneratedQuestion } from '../types'
import { numberParam } from './params'

const SOURCE = 'generator:vocabulary'
const TOPIC = '词汇'
const SEED = 20261106
const LIMIT = 300

interface WordRow {
  word: string
  grade: number
  meaning: string
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

function distractors(
  pool: WordRow[],
  correct: string,
  key: 'word' | 'meaning',
  rand: () => number,
  count: number
): string[] {
  const used = new Set([correct])
  const result: string[] = []
  for (const row of shuffle(pool, rand)) {
    const value = row[key]
    if (!value || used.has(value)) continue
    used.add(value)
    result.push(value)
    if (result.length === count) break
  }
  return result
}

function buildQuestion(
  row: WordRow,
  pool: WordRow[],
  round: number,
  rand: () => number,
  optionCount: number
): GeneratedQuestion | null {
  if (round === 2) {
    if (pool.some((item) => item.word !== row.word && item.meaning === row.meaning)) return null
    return {
      subject: '英语',
      grade: row.grade,
      topic: TOPIC,
      type: 'fill',
      difficulty: difficultyOf(row.grade),
      stem: `根据中文写单词：${row.meaning} ____`,
      answer: [row.word],
      solution: `"${row.meaning}"的英语单词是 ${row.word}。`,
      score: 2,
      source: SOURCE
    }
  }

  const key = round === 0 ? 'meaning' : 'word'
  const correct = round === 0 ? row.meaning : row.word
  const candidates = round === 0 ? pool : pool.filter((item) => item.meaning !== row.meaning)
  const choices = distractors(candidates, correct, key, rand, optionCount - 1)
  if (choices.length < optionCount - 1) return null

  const options = shuffle([correct, ...choices], rand)
  return {
    subject: '英语',
    grade: row.grade,
    topic: TOPIC,
    type: 'single',
    difficulty: difficultyOf(row.grade),
    stem: round === 0 ? `"${row.word}" 的中文意思是？` : `"${row.meaning}" 用英语怎么说？`,
    options,
    answer: options.indexOf(correct),
    solution: `"${row.word}" 的意思是"${row.meaning}"。`,
    score: 2,
    source: SOURCE
  }
}

export function generateVocabulary(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare('SELECT word, grade, meaning FROM ref_english_word ORDER BY grade, rowid')
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
  const optionCount = numberParam(ctx.options, 'optionCount', 4, 3, 4)
  const blankCount = numberParam(ctx.options, 'blankCount', 1, 1, 3)
  let count = 0

  for (const grade of [...groups.keys()].sort((a, b) => a - b)) {
    const allowSingle = accepts(ctx.options, 'single', grade)
    const allowFill = accepts(ctx.options, 'fill', grade)
    if (!allowSingle && !allowFill) continue
    const pool = uniqueByWord(groups.get(grade) ?? [])
    const seen = new Set<string>()
    let generated = 0

    for (let round = 0; round < 3; round += 1) {
      if (round === 2 ? !allowFill || blankCount > 1 : !allowSingle) continue
      for (const row of shuffle(pool, rand)) {
        if (generated >= limit) break
        const question = buildQuestion(row, pool, round, rand, optionCount)
        if (!question || seen.has(question.stem)) continue
        seen.add(question.stem)
        if (ctx.insert(question)) {
          generated += 1
          count += 1
        }
      }
    }
  }

  return count
}
