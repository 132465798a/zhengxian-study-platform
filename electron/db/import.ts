import Papa from 'papaparse'
import { getDb } from './connection'
import { createQuestion } from './repositories/question.repo'
import type { ImportPreview, ImportResult, QuestionAnswer, QuestionType } from '../../shared/types'

const HEADER_ALIASES: Record<string, string> = {
  学科: 'subject',
  subject: 'subject',
  年级: 'grade',
  grade: 'grade',
  题型: 'type',
  type: 'type',
  题干: 'stem',
  stem: 'stem',
  选项: 'options',
  options: 'options',
  答案: 'answer',
  answer: 'answer',
  解析: 'solution',
  solution: 'solution',
  难度: 'difficulty',
  difficulty: 'difficulty',
  知识点: 'knowledge',
  knowledge: 'knowledge'
}

const TYPE_ALIASES: Record<string, QuestionType> = {
  single: 'single',
  multiple: 'multiple',
  judge: 'judge',
  fill: 'fill',
  short_answer: 'short_answer',
  cloze: 'cloze',
  matching: 'matching',
  sorting: 'sorting',
  calculation: 'calculation',
  单选: 'single',
  多选: 'multiple',
  判断: 'judge',
  填空: 'fill',
  简答: 'short_answer',
  完形填空: 'cloze',
  连线: 'matching',
  排序: 'sorting',
  计算: 'calculation'
}

function normalizeRow(raw: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    const target = HEADER_ALIASES[key.trim()] ?? key.trim()
    result[target] = value
  }
  return result
}

function splitList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item))
  if (typeof value !== 'string') return []
  const text = value.trim()
  if (!text) return []
  return text.split(/\s*[|｜,，]\s*/).filter(Boolean)
}

function parseOptions(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      return JSON.parse(text)
    } catch {
      return splitList(text)
    }
  }
  return splitList(text)
}

function parseAnswer(type: QuestionType, value: unknown, options: unknown): QuestionAnswer {
  const raw = typeof value === 'string' ? value.trim() : value
  if (raw === undefined || raw === null || raw === '') throw new Error('答案为空')

  if (type === 'single' || type === 'judge') {
    if (typeof raw === 'number') return raw
    const text = String(raw)
    if (/^\d+$/.test(text)) return Number(text)
    if (Array.isArray(options)) {
      const index = options.findIndex((item) => String(item) === text)
      if (index >= 0) return index
    }
    return text === '对' || text.toLowerCase() === 'true' ? 0 : 1
  }

  if (type === 'multiple') {
    if (Array.isArray(raw)) return raw.map((item) => Number(item))
    return splitList(raw).map((item) => Number(item))
  }

  if (type === 'fill' || type === 'cloze') {
    return splitList(raw)
  }

  if (type === 'sorting') {
    return splitList(raw)
  }

  if (type === 'calculation') {
    const text = String(raw)
    return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text
  }

  if (type === 'matching') {
    if (typeof raw === 'object') return raw as Record<string, string>
    const text = String(raw).trim()
    if (text.startsWith('{')) return JSON.parse(text) as Record<string, string>
    const pairs = text.split(/\s*[|｜,，]\s*/).filter(Boolean)
    return Object.fromEntries(
      pairs.map((pair) => {
        const [key, val] = pair.split(/\s*[:：]\s*/)
        return [key, val]
      })
    )
  }

  if (typeof raw === 'object') return raw as Record<string, string>
  return { reference: String(raw), keywords: [] }
}

function parseRows(raw: string, fileName: string): Record<string, unknown>[] {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('文件内容为空')

  let rows: Record<string, unknown>[]

  if (fileName.toLowerCase().endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) rows = parsed as Record<string, unknown>[]
    else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { questions?: unknown }).questions)) {
      rows = (parsed as { questions: Record<string, unknown>[] }).questions
    } else {
      throw new Error('JSON 结构不正确，应为数组或 { questions: [...] }')
    }
  } else {
    const result = Papa.parse<Record<string, unknown>>(trimmed, {
      header: true,
      skipEmptyLines: true
    })
    if (result.errors.length > 0 && result.data.length === 0) {
      throw new Error(`CSV 解析失败：${result.errors[0].message}`)
    }
    rows = result.data
  }

  return rows.map(normalizeRow).filter((row) => String(row.stem ?? '').trim())
}

export function parseImportSource(raw: string, fileName: string): ImportPreview {
  const normalized = parseRows(raw, fileName)
  if (normalized.length === 0) throw new Error('没有解析到有效题目，请检查表头与内容')

  return {
    kind: 'questions',
    total: normalized.length,
    preview: normalized.slice(0, 5),
    columns: Object.keys(normalized[0])
  }
}

export function commitImportSource(raw: string, fileName: string): ImportResult {
  return commitImport(parseRows(raw, fileName))
}

export function commitImport(rows: Record<string, unknown>[]): ImportResult {
  const db = getDb()
  const subjects = db.prepare("SELECT id, name FROM subject WHERE stage = 'primary'").all() as {
    id: number
    name: string
  }[]
  const subjectByName = new Map(subjects.map((item) => [item.name, item.id]))

  let inserted = 0
  let skipped = 0
  const errors: string[] = []

  rows.forEach((raw, index) => {
    const row = normalizeRow(raw)
    try {
      const subjectName = String(row.subject ?? '数学').trim()
      const subjectId = subjectByName.get(subjectName)
      if (!subjectId) throw new Error(`未知学科：${subjectName}`)

      const typeKey = String(row.type ?? 'single').trim()
      const type = TYPE_ALIASES[typeKey]
      if (!type) throw new Error(`未知题型：${typeKey}`)

      const grade = Number(row.grade ?? 1)
      if (!Number.isInteger(grade) || grade < 1 || grade > 12) throw new Error('年级不合法')

      const stem = String(row.stem ?? '').trim()
      if (!stem) throw new Error('题干为空')

      const options = parseOptions(row.options)
      const answer = parseAnswer(type, row.answer, options)
      const difficulty = Number(row.difficulty ?? 2)

      createQuestion({
        subjectId,
        grade,
        type,
        difficulty: [1, 2, 3].includes(difficulty) ? difficulty : 2,
        stem,
        options,
        answer,
        solution: row.solution ? String(row.solution) : null,
        score: 2,
        source: '批量导入'
      })
      inserted += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      if (message.includes('UNIQUE')) skipped += 1
      else errors.push(`第 ${index + 1} 行：${message}`)
    }
  })

  return { inserted, skipped, errors: errors.slice(0, 20) }
}
