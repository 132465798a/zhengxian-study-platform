import { getDb } from '../connection'
import { getSubject } from './content.repo'
import {
  decodeQuestions,
  encodeQuestions,
  pickQuestions,
  scoreAnswers
} from './quiz.repo'
import { ValidationError } from '../../errors'
import type {
  FamilyEntry,
  FamilyMatchDetail,
  FamilyMatchSummary,
  FamilyOutcome,
  QuizAnswerInput
} from '../../../shared/types'

interface MatchRow {
  id: number
  title: string
  subject_id: number
  subject_name: string
  grade: number
  question_count: number
  payload: string
  end_date: string | null
  created_at: string
  entry_count: number
  joined: number
}

interface EntryRow {
  user_id: number
  name: string | null
  correct: number
  total: number
  duration_sec: number
  finished_at: string
}

const SUMMARY_SELECT = `
  SELECT m.id, m.title, m.subject_id, m.subject_name, m.grade, m.question_count,
         m.payload, m.end_date, m.created_at,
         (SELECT COUNT(*) FROM family_entry e WHERE e.match_id = m.id) AS entry_count,
         EXISTS(SELECT 1 FROM family_entry e WHERE e.match_id = m.id AND e.user_id = ?) AS joined
  FROM family_match m
`

function assertId(value: number, message: string): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError(message)
  return id
}

function mapSummary(row: MatchRow): FamilyMatchSummary {
  return {
    id: row.id,
    title: row.title,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    grade: row.grade,
    questionCount: row.question_count,
    endDate: row.end_date,
    createdAt: row.created_at,
    entryCount: row.entry_count,
    joined: Boolean(row.joined)
  }
}

function summaryById(userId: number, matchId: number): FamilyMatchSummary | null {
  const row = getDb()
    .prepare(`${SUMMARY_SELECT} WHERE m.id = ?`)
    .get(userId, matchId) as MatchRow | undefined
  return row ? mapSummary(row) : null
}

function listEntries(matchId: number): FamilyEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT e.user_id, u.name, e.correct, e.total, e.duration_sec, e.finished_at
       FROM family_entry e
       LEFT JOIN user u ON u.id = e.user_id
       WHERE e.match_id = ?
       ORDER BY e.correct DESC, e.duration_sec ASC, e.finished_at ASC`
    )
    .all(matchId) as EntryRow[]
  return rows.map((row) => ({
    userId: row.user_id,
    name: row.name ?? '',
    correct: row.correct,
    total: row.total,
    durationSec: row.duration_sec,
    finishedAt: row.finished_at
  }))
}

function isDateText(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  )
}

export function listFamilyMatches(userId: number): FamilyMatchSummary[] {
  const uid = assertId(userId, '账号不正确')
  const rows = getDb()
    .prepare(`${SUMMARY_SELECT} ORDER BY m.created_at DESC, m.id DESC LIMIT 50`)
    .all(uid) as MatchRow[]
  return rows.map(mapSummary)
}

export function createFamilyMatch(input: {
  userId: number
  subjectId: number
  grade: number
  title: string
  count: number
  endDate: string | null
}): FamilyMatchSummary {
  const userId = assertId(input.userId, '账号不正确')
  const subjectId = assertId(input.subjectId, '请选择学科')
  const grade = Number(input.grade)
  if (!Number.isInteger(grade) || grade <= 0) throw new ValidationError('年级不正确')

  const title = String(input.title ?? '').trim()
  if (title.length === 0) throw new ValidationError('比赛名称不能为空')
  if (title.length > 40) throw new ValidationError('比赛名称最多 40 个字')

  const count = Number(input.count)
  if (!Number.isInteger(count) || count < 5 || count > 20) {
    throw new ValidationError('题量需在 5 到 20 之间')
  }

  const rawEndDate = input.endDate === null ? '' : String(input.endDate).trim()
  const endDate = rawEndDate === '' ? null : rawEndDate
  if (endDate !== null && !isDateText(endDate)) {
    throw new ValidationError('截止日期格式应为 YYYY-MM-DD')
  }

  const questions = pickQuestions(subjectId, grade, count)
  if (questions.length === 0) throw new ValidationError('当前条件暂无可用题目')

  const subjectName = getSubject(subjectId)?.name ?? ''
  const result = getDb()
    .prepare(
      `INSERT INTO family_match(title, subject_id, subject_name, grade, question_count, payload, end_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      subjectId,
      subjectName,
      grade,
      questions.length,
      encodeQuestions(questions),
      endDate,
      userId
    )

  const created = summaryById(userId, Number(result.lastInsertRowid))
  if (!created) throw new ValidationError('比赛不存在')
  return created
}

export function getFamilyMatch(userId: number, matchId: number): FamilyMatchDetail {
  const uid = assertId(userId, '账号不正确')
  const id = assertId(matchId, '比赛不正确')
  const row = getDb()
    .prepare(`${SUMMARY_SELECT} WHERE m.id = ?`)
    .get(uid, id) as MatchRow | undefined
  if (!row) throw new ValidationError('比赛不存在')

  return {
    ...mapSummary(row),
    questions: decodeQuestions(row.payload),
    entries: listEntries(id)
  }
}

export function submitFamilyAnswer(input: {
  userId: number
  matchId: number
  answers: QuizAnswerInput[]
  durationSec: number
}): FamilyOutcome {
  const userId = assertId(input.userId, '账号不正确')
  const matchId = assertId(input.matchId, '比赛不正确')
  const db = getDb()

  const match = db
    .prepare('SELECT id, payload, end_date FROM family_match WHERE id = ?')
    .get(matchId) as { id: number; payload: string; end_date: string | null } | undefined
  if (!match) throw new ValidationError('比赛不存在')

  if (match.end_date) {
    const today = db.prepare("SELECT date('now','localtime') AS d").get() as { d: string }
    if (today.d > match.end_date) throw new ValidationError('比赛已截止')
  }

  const joined = db
    .prepare('SELECT 1 AS ok FROM family_entry WHERE match_id = ? AND user_id = ?')
    .get(matchId, userId)
  if (joined) throw new ValidationError('你已经交过卷了')

  const questions = decodeQuestions(match.payload)
  if (questions.length === 0) throw new ValidationError('比赛不存在')

  const given = new Map(input.answers.map((item) => [item.questionId, item.answer]))
  const answers: QuizAnswerInput[] = questions.map((question) => ({
    questionId: question.id,
    answer: given.has(question.id) ? given.get(question.id) : null
  }))

  const scored = scoreAnswers(questions, answers)
  const correct = scored.filter((item) => item.isCorrect === true).length
  const total = questions.length
  const durationSec = Math.max(0, Math.round(Number(input.durationSec) || 0))

  db.prepare(
    'INSERT INTO family_entry(match_id, user_id, correct, total, duration_sec) VALUES (?, ?, ?, ?, ?)'
  ).run(matchId, userId, correct, total, durationSec)

  return { correct, total, durationSec, entries: listEntries(matchId) }
}
