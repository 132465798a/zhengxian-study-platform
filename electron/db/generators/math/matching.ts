import type { GeneratorContext } from '../types'
import { accepts, paramInt } from '../types'

const SOURCE = 'generator:math-matching'
const SEED = 20261018
const LIMIT = 250
const MAX_ATTEMPTS = 20000

interface Expr {
  text: string
  result: string
}

interface Conversion {
  from: string
  to: string
  factor: number
  minGrade: number
}

const CONVERSIONS: Conversion[] = [
  { from: '元', to: '角', factor: 10, minGrade: 1 },
  { from: '角', to: '分', factor: 10, minGrade: 1 },
  { from: '元', to: '分', factor: 100, minGrade: 1 },
  { from: '米', to: '厘米', factor: 100, minGrade: 1 },
  { from: '米', to: '分米', factor: 10, minGrade: 2 },
  { from: '厘米', to: '毫米', factor: 10, minGrade: 2 },
  { from: '分米', to: '厘米', factor: 10, minGrade: 3 },
  { from: '千米', to: '米', factor: 1000, minGrade: 3 },
  { from: '千克', to: '克', factor: 1000, minGrade: 3 },
  { from: '时', to: '分', factor: 60, minGrade: 3 },
  { from: '分', to: '秒', factor: 60, minGrade: 3 },
  { from: '吨', to: '千克', factor: 1000, minGrade: 5 },
  { from: '平方米', to: '平方分米', factor: 100, minGrade: 5 },
  { from: '平方分米', to: '平方厘米', factor: 100, minGrade: 5 },
  { from: '立方米', to: '立方分米', factor: 1000, minGrade: 5 },
  { from: '立方分米', to: '立方厘米', factor: 1000, minGrade: 5 }
]

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
  const numerator = n / g
  const denominator = d / g
  return denominator === 1 ? String(numerator) : `${numerator}/${denominator}`
}

function makeExpr(grade: number, rand: () => number): Expr {
  if (grade <= 1) {
    if (rand() < 0.5) {
      const a = int(rand, 0, 19)
      const b = int(rand, 0, 20 - a)
      return { text: `${a} + ${b}`, result: String(a + b) }
    }
    const a = int(rand, 0, 20)
    const b = int(rand, 0, a)
    return { text: `${a} - ${b}`, result: String(a - b) }
  }

  if (grade === 2) {
    const mode = int(rand, 1, 4)
    if (mode === 1) {
      const a = int(rand, 10, 89)
      const b = int(rand, 1, 100 - a)
      return { text: `${a} + ${b}`, result: String(a + b) }
    }
    if (mode === 2) {
      const a = int(rand, 20, 100)
      const b = int(rand, 1, a)
      return { text: `${a} - ${b}`, result: String(a - b) }
    }
    if (mode === 3) {
      const a = int(rand, 2, 9)
      const b = int(rand, 2, 9)
      return { text: `${a} × ${b}`, result: String(a * b) }
    }
    const b = int(rand, 2, 9)
    const q = int(rand, 2, 9)
    return { text: `${b * q} ÷ ${b}`, result: String(q) }
  }

  if (grade === 3) {
    const mode = int(rand, 1, 4)
    if (mode === 1) {
      const a = int(rand, 100, 899)
      const b = int(rand, 100, 999 - a)
      return { text: `${a} + ${b}`, result: String(a + b) }
    }
    if (mode === 2) {
      const a = int(rand, 200, 999)
      const b = int(rand, 100, a)
      return { text: `${a} - ${b}`, result: String(a - b) }
    }
    if (mode === 3) {
      const a = int(rand, 11, 99)
      const b = int(rand, 2, 9)
      return { text: `${a} × ${b}`, result: String(a * b) }
    }
    const b = int(rand, 2, 9)
    const q = int(rand, 11, 99)
    return { text: `${b * q} ÷ ${b}`, result: String(q) }
  }

  if (grade === 4) {
    const mode = int(rand, 1, 4)
    if (mode === 1) {
      const a = int(rand, 100, 8999)
      const b = int(rand, 100, 9999 - a)
      return { text: `${a} + ${b}`, result: String(a + b) }
    }
    if (mode === 2) {
      const a = int(rand, 1000, 9999)
      const b = int(rand, 100, a)
      return { text: `${a} - ${b}`, result: String(a - b) }
    }
    if (mode === 3) {
      const a = int(rand, 11, 99)
      const b = int(rand, 11, 99)
      return { text: `${a} × ${b}`, result: String(a * b) }
    }
    const b = int(rand, 11, 99)
    const q = int(rand, 11, 99)
    return { text: `${b * q} ÷ ${b}`, result: String(q) }
  }

  if (grade === 5) {
    const mode = int(rand, 1, 4)
    if (mode === 1) {
      const a = int(rand, 1, 999)
      const b = int(rand, 1, 999)
      return { text: `${fmt(a / 100)} + ${fmt(b / 100)}`, result: fmt((a + b) / 100) }
    }
    if (mode === 2) {
      const a = int(rand, 100, 999)
      const b = int(rand, 1, a)
      return { text: `${fmt(a / 100)} - ${fmt(b / 100)}`, result: fmt((a - b) / 100) }
    }
    if (mode === 3) {
      const a = int(rand, 11, 99) / 10
      const b = int(rand, 11, 99) / 10
      return { text: `${fmt(a)} × ${fmt(b)}`, result: fmt(a * b) }
    }
    const divisor = int(rand, 2, 50) / 10
    const quotient = int(rand, 10, 100) / 10
    return {
      text: `${fmt(divisor * quotient)} ÷ ${fmt(divisor)}`,
      result: fmt(quotient)
    }
  }

  const mode = int(rand, 1, 4)
  const d1 = int(rand, 2, 12)
  const n1 = int(rand, 1, d1 - 1)
  const d2 = int(rand, 2, 12)
  const n2 = int(rand, 1, d2 - 1)
  if (mode === 1) {
    return {
      text: `${fracText(n1, d1)} + ${fracText(n2, d2)}`,
      result: fracText(n1 * d2 + n2 * d1, d1 * d2)
    }
  }
  if (mode === 2) {
    if (n1 / d1 < n2 / d2) {
      return {
        text: `${fracText(n2, d2)} - ${fracText(n1, d1)}`,
        result: fracText(n2 * d1 - n1 * d2, d1 * d2)
      }
    }
    return {
      text: `${fracText(n1, d1)} - ${fracText(n2, d2)}`,
      result: fracText(n1 * d2 - n2 * d1, d1 * d2)
    }
  }
  if (mode === 3) {
    return {
      text: `${fracText(n1, d1)} × ${fracText(n2, d2)}`,
      result: fracText(n1 * n2, d1 * d2)
    }
  }
  return {
    text: `${fracText(n1, d1)} ÷ ${fracText(n2, d2)}`,
    result: fracText(n1 * d2, d1 * n2)
  }
}

