import type { GeneratorContext } from '../types'
import { accepts, paramInt } from '../types'

const SOURCE = 'generator:math-sorting'
const TOPIC = '数与运算'
const SEED = 20261018
const LIMIT = 200
const MAX_ATTEMPTS = 20000

interface NumberItem {
  text: string
  value: number
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

function fmt(value: number): string {
  return String(Number(value.toFixed(4)))
}

function difficultyOf(grade: number): number {
  if (grade <= 2) return 1
  if (grade <= 4) return 2
  return 3
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y > 0) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

function fracText(n: number, d: number): string {
  const g = gcd(n, d)
  return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`
}

function makeItem(grade: number, rand: () => number): NumberItem {
  if (grade === 1) {
    const value = int(rand, 1, 100)
    return { text: String(value), value }
  }
  if (grade === 2) {
    const value = int(rand, 1, 1000)
    return { text: String(value), value }
  }
  if (grade === 3) {
    if (rand() < 0.5) {
      const value = int(rand, 1, 100)
      return { text: String(value), value }
    }
    const value = int(rand, 1, 500) / 10
    return { text: fmt(value), value }
  }
  if (grade <= 5) {
    const value = int(rand, 1, 1000) / 100
    return { text: fmt(value), value }
  }
  if (rand() < 0.5) {
    const value = int(rand, 1, 1000) / 100
    return { text: fmt(value), value }
  }
  const d = int(rand, 2, 12)
  const n = int(rand, 1, d - 1)
  return { text: fracText(n, d), value: n / d }
}

function buildQuestion(
  grade: number,
  rand: () => number,
  itemCount: number
): { items: NumberItem[]; options: string[] } | null {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const items: NumberItem[] = []
    for (let i = 0; i < itemCount; i += 1) items.push(makeItem(grade, rand))
    const values = new Set(items.map((item) => item.value))
    const texts = new Set(items.map((item) => item.text))
    if (values.size < itemCount || texts.size < itemCount) continue

    const sorted = [...items].sort((a, b) => a.value - b.value)
    const original = sorted.map((item) => item.text).join('、')
    for (let i = 0; i < 12; i += 1) {
      const options = shuffle(items.map((item) => item.text), rand)
      if (options.join('、') !== original) return { items: sorted, options }
    }
  }
  return null
}

export function generateMathSorting(ctx: GeneratorContext): number {
  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  const itemCount = paramInt(ctx.options, 'itemCount', 4, 4, 6)
  let count = 0

  for (let grade = 1; grade <= 6; grade += 1) {
    if (!accepts(ctx.options, 'sorting', grade)) continue
    const seen = new Set<string>()
    let generated = 0
    let attempts = 0
    while (generated < limit && attempts < MAX_ATTEMPTS) {
      attempts += 1
      const item = buildQuestion(grade, rand, itemCount)
      if (!item) continue

      const stem = `把下面的数按从小到大的顺序排列：${item.options.join('、')}。`
      if (seen.has(stem)) continue
      seen.add(stem)

      const inserted = ctx.insert({
        subject: '数学',
        grade,
        topic: TOPIC,
        type: 'sorting',
        difficulty: difficultyOf(grade),
        stem,
        options: item.options,
        answer: item.items.map((entry) => entry.text),
        solution: `从小到大排列：${item.items.map((entry) => entry.text).join(' < ')}`,
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
