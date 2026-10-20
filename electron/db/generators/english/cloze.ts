import { accepts } from '../types'
import type { GeneratorContext, GeneratedQuestion } from '../types'
import { numberParam } from './params'

const SOURCE = 'generator:english-cloze'
const TOPIC = '词汇'
const SEED = 20261205
const LIMIT = 120

interface WordRow {
  word: string
  grade: number
  meaning: string
  sentence: string | null
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

function int(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1))
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
  return grade <= 4 ? 2 : 3
}

function uniqueByWord(rows: WordRow[]): WordRow[] {
  const seen = new Set<string>()
  const result: WordRow[] = []
  for (const row of rows) {
    if (!row.word || !row.meaning || seen.has(row.word)) continue
    seen.add(row.word)
    result.push(row)
  }
  return result
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface BlankOccurrence {
  index: number
  length: number
  text: string
}

function buildSentenceCloze(row: WordRow, blankCount: number): GeneratedQuestion | null {
  const sentence = row.sentence?.trim()
  if (!sentence) return null
  const pattern = new RegExp(`\\b${escapeRegExp(row.word)}\\b`, 'i')
  const match = pattern.exec(sentence)
  if (!match) return null

  if (blankCount <= 1) {
    return {
      subject: '英语',
      grade: row.grade,
      topic: TOPIC,
      type: 'cloze',
      difficulty: difficultyOf(row.grade),
      stem: `补全句子：${sentence.replace(pattern, '___{1}')}（${row.meaning}）`,
      answer: [row.word],
      solution: `空格处应填 ${row.word}，意思是"${row.meaning}"。`,
      score: 2,
      source: SOURCE
    }
  }

  const blanks: BlankOccurrence[] = [
    { index: match.index, length: match[0].length, text: match[0] }
  ]
  const used = new Set([row.word.toLowerCase()])
  const candidates: BlankOccurrence[] = []
  for (const item of sentence.matchAll(/\b[A-Za-z]+(?:'[A-Za-z]+)?\b/g)) {
    const text = item[0]
    if (item.index === match.index) continue
    const key = text.toLowerCase()
    if (used.has(key)) continue
    used.add(key)
    candidates.push({ index: item.index ?? 0, length: text.length, text })
  }
  candidates.sort((a, b) => b.length - a.length || a.index - b.index)
  for (const candidate of candidates) {
    if (blanks.length >= blankCount) break
    blanks.push(candidate)
  }
  if (blanks.length < blankCount) return null

  blanks.sort((a, b) => a.index - b.index)
  let stem = ''
  let cursor = 0
  blanks.forEach((blank, index) => {
    stem += sentence.slice(cursor, blank.index) + `___{${index + 1}}`
    cursor = blank.index + blank.length
  })
  stem += sentence.slice(cursor)

  return {
    subject: '英语',
    grade: row.grade,
    topic: TOPIC,
    type: 'cloze',
    difficulty: difficultyOf(row.grade),
    stem: `补全句子：${stem}（${row.meaning}）`,
    answer: blanks.map((blank) => blank.text),
    solution: blanks
      .map((blank, index) => `第 ${index + 1} 空填 ${blank.text}`)
      .join('；') + `。`,
    score: 2,
    source: SOURCE
  }
}

function buildSpellingCloze(
  row: WordRow,
  rand: () => number,
  blankCount: number
): GeneratedQuestion | null {
  if (!/^[a-zA-Z]+$/.test(row.word) || row.word.length < 4) return null

  if (blankCount <= 1) {
    const size = row.word.length >= 5 ? int(rand, 1, 2) : 1
    const start = int(rand, 1, row.word.length - size - 1)
    const removed = row.word.slice(start, start + size)
    const masked = `${row.word.slice(0, start)}___{1}${row.word.slice(start + size)}`

    return {
      subject: '英语',
      grade: row.grade,
      topic: TOPIC,
      type: 'cloze',
      difficulty: difficultyOf(row.grade),
      stem: `根据中文补全单词：${row.meaning} → ${masked}`,
      answer: [removed],
      solution: `"${row.meaning}"的英语单词是 ${row.word}。`,
      score: 2,
      source: SOURCE
    }
  }

  const positions: number[] = []
  while (positions.length < blankCount) {
    const position = int(rand, 1, row.word.length - 2)
    if (!positions.includes(position)) positions.push(position)
  }
  positions.sort((a, b) => a - b)

  let masked = ''
  let cursor = 0
  positions.forEach((position, index) => {
    masked += row.word.slice(cursor, position) + `___{${index + 1}}`
    cursor = position + 1
  })
  masked += row.word.slice(cursor)

  return {
    subject: '英语',
    grade: row.grade,
    topic: TOPIC,
    type: 'cloze',
    difficulty: difficultyOf(row.grade),
    stem: `根据中文补全单词：${row.meaning} → ${masked}`,
    answer: positions.map((position) => row.word[position]),
    solution: `"${row.meaning}"的英语单词是 ${row.word}。`,
    score: 2,
    source: SOURCE
  }
}

export function generateEnglishCloze(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare('SELECT word, grade, meaning, sentence FROM ref_english_word ORDER BY grade, rowid')
    .all() as WordRow[]

  const groups = new Map<number, WordRow[]>()
  for (const row of rows) {
    if (!row.word || !row.meaning) continue
    const group = groups.get(row.grade)
    if (group) group.push(row)
    else groups.set(row.grade, [row])
  }

  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  const blankCount = numberParam(ctx.options, 'blankCount', 1, 1, 2)
  let count = 0

  for (const grade of [...groups.keys()].sort((a, b) => a - b)) {
    if (!accepts(ctx.options, 'cloze', grade)) continue
    const pool = uniqueByWord(groups.get(grade) ?? [])
    const seen = new Set<string>()
    let generated = 0

    for (const row of shuffle(pool, rand)) {
      if (generated >= limit) break
      const question =
        grade <= 2
          ? buildSpellingCloze(row, rand, blankCount)
          : buildSentenceCloze(row, blankCount)
      if (!question || seen.has(question.stem)) continue
      seen.add(question.stem)
      if (ctx.insert(question)) {
        generated += 1
        count += 1
      }
    }
  }

  return count
}
