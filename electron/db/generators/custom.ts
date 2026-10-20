import Database from 'better-sqlite3'
import { getBankPath } from '../connection'
import { runtimeConfig } from '../../config'
import { matchTopic } from '../knowledge'
import { generateChinese } from './chinese'
import { generateEnglish } from './english'
import { generateMath } from './math'
import type { GeneratorContext, GeneratedQuestion } from './types'
import type { QuestionType } from '../../../shared/types'

export interface CustomGenerateInput {
  subjectId: number
  subjectName: string
  grade: number
  types: QuestionType[]
  /** 外层 key 为题型名，内层为该题型参数 */
  params: Record<string, Record<string, string | number | boolean>>
  knowledgeIds?: number[]
  difficulties?: number[]
  count: number
}

interface KnowledgeRow {
  id: number
  name: string
}

function int(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1))
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

function difficultyOf(grade: number): number {
  if (grade <= 2) return 1
  if (grade <= 4) return 2
  return 3
}

function paramNumber(
  params: Record<string, string | number | boolean>,
  key: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = params[key]
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN
  if (!Number.isInteger(value) || value < min || value > max) return fallback
  return value
}

function paramText(
  params: Record<string, string | number | boolean>,
  key: string,
  fallback: string,
  allowed: string[]
): string {
  const value = String(params[key] ?? '')
  return allowed.includes(value) ? value : fallback
}

function buildKnowledgeMap(
  db: Database.Database,
  subjectId: number,
  grade: number
): Map<string, number> {
  const rows = db
    .prepare('SELECT id, name FROM knowledge_point WHERE subject_id = ? AND grade = ?')
    .all(subjectId, grade) as KnowledgeRow[]
  const map = new Map<string, number>()
  for (const row of rows) map.set(row.name, row.id)
  return map
}

function resolveKnowledgeId(
  map: Map<string, number>,
  subjectName: string,
  topic: string
): number | null {
  const mapped = matchTopic(subjectName, topic) || topic
  return map.get(mapped) ?? null
}

function optionCountOf(question: GeneratedQuestion): number | null {
  return Array.isArray(question.options) ? question.options.length : null
}

function blankCountOf(stem: string): number {
  const matches = stem.match(/_{3,}|_{3}\{\d+\}/g)
  return matches ? matches.length : 0
}

function normalizeSingle(
  question: GeneratedQuestion,
  optionCount: number
): GeneratedQuestion | null {
  if (!Array.isArray(question.options) || typeof question.answer !== 'number') return null
  const options = [...question.options]
  const answer = question.answer
  if (options.length < optionCount) return null
  if (options.length > optionCount) {
    const remove = options.findIndex((_, index) => index !== answer)
    if (remove < 0) return null
    options.splice(remove, 1)
    const nextAnswer = remove < answer ? answer - 1 : answer
    return { ...question, options, answer: nextAnswer }
  }
  return question
}

function matchesStructuralParams(question: GeneratedQuestion, type: QuestionType, params: Record<string, string | number | boolean>): boolean {
  switch (type) {
    case 'single': {
      const expected = paramNumber(params, 'optionCount', 4, 3, 4)
      return optionCountOf(question) === expected
    }
    case 'multiple': {
      const expected = paramNumber(params, 'optionCount', 4, 4, 5)
      const correct = paramNumber(params, 'correctCount', 2, 2, 3)
      return optionCountOf(question) === expected && Array.isArray(question.answer) && question.answer.length === correct
    }
    case 'matching': {
      const expected = paramNumber(params, 'pairCount', 4, 4, 6)
      const options = question.options as { left?: unknown; right?: unknown } | undefined
      return Array.isArray(options?.left) && Array.isArray(options?.right) && options.left.length === expected && options.right.length === expected
    }
    case 'sorting': {
      const expected = paramNumber(params, 'itemCount', 4, 4, 6)
      return Array.isArray(question.options) && question.options.length === expected
    }
    case 'cloze': {
      const expected = paramNumber(params, 'blankCount', 1, 1, 2)
      return blankCountOf(question.stem) === expected
    }
    case 'fill': {
      const expected = paramNumber(params, 'blankCount', 1, 1, 3)
      const actual = blankCountOf(question.stem)
      return expected === 1 ? actual >= 1 || !question.stem.includes('____') : actual === expected
    }
    case 'short_answer': {
      const expected = paramNumber(params, 'keywordCount', 3, 1, 3)
      const payload = question.answer as { keywords?: unknown }
      return Array.isArray(payload?.keywords) && payload.keywords.length >= expected
    }
    default:
      return true
  }
}

