import { accepts } from '../types'
import type { GeneratorContext } from '../types'
import { numberParam } from './params'

const SOURCE = 'generator:english-sorting'
const TOPIC = '句型与语法'
const SEED = 20261018
const LIMIT = 250
const MAX_ATTEMPTS = 30000

interface WordRow {
  word: string
  grade: number
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

function tokenize(sentence: string): string[] {
  return sentence
    .split(/\s+/)
    .map((word) => word.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, ''))
    .filter((word) => word.length > 0)
}

function scramble(words: string[], rand: () => number): string[] | null {
  const original = words.join(' ')
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const order = shuffle(words, rand)
    if (order.join(' ') !== original) return order
  }
  return null
}

function uniqueWords(rows: WordRow[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const row of rows) {
    if (!/^[A-Za-z]+$/.test(row.word) || seen.has(row.word)) continue
    seen.add(row.word)
    result.push(row.word)
  }
  return result
}

function buildLetterOrder(
  words: string[],
  rand: () => number,
  count: number
): { options: string[]; answer: string[] } | null {
  const byLetter = new Map<string, string[]>()
  for (const word of words) {
    const letter = word[0].toLowerCase()
    const group = byLetter.get(letter)
    if (group) group.push(word)
    else byLetter.set(letter, [word])
  }

  const letters = shuffle([...byLetter.keys()], rand).slice(0, count)
  if (letters.length < count) return null

  const picked = letters.map((letter) => {
    const group = byLetter.get(letter) ?? []
    return group[int(rand, 0, group.length - 1)]
  })
  const answer = [...picked].sort((a, b) =>
    a[0].toLowerCase().localeCompare(b[0].toLowerCase())
  )
  const answerKey = answer.map((word) => word.toLowerCase()).join('|')
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const options = shuffle(picked, rand)
    if (options.map((word) => word.toLowerCase()).join('|') !== answerKey) {
      return { options, answer }
    }
  }
  return null
}

export function generateEnglishSorting(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare('SELECT word, grade, sentence FROM ref_english_word ORDER BY grade, rowid')
    .all() as WordRow[]

  const grades = new Set<number>()
  const groups = new Map<number, WordRow[]>()
  const wordGroups = new Map<number, WordRow[]>()
  for (const row of rows) {
    grades.add(row.grade)
    if (/^[A-Za-z]+$/.test(row.word)) {
      const wordGroup = wordGroups.get(row.grade)
      if (wordGroup) wordGroup.push(row)
      else wordGroups.set(row.grade, [row])
    }
    if (!row.sentence) continue
    const group = groups.get(row.grade)
    if (group) group.push(row)
    else groups.set(row.grade, [row])
  }

  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  const itemCount = numberParam(ctx.options, 'itemCount', 4, 4, 6)
  let count = 0

  for (const grade of [...grades].sort((a, b) => a - b)) {
    if (!accepts(ctx.options, 'sorting', grade)) continue
    if (grade < 3) {
      const pool = uniqueWords(wordGroups.get(grade) ?? [])
      const seen = new Set<string>()
      let generated = 0
      let attempts = 0
      while (generated < limit && attempts < MAX_ATTEMPTS) {
        attempts += 1
        const item = buildLetterOrder(pool, rand, itemCount)
        if (!item) continue
        const stem = `按首字母顺序排列下列单词：${item.options.join(' / ')}`
        if (seen.has(stem)) continue
        seen.add(stem)

        const inserted = ctx.insert({
          subject: '英语',
          grade,
          topic: '字母与语音',
          type: 'sorting',
          difficulty: difficultyOf(grade),
          stem,
          options: item.options,
          answer: item.answer,
          solution: `正确顺序：${item.answer.join(' / ')}`,
          score: 3,
          source: SOURCE
        })
        if (inserted) {
          generated += 1
          count += 1
        }
      }
      continue
    }

    const pool = groups.get(grade) ?? []
    const seen = new Set<string>()
    let generated = 0
    let attempts = 0
    while (generated < limit && attempts < MAX_ATTEMPTS) {
      attempts += 1
      const row = pool[int(rand, 0, pool.length - 1)]
      if (!row.sentence) continue
      const words = tokenize(row.sentence)
      if (words.length < 4) continue
      if (itemCount > 4 && words.length < itemCount - 1) continue
      if (itemCount > 4 && words.length > itemCount) continue
      if (new Set(words.map((word) => word.toLowerCase())).size !== words.length) continue

      const order = scramble(words, rand)
      if (!order) continue
      const stem = `连词成句：${order.join(' / ')}`
      if (seen.has(stem)) continue
      seen.add(stem)

      const inserted = ctx.insert({
        subject: '英语',
        grade,
        topic: TOPIC,
        type: 'sorting',
        difficulty: difficultyOf(grade),
        stem,
        options: order,
        answer: words,
        solution: `正确顺序：${words.join(' ')}`,
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
