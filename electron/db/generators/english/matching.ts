import { accepts } from '../types'
import type { GeneratorContext } from '../types'
import { numberParam } from './params'

const SOURCE = 'generator:english-matching'
const SEED = 20261018
const LIMIT = 300
const MAX_ATTEMPTS = 30000

interface WordRow {
  word: string
  grade: number
  meaning: string
  phonetic: string | null
}

interface MatchPairs {
  left: string[]
  right: string[]
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

function pickRows(
  pool: WordRow[],
  key: 'meaning' | 'phonetic',
  rand: () => number,
  count: number
): WordRow[] | null {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const rows = shuffle(pool, rand).slice(0, count)
    if (rows.length < count) return null
    const values: string[] = []
    let valid = true
    for (const row of rows) {
      const value = row[key]
      if (!value || !value.trim() || value.trim() === '-') {
        valid = false
        break
      }
      values.push(value)
    }
    if (!valid || new Set(values.map((value) => value.trim())).size !== count) continue
    return rows
  }
  return null
}

function hasPhoneticPool(pool: WordRow[], count: number): boolean {
  const values = new Set<string>()
  for (const row of pool) {
    const value = row.phonetic?.trim() ?? ''
    if (value && value !== '-') values.add(value)
  }
  return values.size >= count
}

export function generateEnglishMatching(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare('SELECT word, grade, meaning, phonetic FROM ref_english_word ORDER BY grade, rowid')
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
  const pairCount = numberParam(ctx.options, 'pairCount', 4, 4, 6)
  let count = 0

  for (const grade of [...groups.keys()].sort((a, b) => a - b)) {
    if (!accepts(ctx.options, 'matching', grade)) continue
    const pool = uniqueByWord(groups.get(grade) ?? [])
    const canUsePhonetic = hasPhoneticPool(pool, pairCount)
    const seen = new Set<string>()
    let generated = 0
    let attempts = 0
    while (generated < limit && attempts < MAX_ATTEMPTS) {
      attempts += 1
      const byMeaning = !canUsePhonetic || generated % 2 === 0
      const key = byMeaning ? 'meaning' : 'phonetic'
      const picked = pickRows(pool, key, rand, pairCount)
      if (!picked) continue

      const pairs: MatchPairs = {
        left: picked.map((row) => row.word),
        right: picked.map((row) => String(row[key]))
      }
      const stem = byMeaning
        ? `把左边的单词与右边的中文意思连起来：${pairs.left.join('、')}。`
        : `把左边的单词与右边的音标连起来：${pairs.left.join('、')}。`
      if (seen.has(stem)) continue
      seen.add(stem)

      const right = shuffle(pairs.right, rand)
      const answer: Record<string, string> = {}
      pairs.left.forEach((word, index) => {
        answer[String(index)] = pairs.right[index]
      })

      const inserted = ctx.insert({
        subject: '英语',
        grade,
        topic: byMeaning ? '词汇' : '字母与语音',
        type: 'matching',
        difficulty: difficultyOf(grade),
        stem,
        options: { left: pairs.left, right },
        answer,
        solution: pairs.left
          .map((word, index) => `${word} → ${pairs.right[index]}`)
          .join('；'),
        score: 3,
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
