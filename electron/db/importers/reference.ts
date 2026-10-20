import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { importWordCorpus } from './word-corpus'

interface HanziLesson {
  name?: string
  chars?: string[]
}

interface HanziVolume {
  label?: string
  lessons?: HanziLesson[]
}

interface HanziGrade {
  grade?: number
  volumes?: HanziVolume[]
}

interface HanziFile {
  grades?: HanziGrade[]
}

interface Poem {
  title?: string
  author?: string
  dynasty?: string
  grade?: number
  volume?: string
  stage?: string
  difficulty?: number
  linesPunct?: string[]
}

interface PoemFile {
  poems?: Poem[]
}

interface Idiom {
  word?: string
  pinyin?: string
  explanation?: string
  derivation?: string
  example?: string
}

interface Xiehouyu {
  riddle?: string
  answer?: string
}

interface EnglishWord {
  grade: number
  volume: string
  word: string
  phonetic: string | null
  phoneticUs: string | null
  meaning: string
  sentence: string | null
  sentenceZh: string | null
}

const ENGLISH_FILES: { file: string; grade: number; volume: string }[] = [
  { file: 'en-g1b.md', grade: 1, volume: '一年级下册' },
  { file: 'en-g2a.md', grade: 2, volume: '二年级上册' },
  { file: 'en-g2b.md', grade: 2, volume: '二年级下册' },
  { file: 'en-g3a.md', grade: 3, volume: '三年级上册' },
  { file: 'en-g3b.md', grade: 3, volume: '三年级下册' },
  { file: 'en-g4a.md', grade: 4, volume: '四年级上册' },
  { file: 'en-g4b.md', grade: 4, volume: '四年级下册' },
  { file: 'en-g5a.md', grade: 5, volume: '五年级上册' },
  { file: 'en-g5b.md', grade: 5, volume: '五年级下册' },
  { file: 'en-g6a.md', grade: 6, volume: '六年级上册' },
  { file: 'en-g6b.md', grade: 6, volume: '六年级下册' }
]

const CLASSIFIER_HEADERS = new Set(['名词', '词语', 'noun', 'word'])

function readText(file: string): string {
  return readFileSync(file, 'utf8')
}

function textOrNull(value: string | undefined): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text ? text : null
}

function importHanzi(db: Database.Database, datasetsDir: string): number {
  const data = JSON.parse(
    readText(join(datasetsDir, 'chinese', 'hanzi-primary.json'))
  ) as HanziFile
  const insert = db.prepare('INSERT OR IGNORE INTO ref_hanzi(char, grade) VALUES (?, ?)')

  return db.transaction(() => {
    let count = 0
    for (const grade of data.grades ?? []) {
      if (typeof grade.grade !== 'number') continue
      for (const volume of grade.volumes ?? []) {
        for (const lesson of volume.lessons ?? []) {
          for (const char of lesson.chars ?? []) {
            const value = typeof char === 'string' ? char.trim() : ''
            if (!value) continue
            const result = insert.run(value, grade.grade)
            count += result.changes
          }
        }
      }
    }
    return count
  })()
}

function importPoems(db: Database.Database, datasetsDir: string): number {
  const data = JSON.parse(
    readText(join(datasetsDir, 'chinese', 'poems-k12.json'))
  ) as PoemFile
  const insert = db.prepare(
    'INSERT INTO ref_poem(title, author, dynasty, grade, lines, difficulty) VALUES (?, ?, ?, ?, ?, ?)'
  )

  return db.transaction(() => {
    let count = 0
    for (const poem of data.poems ?? []) {
      if (poem.stage !== '小学' || typeof poem.grade !== 'number') continue
      if (!poem.title || !poem.author || !Array.isArray(poem.linesPunct)) continue
      insert.run(
        poem.title,
        poem.author,
        textOrNull(poem.dynasty),
        poem.grade,
        JSON.stringify(poem.linesPunct),
        typeof poem.difficulty === 'number' ? poem.difficulty : 2
      )
      count += 1
    }
    return count
  })()
}

function importIdioms(db: Database.Database, datasetsDir: string): number {
  const data = JSON.parse(
    readText(join(datasetsDir, 'chinese', 'idioms.json'))
  ) as Idiom[]
  const corpusRaw = readText(join(datasetsDir, 'chinese', 'chengyu-corpus.txt')).replace(/^\uFEFF/, '')
  const freqByWord = new Map<string, number>()
  let rank = 0
  for (const line of corpusRaw.split(/\r?\n/).slice(3)) {
    const word = line.trim()
    if (!/^[\u4e00-\u9fa5]{4}$/.test(word)) continue
    rank += 1
    if (!freqByWord.has(word)) freqByWord.set(word, rank)
  }
  const insert = db.prepare(
    'INSERT OR IGNORE INTO ref_idiom(word, pinyin, explanation, freq) VALUES (?, ?, ?, ?)'
  )

  return db.transaction(() => {
    let count = 0
    for (const item of data) {
      const word = textOrNull(item.word)
      if (!word) continue
      const result = insert.run(
        word,
        textOrNull(item.pinyin),
        textOrNull(item.explanation),
        freqByWord.get(word) ?? null
      )
      count += result.changes
    }
    return count
  })()
}

