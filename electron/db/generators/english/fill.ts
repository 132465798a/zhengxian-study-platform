import { accepts } from '../types'
import type { GeneratorContext } from '../types'
import { numberParam } from './params'

const SOURCE = 'generator:english-fill'
const TOPIC = '词汇'
const SEED = 20261018
const LIMIT = 200
const MAX_ATTEMPTS = 30000

interface WordRow {
  word: string
  grade: number
  meaning: string
  sentence: string | null
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

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface FilledSentence {
  stem: string
  answer: string[]
}

interface BlankOccurrence {
  index: number
  length: number
  text: string
}

function fillSentence(
  sentence: string,
  word: string,
  blankCount: number
): FilledSentence | null {
  const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i')
  const match = pattern.exec(sentence)
  if (!match) return null

  if (blankCount <= 1) {
    return { stem: sentence.replace(pattern, '____'), answer: [word] }
  }

  const blanks: BlankOccurrence[] = [
    { index: match.index, length: match[0].length, text: word }
  ]
  const used = new Set([word.toLowerCase()])
  const candidates: BlankOccurrence[] = []
  for (const item of sentence.matchAll(/\b[A-Za-z]+(?:'[A-Za-z]+)?\b/g)) {
    const text = item[0]
    if (item.index === match.index) continue
    const key = text.toLowerCase()
    if (used.has(key)) continue
    used.add(key)
    candidates.push({ index: item.index ?? 0, length: text.length, text })
  }
  candidates.sort((a, b) => b.length - a.length || a.index - b.index)
  for (const candidate of candidates) {
    if (blanks.length >= blankCount) break
    blanks.push(candidate)
  }
  if (blanks.length < blankCount) return null

  blanks.sort((a, b) => a.index - b.index)
  let stem = ''
  let cursor = 0
  blanks.forEach((blank) => {
    stem += sentence.slice(cursor, blank.index) + '____'
    cursor = blank.index + blank.length
  })
  stem += sentence.slice(cursor)
  return { stem, answer: blanks.map((blank) => blank.text) }
}

export function generateEnglishFill(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare('SELECT word, grade, meaning, sentence FROM ref_english_word ORDER BY grade, rowid')
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
  const blankCount = numberParam(ctx.options, 'blankCount', 1, 1, 3)
  let count = 0

  for (const grade of [...groups.keys()].sort((a, b) => a - b)) {
    if (!accepts(ctx.options, 'fill', grade)) continue
    const pool = uniqueByWord(groups.get(grade) ?? [])
    const seen = new Set<string>()
    let generated = 0
    let attempts = 0
    while (generated < limit && attempts < MAX_ATTEMPTS) {
      attempts += 1
      const row = pool[int(rand, 0, pool.length - 1)]
      const filled = row.sentence
        ? fillSentence(row.sentence.trim(), row.word, blankCount)
        : null
      if (!filled && blankCount > 1) continue
      if (!filled && pool.some((item) => item.word !== row.word && item.meaning === row.meaning)) {
        continue
      }
      const stem = filled
        ? `补全句子：${filled.stem}（${row.meaning}）`
        : `根据中文写单词：${row.meaning} ____`
      if (seen.has(stem)) continue
      seen.add(stem)

      const inserted = ctx.insert({
        subject: '英语',
        grade,
        topic: TOPIC,
        type: 'fill',
        difficulty: difficultyOf(grade),
        stem,
        answer: filled ? filled.answer : [row.word],
        solution: `"${row.meaning}"的英语单词是 ${row.word}。`,
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
