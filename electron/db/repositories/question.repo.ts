import { createHash } from 'node:crypto'
import { getDb } from '../connection'
import { CUSTOM_QUESTION_ID_BASE } from '../../../shared/constants'
import type {
  NewQuestion,
  Question,
  QuestionFilter,
  QuestionPage,
  QuestionType
} from '../../../shared/types'

export interface QuestionRow {
  id: number
  subject_id: number
  stage: string
  grade: number
  knowledge_id: number | null
  knowledge_name?: string | null
  type: string
  difficulty: number
  stem: string
  options: string | null
  answer: string
  solution: string | null
  score: number
  source: string | null
}

const BASE_SELECT = `
  SELECT q.id, q.subject_id, q.stage, q.grade, q.knowledge_id, k.name AS knowledge_name,
         q.type, q.difficulty, q.stem, q.options, q.answer, q.solution, q.score, q.source
  FROM bank.question q
  LEFT JOIN bank.knowledge_point k ON k.id = q.knowledge_id
`

function parseJson(value: string | null): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export function mapQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    subjectId: row.subject_id,
    stage: row.stage as Question['stage'],
    grade: row.grade,
    knowledgeId: row.knowledge_id,
    knowledgeName: row.knowledge_name ?? null,
    type: row.type as QuestionType,
    difficulty: row.difficulty,
    stem: row.stem,
    options: parseJson(row.options),
    answer: parseJson(row.answer) as Question['answer'],
    solution: row.solution,
    score: row.score,
    source: row.source
  }
}

export function fingerprintOf(input: {
  subjectId: number
  grade: number
  type: string
  stem: string
  options?: unknown
}): string {
  const optionsKey = input.options === undefined ? '' : JSON.stringify(input.options)
  return createHash('sha1')
    .update(`${input.subjectId}|${input.grade}|${input.type}|${input.stem.trim()}|${optionsKey}`)
    .digest('hex')
}

function buildWhere(filter: QuestionFilter): { sql: string; params: unknown[] } {
  const clauses: string[] = []
  const params: unknown[] = []

  if (filter.stage) {
    clauses.push('q.stage = ?')
    params.push(filter.stage)
  }
  if (filter.subjectId) {
    clauses.push('q.subject_id = ?')
    params.push(filter.subjectId)
  }
  if (filter.grade) {
    clauses.push('q.grade = ?')
    params.push(filter.grade)
  }
  if (filter.types && filter.types.length > 0) {
    clauses.push(`q.type IN (${filter.types.map(() => '?').join(',')})`)
    params.push(...filter.types)
  }
  if (filter.difficulties && filter.difficulties.length > 0) {
    clauses.push(`q.difficulty IN (${filter.difficulties.map(() => '?').join(',')})`)
    params.push(...filter.difficulties)
  }
  if (filter.knowledgeIds && filter.knowledgeIds.length > 0) {
    clauses.push(`q.knowledge_id IN (${filter.knowledgeIds.map(() => '?').join(',')})`)
    params.push(...filter.knowledgeIds)
  }
  if (filter.keyword) {
    const keyword = filter.keyword.trim().replace(/[\\%_]/g, (char) => `\\${char}`)
    clauses.push("q.stem LIKE ? ESCAPE '\\'")
    params.push(`%${keyword}%`)
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  }
}

export function pageQuestions(filter: QuestionFilter): QuestionPage {
  const page = Math.max(1, filter.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20))
  const where = buildWhere(filter)
  const db = getDb()

  const total = (
    db
      .prepare(`SELECT COUNT(*) AS count FROM bank.question q ${where.sql}`)
      .get(...where.params) as { count: number }
  ).count

  const rows = db
    .prepare(`${BASE_SELECT} ${where.sql} ORDER BY q.id DESC LIMIT ? OFFSET ?`)
    .all(...where.params, pageSize, (page - 1) * pageSize) as QuestionRow[]

  return { items: rows.map(mapQuestion), total, page, pageSize }
}

export function sampleQuestions(filter: QuestionFilter, limit: number): Question[] {
  const where = buildWhere(filter)
  const size = Math.min(200, Math.max(1, Math.floor(limit)))
  const rows = getDb()
    .prepare(`${BASE_SELECT} ${where.sql} ORDER BY RANDOM() LIMIT ?`)
    .all(...where.params, Math.min(600, size * 3)) as QuestionRow[]
  // 同一套卷内按题干+选项去重，避免抽到重复题
  const seen = new Set<string>()
  const picked: Question[] = []
  for (const row of rows) {
    const question = mapQuestion(row)
    const key = `${question.type}|${question.stem.trim()}|${JSON.stringify(question.options ?? null)}`
    if (seen.has(key)) continue
    seen.add(key)
    picked.push(question)
    if (picked.length >= size) break
  }
  return picked
}

