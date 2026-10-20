import { getDb } from '../connection'
import type { EnglishWord } from '../../../shared/types'

interface EnglishWordRow {
  id: number
  word: string
  grade: number
  volume: string | null
  phonetic: string | null
  meaning: string
  sentence: string | null
  sentence_zh: string | null
}

export function listEnglishWords(grade: number): EnglishWord[] {
  const rows = getDb()
    .prepare(
      `SELECT id, word, grade, volume, phonetic, meaning, sentence, sentence_zh
       FROM bank.ref_english_word
       WHERE grade = ?
       ORDER BY id ASC`
    )
    .all(grade) as EnglishWordRow[]

  const seen = new Set<string>()
  return rows
    .filter((row) => {
      if (seen.has(row.word)) return false
      seen.add(row.word)
      return true
    })
    .map((row) => ({
      id: row.id,
      word: row.word,
      grade: row.grade,
      volume: row.volume,
      phonetic: row.phonetic,
      meaning: row.meaning,
      sentence: row.sentence,
      sentenceZh: row.sentence_zh
    }))
}
