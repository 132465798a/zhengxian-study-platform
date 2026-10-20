import { accepts } from '../types'
import type { GeneratorContext } from '../types'

const SOURCE = 'generator:idiom'
const TOPIC = '成语俗语'
const SEED = 20261022
const KIND_LIMIT = 1000

interface IdiomRow {
  id: number
  word: string
  pinyin: string
  explanation: string
  freq: number
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

/** 从池中从随机起点顺序取 count 个互不相同且不在 exclude 里的值 */
function pickDistinct(
  pool: string[],
  exclude: Set<string>,
  count: number,
  rand: () => number
): string[] {
  const picked: string[] = []
  if (pool.length === 0) return picked
  const start = Math.floor(rand() * pool.length)
  for (let step = 0; step < pool.length && picked.length < count; step += 1) {
    const value = pool[(start + step) % pool.length]
    if (exclude.has(value)) continue
    exclude.add(value)
    picked.push(value)
  }
  return picked
}

function buildFill(ctx: GeneratorContext, row: IdiomRow, grade: number, rand: () => number): boolean {
  const position = Math.floor(rand() * row.word.length)
  const char = row.word[position]
  if (!char) return false
  const stem = `补全成语：${row.word.slice(0, position)}____${row.word.slice(position + 1)}`
  return ctx.insert({
    subject: '语文',
    grade,
    topic: TOPIC,
    type: 'fill',
    difficulty: difficultyOf(grade),
    stem,
    answer: [char],
    solution: `成语是"${row.word}"。`,
    score: 2,
    source: SOURCE
  })
}

function buildMeaning(
  ctx: GeneratorContext,
  row: IdiomRow,
  grade: number,
  explanations: string[],
  rand: () => number
): boolean {
  const distractors = pickDistinct(
    explanations,
    new Set([row.explanation]),
    3,
    rand
  )
  if (distractors.length < 3) return false

  const options = shuffle([row.explanation, ...distractors], rand)
  return ctx.insert({
    subject: '语文',
    grade,
    topic: TOPIC,
    type: 'single',
    difficulty: difficultyOf(grade),
    stem: `"${row.word}"的意思是？`,
    options,
    answer: options.indexOf(row.explanation),
    solution: `"${row.word}"的意思是：${row.explanation}`,
    score: 2,
    source: SOURCE
  })
}

function buildSpelling(
  ctx: GeneratorContext,
  row: IdiomRow,
  grade: number,
  pinyins: string[],
  rand: () => number
): boolean {
  const distractors = pickDistinct(pinyins, new Set([row.pinyin]), 3, rand)
  if (distractors.length < 3) return false

  const options = shuffle([row.pinyin, ...distractors], rand)
  return ctx.insert({
    subject: '语文',
    grade,
    topic: TOPIC,
    type: 'single',
    difficulty: difficultyOf(grade),
    stem: `"${row.word}"的读音是？`,
    options,
    answer: options.indexOf(row.pinyin),
    solution: `"${row.word}"的读音是 ${row.pinyin}。`,
    score: 2,
    source: SOURCE
  })
}

export function generateIdiom(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare(
      `SELECT rowid AS id, word, pinyin, explanation, freq FROM ref_idiom
       WHERE length(word) = 4 AND pinyin IS NOT NULL AND pinyin <> ''
         AND explanation IS NOT NULL AND explanation <> ''
       ORDER BY rowid`
    )
    .all() as IdiomRow[]

  const groups = new Map<number, IdiomRow[]>()
  for (const row of rows) {
    const grade = gradeOf(row.id)
    const group = groups.get(grade)
    if (group) group.push(row)
    else groups.set(grade, [row])
  }

  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? KIND_LIMIT
  const totalLimit = ctx.options?.limit
  let count = 0

  for (const grade of [...groups.keys()].sort((a, b) => a - b)) {
    if (grade <= 2) continue
    const fillAllowed = accepts(ctx.options, 'fill', grade)
    const singleAllowed = accepts(ctx.options, 'single', grade)
    if (!fillAllowed && !singleAllowed) continue

    const entries = shuffle(
      (groups.get(grade) ?? []).filter(
        (item) => item.freq !== null && item.freq <= (grade <= 4 ? 5000 : 10000)
      ),
      rand
    )
    const explanations = [...new Set(entries.map((item) => item.explanation))]
    const pinyins = [...new Set(entries.map((item) => item.pinyin))]
    const limits = [limit, limit, limit]
    const counts = [0, 0, 0]
    const kinds: number[] = []
    if (fillAllowed) kinds.push(0)
    if (singleAllowed) kinds.push(1, 2)

    for (let index = 0; index < entries.length; index += 1) {
      if (totalLimit !== undefined && count >= totalLimit) break
      if (counts.every((value, kind) => value >= limits[kind])) break
      let position = index % kinds.length
      let kind = kinds[position]
      for (let attempt = 0; attempt < kinds.length && counts[kind] >= limits[kind]; attempt += 1) {
        position = (position + 1) % kinds.length
        kind = kinds[position]
      }
      if (counts[kind] >= limits[kind]) continue

      const row = entries[index]
      const inserted =
        kind === 0
          ? buildFill(ctx, row, grade, rand)
          : kind === 1
            ? buildMeaning(ctx, row, grade, explanations, rand)
            : buildSpelling(ctx, row, grade, pinyins, rand)
      if (inserted) {
        counts[kind] += 1
        count += 1
      }
    }
  }

  return count
}
