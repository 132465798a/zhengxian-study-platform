import { accepts } from '../types'
import type { GeneratorContext } from '../types'
import { numberParam } from './params'

const SOURCE = 'generator:english-grammar'
const TOPIC = '句型与语法'
const SEED = 20261020
const LIMIT = 60

interface WordRow {
  word: string
  grade: number
  meaning: string
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
  'blow', 'tie', 'want', 'eat', 'stop', 'wait', 'go', 'come', 'put', 'sing', 'read',
  'draw', 'jump', 'walk', 'talk', 'take', 'give', 'get', 'use', 'live'
])

const UNCOUNTABLE = new Set([
  'milk', 'water', 'juice', 'rice', 'bread', 'meat', 'grass', 'food', 'salad',
  'chicken', 'fish', 'soup', 'tea', 'hair', 'playtime', 'teatime', 'weather',
  'traffic', 'breakfast', 'lunch', 'dinner', 'supper', 'homework', 'music',
  'art', 'fun', 'news', 'information', 'time', 'spring', 'summer', 'autumn',
  'winter', 'fruit', 'shopping', 'work'
])

/** 冠词题只选可数名词单数，避免 "a food"、"a skip" 这类病句 */
function isCountableNoun(row: WordRow): boolean {
  const word = row.word.trim().toLowerCase()
  if (!/^[a-z]+$/.test(word) || word.length < 3) return false
  if (FUNCTION_WORDS.has(word) || VERBS.has(word) || word.endsWith('ing')) return false
  if (UNCOUNTABLE.has(word) || word.endsWith('s')) return false
  const meaning = row.meaning.trim()
  if (/[的地得了]$/.test(meaning)) return false
  if (/^(是|在|不|很|非常|太|这么|怎么样)/.test(meaning)) return false
  return true
}

export function generateEnglishGrammar(ctx: GeneratorContext): number {
  const blankCount = numberParam(ctx.options, 'blankCount', 1, 1, 3)
  if (blankCount > 1) return 0

  const rows = ctx.db
    .prepare('SELECT word, grade, meaning FROM ref_english_word ORDER BY grade, rowid')
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
    if (grade > 2) continue
    if (!accepts(ctx.options, 'fill', grade)) continue
    const pool = uniqueByWord(groups.get(grade) ?? [])
    const seen = new Set<string>()
    let generated = 0

    for (const row of shuffle(pool, rand)) {
      if (generated >= limit) break
      if (!isCountableNoun(row)) continue
      const stem = `用 a 或 an 填空：____ ${row.word}（${row.meaning}）`
      if (seen.has(stem)) continue

      const article = /^[aeiou]/i.test(row.word) ? 'an' : 'a'
      seen.add(stem)
      const inserted = ctx.insert({
        subject: '英语',
        grade,
        topic: TOPIC,
        type: 'fill',
        difficulty: difficultyOf(grade),
        stem,
        answer: [article],
        solution: `"${row.word}" 前用 ${article}。`,
        score: 2,
        source: SOURCE
      })
      if (inserted) {
        generated += 1
        count += 1
      }
    }
  }

  return count
}