interface CalcItem {
  expression: string
  answer: number
}

function hasCarry(a: number, b: number): boolean {
  let carry = 0
  while (a > 0 || b > 0) {
    const sum = (a % 10) + (b % 10) + carry
    if (sum >= 10) return true
    carry = sum >= 10 ? 1 : 0
    a = Math.floor(a / 10)
    b = Math.floor(b / 10)
  }
  return false
}

function hasBorrow(a: number, b: number): boolean {
  let borrow = 0
  while (a > 0 || b > 0) {
    const digit = (a % 10) - (b % 10) - borrow
    if (digit < 0) return true
    borrow = digit < 0 ? 1 : 0
    a = Math.floor(a / 10)
    b = Math.floor(b / 10)
  }
  return false
}

function makeCalcItem(
  rand: () => number,
  maxValue: number,
  operations: string,
  operands: number,
  carry: string,
  borrow: string
): CalcItem | null {
  const allowed =
    operations === 'add'
      ? ['add']
      : operations === 'sub'
        ? ['sub']
        : operations === 'mul'
          ? ['mul']
          : operations === 'div'
            ? ['div']
            : operations === 'all'
              ? ['add', 'sub', 'mul', 'div']
              : ['add', 'sub']
  const operation = allowed[Math.floor(rand() * allowed.length)]

  if (operands === 3) {
    if (operation === 'mul') {
      const a = int(rand, 2, 9)
      const b = int(rand, 2, 9)
      const c = int(rand, 2, 9)
      const result = a * b * c
      if (result > maxValue) return null
      return { expression: `${a} × ${b} × ${c}`, answer: result }
    }
    if (operation === 'div') {
      const b = int(rand, 2, 9)
      const c = int(rand, 2, 9)
      const quotient = int(rand, 1, Math.max(1, Math.floor(maxValue / (b * c))))
      return { expression: `${b * c * quotient} ÷ ${b} ÷ ${c}`, answer: quotient }
    }
    const a = int(rand, 1, maxValue)
    const b = int(rand, 1, maxValue)
    const c = int(rand, 1, maxValue)
    const mid = operation === 'add' ? a + b : a - b
    if (mid < 0 || mid > maxValue) return null
    const result = operation === 'add' ? mid + c : mid - c
    if (result < 0 || result > maxValue) return null
    if (operation === 'add') {
      if (carry === 'require' && !hasCarry(a, b) && !hasCarry(mid, c)) return null
      if (carry === 'forbid' && (hasCarry(a, b) || hasCarry(mid, c))) return null
    } else {
      if (borrow === 'require' && !hasBorrow(a, b) && !hasBorrow(mid, c)) return null
      if (borrow === 'forbid' && (hasBorrow(a, b) || hasBorrow(mid, c))) return null
    }
    const expression = `${a} ${operation === 'add' ? '+' : '-'} ${b} ${operation === 'add' ? '+' : '-'} ${c}`
    return { expression, answer: result }
  }

  if (operation === 'add') {
    const a = int(rand, 1, maxValue - 1)
    const b = int(rand, 1, maxValue - a)
    if (a + b > maxValue) return null
    if (carry === 'require' && !hasCarry(a, b)) return null
    if (carry === 'forbid' && hasCarry(a, b)) return null
    return { expression: `${a} + ${b}`, answer: a + b }
  }

  if (operation === 'sub') {
    const a = int(rand, 2, maxValue)
    const b = int(rand, 1, a - 1)
    if (borrow === 'require' && !hasBorrow(a, b)) return null
    if (borrow === 'forbid' && hasBorrow(a, b)) return null
    return { expression: `${a} - ${b}`, answer: a - b }
  }

  if (operation === 'mul') {
    const limit = Math.max(2, Math.floor(Math.sqrt(maxValue)))
    const a = int(rand, 2, limit)
    const b = int(rand, 2, limit)
    return { expression: `${a} × ${b}`, answer: a * b }
  }

  const b = int(rand, 2, 9)
  const quotient = int(rand, 1, Math.max(1, Math.floor(maxValue / b)))
  return { expression: `${b * quotient} ÷ ${b}`, answer: quotient }
}

