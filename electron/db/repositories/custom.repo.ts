import { getDb } from '../connection'
import { CUSTOM_QUESTION_ID_BASE } from '../../../shared/constants'
import { mapQuestion, type QuestionRow } from './question.repo'
import type { GeneratedQuestion } from '../generators/types'
import type { Paper, PaperQuestion } from '../../../shared/types'

interface CustomRow extends QuestionRow {
  sort: number
}

interface PaperRow {
  id: number
  title: string
  stage: string
  grade: number | null
  subject_id: number | null
  type: string
  duration: number | null
  total_score: number | null
}

const CUSTOM_SELECT = `
  SELECT cq.id + ? AS id, cq.subject_id, 'primary' AS stage, cq.grade, cq.knowledge_id,
         k.name AS knowledge_name, cq.type, cq.difficulty, cq.stem, cq.options, cq.answer,
         cq.solution, cq.score, cq.source, cq.sort
  FROM custom_question cq
  LEFT JOIN bank.knowledge_point k ON k.id = cq.knowledge_id
`

export function insertCustomQuestions(
  recordId: number,
  subjectId: number,
  questions: GeneratedQuestion[]
): number[] {
  const db = getDb()
  const insert = db.prepare(
    `INSERT INTO custom_question(record_id, sort, subject_id, grade, knowledge_id, type, difficulty,
       stem, options, answer, solution, score, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const ids: number[] = []
  const transaction = db.transaction(() => {
    questions.forEach((question, index) => {
      const result = insert.run(
        recordId,
        index,
        subjectId,
        question.grade,
        question.knowledgeId ?? null,
        question.type,
        question.difficulty,
        question.stem,
        question.options === undefined ? null : JSON.stringify(question.options),
        JSON.stringify(question.answer),
        question.solution ?? null,
        question.score ?? 2,
        question.source
      )
      ids.push(CUSTOM_QUESTION_ID_BASE + Number(result.lastInsertRowid))
    })
  })
  transaction()
  return ids
}

/** 混合试卷（如错题专练）引用已有生成题，不复制题目内容 */
export function linkCustomQuestions(recordId: number, questionIds: number[], sorts: number[]): void {
  const db = getDb()
  const insert = db.prepare(
    'INSERT OR IGNORE INTO practice_custom_question(record_id, question_id, sort) VALUES (?, ?, ?)'
  )
  const transaction = db.transaction(() => {
    questionIds.forEach((id, index) => {
      if (id < CUSTOM_QUESTION_ID_BASE) return
      insert.run(recordId, id - CUSTOM_QUESTION_ID_BASE, sorts[index] ?? index)
    })
  })
  transaction()
}

function getPaperRow(paperId: number): PaperRow | null {
  const row = getDb()
    .prepare(
      'SELECT id, title, stage, grade, subject_id, type, duration, total_score FROM practice_paper WHERE id = ?'
    )
    .get(paperId) as PaperRow | undefined
  return row ?? null
}

export function getCustomPaper(recordId: number): Paper | null {
  const record = getDb()
    .prepare('SELECT paper_id FROM practice_record WHERE id = ?')
    .get(recordId) as { paper_id: number | null } | undefined
  if (!record?.paper_id) return null

  const rows = getDb()
    .prepare(`${CUSTOM_SELECT} WHERE cq.record_id = ? ORDER BY cq.sort ASC`)
    .all(CUSTOM_QUESTION_ID_BASE, recordId) as CustomRow[]
  if (rows.length === 0) return null

  const paper = getPaperRow(record.paper_id)
  if (!paper) return null

  const questions: PaperQuestion[] = rows.map((row) => ({
    questionId: row.id,
    sort: row.sort,
    score: row.score,
    question: mapQuestion(row)
  }))

  return {
    id: paper.id,
    title: paper.title,
    stage: paper.stage as Paper['stage'],
    grade: paper.grade,
    subjectId: paper.subject_id,
    type: paper.type as Paper['type'],
    duration: paper.duration,
    totalScore: questions.reduce((sum, item) => sum + item.score, 0),
    questions
  }
}

export function getCustomScore(_recordId: number, questionId: number): number | null {
  if (questionId < CUSTOM_QUESTION_ID_BASE) return null
  const row = getDb()
    .prepare('SELECT score FROM custom_question WHERE id = ?')
    .get(questionId - CUSTOM_QUESTION_ID_BASE) as { score: number } | undefined
  return row?.score ?? null
}
