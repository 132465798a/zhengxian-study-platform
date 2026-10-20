import { accepts, paramInt } from '../types'
import type { GeneratorContext } from '../types'
import { difficultyOf, groupBy, mulberry32, shuffle } from './common'

const SOURCE = 'generator:chinese-cloze'
const TOPIC = '古诗文'
const SEED = 20261031
const LIMIT = 200
const PER_POEM = 2

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
}

function stripPunct(text: string): string {
  return text.replace(/[^\u4e00-\u9fa5]/g, '')
}

function parseLines(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) return []
    return value.filter(
      (item): item is string => typeof item === 'string' && stripPunct(item).length >= 6
    )
  } catch {
    return []
  }
}

function charPositions(line: string): number[] {
  const positions: number[] = []
  for (let index = 0; index < line.length; index += 1) {
    if (/[\u4e00-\u9fa5]/.test(line[index])) positions.push(index)
  }
  return positions
}

interface BlankedLine {
  masked: string
  answers: string[]
}

function blankAt(
  line: string,
  positions: number[],
  position: number,
  blankCount: number
): BlankedLine | null {
  const first = line[position]
  if (!first) return null

  const picked = [position]
  const chars = [first]
  for (const other of positions) {
    if (picked.length >= blankCount) break
    if (picked.includes(other)) continue
    const char = line[other]
    if (!char || chars.includes(char)) continue
    picked.push(other)
    chars.push(char)
  }
  if (picked.length !== blankCount) return null

  const ordered = [...picked].sort((a, b) => a - b)
  const answers = ordered.map((index) => line[index])
  if (answers.some((char) => !char) || new Set(answers).size !== blankCount) return null

  let masked = ''
  let cursor = 0
  ordered.forEach((index, blankIndex) => {
    masked += `${line.slice(cursor, index)}___{${blankIndex + 1}}`
    cursor = index + 1
  })
  masked += line.slice(cursor)
  return { masked, answers }
}

export function generateChineseCloze(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare('SELECT title, author, grade, lines FROM ref_poem ORDER BY grade, rowid')
    .all() as PoemRow[]

  const poems: Poem[] = []
  const seenTitles = new Set<string>()
  for (const row of rows) {
    const title = row.title.trim()
    const author = row.author.trim()
    const lines = parseLines(row.lines)
    if (!title || !author || lines.length === 0) continue
    if (seenTitles.has(title)) continue
    seenTitles.add(title)
    poems.push({ title, author, grade: row.grade, lines })
  }

  const groups = groupBy(poems, (poem) => poem.grade)
  const grades = [...groups.keys()].sort((a, b) => a - b)
  if (grades.length === 0) return 0

  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  const blankCount = paramInt(ctx.options, 'blankCount', 1, 1, 2)
  const acceptedGrades = grades.filter((grade) => accepts(ctx.options, 'cloze', grade))
  if (acceptedGrades.length === 0) return 0
  const quota = Math.ceil(limit / acceptedGrades.length)
  let count = 0

  for (const grade of acceptedGrades) {
    let generated = 0
    for (const poem of shuffle(groups.get(grade) ?? [], rand)) {
      if (generated >= quota) break
      const line = shuffle(poem.lines, rand)[0]
      if (!line) continue
      const positions = shuffle(charPositions(line), rand)
      let made = 0
      for (const position of positions) {
        if (generated >= quota || made >= PER_POEM) break
        const blanked = blankAt(line, positions, position, blankCount)
        if (!blanked) continue
        const inserted = ctx.insert({
          subject: '语文',
          grade,
          topic: TOPIC,
          type: 'cloze',
          difficulty: difficultyOf(grade),
          stem: `读诗句，填空：${blanked.masked}（《${poem.title}》 ${poem.author}）`,
          answer: blanked.answers,
          solution: `《${poem.title}》${poem.author}：${line}`,
          score: 2,
          source: SOURCE
        })
        if (!inserted) continue
        generated += 1
        count += 1
        made += 1
      }
    }
  }

  return count
}
