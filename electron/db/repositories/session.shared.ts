import { getDb } from '../connection'
import { CUSTOM_QUESTION_ID_BASE } from '../../../shared/constants'
import { getCustomScore } from './custom.repo'
import { mapQuestion, type QuestionRow } from './question.repo'
import type {
  AnswerRecord,
  Paper,
  PaperQuestion,
  PaperType,
  ResultItem,
  SessionResult
} from '../../../shared/types'

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

interface PracticePaperRow extends PaperRow {
  payload: string | null
}

interface PaperQuestionRow extends QuestionRow {
  question_id: number
  sort: number
  score: number
  base_score: number
}

function toPaper(paper: PaperRow, rows: PaperQuestionRow[]): Paper {
  const questions: PaperQuestion[] = rows.map((row) => ({
    questionId: row.question_id,
    sort: row.sort,
    score: row.score,
    question: mapQuestion({ ...row, score: row.base_score })
  }))

  return {
    id: paper.id,
    title: paper.title,
    stage: paper.stage as Paper['stage'],
    grade: paper.grade,
    subjectId: paper.subject_id,
    type: paper.type as PaperType,
    duration: paper.duration,
    totalScore: paper.total_score,
    questions
  }
}

function getPaperRow(paperId: number): PaperRow | null {
  const paper = getDb()
    .prepare(
      'SELECT id, title, stage, grade, subject_id, type, duration, total_score FROM bank.paper WHERE id = ?'
    )
    .get(paperId) as PaperRow | undefined
  return paper ?? null
}

function getPracticePaperRow(paperId: number): PracticePaperRow | null {
  const paper = getDb()
    .prepare(
      'SELECT id, title, stage, grade, subject_id, type, duration, total_score, payload FROM practice_paper WHERE id = ?'
    )
    .get(paperId) as PracticePaperRow | undefined
  return paper ?? null
}

export function getPaper(paperId: number): Paper | null {
  const paper = getPaperRow(paperId)
  if (!paper) return null

  const rows = getDb()
    .prepare(
      `SELECT pq.question_id, pq.sort, pq.score,
              q.id, q.subject_id, q.stage, q.grade, q.knowledge_id, k.name AS knowledge_name,
              q.type, q.difficulty, q.stem, q.options, q.answer, q.solution, q.score AS base_score, q.source
       FROM bank.paper_question pq
       JOIN bank.question q ON q.id = pq.question_id
       LEFT JOIN bank.knowledge_point k ON k.id = q.knowledge_id
       WHERE pq.paper_id = ?
       ORDER BY pq.sort ASC`
    )
    .all(paperId) as PaperQuestionRow[]

  return toPaper(paper, rows)
}

