import type { GeneratorContext } from '../types'
import { accepts } from '../types'
import { makeOralItem } from './oral'

const SOURCE = 'generator:vertical'
const TOPIC = '竖式计算'
const SEED = 20261102
const LIMIT = 300
const MAX_ATTEMPTS = 12000

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

function difficultyOf(grade: number): number {
  if (grade <= 2) return 1
  if (grade <= 4) return 2
  return 3
}

export function generateVertical(ctx: GeneratorContext): number {
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
      const stem = `用竖式计算：${item.stem}`
      if (seen.has(stem)) continue
      seen.add(stem)
      const inserted = ctx.insert({
        subject: '数学',
        grade,
        topic: TOPIC,
        type: 'calculation',
        difficulty: difficultyOf(grade),
        stem,
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
