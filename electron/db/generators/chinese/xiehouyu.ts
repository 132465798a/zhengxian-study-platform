import { accepts } from '../types'
import type { GeneratorContext } from '../types'

const SOURCE = 'generator:xiehouyu'
const TOPIC = '成语俗语'
const SEED = 20261025
const LIMIT = 2000

interface XiehouyuRow {
  id: number
  riddle: string
  answer: string
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

function gradeOf(id: number): number {
  return ((id - 1) % 6) + 1
}

export function generateXiehouyu(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare('SELECT rowid AS id, riddle, answer FROM ref_xiehouyu ORDER BY rowid')
    .all() as XiehouyuRow[]

  const groups = new Map<number, XiehouyuRow[]>()
  for (const row of rows) {
    if (!row.riddle || !row.answer) continue
    const grade = gradeOf(row.id)
    const group = groups.get(grade)
    if (group) group.push(row)
    else groups.set(grade, [row])
  }

  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  let count = 0

  for (const grade of [...groups.keys()].sort((a, b) => a - b)) {
    if (grade <= 2) continue
    if (!accepts(ctx.options, 'fill', grade)) continue
    let generated = 0
    for (const row of shuffle(groups.get(grade) ?? [], rand)) {
      if (generated >= limit) break
      const inserted = ctx.insert({
        subject: '语文',
        grade,
        topic: TOPIC,
        type: 'fill',
        difficulty: difficultyOf(grade),
        stem: `补全歇后语：${row.riddle}——____`,
        answer: [row.answer],
        solution: `${row.riddle}——${row.answer}`,
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
