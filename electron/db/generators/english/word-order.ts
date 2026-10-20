import { accepts } from '../types'
import type { GeneratorContext } from '../types'
import { numberParam } from './params'

const SOURCE = 'generator:word-order'
const TOPIC = '句型与语法'
const SEED = 20261108
const LIMIT = 150

interface SentenceRow {
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

function makeOrder(words: string[], rand: () => number): string[] | null {
  const original = words.join(' ')
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const order = shuffle(words, rand)
    if (order.join(' ') !== original) return order
  }
  return null
}

export function generateWordOrder(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare('SELECT grade, sentence FROM ref_english_word ORDER BY grade, rowid')
    .all() as SentenceRow[]

  const groups = new Map<number, SentenceRow[]>()
  for (const row of rows) {
    if (!row.sentence) continue
    const group = groups.get(row.grade)
    if (group) group.push(row)
    else groups.set(row.grade, [row])
  }

  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  const itemCount = numberParam(ctx.options, 'itemCount', 4, 4, 6)
  let count = 0

  for (const grade of [...groups.keys()].sort((a, b) => a - b)) {
    if (!accepts(ctx.options, 'sorting', grade)) continue
    const usedSentences = new Set<string>()
    const seenStems = new Set<string>()
    let generated = 0

    for (const row of shuffle(groups.get(grade) ?? [], rand)) {
      if (generated >= limit) break
      if (!row.sentence) continue
      const words = tokenize(row.sentence)
      if (words.length < 4) continue
      if (itemCount > 4 && words.length < itemCount - 1) continue
      if (itemCount > 4 && words.length > itemCount) continue
      if (new Set(words.map((word) => word.toLowerCase())).size !== words.length) continue

      const key = words.join(' ').toLowerCase()
      if (usedSentences.has(key)) continue
      usedSentences.add(key)

      const order = makeOrder(words, rand)
      if (!order) continue

      const stem = `连词成句：${order.join(' / ')}`
      if (seenStems.has(stem)) continue
      seenStems.add(stem)

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
