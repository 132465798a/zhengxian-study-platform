import type { GeneratorContext } from '../types'
import { accepts, paramInt } from '../types'

const SOURCE = 'generator:math-multiple'
const TOPIC = '数与运算'
const SEED = 20261018
const LIMIT = 250
const MAX_ATTEMPTS = 20000

interface Expr {
  text: string
  result: string
  wrong(offset: number): string
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

function decimalExpr(text: string, value: number): Expr {
  const normalized = Number(value.toFixed(4))
  return {
    text,
    result: fmt(normalized),
    wrong(offset: number): string {
      const sign = normalized - offset >= 0 ? -1 : 1
      return fmt(normalized + sign * offset)
    }
  }
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

function simplify(n: number, d: number): { n: number; d: number } {
  const g = gcd(n, d)
  return { n: n / g, d: d / g }
}

function fracText(value: { n: number; d: number }): string {
  return value.d === 1 ? String(value.n) : `${value.n}/${value.d}`
}

function fractionExpr(text: string, n: number, d: number): Expr {
  const value = simplify(n, d)
  return {
    text,
    result: fracText(value),
    wrong(offset: number): string {
      const sign = value.n - offset * value.d > 0 ? -1 : 1
      return fracText(simplify(value.n + sign * offset * value.d, value.d))
    }
  }
}

function makeFraction(rand: () => number): { n: number; d: number } {
  const d = int(rand, 2, 12)
  return simplify(int(rand, 1, d - 1), d)
}

function makeExpr(grade: number, rand: () => number): Expr {
  if (grade <= 1) {
    if (rand() < 0.5) {
      const a = int(rand, 0, 19)
      const b = int(rand, 0, 20 - a)
      return decimalExpr(`${a} + ${b}`, a + b)
    }
    const a = int(rand, 0, 20)
    const b = int(rand, 0, a)
    return decimalExpr(`${a} - ${b}`, a - b)
  }

  if (grade === 2) {
    const mode = int(rand, 1, 4)
    if (mode === 1) {
      const a = int(rand, 10, 89)
      const b = int(rand, 1, 100 - a)
      return decimalExpr(`${a} + ${b}`, a + b)
    }
    if (mode === 2) {
      const a = int(rand, 20, 100)
      const b = int(rand, 1, a)
      return decimalExpr(`${a} - ${b}`, a - b)
    }
    if (mode === 3) {
      const a = int(rand, 2, 9)
      const b = int(rand, 2, 9)
      return decimalExpr(`${a} × ${b}`, a * b)
    }
    const b = int(rand, 2, 9)
    const q = int(rand, 2, 9)
    return decimalExpr(`${b * q} ÷ ${b}`, q)
  }

  if (grade === 3) {
    const mode = int(rand, 1, 4)
    if (mode === 1) {
      const a = int(rand, 100, 899)
      const b = int(rand, 100, 999 - a)
      return decimalExpr(`${a} + ${b}`, a + b)
    }
    if (mode === 2) {
      const a = int(rand, 200, 999)
      const b = int(rand, 100, a)
      return decimalExpr(`${a} - ${b}`, a - b)
    }
    if (mode === 3) {
      const a = int(rand, 11, 99)
      const b = int(rand, 2, 9)
      return decimalExpr(`${a} × ${b}`, a * b)
    }
    const b = int(rand, 2, 9)
    const q = int(rand, 11, 99)
    return decimalExpr(`${b * q} ÷ ${b}`, q)
  }

  if (grade === 4) {
    const mode = int(rand, 1, 4)
    if (mode === 1) {
      const a = int(rand, 100, 8999)
      const b = int(rand, 100, 9999 - a)
      return decimalExpr(`${a} + ${b}`, a + b)
    }
    if (mode === 2) {
      const a = int(rand, 1000, 9999)
      const b = int(rand, 100, a)
      return decimalExpr(`${a} - ${b}`, a - b)
    }
    if (mode === 3) {
      const a = int(rand, 11, 99)
      const b = int(rand, 11, 99)
      return decimalExpr(`${a} × ${b}`, a * b)
    }
    const b = int(rand, 11, 99)
    const q = int(rand, 11, 99)
    return decimalExpr(`${b * q} ÷ ${b}`, q)
  }

  if (grade === 5) {
    const mode = int(rand, 1, 4)
    if (mode === 1) {
      const a = int(rand, 1, 999)
      const b = int(rand, 1, 999)
      return decimalExpr(`${fmt(a / 100)} + ${fmt(b / 100)}`, (a + b) / 100)
    }
    if (mode === 2) {
      const a = int(rand, 100, 999)
      const b = int(rand, 1, a)
      return decimalExpr(`${fmt(a / 100)} - ${fmt(b / 100)}`, (a - b) / 100)
    }
    if (mode === 3) {
      const a = int(rand, 11, 99) / 10
      const b = int(rand, 11, 99) / 10
      return decimalExpr(`${fmt(a)} × ${fmt(b)}`, a * b)
    }
    const divisor = int(rand, 2, 50) / 10
    const quotient = int(rand, 10, 100) / 10
    return decimalExpr(
      `${fmt(divisor * quotient)} ÷ ${fmt(divisor)}`,
      Number(quotient.toFixed(4))
    )
  }

  const a = makeFraction(rand)
  const b = makeFraction(rand)
  const mode = int(rand, 1, 4)
  if (mode === 1) {
    return fractionExpr(
      `${fracText(a)} + ${fracText(b)}`,
      a.n * b.d + b.n * a.d,
      a.d * b.d
    )
  }
  if (mode === 2) {
    if (a.n / a.d < b.n / b.d) {
      return fractionExpr(
        `${fracText(b)} - ${fracText(a)}`,
        b.n * a.d - a.n * b.d,
        a.d * b.d
      )
    }
    return fractionExpr(
      `${fracText(a)} - ${fracText(b)}`,
      a.n * b.d - b.n * a.d,
      a.d * b.d
    )
  }
  if (mode === 3) {
    return fractionExpr(`${fracText(a)} × ${fracText(b)}`, a.n * b.n, a.d * b.d)
  }
  return fractionExpr(`${fracText(a)} ÷ ${fracText(b)}`, a.n * b.d, a.d * b.n)
}

interface MultipleItem {
  stem: string
  options: string[]
  answer: number[]
  solution: string
}

function buildQuestion(
  grade: number,
  rand: () => number,
  correctCount: number,
  optionCount: number
): MultipleItem | null {
  const correct: Expr[] = []
  for (let i = 0; i < correctCount; i += 1) correct.push(makeExpr(grade, rand))
  const wrong: Expr[] = []
  for (let i = 0; i < optionCount - correctCount; i += 1) wrong.push(makeExpr(grade, rand))
  const used = new Set<string>()
  const correctTexts = new Set<string>()
  const options: string[] = []

  for (const expr of correct) {
    const text = `${expr.text} = ${expr.result}`
    if (used.has(text)) return null
    used.add(text)
    correctTexts.add(text)
    options.push(text)
  }

  for (const expr of wrong) {
    const text = `${expr.text} = ${expr.wrong(int(rand, 1, 2))}`
    if (used.has(text)) return null
    used.add(text)
    options.push(text)
  }

  const shuffled = shuffle(options, rand)
  const answer = shuffled
    .map((text, index) => (correctTexts.has(text) ? index : -1))
    .filter((index) => index >= 0)
  if (answer.length !== correctCount) return null

  return {
    stem: '下列计算结果正确的有（ ）。',
    options: shuffled,
    answer,
    solution: `正确的算式是：${[...correctTexts].join('，')}。`
  }
}

export function generateMathMultiple(ctx: GeneratorContext): number {
  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  const optionCount = paramInt(ctx.options, 'optionCount', 4, 4, 5)
  const correctCount = paramInt(ctx.options, 'correctCount', 2, 2, Math.min(3, optionCount))
  let count = 0

  for (let grade = 1; grade <= 6; grade += 1) {
    if (!accepts(ctx.options, 'multiple', grade)) continue
    const seen = new Set<string>()
    let generated = 0
    let attempts = 0
    while (generated < limit && attempts < MAX_ATTEMPTS) {
      attempts += 1
      const item = buildQuestion(grade, rand, correctCount, optionCount)
      if (!item) continue
      const key = `${item.stem}|${item.options.join('|')}`
      if (seen.has(key)) continue
      seen.add(key)
      const inserted = ctx.insert({
        subject: '数学',
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