function buildCustomCalculation(
  input: CustomGenerateInput,
  knowledgeId: number | null
): GeneratedQuestion[] {
  const rand = mulberry32((Date.now() ^ (input.count * 2654435761)) >>> 0)
  const params = input.params.calculation ?? {}
  const maxValue = paramNumber(params, 'maxValue', 100, 20, 10000)
  const operations = paramText(params, 'operations', 'mixed', ['add', 'sub', 'mul', 'div', 'mixed'])
  const operands = paramNumber(params, 'operands', 2, 2, 3)
  const carry = paramText(params, 'carry', 'any', ['any', 'require', 'forbid'])
  const borrow = paramText(params, 'borrow', 'any', ['any', 'require', 'forbid'])
  const questions: GeneratedQuestion[] = []
  const seen = new Set<string>()

  for (let attempt = 0; attempt < input.count * 400 && questions.length < input.count; attempt += 1) {
    const item = makeCalcItem(rand, maxValue, operations, operands, carry, borrow)
    if (!item || seen.has(item.expression)) continue
    seen.add(item.expression)
    questions.push({
      subject: '数学',
      grade: input.grade,
      topic: '数与运算',
      knowledgeId,
      type: 'calculation',
      difficulty: difficultyOf(input.grade),
      stem: `计算：${item.expression} = ____`,
      answer: item.answer,
      solution: `${item.expression} = ${item.answer}`,
      score: 2,
      source: 'generator:custom:calculation'
    })
  }

  return questions
}