export function getPracticePaper(recordId: number): Paper | null {
  const db = getDb()
  const record = db
    .prepare('SELECT paper_id FROM practice_record WHERE id = ?')
    .get(recordId) as { paper_id: number | null } | undefined
  if (!record?.paper_id) return null

  const paper = getPracticePaperRow(record.paper_id)
  if (!paper) return null

  if (paper.payload) {
    try {
      const snapshot = JSON.parse(paper.payload) as PaperQuestion[]
      if (Array.isArray(snapshot) && snapshot.length > 0) {
        return {
          id: paper.id,
          title: paper.title,
          stage: paper.stage as Paper['stage'],
          grade: paper.grade,
          subjectId: paper.subject_id,
          type: paper.type as Paper['type'],
          duration: paper.duration,
          totalScore: snapshot.reduce((sum, item) => sum + item.score, 0),
          questions: snapshot
        }
      }
    } catch {
      // 快照损坏时回退到旧版关联查询
    }
  }

  const bankRows = db
    .prepare(
      `SELECT pq.question_id, pq.sort, pq.score,
              q.id, q.subject_id, q.stage, q.grade, q.knowledge_id, k.name AS knowledge_name,
              q.type, q.difficulty, q.stem, q.options, q.answer, q.solution, q.score AS base_score, q.source
       FROM practice_paper_question pq
       JOIN bank.question q ON q.id = pq.question_id
       LEFT JOIN bank.knowledge_point k ON k.id = q.knowledge_id
       WHERE pq.paper_id = ?
       ORDER BY pq.sort ASC`
    )
    .all(record.paper_id) as PaperQuestionRow[]

  const ownCustom = db
    .prepare(
      `SELECT cq.id + ? AS question_id, cq.sort AS sort, cq.score,
              cq.id + ? AS id, cq.subject_id, 'primary' AS stage, cq.grade, cq.knowledge_id,
              k.name AS knowledge_name, cq.type, cq.difficulty, cq.stem, cq.options, cq.answer,
              cq.solution, cq.score AS base_score, cq.source
       FROM custom_question cq
       LEFT JOIN bank.knowledge_point k ON k.id = cq.knowledge_id
       WHERE cq.record_id = ?`
    )
    .all(CUSTOM_QUESTION_ID_BASE, CUSTOM_QUESTION_ID_BASE, recordId) as PaperQuestionRow[]

  const linkedCustom = db
    .prepare(
      `SELECT cq.id + ? AS question_id, pcq.sort AS sort, cq.score,
              cq.id + ? AS id, cq.subject_id, 'primary' AS stage, cq.grade, cq.knowledge_id,
              k.name AS knowledge_name, cq.type, cq.difficulty, cq.stem, cq.options, cq.answer,
              cq.solution, cq.score AS base_score, cq.source
       FROM practice_custom_question pcq
       JOIN custom_question cq ON cq.id = pcq.question_id
       LEFT JOIN bank.knowledge_point k ON k.id = cq.knowledge_id
       WHERE pcq.record_id = ?`
    )
    .all(CUSTOM_QUESTION_ID_BASE, CUSTOM_QUESTION_ID_BASE, recordId) as PaperQuestionRow[]

  const rows = [...bankRows, ...ownCustom, ...linkedCustom].sort((a, b) => a.sort - b.sort)
  if (rows.length === 0) return null
  return toPaper(paper, rows)
}

export function getExamPaper(recordId: number): Paper | null {
  const db = getDb()
  const record = db.prepare('SELECT paper_id FROM exam_record WHERE id = ?').get(recordId) as
    | { paper_id: number }
    | undefined
  if (!record) return null

  const rows = db
    .prepare(
      `SELECT eq.question_id, eq.sort, eq.score,
              q.id, q.subject_id, q.stage, q.grade, q.knowledge_id, k.name AS knowledge_name,
              q.type, q.difficulty, q.stem, q.options, q.answer, q.solution, q.score AS base_score, q.source
       FROM exam_question eq
       JOIN bank.question q ON q.id = eq.question_id
       LEFT JOIN bank.knowledge_point k ON k.id = q.knowledge_id
       WHERE eq.record_id = ?
       ORDER BY eq.sort ASC`
    )
    .all(recordId) as PaperQuestionRow[]

  if (rows.length === 0) return getPaper(record.paper_id)

  const paper = getPaperRow(record.paper_id)
  if (!paper) return null

  const snapshot = toPaper(paper, rows)
  return {
    ...snapshot,
    totalScore:
      Math.round(snapshot.questions.reduce((sum, item) => sum + item.score, 0) * 100) / 100
  }
}

