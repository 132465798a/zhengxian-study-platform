import type { GeneratorContext } from '../types'
import { accepts } from '../types'

const SOURCE = 'generator:math-judge'
const SEED = 20261018
const LIMIT = 250
const MAX_ATTEMPTS = 20000

interface JudgeItem {
  text: string
  topic: string
  solution: string
}

interface Conversion {
  from: string
  to: string
  factor: number
  minGrade: number
}

interface Concept {
  trueText: string
  falseText: string
  topic: string
  minGrade: number
}

const CONVERSIONS: Conversion[] = [
  { from: '元', to: '角', factor: 10, minGrade: 1 },
  { from: '角', to: '分', factor: 10, minGrade: 1 },
  { from: '元', to: '分', factor: 100, minGrade: 1 },
  { from: '米', to: '厘米', factor: 100, minGrade: 1 },
  { from: '米', to: '分米', factor: 10, minGrade: 2 },
  { from: '分米', to: '厘米', factor: 10, minGrade: 3 },
  { from: '厘米', to: '毫米', factor: 10, minGrade: 3 },
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

const CONCEPTS: Concept[] = [
  { trueText: '1 米 = 100 厘米', falseText: '1 米 = 10 厘米', topic: '单位与测量', minGrade: 1 },
  { trueText: '1 千克 = 1000 克', falseText: '1 千克 = 100 克', topic: '单位与测量', minGrade: 3 },
  { trueText: '1 时 = 60 分', falseText: '1 时 = 100 分', topic: '单位与测量', minGrade: 3 },
  { trueText: '1 千米 = 1000 米', falseText: '1 千米 = 100 米', topic: '单位与测量', minGrade: 3 },
  { trueText: '1 平方米 = 100 平方分米', falseText: '1 平方米 = 10 平方分米', topic: '单位与测量', minGrade: 5 },
  { trueText: '1 立方分米 = 1000 立方厘米', falseText: '1 立方分米 = 100 立方厘米', topic: '单位与测量', minGrade: 5 },
  { trueText: '直角是 90 度', falseText: '直角是 180 度', topic: '图形与几何', minGrade: 2 },
  { trueText: '平角是 180 度', falseText: '平角是 90 度', topic: '图形与几何', minGrade: 4 },
  { trueText: '周角是 360 度', falseText: '周角是 180 度', topic: '图形与几何', minGrade: 4 },
  { trueText: '三角形内角和是 180 度', falseText: '三角形内角和是 360 度', topic: '图形与几何', minGrade: 4 },
  { trueText: '四边形内角和是 360 度', falseText: '四边形内角和是 180 度', topic: '图形与几何', minGrade: 4 },
  { trueText: '长方形有 2 条对称轴', falseText: '长方形有 4 条对称轴', topic: '图形与几何', minGrade: 3 },
  { trueText: '正方形有 4 条对称轴', falseText: '正方形有 2 条对称轴', topic: '图形与几何', minGrade: 3 },
  { trueText: '等边三角形有 3 条对称轴', falseText: '等边三角形有 1 条对称轴', topic: '图形与几何', minGrade: 4 },
  { trueText: '等腰三角形有 1 条对称轴', falseText: '等腰三角形有 2 条对称轴', topic: '图形与几何', minGrade: 4 },
  { trueText: '圆有无数条对称轴', falseText: '圆只有 1 条对称轴', topic: '图形与几何', minGrade: 4 },
  { trueText: '0 不能作除数', falseText: '0 可以作除数', topic: '数与运算', minGrade: 3 }
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

function fmt(value: number): string {
  return String(Number(value.toFixed(4)))
}

function difficultyOf(grade: number): number {
  if (grade <= 2) return 1
  if (grade <= 4) return 2
  return 3
}

function shownResult(value: number, wantTrue: boolean, rand: () => number): number {
  if (wantTrue) return value
  const offset = int(rand, 1, 2)
  return value - offset >= 0 ? value - offset : value + offset
}

function numericStatement(grade: number, wantTrue: boolean, rand: () => number): JudgeItem {
  if (grade <= 1) {
    if (rand() < 0.5) {
      const a = int(rand, 0, 19)
      const b = int(rand, 0, 20 - a)
      const shown = shownResult(a + b, wantTrue, rand)
      return {
        text: `${a} + ${b} = ${shown}`,
        topic: '数与运算',
        solution: `${a} + ${b} = ${a + b}`
      }
    }
    const a = int(rand, 0, 20)
    const b = int(rand, 0, a)
    const shown = shownResult(a - b, wantTrue, rand)
    return {
      text: `${a} - ${b} = ${shown}`,
      topic: '数与运算',
      solution: `${a} - ${b} = ${a - b}`
    }
  }

  if (grade <= 2) {
    const mode = int(rand, 1, 4)
    if (mode === 1) {
      const a = int(rand, 10, 89)
      const b = int(rand, 1, 100 - a)
      const shown = shownResult(a + b, wantTrue, rand)
      return {
        text: `${a} + ${b} = ${shown}`,
        topic: '数与运算',
        solution: `${a} + ${b} = ${a + b}`
      }
    }
    if (mode === 2) {
      const a = int(rand, 20, 100)
      const b = int(rand, 1, a)
      const shown = shownResult(a - b, wantTrue, rand)
      return {
        text: `${a} - ${b} = ${shown}`,
        topic: '数与运算',
        solution: `${a} - ${b} = ${a - b}`
      }
    }
    if (mode === 3) {
      const a = int(rand, 2, 9)
      const b = int(rand, 2, 9)
      const shown = shownResult(a * b, wantTrue, rand)
      return {
        text: `${a} × ${b} = ${shown}`,
        topic: '数与运算',
        solution: `${a} × ${b} = ${a * b}`
      }
    }
    const b = int(rand, 2, 9)
    const q = int(rand, 2, 9)
    const shown = shownResult(q, wantTrue, rand)
    return {
      text: `${b * q} ÷ ${b} = ${shown}`,
      topic: '数与运算',
      solution: `${b * q} ÷ ${b} = ${q}`
    }
  }

  if (grade <= 4) {
    const mode = int(rand, 1, 4)
    if (mode === 1) {
      const a = int(rand, 100, 899)
      const b = int(rand, 100, 999 - a)
      const shown = shownResult(a + b, wantTrue, rand)
      return {
        text: `${a} + ${b} = ${shown}`,
        topic: '数与运算',
        solution: `${a} + ${b} = ${a + b}`
      }
    }
    if (mode === 2) {
      const a = int(rand, 200, 999)
      const b = int(rand, 100, a)
      const shown = shownResult(a - b, wantTrue, rand)
      return {
        text: `${a} - ${b} = ${shown}`,
        topic: '数与运算',
        solution: `${a} - ${b} = ${a - b}`
      }
    }
    if (mode === 3) {
      const a = int(rand, 11, 99)
      const b = int(rand, 2, 9)
      const shown = shownResult(a * b, wantTrue, rand)
      return {
        text: `${a} × ${b} = ${shown}`,
        topic: '数与运算',
        solution: `${a} × ${b} = ${a * b}`
      }
    }
    const b = int(rand, 2, 9)
    const q = int(rand, 11, 99)
    const shown = shownResult(q, wantTrue, rand)
    return {
      text: `${b * q} ÷ ${b} = ${shown}`,
      topic: '数与运算',
      solution: `${b * q} ÷ ${b} = ${q}`
    }
  }

  if (rand() < 0.5) {
    const a = int(rand, 1, 99) / 10
    const b = int(rand, 1, 99) / 10
    const shown = shownResult(Number((a + b).toFixed(4)), wantTrue, rand)
    return {
      text: `${fmt(a)} + ${fmt(b)} = ${fmt(shown)}`,
      topic: '数与运算',
      solution: `${fmt(a)} + ${fmt(b)} = ${fmt(a + b)}`
    }
  }
  const a = int(rand, 20, 99) / 10
  const b = int(rand, 1, Math.round(a * 10)) / 10
  const shown = shownResult(Number((a - b).toFixed(4)), wantTrue, rand)
  return {
    text: `${fmt(a)} - ${fmt(b)} = ${fmt(shown)}`,
    topic: '数与运算',
    solution: `${fmt(a)} - ${fmt(b)} = ${fmt(a - b)}`
  }
}

function unitStatement(grade: number, wantTrue: boolean, rand: () => number): JudgeItem {
  const pool = CONVERSIONS.filter((conversion) => conversion.minGrade <= grade)
  const conversion = pool[int(rand, 0, pool.length - 1)]
  const value = int(rand, 1, 20)
  const actual = value * conversion.factor
  const shown = shownResult(actual, wantTrue, rand)
  return {
    text: `${value} ${conversion.from} = ${shown} ${conversion.to}`,
    topic: '单位与测量',
    solution: `${value} ${conversion.from} = ${actual} ${conversion.to}`
  }
}

function conceptStatement(grade: number, wantTrue: boolean, rand: () => number): JudgeItem {
  const pool = CONCEPTS.filter((concept) => concept.minGrade <= grade)
  const concept = pool[int(rand, 0, pool.length - 1)]
  return {
    text: wantTrue ? concept.trueText : concept.falseText,
    topic: concept.topic,
    solution: concept.trueText
  }
}

export function generateMathJudge(ctx: GeneratorContext): number {
  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  const ratioRaw = Number(ctx.options?.params?.trueRatio)
  const useRatio = Number.isFinite(ratioRaw) && ratioRaw >= 0 && ratioRaw <= 100
  let count = 0

  for (let grade = 1; grade <= 6; grade += 1) {
    if (!accepts(ctx.options, 'judge', grade)) continue
    const seen = new Set<string>()
    let generated = 0
    let attempts = 0
    while (generated < limit && attempts < MAX_ATTEMPTS) {
      attempts += 1
      const wantTrue = useRatio ? rand() * 100 < ratioRaw : generated % 2 === 0
      const kind = rand()
      const item =
        kind < 0.5
          ? numericStatement(grade, wantTrue, rand)
          : kind < 0.75
            ? unitStatement(grade, wantTrue, rand)
            : conceptStatement(grade, wantTrue, rand)
      const stem = `判断：${item.text}。`
      if (seen.has(stem)) continue
      seen.add(stem)
      const inserted = ctx.insert({
        subject: '数学',
        grade,
        topic: item.topic,
        type: 'judge',
        difficulty: difficultyOf(grade),
        stem,
        options: ['正确', '错误'],
        answer: wantTrue ? 0 : 1,
        solution: wantTrue ? `这个说法正确：${item.solution}。` : `这个说法错误：${item.solution}。`,
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
