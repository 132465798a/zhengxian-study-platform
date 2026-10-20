import cnchar from 'cnchar'
import order from 'cnchar-order'
import { accepts, paramInt } from '../types'
import type { GeneratedQuestion, GeneratorContext } from '../types'
import { difficultyOf, mulberry32, shuffle } from './common'
import { toStrokeGlyphs } from './stroke-glyph'

cnchar.use(order)

const SOURCE = 'generator:chinese-sorting'
const SEED = 20261018
const LIMIT = 250

interface HanziRow {
  char: string
  grade: number
}

interface PoemRow {
  title: string
  grade: number
  lines: string
}

interface ClauseWindow {
  title: string
  clauses: string[]
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

function parseClauses(raw: string): string[] {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(value)) return []
  const clauses: string[] = []
  for (const line of value) {
    if (typeof line !== 'string') continue
    for (const part of line.split(/[，,]/)) {
      const text = part.replace(/^[^\u4e00-\u9fa5]+|[^\u4e00-\u9fa5]+$/g, '')
      if (text) clauses.push(text)
    }
  }
  return clauses
}

function buildStrokeQuestions(
  chars: HanziRow[],
  grade: number,
  target: number,
  itemCount: number,
  rand: () => number,
  seen: Set<string>
): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = []
  for (const row of chars) {
    if (questions.length >= target) break
    const names = strokeNames(row.char)
    if (names.length < itemCount) continue
    const glyphs = toStrokeGlyphs(names.slice(0, itemCount))
    if (!glyphs) continue
    const correct = glyphs
    if (new Set(correct).size < itemCount) continue

    let options: string[] | null = null
    for (let attempt = 0; attempt < 12 && !options; attempt += 1) {
      const candidate = shuffle(correct, rand)
      if (candidate.join('|') !== correct.join('|')) options = candidate
    }
    if (!options) continue

    const stem = `请按正确笔顺排列"${row.char}"字的前 ${itemCount} 笔：`
    if (seen.has(stem)) continue
    seen.add(stem)
    questions.push({
      subject: '语文',
      grade,
      topic: '笔顺笔画',
      type: 'sorting',
      difficulty: difficultyOf(grade),
      stem,
      options,
      answer: correct,
      solution: `"${row.char}"字前 ${itemCount} 笔的笔顺是：${glyphs.join('、')}。`,
      score: 3,
      source: SOURCE
    })
  }
  return questions
}

function poemWindows(rows: PoemRow[], itemCount: number): ClauseWindow[] {
  const windows: ClauseWindow[] = []
  for (const row of rows) {
    const clauses = parseClauses(row.lines)
    for (let start = 0; start + itemCount <= clauses.length; start += 1) {
      const window = clauses.slice(start, start + itemCount)
      if (new Set(window).size !== itemCount) continue
      windows.push({ title: row.title, clauses: window })
    }
  }
  return windows
}

function buildPoemQuestions(
  windows: ClauseWindow[],
  grade: number,
  target: number,
  rand: () => number,
  seen: Set<string>
): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = []
  const shuffled = shuffle(windows, rand)
  for (let index = 0; index < shuffled.length; index += 1) {
    const window = shuffled[index]
    if (questions.length >= target) break
    const sentenceMode = index % 2 === 0
    let made = 0
    for (let attempt = 0; attempt < 40 && made < 10; attempt += 1) {
      const options = shuffle(window.clauses, rand)
      if (options.join('|') === window.clauses.join('|')) continue
      const stem = sentenceMode
        ? `把下面的句子排成通顺的一段话：${options.join(' / ')}`
        : `把《${window.title}》中的诗句按正确顺序排列：${options.join(' / ')}`
      if (seen.has(stem)) continue
      seen.add(stem)
      questions.push({
        subject: '语文',
        grade,
        topic: sentenceMode ? '句子与修辞' : '古诗文',
        type: 'sorting',
        difficulty: difficultyOf(grade),
        stem,
        options,
        answer: window.clauses,
        solution: `《${window.title}》：${window.clauses.join('，')}。`,
        score: 3,
        source: SOURCE
      })
      made += 1
    }
  }
  return questions
}

export function generateSorting(ctx: GeneratorContext): number {
  const hanzi = ctx.db
    .prepare('SELECT char, grade FROM ref_hanzi ORDER BY grade, rowid')
    .all() as HanziRow[]
  const poems = ctx.db
    .prepare('SELECT title, grade, lines FROM ref_poem ORDER BY grade, rowid')
    .all() as PoemRow[]

  const hanziByGrade = new Map<number, HanziRow[]>()
  for (const row of hanzi) {
    const list = hanziByGrade.get(row.grade)
    if (list) list.push(row)
    else hanziByGrade.set(row.grade, [row])
  }
  const poemsByGrade = new Map<number, PoemRow[]>()
  for (const row of poems) {
    const list = poemsByGrade.get(row.grade)
    if (list) list.push(row)
    else poemsByGrade.set(row.grade, [row])
  }

  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  const itemCount = paramInt(ctx.options, 'itemCount', 4, 4, 6)
  const half = Math.ceil(limit / 2)
  let count = 0

  for (let grade = 1; grade <= 6; grade += 1) {
    if (!accepts(ctx.options, 'sorting', grade)) continue
    const seen = new Set<string>()
    const strokeQuestions = buildStrokeQuestions(
      shuffle(hanziByGrade.get(grade) ?? [], rand),
      grade,
      limit - half,
      itemCount,
      rand,
      seen
    )
    const poemQuestions = buildPoemQuestions(
      poemWindows(poemsByGrade.get(grade) ?? [], itemCount),
      grade,
      half,
      rand,
      seen
    )

    const total = Math.min(limit, strokeQuestions.length + poemQuestions.length)
    let strokeIndex = 0
    let poemIndex = 0
    for (let index = 0; index < total; index += 1) {
      let question: GeneratedQuestion | undefined
      if (index % 2 === 0 && strokeIndex < strokeQuestions.length) {
        question = strokeQuestions[strokeIndex++]
      } else if (poemIndex < poemQuestions.length) {
        question = poemQuestions[poemIndex++]
      } else if (strokeIndex < strokeQuestions.length) {
        question = strokeQuestions[strokeIndex++]
      }
      if (question && ctx.insert(question)) count += 1
    }
  }

  return count
}
