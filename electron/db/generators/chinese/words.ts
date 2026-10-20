import cnchar from 'cnchar'
import words from 'cnchar-words'
import { accepts } from '../types'
import type { GeneratorContext } from '../types'

cnchar.use(words)

const SOURCE = 'generator:words'
const TOPIC = '组词造句'
const SEED = 20261021
const LIMIT = 200

interface HanziRow {
  char: string
  grade: number
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

function wordsOf(char: string): string[] {
  const result = cnchar.words(char)
  if (!Array.isArray(result)) return []
  return [...new Set(result)]
    .map((item) => String(item).trim())
    .filter((item) => item.length >= 2 && item.includes(char) && /^[\u4e00-\u9fa5]+$/.test(item))
}

export function generateWords(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare('SELECT char, grade FROM ref_hanzi ORDER BY grade, char')
    .all() as HanziRow[]
  const pools = new Map<number, string[]>()
  for (const row of rows) {
    const pool = pools.get(row.grade)
    if (pool) pool.push(row.char)
    else pools.set(row.grade, [row.char])
  }

  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  let count = 0

  for (const grade of [...pools.keys()].sort((a, b) => a - b)) {
    if (!accepts(ctx.options, 'fill', grade)) continue
    let generated = 0
    for (const char of shuffle(pools.get(grade) ?? [], rand)) {
      if (generated >= limit) break
      const candidates = wordsOf(char)
      if (candidates.length === 0) continue

      const picked = shuffle(candidates, rand).slice(0, 3)
      const inserted = ctx.insert({
        subject: '语文',
        grade,
        topic: TOPIC,
        type: 'fill',
        difficulty: difficultyOf(grade),
        stem: `用"${char}"组词：____`,
        answer: [picked.join('|')],
        solution: `"${char}"可组词：${picked.join('、')}。`,
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
