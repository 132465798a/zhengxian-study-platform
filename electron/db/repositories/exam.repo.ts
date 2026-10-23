import { getDb } from '../connection'
import { scoreAnswer } from '../scoring'
import { topUp } from '../generators/runtime'
import { getExamPaper, getPaper, buildResult, getAnswers, markWrong, upsertAnswer, safeParse } from './session.shared'
import { settleExam } from './incentive.repo'
import type {
  AnswerRecord,
  ExamRecord,
  ExamSession,
  ExamTemplate,
  HistoryItem,
  SessionResult
} from '../../../shared/types'

interface ExamRow {
  id: number
  user_id: number
  paper_id: number
  total_score: number | null
  user_score: number | null
  duration_sec: number
  status: string
  started_at: string
  finished_at: string | null
}

function mapExamRecord(row: ExamRow): ExamRecord {
  return {
    id: row.id,
    userId: row.user_id,
    paperId: row.paper_id,
    totalScore: row.total_score,
    userScore: row.user_score,
    durationSec: row.duration_sec,
    status: row.status as ExamRecord['status'],
    startedAt: row.started_at,
    finishedAt: row.finished_at
  }
}

export function listExamTemplates(userId: number): ExamTemplate[] {
  const db = getDb()
  const papers = db
    .prepare(
      `SELECT p.id, p.title, p.stage, p.grade, p.subject_id, p.type, p.duration, p.total_score,
              s.name AS subject_name
       FROM bank.paper p
       LEFT JOIN bank.subject s ON s.id = p.subject_id
       WHERE p.type = 'exam'
       ORDER BY p.grade ASC, p.subject_id ASC, p.id ASC`
    )
    .all() as {
    id: number
    title: string
    stage: string
    grade: number | null
    subject_id: number | null
    type: string
    duration: number | null
    total_score: number | null
    subject_name: string | null
  }[]

  return papers.map((paper) => {
    const stats = db
      .prepare(
        `SELECT MAX(user_score) AS best, COUNT(*) AS attempts
         FROM exam_record WHERE user_id = ? AND paper_id = ? AND status != 'doing'`
      )
      .get(userId, paper.id) as { best: number | null; attempts: number }
    return {
      paper: {
        id: paper.id,
        title: paper.subject_name ? `${paper.subject_name} · ${paper.title}` : paper.title,
        stage: paper.stage as ExamTemplate['paper']['stage'],
        grade: paper.grade,
        subjectId: paper.subject_id,
        type: 'exam',
        duration: paper.duration,
        totalScore: paper.total_score,
        questions: []
      },
      bestScore: stats.best,
      attemptCount: stats.attempts
    }
  })
}

interface PaperRule {
  mode?: string
  filters?: {
    subjectId?: number
    grade?: number
  }
  count?: number
}

interface SnapshotRow {
  id: number
  score: number
}

function parsePaperRule(raw: string | null): PaperRule | null {
  if (!raw) return null
  const parsed = safeParse(raw)
  return parsed !== null && typeof parsed === 'object' ? (parsed as PaperRule) : null
}

function pickSnapshotRows(paperId: number): SnapshotRow[] {
  const db = getDb()
  const paper = db.prepare('SELECT rule FROM bank.paper WHERE id = ?').get(paperId) as
    | { rule: string | null }
    | undefined
  const rule = parsePaperRule(paper?.rule ?? null)
  const subjectId = rule?.filters?.subjectId
  const grade = rule?.filters?.grade

  if (rule?.mode === 'auto' && typeof subjectId === 'number' && typeof grade === 'number') {
    const count = typeof rule.count === 'number' ? Math.floor(rule.count) : 10
    const picked = db
      .prepare(
        'SELECT id, score FROM bank.question WHERE subject_id = ? AND grade = ? ORDER BY RANDOM() LIMIT ?'
      )
      .all(subjectId, grade, count) as SnapshotRow[]
    if (picked.length > 0) return picked
    topUp({
      db,
      subjectId,
      grade,
      type: 'single',
      difficulty: null,
      deficit: count
    })
    const repicked = db
      .prepare(
        'SELECT id, score FROM bank.question WHERE subject_id = ? AND grade = ? ORDER BY RANDOM() LIMIT ?'
      )
      .all(subjectId, grade, count) as SnapshotRow[]
    if (repicked.length > 0) return repicked
  }

  return db
    .prepare(
      'SELECT question_id AS id, score FROM bank.paper_question WHERE paper_id = ? ORDER BY sort ASC'
    )
    .all(paperId) as SnapshotRow[]
}

