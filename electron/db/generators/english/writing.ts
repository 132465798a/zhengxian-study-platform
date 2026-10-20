import { accepts } from '../types'
import type { GeneratorContext, GeneratedQuestion } from '../types'

const SOURCE = 'generator:english-writing'
const TOPIC = '书面表达'
const SEED = 20261209
const LIMIT = 80

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'am', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'to', 'of', 'in', 'on', 'at', 'my', 'your', 'his', 'her', 'this', 'that', 'and',
  'or', 'do', 'does', 'can', 'have', 'has', 'not', 'what', 'how'
])

interface WordRow {
  word: string
  grade: number
  meaning: string
  sentence: string | null
  sentence_zh: string | null
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

function keywordsOf(sentence: string): string[] {
  const tokens = sentence.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? []
  const seen = new Set<string>()
  const result: string[] = []
  for (const token of tokens) {
    const word = token.toLowerCase()
    if (word.length < 3 || STOP_WORDS.has(word) || seen.has(word)) continue
    seen.add(word)
    result.push(word)
    if (result.length === 3) break
  }
  return result
}

function buildWordQuestion(row: WordRow): GeneratedQuestion {
  return {
    subject: '英语',
    grade: row.grade,
    topic: TOPIC,
    type: 'short_answer',
    difficulty: difficultyOf(row.grade),
    stem: `请用英语写出：${row.meaning}`,
    answer: { reference: row.word, keywords: [row.word] },
    solution: `"${row.meaning}"的英语单词是 ${row.word}。`,
    score: 3,
    source: SOURCE
  }
}

function buildSentenceQuestion(row: WordRow): GeneratedQuestion | null {
  const sentence = row.sentence?.trim()
  const sentenceZh = row.sentence_zh?.trim()
  if (!sentence || !sentenceZh) return null

  const keywords = keywordsOf(sentence)
  if (keywords.length === 0) return null

  return {
    subject: '英语',
    grade: row.grade,
    topic: TOPIC,
    type: 'short_answer',
    difficulty: difficultyOf(row.grade),
    stem: `请把下面的句子翻译成英语：${sentenceZh}`,
    answer: { reference: sentence, keywords },
    solution: `参考译文：${sentence}`,
    score: 3,
    source: SOURCE
  }
}

export function generateEnglishWriting(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare(
      'SELECT word, grade, meaning, sentence, sentence_zh FROM ref_english_word ORDER BY grade, rowid'
    )
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
  let count = 0

  for (const grade of [...groups.keys()].sort((a, b) => a - b)) {
    if (!accepts(ctx.options, 'short_answer', grade)) continue
    const pool = uniqueByWord(groups.get(grade) ?? [])
    const seen = new Set<string>()
    let generated = 0

    for (const row of shuffle(pool, rand)) {
      if (generated >= limit) break
      const question = grade <= 2 ? buildWordQuestion(row) : buildSentenceQuestion(row)
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
