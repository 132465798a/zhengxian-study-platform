import { accepts } from '../types'
import type { GeneratorContext } from '../types'
import { difficultyOf, mulberry32, shuffle } from './common'

const SOURCE = 'generator:chinese-short-answer'
const READING_TOPIC = '阅读理解'
const POEM_TOPIC = '古诗文'
const READING_LIMIT = 120
const RECITE_LIMIT = 300
const SEED = 20261111

interface IdiomRow {
  word: string
  explanation: string
}

interface PoemRow {
  title: string
  author: string
  grade: number
  lines: string
}

export function generateChineseShortAnswer(ctx: GeneratorContext): number {
  const idiomRows = ctx.db
    .prepare(
      `SELECT word, explanation FROM ref_idiom
       WHERE word IS NOT NULL AND word <> ''
         AND explanation IS NOT NULL AND explanation <> ''
       ORDER BY rowid`
    )
    .all() as IdiomRow[]

  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit
  const readingLimit = limit ?? READING_LIMIT
  let count = 0
  const seenStems = new Set<string>()
  let readingCount = 0
  const readingGrades = [4, 5, 6].filter((grade) => accepts(ctx.options, 'short_answer', grade))

  for (const row of shuffle(idiomRows, rand)) {
    if (readingCount >= readingLimit || readingGrades.length === 0) break
    const word = row.word.trim()
    const explanation = row.explanation.trim()
    if (!word || !explanation || /[\r\n]/.test(explanation)) continue
    if (explanation.includes(word)) continue
    const length = explanation.replace(/\s+/g, '').length
    if (length < 6 || length > 40) continue

    const stem = `读一读下面的释义，写出对应的成语：${explanation}`
    if (seenStems.has(stem)) continue
    seenStems.add(stem)

    const grade = readingGrades[readingCount % readingGrades.length]
    const inserted = ctx.insert({
      subject: '语文',
      grade,
      topic: READING_TOPIC,
      type: 'short_answer',
      difficulty: difficultyOf(grade),
      stem,
      answer: { reference: word, keywords: [word] },
      solution: `这个释义对应的成语是"${word}"。`,
      score: 3,
      source: SOURCE
    })
    if (!inserted) continue
    readingCount += 1
    count += 1
  }

  const poemRows = ctx.db
    .prepare('SELECT title, author, grade, lines FROM ref_poem ORDER BY grade, rowid')
    .all() as PoemRow[]
  const seenTitles = new Set<string>()
  let reciting = 0
  const reciteLimit = limit ?? RECITE_LIMIT

  for (const row of poemRows) {
    if (limit !== undefined && count >= limit) break
    const title = row.title.trim()
    const author = row.author.trim()
    if (!title || !author || seenTitles.has(title)) continue
    seenTitles.add(title)
    if (!accepts(ctx.options, 'short_answer', row.grade)) continue

    const inserted = ctx.insert({
      subject: '语文',
      grade: row.grade,
      topic: POEM_TOPIC,
      type: 'short_answer',
      difficulty: difficultyOf(row.grade),
      stem: `《${title}》的作者是谁？`,
      answer: { reference: author, keywords: [author] },
      solution: `《${title}》的作者是${author}。`,
      score: 3,
      source: SOURCE
    })
    if (inserted) count += 1

    const lines = parseLines(row.lines)
    for (let index = 0; index < lines.length - 1; index += 1) {
      if (reciting >= reciteLimit || (limit !== undefined && count >= limit)) break
      const current = lines[index]
      const next = lines[index + 1]
      const key = next.split(/[，。；！？]/)[0]?.trim() ?? ''
      if (!current || !next || !key) continue

      const written = ctx.insert({
        subject: '语文',
        grade: row.grade,
        topic: POEM_TOPIC,
        type: 'short_answer',
        difficulty: difficultyOf(row.grade),
        stem: `读诗句，补写下一句：${current}`,
        answer: { reference: next, keywords: [key] },
        solution: `《${title}》：${next}`,
        score: 3,
        source: SOURCE
      })
      if (written) {
        reciting += 1
        count += 1
      }
    }
  }

  return count
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
