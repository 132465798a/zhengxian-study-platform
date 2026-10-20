import { accepts, paramInt } from '../types'
import type { GeneratorContext } from '../types'

const SOURCE = 'generator:poem'
const TOPIC = '古诗文'
const SEED = 20261027

interface PoemRow {
  id: number
  title: string
  author: string
  dynasty: string | null
  grade: number
  lines: string
  difficulty: number
}

interface Poem {
  id: number
  title: string
  author: string
  dynasty: string
  grade: number
  lines: string[]
  difficulty: number
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

function clampDifficulty(value: number): number {
  return Math.min(3, Math.max(1, Math.round(value)))
}

function stripPunct(text: string): string {
  return text.replace(/[^\u4e00-\u9fa5]/g, '')
}

function parseLines(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) return []
    return value.filter(
      (item): item is string => typeof item === 'string' && stripPunct(item).length > 0
    )
  } catch {
    return []
  }
}

function solutionOf(poem: Poem): string {
  return `《${poem.title}》${poem.dynasty}·${poem.author}：${poem.lines.join('')}`
}

function buildFillQuestions(ctx: GeneratorContext, poem: Poem, max: number): number {
  let count = 0
  for (let index = 0; index < poem.lines.length - 1; index += 1) {
    if (count >= max) break
    const upper = poem.lines[index]
    const answer = stripPunct(poem.lines[index + 1])
    if (!upper || !answer) continue
    const inserted = ctx.insert({
      subject: '语文',
      grade: poem.grade,
      topic: TOPIC,
      type: 'fill',
      difficulty: clampDifficulty(poem.difficulty),
      stem: `补全诗句：${upper}____`,
      answer: [answer],
      solution: solutionOf(poem),
      score: 2,
      source: SOURCE
    })
    if (inserted) count += 1
  }
  return count
}

function buildJudgeQuestion(
  ctx: GeneratorContext,
  poem: Poem,
  pool: Poem[],
  rand: () => number,
  max: number
): number {
  if (max <= 0) return 0
  const authors = [...new Set(pool.map((item) => item.author).filter((name) => name && name !== poem.author))]
  if (!poem.author) return 0
  const trueRatio = paramInt(ctx.options, 'trueRatio', 50, 50, 70)
  const askWrong = authors.length > 0 && rand() * 100 >= trueRatio
  const present = askWrong ? authors[Math.floor(rand() * authors.length)] : poem.author
  const inserted = ctx.insert({
    subject: '语文',
    grade: poem.grade,
    topic: TOPIC,
    type: 'judge',
    difficulty: clampDifficulty(poem.difficulty),
    stem: `判断：《${poem.title}》的作者是${present}。`,
    options: ['正确', '错误'],
    answer: askWrong ? 1 : 0,
    solution: solutionOf(poem),
    score: 2,
    source: SOURCE
  })
  return inserted ? 1 : 0
}

function buildMatchingQuestions(
  ctx: GeneratorContext,
  poems: Poem[],
  rand: () => number,
  max: number
): number {
  let count = 0
  let group: Poem[] = []

  const flush = (): void => {
    if (group.length < 4 || count >= max) {
      group = []
      return
    }
    const titles = group.map((poem) => poem.title)
    const authors = group.map((poem) => poem.author)
    const answer: Record<string, string> = {}
    group.forEach((poem, index) => {
      answer[String(index)] = poem.author
    })
    const inserted = ctx.insert({
      subject: '语文',
      grade: group[0].grade,
      topic: TOPIC,
      type: 'matching',
      difficulty: clampDifficulty(group[0].difficulty),
      stem: `将下列古诗与作者连线：《${titles.join('》《')}》`,
      options: { left: titles, right: shuffle(authors, rand) },
      answer,
      solution: group.map((poem) => solutionOf(poem)).join('；'),
      score: 3,
      source: SOURCE
    })
    if (inserted) count += 1
    group = []
  }

  for (const poem of poems) {
    if (!poem.author || group.some((item) => item.author === poem.author)) continue
    group.push(poem)
    if (group.length === 4) flush()
  }

  return count
}

export function generatePoem(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare(
      `SELECT rowid AS id, title, author, dynasty, grade, lines, difficulty
       FROM ref_poem ORDER BY grade, rowid`
    )
    .all() as PoemRow[]

  const poems: Poem[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const lines = parseLines(row.lines)
    if (!row.title || !row.author || lines.length < 2) continue
    if (seen.has(row.title)) continue
    seen.add(row.title)
    poems.push({
      id: row.id,
      title: row.title,
      author: row.author,
      dynasty: row.dynasty ?? '',
      grade: row.grade,
      lines,
      difficulty: row.difficulty
    })
  }

  const groups = new Map<number, Poem[]>()
  for (const poem of poems) {
    const group = groups.get(poem.grade)
    if (group) group.push(poem)
    else groups.set(poem.grade, [poem])
  }

  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit
  let count = 0

  for (const grade of [...groups.keys()].sort((a, b) => a - b)) {
    const group = groups.get(grade) ?? []
    for (const poem of group) {
      if (limit !== undefined && count >= limit) break
      if (accepts(ctx.options, 'fill', grade)) {
        count += buildFillQuestions(
          ctx,
          poem,
          limit === undefined ? Infinity : Math.max(0, limit - count)
        )
      }
      if (limit !== undefined && count >= limit) break
      if (accepts(ctx.options, 'judge', grade)) {
        count += buildJudgeQuestion(
          ctx,
          poem,
          group,
          rand,
          limit === undefined ? Infinity : Math.max(0, limit - count)
        )
      }
    }
    if (
      accepts(ctx.options, 'matching', grade) &&
      (limit === undefined || count < limit)
    ) {
      count += buildMatchingQuestions(
        ctx,
        shuffle(group, rand),
        rand,
        limit === undefined ? Infinity : Math.max(0, limit - count)
      )
    }
  }

  return count
}
