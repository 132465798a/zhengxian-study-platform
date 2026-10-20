import type { GeneratorContext } from '../types'
import { accepts } from '../types'

const SOURCE = 'generator:equation'
const TOPIC = '解方程'
const SEED = 20261103
const LIMIT = 300
const MAX_ATTEMPTS = 12000

interface EquationItem {
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

function buildInteger(rand: () => number): EquationItem {
  const mode = int(rand, 1, 3)
  if (mode === 1) {
    const a = int(rand, 1, 50)
    const answer = int(rand, 1, 40)
    const b = a + answer
    return {
      stem: `x + ${a} = ${b}`,
      answer,
      solution: `x = ${b} - ${a} = ${answer}`
    }
  }
  if (mode === 2) {
    const a = int(rand, 2, 9)
    const answer = int(rand, 1, 20)
    const b = a * answer
    return {
      stem: `${a}x = ${b}`,
      answer,
      solution: `x = ${b} ÷ ${a} = ${answer}`
    }
  }
  const a = int(rand, 2, 9)
  const answer = int(rand, 1, 20)
  const b = int(rand, 1, 50)
  const c = a * answer + b
  return {
    stem: `${a}x + ${b} = ${c}`,
    answer,
    solution: `x = (${c} - ${b}) ÷ ${a} = ${answer}`
  }
}

function buildDecimal(rand: () => number): EquationItem {
  const mode = int(rand, 1, 3)
  if (mode === 1) {
    const a = int(rand, 5, 95) / 10
    const answer = int(rand, 5, 95) / 10
    const b = Number((a + answer).toFixed(4))
    return {
      stem: `x + ${fmt(a)} = ${fmt(b)}`,
      answer: Number(answer.toFixed(4)),
      solution: `x = ${fmt(b)} - ${fmt(a)} = ${fmt(answer)}`
    }
  }
  if (mode === 2) {
    const a = int(rand, 2, 20) / 10
    const answer = int(rand, 5, 100) / 10
    const b = Number((a * answer).toFixed(4))
    return {
      stem: `${fmt(a)}x = ${fmt(b)}`,
      answer: Number(answer.toFixed(4)),
      solution: `x = ${fmt(b)} ÷ ${fmt(a)} = ${fmt(answer)}`
    }
  }
  const a = int(rand, 2, 20) / 10
  const answer = int(rand, 5, 100) / 10
  const b = int(rand, 1, 100) / 10
  const c = Number((a * answer + b).toFixed(4))
  return {
    stem: `${fmt(a)}x + ${fmt(b)} = ${fmt(c)}`,
    answer: Number(answer.toFixed(4)),
    solution: `x = (${fmt(c)} - ${fmt(b)}) ÷ ${fmt(a)} = ${fmt(answer)}`
  }
}

export function generateEquation(ctx: GeneratorContext): number {
  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  let count = 0

  for (const grade of [5, 6]) {
    if (!accepts(ctx.options, 'calculation', grade)) continue
    const seen = new Set<string>()
    let generated = 0
    let attempts = 0
    while (generated < LIMIT && attempts < MAX_ATTEMPTS) {
      attempts += 1
      const item = grade === 5 ? buildInteger(rand) : rand() < 0.5 ? buildInteger(rand) : buildDecimal(rand)
      if (seen.has(item.stem)) continue
      seen.add(item.stem)
      const inserted = ctx.insert({
        subject: '数学',
        grade,
        topic: TOPIC,
        type: 'calculation',
        difficulty: 3,
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
