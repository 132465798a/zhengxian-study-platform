import { getDb } from '../connection'

export interface PrintTemplateRow {
  id: number
  name: string
  subject_id: number | null
  grade: number | null
  created_at: string
}

export interface PrintTemplateSummary {
  id: number
  name: string
  subjectId: number | null
  grade: number | null
  createdAt: string
}

export interface PrintTemplateDetail extends PrintTemplateSummary {
  payload: string
}

function mapRow(row: PrintTemplateRow): PrintTemplateSummary {
  return {
    id: row.id,
    name: row.name,
    subjectId: row.subject_id,
    grade: row.grade,
    createdAt: row.created_at
  }
}

export function listPrintTemplates(userId: number): PrintTemplateSummary[] {
  const rows = getDb()
    .prepare(
      'SELECT id, name, subject_id, grade, created_at FROM print_template WHERE user_id = ? ORDER BY id DESC LIMIT 50'
    )
    .all(userId) as PrintTemplateRow[]
  return rows.map(mapRow)
}

export function getPrintTemplate(userId: number, id: number): PrintTemplateDetail | null {
  const row = getDb()
    .prepare(
      'SELECT id, name, subject_id, grade, created_at, payload FROM print_template WHERE id = ? AND user_id = ?'
    )
    .get(id, userId) as (PrintTemplateRow & { payload: string }) | undefined
  if (!row) return null
  return { ...mapRow(row), payload: row.payload }
}

export function savePrintTemplate(input: {
  userId: number
  name: string
  subjectId: number
  grade: number
  payload: string
}): PrintTemplateSummary {
  const result = getDb()
    .prepare(
      'INSERT INTO print_template(user_id, name, subject_id, grade, payload) VALUES (?, ?, ?, ?, ?)'
    )
    .run(input.userId, input.name, input.subjectId, input.grade, input.payload)
  return {
    id: Number(result.lastInsertRowid),
    name: input.name,
    subjectId: input.subjectId,
    grade: input.grade,
    createdAt: new Date().toLocaleString('zh-CN', { hour12: false })
  }
}

export function deletePrintTemplate(userId: number, id: number): boolean {
  const result = getDb()
    .prepare('DELETE FROM print_template WHERE id = ? AND user_id = ?')
    .run(id, userId)
  return result.changes > 0
}