function importXiehouyu(db: Database.Database, datasetsDir: string): number {
  const data = JSON.parse(
    readText(join(datasetsDir, 'chinese', 'xiehouyu.json'))
  ) as Xiehouyu[]
  const insert = db.prepare('INSERT OR IGNORE INTO ref_xiehouyu(riddle, answer) VALUES (?, ?)')

  return db.transaction(() => {
    let count = 0
    for (const item of data) {
      const riddle = textOrNull(item.riddle)
      const answer = textOrNull(item.answer)
      if (!riddle || !answer) continue
      count += insert.run(riddle, answer).changes
    }
    return count
  })()
}

function importSynonyms(db: Database.Database, datasetsDir: string): number {
  const raw = readText(join(datasetsDir, 'chinese', 'synonyms.txt'))
  const insert = db.prepare('INSERT INTO ref_synonym(words) VALUES (?)')

  return db.transaction(() => {
    let count = 0
    for (const line of raw.split(/\r?\n/)) {
      // 原文件除 = 外还使用 # / @ 作为分隔符
      const index = line.search(/[=#@]/)
      if (index < 0) continue
      const words = line
        .slice(index + 1)
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .join(' ')
      if (!words) continue
      insert.run(words)
      count += 1
    }
    return count
  })()
}

function importAntonyms(db: Database.Database, datasetsDir: string): number {
  const raw = readText(join(datasetsDir, 'chinese', 'antonyms.txt'))
  const insert = db.prepare('INSERT INTO ref_antonym(left, right) VALUES (?, ?)')

  return db.transaction(() => {
    let count = 0
    for (const line of raw.split(/\r?\n/)) {
      const parts = line
        .split(/[─—―–-]+/)
        .map((part) => part.trim())
        .filter(Boolean)
      if (parts.length !== 2) continue
      const [left, right] = parts
      if (!left || !right || left.length > 8 || right.length > 8) continue
      insert.run(left, right)
      count += 1
    }
    return count
  })()
}

function importClassifiers(db: Database.Database, datasetsDir: string): number {
  const raw = readText(join(datasetsDir, 'chinese', 'classifiers.txt'))
  const insert = db.prepare(
    'INSERT OR IGNORE INTO ref_classifier(noun, classifier) VALUES (?, ?)'
  )

  return db.transaction(() => {
    let count = 0
    let first = true
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue
      const cells = line.split('\t').map((cell) => cell.trim())
      if (cells.length < 2) continue
      const [noun, classifier] = cells
      if (first) {
        first = false
        if (CLASSIFIER_HEADERS.has(noun.toLowerCase())) continue
      }
      if (!noun || !classifier) continue
      count += insert.run(noun, classifier).changes
    }
    return count
  })()
}

function parseEnglishRows(raw: string): Omit<EnglishWord, 'grade' | 'volume'>[] {
  const rows: Omit<EnglishWord, 'grade' | 'volume'>[] = []
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) continue

    const cells = trimmed.split('|').map((cell) => cell.trim())
    if (cells[0] === '') cells.shift()
    if (cells[cells.length - 1] === '') cells.pop()
    if (cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue
    if (cells[0] === '序号') continue
    if (cells.length === 6) cells.unshift('')
    if (cells.length !== 7) continue

    const word = cells[1]
    const meaning = cells[4]
    if (!word || !meaning || meaning === '-') continue

    rows.push({
      word,
      phonetic: textOrNull(cells[2]),
      phoneticUs: textOrNull(cells[3]),
      meaning,
      sentence: textOrNull(cells[5]),
      sentenceZh: textOrNull(cells[6])
    })
  }
  return rows
}

function importEnglishWords(db: Database.Database, datasetsDir: string): number {
  const insert = db.prepare(
    'INSERT INTO ref_english_word(word, grade, volume, phonetic, meaning, sentence, sentence_zh) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )

  return db.transaction(() => {
    let count = 0
    for (const entry of ENGLISH_FILES) {
      let rows: Omit<EnglishWord, 'grade' | 'volume'>[]
      try {
        rows = parseEnglishRows(
          readText(join(datasetsDir, 'english', 'pep-words', entry.file))
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`[reference] ${entry.file} 读取失败，已跳过: ${message}`)
        continue
      }
      for (const row of rows) {
        insert.run(
          row.word,
          entry.grade,
          entry.volume,
          row.phonetic,
          row.meaning,
          row.sentence,
          row.sentenceZh
        )
        count += 1
      }
    }
    return count
  })()
}

function safeImport(name: string, task: () => number): number {
  try {
    return task()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[reference] ${name} 导入失败，已跳过: ${message}`)
    return 0
  }
}

export function importReferenceData(
  db: Database.Database,
  datasetsDir: string
): Record<string, number> {
  const counts: Record<string, number> = {
    hanzi: safeImport('hanzi', () => importHanzi(db, datasetsDir)),
    word: safeImport('word', () => importWordCorpus(db, datasetsDir)),
    poem: safeImport('poem', () => importPoems(db, datasetsDir)),
    idiom: safeImport('idiom', () => importIdioms(db, datasetsDir)),
    xiehouyu: safeImport('xiehouyu', () => importXiehouyu(db, datasetsDir)),
    synonym: safeImport('synonym', () => importSynonyms(db, datasetsDir)),
    antonym: safeImport('antonym', () => importAntonyms(db, datasetsDir)),
    classifier: safeImport('classifier', () => importClassifiers(db, datasetsDir)),
    englishWord: safeImport('englishWord', () => importEnglishWords(db, datasetsDir))
  }

  console.log('[reference] 参考数据导入完成', counts)
  return counts
}
