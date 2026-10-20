import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import cnchar from 'cnchar'
import words from 'cnchar-words'

cnchar.use(words)

/** 小学生词库里不应出现的词，生成前直接排除 */
const BLOCKED_WORDS = new Set([
  '色情',
  '情色',
  '色欲',
  '下情',
  '钟情',
  '情人',
  '情夫',
  '情妇',
  '男女',
  '上床',
  '开房',
  '恋爱',
  '结婚',
  '离婚',
  '性感',
  '裸体',
  '自杀',
  '杀人',
  '吸毒',
  '赌博',
  '赌钱',
  '香烟',
  '喝酒',
  '啤酒',
  '酒吧',
  '死亡',
  '尸体',
  '枪杀',
  '爆炸',
  '恐怖',
  '暴力',
  '打架',
  '斗殴'
])

interface HanziRow {
  char: string
  grade: number
}

interface AishizhiQuestion {
  stem?: string
  explanation?: string
  options?: unknown[]
  answer?: unknown
}

interface AishizhiFile {
  questions?: AishizhiQuestion[]
}

interface IdiomEntry {
  derivation?: string
  example?: string
  explanation?: string
}

function countBigrams(texts: string[]): Map<string, number> {
  const freq = new Map<string, number>()
  for (const text of texts) {
    for (const match of text.matchAll(/[\u4e00-\u9fa5]{2,}/g)) {
      const run = match[0]
      for (let index = 0; index < run.length - 1; index += 1) {
        const word = run.slice(index, index + 2)
        freq.set(word, (freq.get(word) ?? 0) + 1)
      }
    }
  }
  return freq
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return null
  }
}

/** 从小学试卷与成语释义语料中统计二字词的出现次数，作为「常用词」依据 */
function buildCorpus(datasetsDir: string): {
  examFreq: Map<string, number>
  proseFreq: Map<string, number>
} {
  const examTexts: string[] = []
  const examDir = join(datasetsDir, 'chinese', 'aishizhi')
  try {
    for (const file of readdirSync(examDir)) {
      if (!file.endsWith('.json')) continue
      const data = readJson<AishizhiFile>(join(examDir, file))
      for (const question of data?.questions ?? []) {
        examTexts.push(String(question.stem ?? ''), String(question.explanation ?? ''))
        for (const option of question.options ?? []) examTexts.push(String(option))
        if (typeof question.answer === 'string') examTexts.push(question.answer)
      }
    }
  } catch {
    // 缺少试卷语料时仍可用成语释义语料
  }

  const proseTexts: string[] = []
  const idioms = readJson<IdiomEntry[]>(join(datasetsDir, 'chinese', 'idioms.json')) ?? []
  for (const idiom of idioms) {
    proseTexts.push(String(idiom.derivation ?? ''), String(idiom.example ?? ''), String(idiom.explanation ?? ''))
  }

  return { examFreq: countBigrams(examTexts), proseFreq: countBigrams(proseTexts) }
}

/**
 * 生成 ref_word：只保留「由本年级及以下生字组成 + 在小学语料中出现过」的二字词。
 * 低年级只用试卷语料，避免成语释义里的书面语进入一年级题库。
 */
export function importWordCorpus(db: Database.Database, datasetsDir: string): number {
  const rows = db.prepare('SELECT char, grade FROM ref_hanzi').all() as HanziRow[]
  const { examFreq, proseFreq } = buildCorpus(datasetsDir)
  const insert = db.prepare('INSERT OR IGNORE INTO ref_word(word, grade, freq) VALUES (?, ?, ?)')
  const picked = new Map<string, number>()

  for (const grade of [1, 2, 3, 4, 5, 6]) {
    const allowed = new Set(rows.filter((row) => row.grade <= grade).map((row) => row.char))
    const pool = rows.filter((row) => row.grade === grade).map((row) => row.char)
    const threshold = grade <= 3 ? 2 : 3
    for (const char of pool) {
      const list = cnchar.words(char)
      if (!Array.isArray(list)) continue
      for (const raw of list) {
        const word = String(raw)
        if (word.length !== 2 || !word.includes(char)) continue
        if (BLOCKED_WORDS.has(word)) continue
        if (!word.split('').every((part) => allowed.has(part))) continue
        const examFreqOfWord = examFreq.get(word) ?? 0
        const freq = grade <= 3 ? examFreqOfWord : examFreqOfWord + (proseFreq.get(word) ?? 0)
        if (freq < threshold) continue
        if (picked.has(word) && picked.get(word)! <= grade) continue
        picked.set(word, grade)
      }
    }
  }

  let count = 0
  const insertAll = db.transaction(() => {
    for (const [word, grade] of picked) {
      const freq = (examFreq.get(word) ?? 0) + (proseFreq.get(word) ?? 0)
      if (insert.run(word, grade, freq).changes > 0) count += 1
    }
  })
  insertAll()
  return count
}