function collectFromGenerators(input: CustomGenerateInput): GeneratedQuestion[] {
  const bankDb = new Database(runtimeConfig.bankPath || getBankPath(), { readonly: true })
  const knowledgeMap = buildKnowledgeMap(bankDb, input.subjectId, input.grade)
  const targetKnowledge = input.knowledgeIds?.length ? new Set(input.knowledgeIds) : null
  const questions: GeneratedQuestion[] = []
  const seen = new Set<string>()
  const limit = Math.max(input.count * 5, 60)

  const context: GeneratorContext = {
    db: bankDb,
    subjectId: (name: string) => (name === input.subjectName ? input.subjectId : 0),
    knowledgeId: (subject, grade, topic) =>
      grade === input.grade && subject === input.subjectName
        ? resolveKnowledgeId(knowledgeMap, subject, topic)
        : null,
    insert: (question: GeneratedQuestion): boolean => {
      if (questions.length >= input.count) return false
      if (question.subject !== input.subjectName) return false
      if (question.grade !== input.grade) return false
      if (!input.types.includes(question.type)) return false

      const typeParams = input.params[question.type] ?? {}
      let normalized = question
      if (question.type === 'single') {
        const expected = paramNumber(typeParams, 'optionCount', 4, 3, 4)
        normalized = normalizeSingle(question, expected) ?? question
        if (optionCountOf(normalized) !== expected) return false
      }

      if (!matchesStructuralParams(normalized, normalized.type, typeParams)) return false

      const knowledgeId = resolveKnowledgeId(knowledgeMap, input.subjectName, normalized.topic)
      if (targetKnowledge && (knowledgeId === null || !targetKnowledge.has(knowledgeId))) return false
      if (input.knowledgeIds?.length && knowledgeId === null) return false

      const key = `${normalized.stem}|${JSON.stringify(normalized.options ?? null)}`
      if (seen.has(key)) return false
      seen.add(key)
      questions.push({ ...normalized, knowledgeId, source: `generator:custom:${normalized.type}` })
      return true
    },
    options: {
      grade: input.grade,
      limit,
      params: Object.assign({}, ...input.types.map((type) => input.params[type] ?? {})),
      knowledgeIds: input.knowledgeIds,
      seed: (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0
    }
  }

  try {
    if (input.subjectName === '语文') generateChinese(context)
    else if (input.subjectName === '数学') generateMath(context)
    else if (input.subjectName === '英语') generateEnglish(context)
  } finally {
    bankDb.close()
  }

  return questions
}

export interface OralCardInput {
  grade: number
  count: number
  maxValue: number
  operations: 'add' | 'sub' | 'mul' | 'div' | 'mixed' | 'all'
}

/** 口算题卡：纯算式、一题 1 分，供整页口算练习使用 */
export function generateOralQuestions(input: OralCardInput): GeneratedQuestion[] {
  const rand = mulberry32((Date.now() ^ (input.count * 2654435761)) >>> 0)
  const questions: GeneratedQuestion[] = []
  const seen = new Set<string>()
  for (let attempt = 0; attempt < input.count * 200 && questions.length < input.count; attempt += 1) {
    const item = makeCalcItem(rand, input.maxValue, input.operations, 2, 'any', 'any')
    if (!item || seen.has(item.expression)) continue
    seen.add(item.expression)
    questions.push({
      subject: '数学',
      grade: input.grade,
      topic: '数与运算',
      knowledgeId: null,
      type: 'calculation',
      difficulty: 1,
      stem: `${item.expression} = ____`,
      answer: item.answer,
      solution: `${item.expression} = ${item.answer}`,
      score: 1,
      source: 'generator:oral'
    })
  }
  return questions
}

/**
 * 自定义题不写题库，难度由本次组卷决定：
 * 选了具体难度就统一使用；不限时按题序均匀分布 1/2/3。
 */
function withDifficulty(
  questions: GeneratedQuestion[],
  difficulties?: number[]
): GeneratedQuestion[] {
  const fixed = difficulties && difficulties.length > 0 ? difficulties[0] : null
  return questions.map((question, index) => ({
    ...question,
    difficulty: fixed ?? ((index % 3) + 1)
  }))
}

/**
 * 自定义组卷：实时生成题目，只返回内存结果，不写入 bank.db。
 * 计算题由独立构建器处理参数；其他题型复用既有生成器并做结构校验。
 */
export function generateCustomQuestions(input: CustomGenerateInput): GeneratedQuestion[] {
  if (input.count <= 0) return []
  if (!input.types.length) return []

  if (input.types.length === 1 && input.types[0] === 'calculation') {
    const bankDb = new Database(runtimeConfig.bankPath || getBankPath(), { readonly: true })
    try {
      const map = buildKnowledgeMap(bankDb, input.subjectId, input.grade)
      return withDifficulty(
        buildCustomCalculation(input, resolveKnowledgeId(map, input.subjectName, '数与运算')),
        input.difficulties
      )
    } finally {
      bankDb.close()
    }
  }

  if (input.types.includes('calculation')) {
    const per = Math.max(1, Math.floor(input.count / input.types.length))
    const shared = input.subjectId
    const bankDb = new Database(runtimeConfig.bankPath || getBankPath(), { readonly: true })
    try {
      const map = buildKnowledgeMap(bankDb, shared, input.grade)
      const calcInput: CustomGenerateInput = {
        ...input,
        types: ['calculation'],
        params: { calculation: input.params.calculation ?? {} },
        count: per
      }
      const calc = buildCustomCalculation(calcInput, resolveKnowledgeId(map, input.subjectName, '数与运算'))
      const rest = collectFromGenerators({
        ...input,
        types: input.types.filter((type) => type !== 'calculation'),
        count: input.count - calc.length
      })
      return withDifficulty([...calc, ...rest], input.difficulties)
    } finally {
      bankDb.close()
    }
  }

  return withDifficulty(collectFromGenerators(input), input.difficulties)
}