export function getAnswers(recordType: PaperType, recordId: number): AnswerRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT id, record_id, record_type, question_id, user_answer, is_correct, score, answered_at
       FROM answer_record WHERE record_type = ? AND record_id = ?`
    )
    .all(recordType, recordId) as {
    id: number
    record_id: number
    record_type: string
    question_id: number
    user_answer: string | null
    is_correct: number | null
    score: number
    answered_at: string
  }[]

  return rows.map((row) => ({
    id: row.id,
    recordId: row.record_id,
    recordType: row.record_type as PaperType,
    questionId: row.question_id,
    userAnswer: row.user_answer ? safeParse(row.user_answer) : null,
    isCorrect: row.is_correct === null ? null : Boolean(row.is_correct),
    score: row.score,
    answeredAt: row.answered_at
  }))
}

export function safeParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export function upsertAnswer(input: {
  userId: number
  recordId: number
  recordType: PaperType
  questionId: number
  userAnswer: unknown
  isCorrect: boolean | null
  score: number
}): void {
  getDb()
    .prepare(
      `INSERT INTO answer_record(user_id, record_id, record_type, question_id, user_answer, is_correct, score)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(record_id, record_type, question_id) DO UPDATE SET
         user_answer = excluded.user_answer,
         is_correct = excluded.is_correct,
         score = excluded.score,
         answered_at = datetime('now','localtime')`
    )
    .run(
      input.userId,
      input.recordId,
      input.recordType,
      input.questionId,
      JSON.stringify(input.userAnswer ?? null),
      input.isCorrect === null ? null : input.isCorrect ? 1 : 0,
      input.score
    )
}

export function markWrong(userId: number, questionId: number): void {
  getDb()
    .prepare(
      `INSERT INTO wrong_book(user_id, question_id, wrong_count, last_wrong_at, mastered)
       VALUES (?, ?, 1, datetime('now','localtime'), 0)
       ON CONFLICT(user_id, question_id) DO UPDATE SET
         wrong_count = wrong_book.wrong_count + 1,
         last_wrong_at = datetime('now','localtime'),
         mastered = 0`
    )
    .run(userId, questionId)
}

export function markMastered(userId: number, questionId: number): void {
  getDb()
    .prepare(
      `INSERT INTO wrong_book(user_id, question_id, wrong_count, last_wrong_at, mastered)
       VALUES (?, ?, 1, datetime('now','localtime'), 1)
       ON CONFLICT(user_id, question_id) DO UPDATE SET mastered = 1`
    )
    .run(userId, questionId)
}

export function buildResult(
  recordType: PaperType,
  recordId: number,
  title: string,
  durationSec: number
): SessionResult {
  const answers = getAnswers(recordType, recordId)
  const answerMap = new Map(answers.map((item) => [item.questionId, item]))

  let paper: Paper | null
  if (recordType === 'practice') {
    paper = getPracticePaper(recordId)
  } else {
    paper = getExamPaper(recordId)
  }

  const items: ResultItem[] = (paper?.questions ?? []).map((question) => {
    const answer = answerMap.get(question.questionId)
    return {
      question: question.question,
      userAnswer: answer?.userAnswer ?? null,
      isCorrect: answer?.isCorrect ?? null,
      score: answer?.score ?? 0,
      order: question.sort,
      answerId: answer?.id ?? null
    }
  })

  const correctCount = items.filter((item) => item.isCorrect === true).length
  const pendingCount = items.filter((item) => item.isCorrect === null).length
  const wrongCount = items.filter((item) => item.isCorrect === false).length
  const userScore = items.reduce((sum, item) => sum + (item.score ?? 0), 0)
  const totalScore = paper?.questions.reduce((sum, item) => sum + item.score, 0) ?? 0
  const graded = correctCount + wrongCount

  return {
    title: title || paper?.title || '练习',
    type: recordType,
    recordId,
    questionCount: items.length,
    correctCount,
    wrongCount,
    pendingCount,
    userScore: Math.round(userScore * 100) / 100,
    totalScore: Math.round(totalScore * 100) / 100,
    durationSec,
    accuracy: graded === 0 ? 0 : Math.round((correctCount / graded) * 100),
    items
  }
}

export function findPaperScore(recordType: PaperType, recordId: number, questionId: number): number {
  if (recordType === 'exam') {
    const snapshot = getDb()
      .prepare('SELECT score FROM exam_question WHERE record_id = ? AND question_id = ?')
      .get(recordId, questionId) as { score: number } | undefined
    return snapshot?.score ?? 2
  }

  const customScore = getCustomScore(recordId, questionId)
  if (customScore !== null) return customScore

  const row = getDb()
    .prepare(
      `SELECT pq.score AS score FROM practice_paper_question pq
       JOIN practice_record r ON r.paper_id = pq.paper_id
       WHERE r.id = ? AND pq.question_id = ?`
    )
    .get(recordId, questionId) as { score: number } | undefined
  return row?.score ?? 2
}
