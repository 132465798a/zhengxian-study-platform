import { accepts } from '../types'
import type { GeneratorContext } from '../types'
import { difficultyOf, gradeOf, groupBy, mulberry32, shuffle } from './common'

const SOURCE = 'generator:chinese-writing'
const TOPIC = '习作'
const SEED = 20261102
const LIMIT = 40

interface ClassifierRow {
  id: number
  noun: string
}

export function generateChineseWriting(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare('SELECT rowid AS id, noun FROM ref_classifier ORDER BY rowid')
    .all() as ClassifierRow[]

  const groups = groupBy(rows, (row) => gradeOf(row.id))
  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  const maxAttempts = limit * 10
  let count = 0

  for (const grade of [...groups.keys()].sort((a, b) => a - b)) {
    if (!accepts(ctx.options, 'short_answer', grade)) continue
    const pool = [
      ...new Set(
        (groups.get(grade) ?? [])
          .map((row) => row.noun.trim())
          .filter((noun) => /^[\u4e00-\u9fa5]{2,4}$/.test(noun))
      )
    ]
    if (pool.length < 3) continue

    const seen = new Set<string>()
    let generated = 0
    let attempts = 0

    while (generated < limit && attempts < maxAttempts) {
      attempts += 1
      const picks = shuffle(pool, rand).slice(0, 3).sort()
      const [a, b, c] = picks
      if (!a || !b || !c) continue
      const stem = `请用“${a}”“${b}”“${c}”写一两句通顺的话。`
      if (seen.has(stem)) continue
      seen.add(stem)

      const reference = `我喜欢${a}，也喜欢${b}，还喜欢${c}。`
      const inserted = ctx.insert({
        subject: '语文',
        grade,
        topic: TOPIC,
        type: 'short_answer',
        difficulty: difficultyOf(grade),
        stem,
        answer: {
          reference,
          keywords: [a, b, c]
        },
        solution: `参考：${reference}`,
        score: 3,
        source: SOURCE
      })
      if (!inserted) continue
      generated += 1
      count += 1
    }
  }

  return count
}
