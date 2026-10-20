import cnchar from 'cnchar'
import order from 'cnchar-order'
import { accepts, paramInt } from '../types'
import type { GeneratorContext } from '../types'
import { strokeGlyphOf } from './stroke-glyph'

cnchar.use(order)

const SOURCE = 'generator:stroke'
const TOPIC = '笔顺笔画'
const SEED = 20261019
const LIMIT = 200

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

function strokeNames(char: string): string[] {
  const raw = cnchar.stroke(char, 'order', 'name')
  if (!Array.isArray(raw) || raw.length === 0) return []
  const first = raw[0]
  const list = Array.isArray(first) ? first : raw
  return list
    .map((item) => String(item).split('|')[0].replace(/\d+$/, '').trim())
    .filter((item) => item.length > 0)
}

export function generateStroke(ctx: GeneratorContext): number {
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
  const trueRatio = paramInt(ctx.options, 'trueRatio', 50, 50, 70)
  let count = 0

  for (const grade of [...pools.keys()].sort((a, b) => a - b)) {
    if (!accepts(ctx.options, 'judge', grade)) continue
    let generated = 0
    for (const char of shuffle(pools.get(grade) ?? [], rand)) {
      if (generated >= limit) break
      const names = strokeNames(char)
      if (names.length === 0) continue
      const first = strokeGlyphOf(names[0])
      if (!first) continue
      const glyphs: string[] = []
      for (const name of names) {
        const glyph = strokeGlyphOf(name)
        if (!glyph) break
        glyphs.push(glyph)
      }

      const wrongGlyphs = [...new Set(glyphs.filter((glyph) => glyph !== first))]
      const askWrong = wrongGlyphs.length > 0 && rand() * 100 >= trueRatio
      const present = askWrong ? wrongGlyphs[Math.floor(rand() * wrongGlyphs.length)] : first

      const inserted = ctx.insert({
        subject: '语文',
        grade,
        topic: TOPIC,
        type: 'judge',
        difficulty: difficultyOf(grade),
        stem: `判断："${char}"字的第一笔是"${present}"。`,
        options: ['正确', '错误'],
        answer: askWrong ? 1 : 0,
        solution: `"${char}"的笔顺是：${glyphs.join('、')}。`,
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
