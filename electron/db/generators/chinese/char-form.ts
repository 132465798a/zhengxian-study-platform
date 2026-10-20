import cnchar from 'cnchar'
import { accepts } from '../types'
import type { GeneratorContext } from '../types'
import { difficultyOf, mulberry32, shuffle } from './common'

const SOURCE = 'generator:chinese-char-form'
const TOPIC = '字形辨析'
const SEED = 20261103
const LIMIT = 60

interface HanziRow {
  char: string
  grade: number
}

function readingOf(char: string): string | null {
  const result = cnchar.spell(char, 'array', 'tone')
  if (!Array.isArray(result) || result.length === 0) return null
  const text = String(result[0]).trim().toLowerCase()
  return text.length > 0 ? text : null
}

export function generateChineseCharForm(ctx: GeneratorContext): number {
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
    if (!accepts(ctx.options, 'single', grade)) continue
    const pool = pools.get(grade) ?? []
    const readings = new Map<string, string>()
    const byReading = new Map<string, string[]>()
    for (const char of pool) {
      const reading = readingOf(char)
      if (!reading) continue
      readings.set(char, reading)
      const group = byReading.get(reading)
      if (group) group.push(char)
      else byReading.set(reading, [char])
    }

    const targets = shuffle(
      [...byReading.values()]
        .filter((group) => group.length >= 2)
        .flatMap((group) => shuffle(group, rand)),
      rand
    )

    let generated = 0
    for (const target of targets) {
      if (generated >= limit) break
      const targetReading = readings.get(target)
      if (!targetReading) continue
      const partner = (byReading.get(targetReading) ?? []).find((char) => char !== target)
      if (!partner) continue

      const distractors: string[] = []
      const usedReadings = new Set([targetReading])
      for (const candidate of shuffle(pool, rand)) {
        if (candidate === target) continue
        const reading = readings.get(candidate)
        if (!reading || usedReadings.has(reading)) continue
        usedReadings.add(reading)
        distractors.push(candidate)
        if (distractors.length === 3) break
      }
      if (distractors.length < 3) continue

      const options = shuffle([partner, ...distractors], rand)
      const inserted = ctx.insert({
        subject: '语文',
        grade,
        topic: TOPIC,
        type: 'single',
        difficulty: difficultyOf(grade),
        stem: `下列哪个字与“${target}”读音相同？`,
        options,
        answer: options.indexOf(partner),
        solution: `“${target}”和“${partner}”都读 ${targetReading}。`,
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
