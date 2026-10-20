import { accepts } from '../types'
import type { GeneratorContext } from '../types'
import { numberParam } from './params'

const SOURCE = 'generator:english-alphabet'
const TOPIC = '字母与语音'
const SEED = 20261019
const LIMIT = 60
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')

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

export function generateEnglishAlphabet(ctx: GeneratorContext): number {
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
  let count = 0

  for (const grade of [...groups.keys()].sort((a, b) => a - b)) {
    if (grade > 2) continue
    if (!accepts(ctx.options, 'single', grade)) continue
    const pool = uniqueByWord(groups.get(grade) ?? [])
    const seen = new Set<string>()
    let generated = 0

    for (const row of shuffle(pool, rand)) {
      if (generated >= limit) break
      if (!/^[A-Za-z]+$/.test(row.word)) continue
      const stem = `单词 ${row.word} 的首字母是？`
      if (seen.has(stem)) continue

      const letter = row.word[0].toLowerCase()
      const wrong = shuffle(
        LETTERS.filter((item) => item !== letter),
        rand
      ).slice(0, optionCount - 1)
      if (wrong.length < optionCount - 1) continue

      seen.add(stem)
      const options = shuffle([letter, ...wrong], rand)
      const inserted = ctx.insert({
        subject: '英语',
        grade,
        topic: TOPIC,
        type: 'single',
        difficulty: difficultyOf(grade),
        stem,
        options,
        answer: options.indexOf(letter),
        solution: `${row.word} 的首字母是 ${letter}。`,
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
