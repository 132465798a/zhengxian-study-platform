import type { GeneratorContext } from '../types'
import { accepts } from '../types'

const SOURCE = 'generator:unit'
const TOPIC = '单位换算'
const SEED = 20261104
const LIMIT = 250
const MAX_ATTEMPTS = 15000

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
  { from: '米', to: '分米', factor: 10, minGrade: 3 },
  { from: '分米', to: '厘米', factor: 10, minGrade: 3 },
  { from: '厘米', to: '毫米', factor: 10, minGrade: 3 },
  { from: '千米', to: '米', factor: 1000, minGrade: 3 },
  { from: '千克', to: '克', factor: 1000, minGrade: 3 },
  { from: '时', to: '分', factor: 60, minGrade: 3 },
  { from: '分', to: '秒', factor: 60, minGrade: 3 },
  { from: '吨', to: '千克', factor: 1000, minGrade: 5 },
  { from: '平方米', to: '平方分米', factor: 100, minGrade: 5 },
  { from: '平方分米', to: '平方厘米', factor: 100, minGrade: 5 },
  { from: '平方米', to: '平方厘米', factor: 10000, minGrade: 5 },
  { from: '立方米', to: '立方分米', factor: 1000, minGrade: 5 },
  { from: '立方分米', to: '立方厘米', factor: 1000, minGrade: 5 },
  { from: '立方米', to: '立方厘米', factor: 1000000, minGrade: 5 }
]

interface UnitItem {
  stem: string
  answer: number
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

function difficultyOf(grade: number): number {
  if (grade <= 2) return 1
  if (grade <= 4) return 2
  return 3
}

function buildItem(conversion: Conversion, rand: () => number, grade: number): UnitItem {
  if (rand() < 0.6) {
    const max = grade <= 2 ? 9 : conversion.factor >= 10000 ? 20 : conversion.factor >= 1000 ? 50 : 99
    const value = int(rand, 1, max)
    const answer = value * conversion.factor
    return {
      stem: `${value} ${conversion.from} = ____ ${conversion.to}`,
      answer,
      solution: `${value} ${conversion.from} = ${answer} ${conversion.to}`
    }
  }
  const answer = int(rand, 1, 20)
  const value = answer * conversion.factor
  return {
    stem: `${value} ${conversion.to} = ____ ${conversion.from}`,
    answer,
    solution: `${value} ${conversion.to} = ${answer} ${conversion.from}`
  }
}

export function generateUnit(ctx: GeneratorContext): number {
  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  let count = 0

  for (let grade = 1; grade <= 6; grade += 1) {
    if (!accepts(ctx.options, 'fill', grade)) continue
    const pool = CONVERSIONS.filter(
      (conversion) =>
        conversion.minGrade <= grade && (grade > 2 || conversion.factor <= 10)
    )
    const seen = new Set<string>()
    let generated = 0
    let attempts = 0
    while (generated < LIMIT && attempts < MAX_ATTEMPTS) {
      attempts += 1
      const conversion = pool[int(rand, 0, pool.length - 1)]
      const item = buildItem(conversion, rand, grade)
      if (seen.has(item.stem)) continue
      seen.add(item.stem)
      const inserted = ctx.insert({
        subject: '数学',
        grade,
        topic: TOPIC,
        type: 'fill',
        difficulty: difficultyOf(grade),
        stem: item.stem,
        answer: [String(item.answer)],
        solution: item.solution,
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
