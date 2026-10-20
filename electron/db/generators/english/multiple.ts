import { accepts } from '../types'
import type { GeneratorContext } from '../types'
import { numberParam } from './params'

const SOURCE = 'generator:english-multiple'
const TOPIC = '词汇'
const SEED = 20261018
const LIMIT = 250
const MAX_ATTEMPTS = 20000

interface WordRow {
  word: string
  grade: number
  volume: string | null
  meaning: string
}

interface MultipleItem {
  stem: string
  options: string[]
  answer: number[]
  solution: string
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

function optionKey(value: string): string {
  return value.replace(/\s+/g, '').replace(/[。．.，,；;！!？?、]+$/, '').toLowerCase()
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

function buildByMeaning(
  pool: WordRow[],
  rand: () => number,
  correctCount: number,
  optionCount: number
): MultipleItem | null {
  const target = pool[int(rand, 0, pool.length - 1)]
  const matches = [...new Set(pool.filter((row) => row.meaning === target.meaning).map((row) => row.word))]
  if (matches.length < correctCount) return null
  const correct = matches.slice(0, correctCount)

  const used = new Set(correct)
  const wrong: string[] = []
  for (const row of shuffle(pool, rand)) {
    if (used.has(row.word) || row.meaning === target.meaning) continue
    used.add(row.word)
    wrong.push(row.word)
    if (wrong.length === optionCount - correct.length) break
  }
  if (wrong.length < optionCount - correct.length) return null

  const options = shuffle([...correct, ...wrong], rand)
  if (new Set(options.map(optionKey)).size !== options.length) return null
  const answer = options
    .map((word, index) => (correct.includes(word) ? index : -1))
    .filter((index) => index >= 0)
  return {
    stem: `下列单词中，意思是"${target.meaning}"的有（ ）。`,
    options,
    answer,
    solution: `${correct.join('、')} 的意思是"${target.meaning}"。`
  }
}

function buildByVolume(
  pool: WordRow[],
  byVolume: Map<string, WordRow[]>,
  rand: () => number,
  correctCount: number,
  optionCount: number
): MultipleItem | null {
  const target = pool[int(rand, 0, pool.length - 1)]
  if (!target.volume) return null
  const sameVolume = (byVolume.get(target.volume) ?? []).filter((row) => row.word !== target.word)
  const others = pool.filter((row) => row.volume !== target.volume)
  if (sameVolume.length < correctCount || others.length < optionCount - correctCount) return null

  const correct = shuffle(sameVolume, rand)
    .slice(0, correctCount)
    .map((row) => row.word)
  const used = new Set([target.word, ...correct])
  const wrong: string[] = []
  for (const row of shuffle(others, rand)) {
    if (used.has(row.word)) continue
    used.add(row.word)
    wrong.push(row.word)
    if (wrong.length === optionCount - correctCount) break
  }
  if (wrong.length < optionCount - correctCount) return null

  const options = shuffle([...correct, ...wrong], rand)
  if (new Set(options.map(optionKey)).size !== options.length) return null
  const answer = options
    .map((word, index) => (correct.includes(word) ? index : -1))
    .filter((index) => index >= 0)
  return {
    stem: `下列单词中，与"${target.word}"出现在同一单元的有（ ）。`,
    options,
    answer,
    solution: `${correct.join('、')} 与 ${target.word} 在同一单元中出现。`
  }
}

function pureWordRows(pool: WordRow[]): WordRow[] {
  return pool.filter((row) => /^[A-Za-z]+$/.test(row.word))
}

function pickWrongWords(
  words: WordRow[],
  used: Set<string>,
  rand: () => number,
  count: number
): string[] {
  const wrong: string[] = []
  for (const row of shuffle(words, rand)) {
    if (used.has(row.word)) continue
    used.add(row.word)
    wrong.push(row.word)
    if (wrong.length === count) break
  }
  return wrong
}

function buildByLetter(
  pool: WordRow[],
  rand: () => number,
  correctCount: number,
  optionCount: number
): MultipleItem | null {
  const words = pureWordRows(pool)
  if (words.length < optionCount) return null

  const letter = String.fromCharCode(97 + int(rand, 0, 25))
  const inside = words.filter((row) => row.word.toLowerCase().includes(letter))
  const outside = words.filter((row) => !row.word.toLowerCase().includes(letter))
  if (inside.length < correctCount || outside.length < optionCount - correctCount) return null

  const correct = shuffle(inside, rand)
    .slice(0, correctCount)
    .map((row) => row.word)
  const wrong = pickWrongWords(outside, new Set(correct), rand, optionCount - correctCount)
  if (wrong.length < optionCount - correctCount) return null

  const options = shuffle([...correct, ...wrong], rand)
  if (new Set(options.map(optionKey)).size !== options.length) return null
  const answer = options
    .map((word, index) => (correct.includes(word) ? index : -1))
    .filter((index) => index >= 0)
  return {
    stem: `下列单词中，含有字母 ${letter} 的有（ ）。`,
    options,
    answer,
    solution: `${correct.join('、')} 中含有字母 ${letter}。`
  }
}

function buildByLength(
  pool: WordRow[],
  rand: () => number,
  correctCount: number,
  optionCount: number
): MultipleItem | null {
  const words = pureWordRows(pool)
  if (words.length < optionCount) return null

  const byLength = new Map<number, WordRow[]>()
  for (const row of words) {
    const group = byLength.get(row.word.length)
    if (group) group.push(row)
    else byLength.set(row.word.length, [row])
  }
  const lengths = [...byLength.keys()].filter(
    (length) => (byLength.get(length) ?? []).length >= correctCount
  )
  if (lengths.length === 0) return null

  const length = lengths[int(rand, 0, lengths.length - 1)]
  const correct = shuffle(byLength.get(length) ?? [], rand)
    .slice(0, correctCount)
    .map((row) => row.word)
  const wrong = pickWrongWords(
    words.filter((row) => row.word.length !== length),
    new Set(correct),
    rand,
    optionCount - correctCount
  )
  if (wrong.length < optionCount - correctCount) return null

  const options = shuffle([...correct, ...wrong], rand)
  if (new Set(options.map(optionKey)).size !== options.length) return null
  const answer = options
    .map((word, index) => (correct.includes(word) ? index : -1))
    .filter((index) => index >= 0)
  return {
    stem: `下列单词中，由 ${length} 个字母组成的有（ ）。`,
    options,
    answer,
    solution: `${correct.join('、')} 均由 ${length} 个字母组成。`
  }
}

function buildLowGrade(
  pool: WordRow[],
  rand: () => number,
  correctCount: number,
  optionCount: number
): MultipleItem | null {
  return rand() < 0.5
    ? buildByLetter(pool, rand, correctCount, optionCount)
    : buildByLength(pool, rand, correctCount, optionCount)
}

export function generateEnglishMultiple(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare('SELECT word, grade, volume, meaning FROM ref_english_word ORDER BY grade, rowid')
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
  const optionCount = numberParam(ctx.options, 'optionCount', 4, 4, 5)
  const correctCount = numberParam(ctx.options, 'correctCount', 2, 2, 3)
  let count = 0

  for (const grade of [...groups.keys()].sort((a, b) => a - b)) {
    if (!accepts(ctx.options, 'multiple', grade)) continue
    const pool = uniqueByWord(groups.get(grade) ?? [])
    const byVolume = new Map<string, WordRow[]>()
    for (const row of pool) {
      if (!row.volume) continue
      const group = byVolume.get(row.volume)
      if (group) group.push(row)
      else byVolume.set(row.volume, [row])
    }

    const seen = new Set<string>()
    let generated = 0
    let attempts = 0
    while (generated < limit && attempts < MAX_ATTEMPTS) {
      attempts += 1
      const item =
        grade < 3
          ? buildLowGrade(pool, rand, correctCount, optionCount)
          : rand() < 0.5
            ? buildByMeaning(pool, rand, correctCount, optionCount)
            : buildByVolume(pool, byVolume, rand, correctCount, optionCount)
      if (!item || seen.has(item.stem)) continue
      seen.add(item.stem)
      const inserted = ctx.insert({
        subject: '英语',
        grade,
        topic: TOPIC,
        type: 'multiple',
        difficulty: difficultyOf(grade),
        stem: item.stem,
        options: item.options,
        answer: item.answer,
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
