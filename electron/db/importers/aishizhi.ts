import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SeedContext, SeedQuestion } from '../seed/types'
import type { QuestionAnswer, QuestionType } from '../../../shared/types'
import { datasetPath } from './dataset'

const DATA_DIRS = [
  datasetPath('chinese', 'aishizhi'),
  datasetPath('math', 'aishizhi'),
  datasetPath('english', 'aishizhi')
]

const SUBJECT_MAP: Record<string, string> = {
  chinese: '语文',
  math: '数学',
  english: '英语'
}

const DIFFICULTY_MAP: Record<string, number> = {
  low: 1,
  mid: 2,
  high: 3
}

const TYPE_MAP: Record<string, QuestionType> = {
  single: 'single',
  multiple: 'multiple',
  judge: 'judge',
  fill: 'fill',
  short_answer: 'short_answer',
  cloze: 'cloze',
  match: 'matching',
  order: 'sorting',
  calculation: 'calculation'
}

const LETTER = /^[A-Z]$/

interface AishizhiQuestion {
  stage: string
  subject: string
  grade: number
  difficulty: string
  type: string
  stem: string
  options?: string[]
  answer: unknown
  explanation?: string
  knowledge_point?: string
  points?: number
}

interface AishizhiFile {
  meta: { subject: string; grade: number }
  questions: AishizhiQuestion[]
}

function letterIndex(value: string): number {
  return value.charCodeAt(0) - 65
}

function toLetters(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter((item) => LETTER.test(item))
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item))
  if (typeof value === 'string') return value.split(/\s*[|｜,，]\s*/).filter(Boolean)
  return []
}

interface ParsedAnswer {
  options?: unknown
  answer: QuestionAnswer
}

function parseAnswer(
  type: QuestionType,
  raw: unknown,
  options: unknown,
  stem: string
): ParsedAnswer | null {
  if (type === 'single') {
    const letter = String(raw).trim()
    return LETTER.test(letter) ? { answer: letterIndex(letter) } : null
  }

  if (type === 'multiple') {
    const indexes = toLetters(raw).map(letterIndex)
    return indexes.length > 0 ? { answer: indexes } : null
  }

  if (type === 'judge') {
    const text = String(raw).trim().toLowerCase()
    if (['true', 't', '1', '对', '正确'].includes(text)) {
      return { options: ['正确', '错误'], answer: 0 }
    }
    if (['false', 'f', '0', '错', '错误'].includes(text)) {
      return { options: ['正确', '错误'], answer: 1 }
    }
    return null
  }

  if (type === 'matching') {
    const leftMatch = stem.match(/[「“]([^」”]+)[」”]/)
    if (!leftMatch) return null
    const left = leftMatch[1]
      .split(/[、,，]/)
      .map((item) => item.trim())
      .filter(Boolean)
    const right = toStringList(options)
    const letters = toLetters(raw)
    if (left.length === 0 || right.length < left.length || letters.length !== left.length) {
      return null
    }

    const answer: Record<string, string> = {}
    letters.forEach((letter, index) => {
      const value = right[letterIndex(letter)]
      if (value) answer[String(index)] = value
    })
    if (Object.keys(answer).length !== left.length) return null
    return { options: { left, right }, answer }
  }

  if (type === 'sorting') {
    const items = toStringList(options)
    const letters = toLetters(raw)
    if (items.length === 0 || letters.length !== items.length) return null
    const answer = letters.map((letter) => items[letterIndex(letter)])
    if (answer.some((item) => !item)) return null
    return { options: items, answer }
  }

  if (type === 'calculation') {
    const text = String(raw).trim()
    return /^-?\d+(\.\d+)?$/.test(text) ? { answer: Number(text) } : { answer: text }
  }

  const values = toStringList(raw)
  return values.length > 0 ? { answer: values } : null
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isIndexList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item))
}

function sameMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const left = [...a].sort()
  const right = [...b].sort()
  return left.every((item, index) => item === right[index])
}

interface MatchingOptions {
  left: string[]
  right: string[]
}

function toMatchingOptions(value: unknown): MatchingOptions | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (!isStringList(record.left) || !isStringList(record.right)) return null
  return { left: record.left, right: record.right }
}

