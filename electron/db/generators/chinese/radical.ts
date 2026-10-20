import cnchar from 'cnchar'
import radical from 'cnchar-radical'
import { accepts } from '../types'
import type { GeneratorContext } from '../types'

cnchar.use(radical)

const SOURCE = 'generator:radical'
const TOPIC = '偏旁部首'
const SEED = 20261020
const LIMIT = 150

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

function radicalOf(char: string): string | null {
  const result = cnchar.radical(char)
  if (!Array.isArray(result) || result.length === 0) return null
  const name = result[0]?.radical
  return name && name.length > 0 ? name : null
}

export function generateRadical(ctx: GeneratorContext): number {
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
    const radicals = new Map<string, string>()
    for (const char of pool) {
      const name = radicalOf(char)
      // 独体字的部首就是它本身，这类题没有辨析价值
      if (name && name !== char) radicals.set(char, name)
    }
    const radicalNames = [...new Set(radicals.values())]
    if (radicalNames.length < 4) continue

    const usedRadicals = new Set<string>()
    let generated = 0
    for (const char of shuffle(pool, rand)) {
      if (generated >= limit) break
      const name = radicals.get(char)
      if (!name || usedRadicals.has(name)) continue

      const distractors = shuffle(
        radicalNames.filter((value) => value !== name),
        rand
      ).slice(0, 3)
      if (distractors.length < 3) continue

      const options = shuffle([name, ...distractors], rand)
      const inserted = ctx.insert({
        subject: '语文',
        grade,
        topic: TOPIC,
        type: 'single',
        difficulty: difficultyOf(grade),
        stem: `下列哪个是"${char}"字的部首？`,
        options,
        answer: options.indexOf(name),
        solution: `"${char}"的部首是"${name}"。`,
        score: 2,
        source: SOURCE
      })
      if (inserted) {
        usedRadicals.add(name)
        generated += 1
        count += 1
      }
    }
  }

  return count
}
