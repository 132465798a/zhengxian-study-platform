import type { GeneratorContext } from '../types'
import { accepts } from '../types'

const SOURCE = 'generator:oral'
const TOPIC = '口算'
const SEED = 20261101
const LIMIT = 800
const MAX_ATTEMPTS = 30000

export interface OralItem {
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

function fmt(value: number): string {
  return String(Number(value.toFixed(4)))
}

function difficultyOf(grade: number): number {
  if (grade <= 2) return 1
  if (grade <= 4) return 2
  return 3
}

function buildGrade1(rand: () => number): OralItem {
  const mode = rand()
  if (mode < 0.35) {
    const a = int(rand, 0, 19)
    const b = int(rand, 0, 20 - a)
    return { stem: `${a} + ${b} = ____`, answer: a + b, solution: `${a} + ${b} = ${a + b}` }
  }
  if (mode < 0.7) {
    const a = int(rand, 0, 20)
    const b = int(rand, 0, a)
    return { stem: `${a} - ${b} = ____`, answer: a - b, solution: `${a} - ${b} = ${a - b}` }
  }
  if (mode < 0.85) {
    const a = int(rand, 0, 19)
    const total = int(rand, a, 20)
    return {
      stem: `${a} + ____ = ${total}`,
      answer: total - a,
      solution: `${total} - ${a} = ${total - a}`
    }
  }
  const b = int(rand, 0, 19)
  const result = int(rand, 0, 20 - b)
  return {
    stem: `____ - ${b} = ${result}`,
    answer: b + result,
    solution: `${b} + ${result} = ${b + result}`
  }
}

function buildGrade2(rand: () => number): OralItem {
  const mode = rand()
  if (mode < 0.2) {
    const a = int(rand, 10, 90)
    const b = int(rand, 1, 100 - a)
    return { stem: `${a} + ${b} = ____`, answer: a + b, solution: `${a} + ${b} = ${a + b}` }
  }
  if (mode < 0.4) {
    const a = int(rand, 10, 100)
    const b = int(rand, 1, a)
    return { stem: `${a} - ${b} = ____`, answer: a - b, solution: `${a} - ${b} = ${a - b}` }
  }
  if (mode < 0.7) {
    const a = int(rand, 1, 9)
    const b = int(rand, 1, 9)
    return { stem: `${a} × ${b} = ____`, answer: a * b, solution: `${a} × ${b} = ${a * b}` }
  }
  const b = int(rand, 1, 9)
  const q = int(rand, 1, 9)
  return { stem: `${b * q} ÷ ${b} = ____`, answer: q, solution: `${b * q} ÷ ${b} = ${q}` }
}

function buildGrade3(rand: () => number): OralItem {
  const mode = rand()
  if (mode < 0.25) {
    const a = int(rand, 100, 800)
    const b = int(rand, 100, 999 - a)
    return { stem: `${a} + ${b} = ____`, answer: a + b, solution: `${a} + ${b} = ${a + b}` }
  }
  if (mode < 0.5) {
    const a = int(rand, 200, 999)
    const b = int(rand, 100, a)
    return { stem: `${a} - ${b} = ____`, answer: a - b, solution: `${a} - ${b} = ${a - b}` }
  }
  if (mode < 0.75) {
    const a = int(rand, 10, 99)
    const b = int(rand, 2, 9)
    return { stem: `${a} × ${b} = ____`, answer: a * b, solution: `${a} × ${b} = ${a * b}` }
  }
  const b = int(rand, 2, 9)
  const q = int(rand, 11, 99)
  return { stem: `${b * q} ÷ ${b} = ____`, answer: q, solution: `${b * q} ÷ ${b} = ${q}` }
}

function buildGrade4(rand: () => number): OralItem {
  if (rand() < 0.5) {
    const a = int(rand, 10, 99)
    const b = int(rand, 10, 99)
    return { stem: `${a} × ${b} = ____`, answer: a * b, solution: `${a} × ${b} = ${a * b}` }
  }
  const b = int(rand, 10, 99)
  const q = int(rand, 2, 20)
  return { stem: `${b * q} ÷ ${b} = ____`, answer: q, solution: `${b * q} ÷ ${b} = ${q}` }
}

function buildGrade5(rand: () => number): OralItem {
  const mode = rand()
  if (mode < 0.25) {
    const scale = rand() < 0.5 ? 10 : 100
    const a = int(rand, 1, scale - 1)
    const b = int(rand, 1, scale - 1)
    const answer = Number(((a + b) / scale).toFixed(4))
    return {
      stem: `${fmt(a / scale)} + ${fmt(b / scale)} = ____`,
      answer,
      solution: `${fmt(a / scale)} + ${fmt(b / scale)} = ${fmt(answer)}`
    }
  }
  if (mode < 0.5) {
    const scale = rand() < 0.5 ? 10 : 100
    let a = int(rand, 1, scale - 1)
    let b = int(rand, 1, scale - 1)
    if (a < b) {
      const temp = a
      a = b
      b = temp
    }
    const answer = Number(((a - b) / scale).toFixed(4))
    return {
      stem: `${fmt(a / scale)} - ${fmt(b / scale)} = ____`,
      answer,
      solution: `${fmt(a / scale)} - ${fmt(b / scale)} = ${fmt(answer)}`
    }
  }
  if (mode < 0.75) {
    const a = int(rand, 1, 99) / 10
    if (rand() < 0.5) {
      const b = int(rand, 2, 9)
      const answer = Number((a * b).toFixed(4))
      return { stem: `${fmt(a)} × ${b} = ____`, answer, solution: `${fmt(a)} × ${b} = ${fmt(answer)}` }
    }
    const b = int(rand, 1, 99) / 10
    const answer = Number((a * b).toFixed(4))
    return { stem: `${fmt(a)} × ${fmt(b)} = ____`, answer, solution: `${fmt(a)} × ${fmt(b)} = ${fmt(answer)}` }
  }
  const divisor = int(rand, 2, 50) / 10
  const quotient = int(rand, 10, 100) / 10
  const dividend = Number((divisor * quotient).toFixed(4))
  return {
    stem: `${fmt(dividend)} ÷ ${fmt(divisor)} = ____`,
    answer: Number(quotient.toFixed(4)),
    solution: `${fmt(dividend)} ÷ ${fmt(divisor)} = ${fmt(quotient)}`
  }
}

const DENOMINATORS = [2, 4, 5, 8, 10, 20, 25, 50]

function buildGrade6(rand: () => number): OralItem {
  const mode = rand()
  if (mode < 0.4) {
    const d = DENOMINATORS[int(rand, 0, DENOMINATORS.length - 1)]
    if (rand() < 0.5) {
      const a = int(rand, 1, d - 1)
      const b = int(rand, 1, d - a)
      const answer = Number(((a + b) / d).toFixed(4))
      return {
        stem: `${a}/${d} + ${b}/${d} = ____（填小数）`,
        answer,
        solution: `${a}/${d} + ${b}/${d} = ${fmt(answer)}`
      }
    }
    const a = int(rand, 2, d - 1)
    const b = int(rand, 1, a - 1)
    const answer = Number(((a - b) / d).toFixed(4))
    return {
      stem: `${a}/${d} - ${b}/${d} = ____（填小数）`,
      answer,
      solution: `${a}/${d} - ${b}/${d} = ${fmt(answer)}`
    }
  }
  if (mode < 0.8) {
    const first = int(rand, 0, DENOMINATORS.length - 1)
    let second = int(rand, 0, DENOMINATORS.length - 1)
    if (second === first) second = (first + 1) % DENOMINATORS.length
    const d1 = DENOMINATORS[first]
    const d2 = DENOMINATORS[second]
    const a = int(rand, 1, d1 - 1)
    const b = int(rand, 1, d2 - 1)
    if (rand() < 0.5) {
      const answer = Number((a / d1 + b / d2).toFixed(4))
      return {
        stem: `${a}/${d1} + ${b}/${d2} = ____（填小数）`,
        answer,
        solution: `${a}/${d1} + ${b}/${d2} = ${fmt(answer)}`
      }
    }
    let leftN = a
    let leftD = d1
    let rightN = b
    let rightD = d2
    if (leftN / leftD < rightN / rightD) {
      leftN = b
      leftD = d2
      rightN = a
      rightD = d1
    }
    const answer = Number((leftN / leftD - rightN / rightD).toFixed(4))
    return {
      stem: `${leftN}/${leftD} - ${rightN}/${rightD} = ____（填小数）`,
      answer,
      solution: `${leftN}/${leftD} - ${rightN}/${rightD} = ${fmt(answer)}`
    }
  }
  if (rand() < 0.5) {
    const a = int(rand, 1, 90)
    const b = int(rand, 1, 100 - a)
    const answer = (a + b) / 100
    return {
      stem: `${a}% + ${b}% = ____（填小数）`,
      answer,
      solution: `${a}% + ${b}% = ${a + b}% = ${fmt(answer)}`
    }
  }
  const a = int(rand, 2, 100)
  const b = int(rand, 1, a)
  const answer = (a - b) / 100
  return {
    stem: `${a}% - ${b}% = ____（填小数）`,
    answer,
    solution: `${a}% - ${b}% = ${a - b}% = ${fmt(answer)}`
  }
}

export function makeOralItem(grade: number, rand: () => number): OralItem {
  if (grade <= 1) return buildGrade1(rand)
  if (grade === 2) return buildGrade2(rand)
  if (grade === 3) return buildGrade3(rand)
  if (grade === 4) return buildGrade4(rand)
  if (grade === 5) return buildGrade5(rand)
  return buildGrade6(rand)
}

export function generateOral(ctx: GeneratorContext): number {
  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  let count = 0

  for (let grade = 1; grade <= 6; grade += 1) {
    if (!accepts(ctx.options, 'calculation', grade)) continue
    const seen = new Set<string>()
    let generated = 0
    let attempts = 0
    while (generated < LIMIT && attempts < MAX_ATTEMPTS) {
      attempts += 1
      const item = makeOralItem(grade, rand)
      if (seen.has(item.stem)) continue
      seen.add(item.stem)
      const inserted = ctx.insert({
        subject: '数学',
        grade,
        topic: TOPIC,
        type: 'calculation',
        difficulty: difficultyOf(grade),
        stem: item.stem,
        answer: item.answer,
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