export function startExam(userId: number, paperId: number): ExamSession {
  const db = getDb()
  const paper = getPaper(paperId)
  if (!paper) throw new Error('试卷不存在')

  const existing = db
    .prepare(
      "SELECT * FROM exam_record WHERE user_id = ? AND paper_id = ? AND status = 'doing' ORDER BY id DESC LIMIT 1"
    )
    .get(userId, paperId) as ExamRow | undefined

  if (existing) {
    const examPaper = getExamPaper(existing.id)
    if (!examPaper) throw new Error('试卷不存在')
    return {
      record: mapExamRecord(existing),
      paper: examPaper,
      answers: getAnswers('exam', existing.id)
    }
  }

  const create = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO exam_record(user_id, paper_id, total_score, user_score, duration_sec, status)
         VALUES (?, ?, 0, 0, 0, 'doing')`
      )
      .run(userId, paperId)

    const recordId = Number(result.lastInsertRowid)
    const picked = pickSnapshotRows(paperId)
    const insertQuestion = db.prepare(
      'INSERT INTO exam_question(record_id, question_id, sort, score) VALUES (?, ?, ?, ?)'
    )
    let totalScore = 0

    picked.forEach((item, index) => {
      insertQuestion.run(recordId, item.id, index + 1, item.score)
      totalScore += item.score
    })

    db.prepare('UPDATE exam_record SET total_score = ? WHERE id = ?').run(
      Math.round(totalScore * 100) / 100,
      recordId
    )
    return recordId
  })

  const recordId = create()
  const examPaper = getExamPaper(recordId)
  if (!examPaper) throw new Error('试卷不存在')

  return {
    record: mapExamRecord(
      db.prepare('SELECT * FROM exam_record WHERE id = ?').get(recordId) as ExamRow
    ),
    paper: examPaper,
    answers: []
  }
}

export function getExamSession(userId: number, recordId: number): ExamSession | null {
  const row = getDb()
    .prepare('SELECT * FROM exam_record WHERE id = ? AND user_id = ?')
    .get(recordId, userId) as ExamRow | undefined
  if (!row) return null
  const paper = getExamPaper(recordId)
  if (!paper) return null
  return { record: mapExamRecord(row), paper, answers: getAnswers('exam', recordId) }
}

export function answerExamQuestion(input: {
  userId: number
  recordId: number
  questionId: number
  answer: unknown
}): { saved: true } {
  const record = getDb()
    .prepare("SELECT id FROM exam_record WHERE id = ? AND user_id = ? AND status = 'doing'")
    .get(input.recordId, input.userId) as { id: number } | undefined
  if (!record) throw new Error('考试不存在或已结束')

  upsertAnswer({
    userId: input.userId,
    recordId: input.recordId,
    recordType: 'exam',
    questionId: input.questionId,
    userAnswer: input.answer,
    isCorrect: null,
    score: 0
  })
  return { saved: true }
}

export function submitExam(recordId: number, userId: number, durationSec: number): SessionResult {
  const db = getDb()
  const record = db
    .prepare("SELECT * FROM exam_record WHERE id = ? AND user_id = ? AND status = 'doing'")
    .get(recordId, userId) as ExamRow | undefined
  if (!record) throw new Error('考试不存在或已结束')

  const paper = getExamPaper(recordId)
  if (!paper) throw new Error('试卷不存在')

  const answers = new Map<number, AnswerRecord>(
    getAnswers('exam', recordId).map((item) => [item.questionId, item])
  )

  let userScore = 0
  const submit = db.transaction(() => {
    for (const item of paper.questions) {
      const answered = answers.get(item.questionId)
      const outcome = answered
        ? scoreAnswer(item.question.type, item.question.answer, answered.userAnswer, item.score)
        : { isCorrect: false as const, score: 0 }

      const score = outcome.score
      userScore += score

      upsertAnswer({
        userId,
        recordId,
        recordType: 'exam',
        questionId: item.questionId,
        userAnswer: answered?.userAnswer ?? null,
        isCorrect: outcome.isCorrect,
        score
      })

      if (outcome.isCorrect === false) markWrong(userId, item.questionId)
    }

    db.prepare(
      `UPDATE exam_record SET status = 'done', user_score = ?, total_score = ?, duration_sec = ?,
         finished_at = datetime('now','localtime') WHERE id = ?`
    ).run(
      Math.round(userScore * 100) / 100,
      Math.round(paper.questions.reduce((sum, item) => sum + item.score, 0) * 100) / 100,
      Math.round(durationSec),
      recordId
    )
  })

  submit()
  const settle = settleExam(userId, recordId)
  return {
    ...buildResult('exam', recordId, paper.title, Math.round(durationSec)),
    growthGained: settle.gained,
    unlockedAchievements: settle.unlocked
  }
}

export function getExamResult(userId: number, recordId: number): SessionResult | null {
  const row = getDb()
    .prepare('SELECT * FROM exam_record WHERE id = ? AND user_id = ?')
    .get(recordId, userId) as ExamRow | undefined
  if (!row) return null
  const paper = getExamPaper(recordId)
  return buildResult('exam', recordId, paper?.title ?? '考试', row.duration_sec)
}

export function listExamHistory(userId: number, limit = 20): HistoryItem[] {
  const rows = getDb()
    .prepare(
      `SELECT er.id, er.user_score, er.total_score, er.duration_sec, er.started_at, er.finished_at,
              p.title, p.grade, s.name AS subject_name,
              (SELECT COUNT(*) FROM bank.paper_question pq WHERE pq.paper_id = p.id) AS question_count
       FROM exam_record er
       JOIN bank.paper p ON p.id = er.paper_id
       LEFT JOIN bank.subject s ON s.id = p.subject_id
       WHERE er.user_id = ? AND er.status != 'doing'
       ORDER BY er.finished_at DESC LIMIT ?`
    )
    .all(userId, limit) as {
    id: number
    user_score: number | null
    total_score: number | null
    duration_sec: number
    started_at: string
    finished_at: string | null
    title: string
    grade: number | null
    subject_name: string | null
    question_count: number
  }[]

  return rows.map((row) => ({
    id: row.id,
    type: 'exam',
    title: row.subject_name ? `${row.subject_name} · ${row.title}` : row.title,
    subjectName: row.subject_name ?? '',
    grade: row.grade ?? 0,
    questionCount: row.question_count,
    correctCount: 0,
    score: row.user_score ?? 0,
    totalScore: row.total_score ?? 0,
    accuracy:
      row.total_score && row.total_score > 0
        ? Math.round(((row.user_score ?? 0) / row.total_score) * 100)
        : 0,
    durationSec: row.duration_sec,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  }))
}

export { safeParse }
