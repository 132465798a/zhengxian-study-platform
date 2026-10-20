import { accepts } from '../types'
import type { GeneratedQuestion, GeneratorContext } from '../types'
import { difficultyOf, mulberry32, shuffle } from './common'

const SOURCE = 'generator:chinese-reading'
const TOPIC = '阅读理解'
const SEED = 20261219
const LIMIT = 30

interface PoemRow {
  title: string
  author: string
  grade: number
  lines: string
}

interface Poem {
  title: string
  author: string
  grade: number
  lines: string[]
  text: string
}

function parseLines(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) return []
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function optionKey(value: string): string {
  return value.replace(/\s+/g, '').replace(/[。．.，,；;！!？?、]+$/, '')
}

function pickAuthors(
  correct: string,
  pools: string[][],
  rand: () => number
): string[] {
  const used = new Set([correct])
  const result: string[] = []
  for (const pool of pools) {
    for (const name of shuffle(pool, rand)) {
      if (used.has(name)) continue
      used.add(name)
      result.push(name)
      if (result.length === 3) return result
    }
  }
  return result
}

function buildAuthorQuestion(
  poem: Poem,
  pools: string[][],
  rand: () => number
): GeneratedQuestion | null {
  const distractors = pickAuthors(poem.author, pools, rand)
  if (distractors.length < 3) return null

  const options = shuffle([poem.author, ...distractors], rand)
  return {
    subject: '语文',
    grade: poem.grade,
    topic: TOPIC,
    type: 'single',
    difficulty: difficultyOf(poem.grade),
    stem: `阅读古诗《${poem.title}》：${poem.text}这首诗的作者是？`,
    options,
    answer: options.indexOf(poem.author),
    solution: `《${poem.title}》的作者是${poem.author}。`,
    score: 2,
    source: SOURCE
  }
}

function buildLineQuestion(
  poem: Poem,
  linePools: string[][],
  variant: number,
  rand: () => number
): GeneratedQuestion | null {
  const correct = poem.lines[Math.floor(rand() * poem.lines.length)]
  if (!correct) return null

  const own = new Set(poem.lines.map(optionKey))
  const used = new Set([optionKey(correct)])
  const distractors: string[] = []
  for (const pool of linePools) {
    for (const line of shuffle(pool, rand)) {
      const key = optionKey(line)
      if (!key || own.has(key) || used.has(key)) continue
      used.add(key)
      distractors.push(line)
      if (distractors.length === 3) break
    }
    if (distractors.length === 3) break
  }
  if (distractors.length < 3) return null

  const options = shuffle([correct, ...distractors], rand)
  const intro = variant === 0 ? '阅读古诗' : '读一读古诗'
  return {
    subject: '语文',
    grade: poem.grade,
    topic: TOPIC,
    type: 'single',
    difficulty: difficultyOf(poem.grade),
    stem: `${intro}《${poem.title}》：${poem.text}下列诗句中，出自这首诗的是？`,
    options,
    answer: options.indexOf(correct),
    solution: `出自《${poem.title}》的诗句是"${correct}"。`,
    score: 2,
    source: SOURCE
  }
}

function pushQuestion(
  questions: GeneratedQuestion[],
  seen: Set<string>,
  question: GeneratedQuestion | null
): void {
  if (!question || seen.has(question.stem)) return
  seen.add(question.stem)
  questions.push(question)
}

export function generateChineseReading(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare('SELECT title, author, grade, lines FROM ref_poem ORDER BY grade, rowid')
    .all() as PoemRow[]

  const poems: Poem[] = []
  const seenTitles = new Set<string>()
  for (const row of rows) {
    const title = row.title.trim()
    const author = row.author.trim()
    if (!title || !author) continue
    const key = `${row.grade}|${title}`
    if (seenTitles.has(key)) continue
    const lines = parseLines(row.lines)
    if (lines.length === 0) continue
    seenTitles.add(key)
    poems.push({ title, author, grade: row.grade, lines, text: lines.join('') })
  }

  const poemsByGrade = new Map<number, Poem[]>()
  for (const poem of poems) {
    const list = poemsByGrade.get(poem.grade)
    if (list) list.push(poem)
    else poemsByGrade.set(poem.grade, [poem])
  }

  const allAuthors = [...new Set(poems.map((poem) => poem.author))]
  const allLines = [...new Set(poems.flatMap((poem) => poem.lines))]
  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  let count = 0

  for (let grade = 1; grade <= 6; grade += 1) {
    if (!accepts(ctx.options, 'single', grade)) continue
    const pool = shuffle(poemsByGrade.get(grade) ?? [], rand)
    if (pool.length === 0) continue

    const authorPool = [...new Set(pool.map((poem) => poem.author))]
    const authorPools = authorPool.length >= 4 ? [authorPool, allAuthors] : [allAuthors]
    const linePool = [...new Set(pool.flatMap((poem) => poem.lines))]
    const linePools = linePool.length >= 4 ? [linePool, allLines] : [allLines]

    const questions: GeneratedQuestion[] = []
    const seen = new Set<string>()
    for (const poem of pool) {
      if (questions.length >= limit) break
      pushQuestion(questions, seen, buildAuthorQuestion(poem, authorPools, rand))
      if (questions.length >= limit) break
      pushQuestion(questions, seen, buildLineQuestion(poem, linePools, 0, rand))
    }
    for (const poem of pool) {
      if (questions.length >= limit) break
      pushQuestion(questions, seen, buildLineQuestion(poem, linePools, 1, rand))
    }

    for (const question of questions) {
      if (ctx.insert(question)) count += 1
    }
  }

  return count
}
