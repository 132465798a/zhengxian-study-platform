import cnchar from 'cnchar'
import poly from 'cnchar-poly'
import { accepts } from '../types'
import type { GeneratorContext } from '../types'

cnchar.use(poly)

const SOURCE = 'generator:pinyin'
const TOPIC = '拼音'
const SEED = 20261018
const PINYIN_LIMIT = 200
const POLY_LIMIT = 100

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

function pinyinOf(char: string): string | null {
  const result = cnchar.spell(char, 'array', 'tone')
  if (!Array.isArray(result) || result.length === 0) return null
  const text = String(result[0]).trim().toLowerCase()
  return text.length > 0 ? text : null
}

/** 返回该字的全部读音；长度大于 1 即为多音字 */
function readingsOf(char: string): string[] {
  const result = cnchar.spell(char, 'array', 'poly')
  if (!Array.isArray(result) || result.length === 0) return []
  return String(result[0])
    .replace(/[()]/g, '')
    .split('|')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function buildPinyinQuestion(
  ctx: GeneratorContext,
  grade: number,
  char: string,
  pinyin: string,
  pool: string[],
  readings: Map<string, string>,
  rand: () => number
): boolean {
  const distractors: string[] = []
  for (const candidate of shuffle(pool, rand)) {
    if (candidate === char) continue
    const candidatePinyin = readings.get(candidate)
    if (!candidatePinyin || candidatePinyin === pinyin) continue
    distractors.push(candidate)
    if (distractors.length === 3) break
  }
  if (distractors.length < 3) return false

  const options = shuffle([char, ...distractors], rand)
  return ctx.insert({
    subject: '语文',
    grade,
    topic: TOPIC,
    type: 'single',
    difficulty: difficultyOf(grade),
    stem: `下列哪个字的拼音是 "${pinyin}"？`,
    options,
    answer: options.indexOf(char),
    solution: `"${char}"的拼音是 ${pinyin}。`,
    score: 2,
    source: SOURCE
  })
}

function buildPolyQuestion(
  ctx: GeneratorContext,
  grade: number,
  char: string,
  monos: string[],
  rand: () => number
): boolean {
  const distractors = shuffle(monos, rand).slice(0, 3)
  if (distractors.length < 3) return false

  const options = shuffle([char, ...distractors], rand)
  return ctx.insert({
    subject: '语文',
    grade,
    topic: TOPIC,
    type: 'single',
    difficulty: difficultyOf(grade),
    stem: '下列哪个字的读音不唯一？',
    options,
    answer: options.indexOf(char),
    solution: `"${char}"是多音字。`,
    score: 2,
    source: SOURCE
  })
}

export function generatePinyin(ctx: GeneratorContext): number {
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
  const pinyinLimit = ctx.options?.limit ?? PINYIN_LIMIT
  const polyLimit = ctx.options?.limit ?? POLY_LIMIT
  let count = 0

  for (const grade of [...pools.keys()].sort((a, b) => a - b)) {
    if (!accepts(ctx.options, 'single', grade)) continue
    const pool = pools.get(grade) ?? []
    const readings = new Map<string, string>()
    const monos: string[] = []
    const polys: string[] = []
    for (const char of pool) {
      const pinyin = pinyinOf(char)
      if (pinyin) readings.set(char, pinyin)
      if (readingsOf(char).length > 1) polys.push(char)
      else monos.push(char)
    }

    const usedPinyin = new Set<string>()
    let pinyinCount = 0
    for (const char of shuffle(pool, rand)) {
      if (pinyinCount >= pinyinLimit) break
      const pinyin = readings.get(char)
      if (!pinyin || usedPinyin.has(pinyin)) continue
      usedPinyin.add(pinyin)
      if (buildPinyinQuestion(ctx, grade, char, pinyin, pool, readings, rand)) {
        pinyinCount += 1
        count += 1
      }
    }

    let polyCount = 0
    for (const char of shuffle(polys, rand)) {
      if (polyCount >= polyLimit) break
      if (buildPolyQuestion(ctx, grade, char, monos, rand)) {
        polyCount += 1
        count += 1
      }
    }
  }

  return count
}