export function getQuestion(id: number): Question | null {
  if (id >= CUSTOM_QUESTION_ID_BASE) {
    const row = getDb()
      .prepare(
        `SELECT cq.id + ? AS id, cq.subject_id, 'primary' AS stage, cq.grade, cq.knowledge_id,
                k.name AS knowledge_name, cq.type, cq.difficulty, cq.stem, cq.options, cq.answer,
                cq.solution, cq.score, cq.source
         FROM custom_question cq
         LEFT JOIN bank.knowledge_point k ON k.id = cq.knowledge_id
         WHERE cq.id = ?`
      )
      .get(CUSTOM_QUESTION_ID_BASE, id - CUSTOM_QUESTION_ID_BASE) as QuestionRow | undefined
    return row ? mapQuestion(row) : null
  }
  const row = getDb().prepare(`${BASE_SELECT} WHERE q.id = ?`).get(id) as QuestionRow | undefined
  return row ? mapQuestion(row) : null
}

export function pickRandomQuestions(filter: QuestionFilter, count: number, exclude: number[] = []): Question[] {
  const where = buildWhere(filter)
  const conditions: string[] = []
  const params: unknown[] = [...where.params]

  if (where.sql) conditions.push(where.sql.replace(/^WHERE\s+/, ''))
  if (exclude.length > 0) {
    conditions.push(`q.id NOT IN (${exclude.map(() => '?').join(',')})`)
    params.push(...exclude)
  }

  const sql = `${BASE_SELECT} ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY RANDOM() LIMIT ?`
  const rows = getDb().prepare(sql).all(...params, Math.max(1, count)) as QuestionRow[]
  return rows.map(mapQuestion)
}

export function createQuestion(input: NewQuestion): Question {
  const db = getDb()
  const fingerprint = fingerprintOf({
    subjectId: input.subjectId,
    grade: input.grade,
    type: input.type,
    stem: input.stem,
    options: input.options ?? undefined
  })
  const subject = db.prepare('SELECT stage FROM bank.subject WHERE id = ?').get(input.subjectId) as
    | { stage: string }
    | undefined
  if (!subject) throw new Error('学科不存在')

  const result = db
    .prepare(
      `INSERT INTO bank.question(subject_id, stage, grade, knowledge_id, type, difficulty, stem, options, answer, solution, score, source, fingerprint)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.subjectId,
      subject.stage,
      input.grade,
      input.knowledgeId ?? null,
      input.type,
      input.difficulty ?? 2,
      input.stem,
      input.options === undefined || input.options === null ? null : JSON.stringify(input.options),
      JSON.stringify(input.answer),
      input.solution ?? null,
      input.score ?? 2,
      input.source ?? '手动录入',
      fingerprint
    )
  return getQuestion(Number(result.lastInsertRowid))!
}

export function updateQuestion(id: number, input: NewQuestion): Question {
  const db = getDb()
  const subject = db.prepare('SELECT stage FROM bank.subject WHERE id = ?').get(input.subjectId) as
    | { stage: string }
    | undefined
  if (!subject) throw new Error('学科不存在')

  const fingerprint = fingerprintOf({
    subjectId: input.subjectId,
    grade: input.grade,
    type: input.type,
    stem: input.stem,
    options: input.options ?? undefined
  })

  db.prepare(
    `UPDATE bank.question SET subject_id = ?, stage = ?, grade = ?, knowledge_id = ?, type = ?,
       difficulty = ?, stem = ?, options = ?, answer = ?, solution = ?, score = ?, source = ?,
       fingerprint = ?, updated_at = datetime('now','localtime')
     WHERE id = ?`
  ).run(
    input.subjectId,
    subject.stage,
    input.grade,
    input.knowledgeId ?? null,
    input.type,
    input.difficulty ?? 2,
    input.stem,
    input.options === undefined || input.options === null ? null : JSON.stringify(input.options),
    JSON.stringify(input.answer),
    input.solution ?? null,
    input.score ?? 2,
    input.source ?? '手动录入',
    fingerprint,
    id
  )
  return getQuestion(id)!
}

export function deleteQuestion(id: number): void {
  getDb().prepare('DELETE FROM bank.paper_question WHERE question_id = ?').run(id)
  getDb().prepare('DELETE FROM bank.question WHERE id = ?').run(id)
}

export function typeStats(filter: QuestionFilter): { type: QuestionType; count: number }[] {
  const where = buildWhere(filter)
  return getDb()
    .prepare(`SELECT q.type AS type, COUNT(*) AS count FROM bank.question q ${where.sql} GROUP BY q.type`)
    .all(...where.params) as { type: QuestionType; count: number }[]
}

export function countQuestions(filter: QuestionFilter): number {
  const where = buildWhere(filter)
  return (
    getDb()
      .prepare(`SELECT COUNT(*) AS count FROM bank.question q ${where.sql}`)
      .get(...where.params) as { count: number }
  ).count
}
