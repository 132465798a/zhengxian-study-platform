import { getDb } from '../connection'
import { CUSTOM_QUESTION_ID_BASE } from '../../../shared/constants'
import { mapQuestion, type QuestionRow } from './question.repo'
import type { WrongBookFilter, WrongBookItem, WrongBookPage } from '../../../shared/types'

export function pageWrongBook(filter: WrongBookFilter): WrongBookPage {
  const page = Math.max(1, filter.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20))
  const clauses = ['wb.user_id = ?', '(q.id IS NOT NULL OR cq.id IS NOT NULL)']
  const params: unknown[] = [filter.userId]

  if (filter.subjectId) {
    clauses.push('COALESCE(q.subject_id, cq.subject_id) = ?')
    params.push(filter.subjectId)
  }
  if (filter.grade) {
    clauses.push('COALESCE(q.grade, cq.grade) = ?')
    params.push(filter.grade)
  }
  if (filter.mastered !== undefined) {
    clauses.push('wb.mastered = ?')
    params.push(filter.mastered ? 1 : 0)
  }

  const where = `WHERE ${clauses.join(' AND ')}`
  const db = getDb()
  const customJoin = `LEFT JOIN custom_question cq ON cq.id = wb.question_id - ${CUSTOM_QUESTION_ID_BASE}`

  const total = (
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM wrong_book wb
         LEFT JOIN bank.question q ON q.id = wb.question_id
         ${customJoin}
         ${where}`
      )
      .get(...params) as { count: number }
  ).count

  const rows = db
    .prepare(
      `SELECT wb.id AS wb_id, wb.wrong_count, wb.last_wrong_at, wb.mastered,
              COALESCE(q.id, cq.id + ${CUSTOM_QUESTION_ID_BASE}) AS id,
              COALESCE(q.subject_id, cq.subject_id) AS subject_id,
              COALESCE(q.stage, 'primary') AS stage,
              COALESCE(q.grade, cq.grade) AS grade,
              COALESCE(q.knowledge_id, cq.knowledge_id) AS knowledge_id,
              k.name AS knowledge_name,
              COALESCE(q.type, cq.type) AS type,
              COALESCE(q.difficulty, cq.difficulty) AS difficulty,
              COALESCE(q.stem, cq.stem) AS stem,
              COALESCE(q.options, cq.options) AS options,
              COALESCE(q.answer, cq.answer) AS answer,
              COALESCE(q.solution, cq.solution) AS solution,
              COALESCE(q.score, cq.score) AS score,
              COALESCE(q.source, cq.source) AS source
       FROM wrong_book wb
       LEFT JOIN bank.question q ON q.id = wb.question_id
       ${customJoin}
       LEFT JOIN bank.knowledge_point k ON k.id = COALESCE(q.knowledge_id, cq.knowledge_id)
       ${where}
       ORDER BY wb.last_wrong_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, (page - 1) * pageSize) as (Record<string, unknown> & {
    wb_id: number
    wrong_count: number
    last_wrong_at: string
    mastered: number
  })[]

  const items: WrongBookItem[] = rows.map((row) => ({
    id: row.wb_id,
    question: mapQuestion(row as unknown as QuestionRow),
    wrongCount: row.wrong_count,
    lastWrongAt: row.last_wrong_at,
    mastered: Boolean(row.mastered)
  }))

  return { items, total }
}

export function setMastered(userId: number, id: number, mastered: boolean): void {
  getDb()
    .prepare('UPDATE wrong_book SET mastered = ? WHERE id = ? AND user_id = ?')
    .run(mastered ? 1 : 0, id, userId)
}

export function removeWrong(userId: number, id: number): void {
  getDb().prepare('DELETE FROM wrong_book WHERE id = ? AND user_id = ?').run(id, userId)
}

export function wrongSummary(userId: number): {
  total: number
  unmastered: number
  mastered: number
  bySubject: { subjectId: number; name: string; count: number }[]
} {
  const db = getDb()
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN mastered = 0 THEN 1 ELSE 0 END) AS unmastered,
              SUM(CASE WHEN mastered = 1 THEN 1 ELSE 0 END) AS mastered
       FROM wrong_book WHERE user_id = ?`
    )
    .get(userId) as { total: number; unmastered: number | null; mastered: number | null }

  const bySubject = db
    .prepare(
      `SELECT s.id AS subjectId, s.name AS name, COUNT(*) AS count
       FROM wrong_book wb
       LEFT JOIN bank.question q ON q.id = wb.question_id
       LEFT JOIN custom_question cq ON cq.id = wb.question_id - ${CUSTOM_QUESTION_ID_BASE}
       JOIN bank.subject s ON s.id = COALESCE(q.subject_id, cq.subject_id)
       WHERE wb.user_id = ? AND wb.mastered = 0 AND (q.id IS NOT NULL OR cq.id IS NOT NULL)
       GROUP BY s.id ORDER BY s.sort`
    )
    .all(userId) as { subjectId: number; name: string; count: number }[]

  return {
    total: totals.total,
    unmastered: totals.unmastered ?? 0,
    mastered: totals.mastered ?? 0,
    bySubject
  }
}
