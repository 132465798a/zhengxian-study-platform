import { getDb } from '../connection'
import type { PrintHistoryItem, PrintHistoryPage } from '../../../shared/types'

interface PrintHistoryRow {
  id: number
  title: string
  subject_name: string
  grade: number | null
  question_count: number
  pages: number
  created_at: string
}

function normalizeCount(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function mapRow(row: PrintHistoryRow): PrintHistoryItem {
  return {
    id: row.id,
    title: row.title,
    subjectName: row.subject_name,
    grade: row.grade,
    questionCount: row.question_count,
    pages: row.pages,
    createdAt: row.created_at
  }
}

export function recordPrint(input: {
  userId: number
  title: string
  subjectName: string
  grade: number | null
  questionCount: number
  pages: number
}): void {
  const title = input.title.trim()
  if (!title) return
  if (!Number.isFinite(input.userId) || input.userId <= 0) return

  getDb()
    .prepare(
      `INSERT INTO print_history(user_id, title, subject_name, grade, question_count, pages)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.userId,
      title,
      input.subjectName.trim(),
      input.grade,
      normalizeCount(input.questionCount),
      normalizeCount(input.pages)
    )
}

export function listPrintHistory(userId: number, page = 1, pageSize = 20): PrintHistoryPage {
  const current = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1
  const size = Number.isFinite(pageSize) ? Math.min(50, Math.max(1, Math.floor(pageSize))) : 20
  const db = getDb()

  const total = (
    db.prepare('SELECT COUNT(*) AS count FROM print_history WHERE user_id = ?').get(userId) as {
      count: number
    }
  ).count

  const rows = db
    .prepare(
      `SELECT id, title, subject_name, grade, question_count, pages, created_at
       FROM print_history
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .all(userId, size, (current - 1) * size) as PrintHistoryRow[]

  return { items: rows.map(mapRow), total }
}

export function removePrintHistory(userId: number, id: number): { deleted: boolean } {
  if (!Number.isFinite(userId) || !Number.isFinite(id)) return { deleted: false }
  const result = getDb()
    .prepare('DELETE FROM print_history WHERE id = ? AND user_id = ?')
    .run(id, userId)
  return { deleted: result.changes > 0 }
}