function buildExpressionPairs(
  grade: number,
  rand: () => number,
  pairCount: number
): { left: string[]; right: string[] } | null {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const exprs: Expr[] = []
    for (let i = 0; i < pairCount; i += 1) exprs.push(makeExpr(grade, rand))
    const texts = new Set(exprs.map((expr) => expr.text))
    const results = new Set(exprs.map((expr) => expr.result))
    if (texts.size === pairCount && results.size === pairCount) {
      return {
        left: exprs.map((expr) => expr.text),
        right: exprs.map((expr) => expr.result)
      }
    }
  }
  return null
}

function buildUnitPairs(
  grade: number,
  rand: () => number,
  pairCount: number
): { left: string[]; right: string[] } | null {
  const pool = CONVERSIONS.filter((conversion) => conversion.minGrade <= grade)
  if (pool.length < pairCount) return null
  const picked = shuffle(pool, rand).slice(0, pairCount)
  const left: string[] = []
  const right: string[] = []
  for (const conversion of picked) {
    const value = int(rand, 1, 20)
    left.push(`${value} ${conversion.from}`)
    right.push(`${value * conversion.factor} ${conversion.to}`)
  }
  if (new Set(left).size !== pairCount || new Set(right).size !== pairCount) return null
  return { left, right }
}

export function generateMathMatching(ctx: GeneratorContext): number {
  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  const pairCount = paramInt(ctx.options, 'pairCount', 4, 4, 6)
  let count = 0

  for (let grade = 1; grade <= 6; grade += 1) {
    if (!accepts(ctx.options, 'matching', grade)) continue
    const seen = new Set<string>()
    let generated = 0
    let attempts = 0
    while (generated < limit && attempts < MAX_ATTEMPTS) {
      attempts += 1
      const isExpression = generated % 2 === 0
      const pair = isExpression
        ? buildExpressionPairs(grade, rand, pairCount)
        : buildUnitPairs(grade, rand, pairCount)
      if (!pair) continue

      const stem = isExpression
        ? `把左边的算式与右边的结果连起来：${pair.left.join('，')}。`
        : `把左边的单位换算与右边的结果连起来：${pair.left.join('，')}。`
      if (seen.has(stem)) continue
      seen.add(stem)

      const right = shuffle(pair.right, rand)
      const answer: Record<string, string> = {}
      pair.left.forEach((text, index) => {
        answer[String(index)] = pair.right[index]
      })

      const inserted = ctx.insert({
        subject: '数学',
        grade,
        topic: isExpression ? '数与运算' : '单位与测量',
        type: 'matching',
        difficulty: difficultyOf(grade),
        stem,
        options: { left: pair.left, right },
        answer,
        solution: pair.left.map((text, index) => `${text} → ${pair.right[index]}`).join('；'),
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