/**
 * 题型契约校验：不满足的题目在导入阶段直接丢弃，
 * 避免渲染与判分依赖不成立的数据结构。
 */
function validateQuestion(question: SeedQuestion): boolean {
  const options = question.options
  const answer = question.answer

  if (question.type === 'single') {
    if (!isStringList(options) || options.length < 3 || options.length > 4) return false
    return (
      typeof answer === 'number' &&
      Number.isInteger(answer) &&
      answer >= 0 &&
      answer < options.length
    )
  }

  if (question.type === 'multiple') {
    if (!isStringList(options)) return false
    if (!isIndexList(answer) || answer.length < 2 || answer.length > 3) return false
    if (new Set(answer).size !== answer.length) return false
    return answer.every((index) => index >= 0 && index < options.length)
  }

  if (question.type === 'judge') {
    if (!isStringList(options)) return false
    if (options.length !== 2 || options[0] !== '正确' || options[1] !== '错误') return false
    return answer === 0 || answer === 1
  }

  if (question.type === 'matching') {
    const parsed = toMatchingOptions(options)
    if (parsed === null) return false
    if (parsed.left.length !== 4 || parsed.right.length !== 4) return false
    if (new Set(parsed.right).size !== parsed.right.length) return false
    if (answer === null || typeof answer !== 'object' || Array.isArray(answer)) return false
    const entries = Object.entries(answer as Record<string, unknown>)
    if (entries.length !== parsed.left.length) return false
    return entries.every(
      ([key, value]) =>
        /^\d+$/.test(key) &&
        Number(key) < parsed.left.length &&
        typeof value === 'string' &&
        parsed.right.includes(value)
    )
  }

  if (question.type === 'sorting') {
    if (!isStringList(options) || options.length === 0) return false
    if (!isStringList(answer)) return false
    return sameMultiset(options, answer)
  }

  if (question.type === 'fill') {
    if (!isStringList(answer) || answer.length === 0) return false
    const blanks = question.stem.match(/____/g)?.length ?? 0
    return blanks === answer.length
  }

  return true
}

export function importAishizhi(seed: SeedContext): number {
  let count = 0
  const skipped: Record<string, number> = {}
  const files = DATA_DIRS.flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => join(dir, name))
  )
  console.log(`[aishizhi] 发现 ${files.length} 个数据文件`)

  for (const filePath of files) {
    const raw = readFileSync(filePath, 'utf8')
    let parsed: AishizhiFile
    try {
      parsed = JSON.parse(raw) as AishizhiFile
    } catch {
      console.warn(`[aishizhi] 跳过解析失败的文件: ${filePath}`)
      continue
    }

    const questions = parsed.questions ?? []
    for (const item of questions) {
      const subject = SUBJECT_MAP[item.subject]
      if (!subject) continue

      const type = TYPE_MAP[item.type]
      if (!type) continue

      const difficulty = DIFFICULTY_MAP[item.difficulty] ?? 2
      const grade = item.grade
      const stem = (item.stem ?? '').trim()
      if (!stem) continue

      const parsedAnswer = parseAnswer(type, item.answer, item.options, stem)
      if (!parsedAnswer) continue

      const question: SeedQuestion = {
        subject,
        grade,
        topic: item.knowledge_point ?? '综合',
        type,
        difficulty,
        stem,
        options: parsedAnswer.options ?? item.options,
        answer: parsedAnswer.answer,
        solution: item.explanation,
        score: item.points ?? 2,
        source: '爱时智卫'
      }
      if (!validateQuestion(question)) {
        skipped[type] = (skipped[type] ?? 0) + 1
        continue
      }
      seed.add(question)
      count += 1
    }
  }

  const skippedTotal = Object.values(skipped).reduce((sum, item) => sum + item, 0)
  const skippedDetail = Object.entries(skipped)
    .map(([type, amount]) => `${type} ${amount}`)
    .join(', ')
  console.log(
    `[aishizhi] 契约校验跳过 ${skippedTotal} 题${skippedDetail ? ` (${skippedDetail})` : ''}`
  )
  console.log(`[aishizhi] 导入完成, 共 ${count} 题`)
  return count
}
