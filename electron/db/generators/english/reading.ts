import { accepts } from '../types'
import type { GeneratorContext, GeneratedQuestion } from '../types'
import { numberParam } from './params'

const SOURCE = 'generator:english-reading'
const TOPIC = '阅读理解'
const SEED = 20261207
const LIMIT = 80

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

function optionKey(value: string): string {
  return value.replace(/\s+/g, '').replace(/[。．.，,；;！!？?、]+$/, '').toLowerCase()
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

const FUNCTION_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'am', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'to', 'of', 'in', 'on', 'at', 'my', 'your', 'his', 'her', 'this', 'that', 'and',
  'or', 'do', 'does', 'can', 'have', 'has', 'not', 'what', 'how', 'so', 'some',
  'for', 'too', 'very', 'where', 'now', 'yes', 'no', 'let', 'would', 'sure'
])

const VERBS = new Set([
  'see', 'listen', 'hear', 'smell', 'taste', 'help', 'stand', 'like', 'ride', 'skip',
  'play', 'fly', 'make', 'write', 'fold', 'tell', 'lie', 'run', 'swim', 'look', 'work',
  'sleep', 'pick', 'climb', 'cut', 'cry', 'feel', 'touch', 'guess', 'open', 'watch',
  'blow', 'tie', 'want', 'eat', 'stop', 'wait', 'go', 'come', 'put', 'skip', 'sing',
  'read', 'draw', 'jump', 'walk', 'talk', 'take', 'give', 'get', 'use', 'live'
])

/** 低年级阅读短文只保留可自然放进句子的名词，避免出现 "Look at the swim" 这类病句 */
function isNounLike(row: WordRow): boolean {
  const word = row.word.trim().toLowerCase()
  if (!/^[a-z]+$/.test(word) || word.length < 3) return false
  if (FUNCTION_WORDS.has(word) || VERBS.has(word) || word.endsWith('ing')) return false
  const meaning = row.meaning.trim()
  if (/[的地得了]$/.test(meaning)) return false
  if (/^(是|在|不|很|非常|太|这么|怎么样)/.test(meaning)) return false
  return true
}

function distinctMeanings(
  pool: WordRow[],
  correct: string,
  rand: () => number,
  count: number
): string[] {
  const used = new Set([optionKey(correct)])
  const result: string[] = []
  for (const row of shuffle(pool, rand)) {
    const value = row.meaning.trim()
    if (!value || used.has(optionKey(value))) continue
    used.add(optionKey(value))
    result.push(value)
    if (result.length === count) break
  }
  return result
}

function buildQuestion(
  grade: number,
  passage: string,
  word: string,
  meaning: string,
  pool: WordRow[],
  rand: () => number,
  optionCount: number
): GeneratedQuestion | null {
  const correct = meaning.trim()
  const choices = distinctMeanings(pool, correct, rand, optionCount - 1)
  if (choices.length < optionCount - 1) return null

  const options = shuffle([correct, ...choices], rand)
  return {
    subject: '英语',
    grade,
    topic: TOPIC,
    type: 'single',
    difficulty: difficultyOf(grade),
    stem: `阅读短文，回答问题：\n${passage}\n短文中“${word}”的意思是？`,
    options,
    answer: options.indexOf(correct),
    solution: `“${word}”在短文中的意思是"${correct}"。`,
    score: 2,
    source: SOURCE
  }
}

function buildSentenceReading(
  row: WordRow,
  pool: WordRow[],
  rand: () => number,
  optionCount: number
): GeneratedQuestion | null {
  const sentence = row.sentence?.trim()
  if (!sentence || !row.sentence_zh?.trim()) return null
  const pattern = new RegExp(`\\b${row.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  if (!pattern.test(sentence)) return null

  const partners = pool.filter(
    (item) => item !== row && item.sentence?.trim() && item.sentence_zh?.trim()
  )
  if (partners.length === 0) return null

  const partner = partners[int(rand, 0, partners.length - 1)]
  const passage = `${sentence} ${partner.sentence?.trim() ?? ''}`.trim()
  return buildQuestion(row.grade, passage, row.word, row.meaning, pool, rand, optionCount)
}

function buildWordReading(
  row: WordRow,
  pool: WordRow[],
  rand: () => number,
  optionCount: number
): GeneratedQuestion | null {
  if (!isNounLike(row)) return null

  const word = row.word.trim().toLowerCase()
  const passage = `Look at the ${word}. I like it.`
  return buildQuestion(row.grade, passage, row.word, row.meaning, pool, rand, optionCount)
}

export function generateEnglishReading(ctx: GeneratorContext): number {
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
  const optionCount = numberParam(ctx.options, 'optionCount', 4, 3, 4)
  let count = 0

  for (const grade of [...groups.keys()].sort((a, b) => a - b)) {
    if (!accepts(ctx.options, 'single', grade)) continue
    const pool = uniqueByWord(groups.get(grade) ?? [])
    const candidates = grade <= 2
      ? pool.filter(isNounLike)
      : pool.filter((row) => row.sentence?.trim() && row.sentence_zh?.trim())
    const seen = new Set<string>()
    let generated = 0

    for (const row of shuffle(candidates, rand)) {
      if (generated >= limit) break
      const question = grade <= 2
        ? buildWordReading(row, pool, rand, optionCount)
        : buildSentenceReading(row, pool, rand, optionCount)
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
