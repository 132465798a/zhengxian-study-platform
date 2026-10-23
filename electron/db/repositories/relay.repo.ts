import { getDb } from '../connection'
import { getSubject } from './content.repo'
import { decodeQuestions, encodeQuestions, pickQuestions, scoreAnswers } from './quiz.repo'
import { ValidationError } from '../../errors'
import type {
  Question,
  RelayMatch,
  RelayQuestionState,
  RelayStatus,
  RelayTurnOutcome
} from '../../../shared/types'

interface RelayRow {
  id: number
  user_a: number
  user_b: number
  subject_id: number
  subject_name: string
  grade: number
  question_count: number
  turn_seconds: number
  payload: string
  answers: string
  current_index: number
  status: string
  created_at: string
  finished_at: string | null
  name_a: string | null
  name_b: string | null
}

interface RelayMark {
  index: number
  userId: number
  isCorrect: boolean | null
}

const RELAY_SELECT = `
  SELECT m.id, m.user_a, m.user_b, m.subject_id, m.subject_name, m.grade, m.question_count,
         m.turn_seconds, m.payload, m.answers, m.current_index, m.status, m.created_at,
         m.finished_at, ua.name AS name_a, ub.name AS name_b
  FROM relay_match m
  LEFT JOIN user ua ON ua.id = m.user_a
  LEFT JOIN user ub ON ub.id = m.user_b
`

function assertId(value: number, message: string): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError(message)
  return id
}

function parseMarks(raw: string): RelayMark[] {
  try {
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data.filter((item): item is RelayMark => {
      if (!item || typeof item !== 'object') return false
      const mark = item as Partial<RelayMark>
      return typeof mark.index === 'number' && typeof mark.userId === 'number'
    })
  } catch {
    return []
  }
}

function correctCount(marks: RelayMark[], userId: number): number {
  return marks.filter((mark) => mark.userId === userId && mark.isCorrect === true).length
}

function winnerOf(marks: RelayMark[], userA: number, userB: number): number | null {
  const countA = correctCount(marks, userA)
  const countB = correctCount(marks, userB)
  if (countA === countB) return null
  return countA > countB ? userA : userB
}

function mapMatch(row: RelayRow): RelayMatch {
  const marks = parseMarks(row.answers)
  const status = row.status as RelayStatus
  const countA = correctCount(marks, row.user_a)
  const countB = correctCount(marks, row.user_b)
  return {
    id: row.id,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    grade: row.grade,
    questionCount: row.question_count,
    turnSeconds: row.turn_seconds,
    currentIndex: row.current_index,
    currentUserId: status === 'running' ? (row.current_index % 2 === 0 ? row.user_a : row.user_b) : null,
    status,
    userA: row.user_a,
    userB: row.user_b,
    nameA: row.name_a ?? '',
    nameB: row.name_b ?? '',
    correctA: countA,
    correctB: countB,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    winnerId: status === 'finished' ? winnerOf(marks, row.user_a, row.user_b) : null
  }
}

function rowById(matchId: number): RelayRow | undefined {
  return getDb().prepare(`${RELAY_SELECT} WHERE m.id = ?`).get(matchId) as RelayRow | undefined
}

function settleRelay(
  matchId: number,
  userA: number,
  userB: number,
  winnerId: number | null
): void {
  const db = getDb()
  const settled = db
    .prepare("SELECT 1 AS ok FROM point_ledger WHERE reason = 'relay' AND ref_id = ? LIMIT 1")
    .get(matchId)
  if (settled) return

  const today = db.prepare("SELECT date('now','localtime') AS d").get() as { d: string }
  for (const userId of [userA, userB]) {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS n FROM relay_match
         WHERE status = 'finished' AND (user_a = ? OR user_b = ?) AND date(finished_at) = ?`
      )
      .get(userId, userId, today.d) as { n: number }
    if (row.n > 3) continue
    const delta = winnerId === null ? 8 : winnerId === userId ? 15 : 3
    db.prepare(
      "INSERT INTO point_ledger(user_id, delta, reason, ref_type, ref_id) VALUES (?, ?, 'relay', 'relay', ?)"
    ).run(userId, delta, matchId)
  }
}

export function listRelayMatches(userId: number, limit = 10): RelayMatch[] {
  const uid = assertId(userId, '账号不正确')
  const size = Math.min(50, Math.max(1, Number(limit) || 10))
  const rows = getDb()
    .prepare(
      `${RELAY_SELECT} WHERE m.user_a = ? OR m.user_b = ?
       ORDER BY m.created_at DESC, m.id DESC LIMIT ?`
    )
    .all(uid, uid, size) as RelayRow[]
  return rows.map(mapMatch)
}

export function createRelayMatch(input: {
  userA: number
  userB: number
  subjectId: number
  grade: number
  count: number
  turnSeconds: number
}): RelayMatch {
  const userA = assertId(input.userA, '账号不正确')
  const userB = assertId(input.userB, '账号不正确')
  if (userA === userB) throw new ValidationError('不能和自己对战')

  const subjectId = assertId(input.subjectId, '请选择学科')
  const grade = Number(input.grade)
  if (!Number.isInteger(grade) || grade <= 0) throw new ValidationError('年级不正确')

  const count = Number(input.count)
  if (!Number.isInteger(count) || count < 5 || count > 20) {
    throw new ValidationError('题量需在 5 到 20 之间')
  }

  const turnSeconds = Number(input.turnSeconds)
  if (turnSeconds !== 15 && turnSeconds !== 30 && turnSeconds !== 60) {
    throw new ValidationError('回合时长只能是 15、30 或 60 秒')
  }

  const db = getDb()
  const users = db
    .prepare('SELECT COUNT(*) AS n FROM user WHERE id IN (?, ?)')
    .get(userA, userB) as { n: number }
  if (users.n < 2) throw new ValidationError('账号不存在')

  const subject = getSubject(subjectId)
  if (!subject) throw new ValidationError('学科不存在')

  const questions = pickQuestions(subjectId, grade, count)
  if (questions.length === 0) throw new ValidationError('当前条件暂无可用题目')

  const result = db
    .prepare(
      `INSERT INTO relay_match(user_a, user_b, subject_id, subject_name, grade, question_count, turn_seconds, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userA,
      userB,
      subjectId,
      subject.name,
      grade,
      questions.length,
      turnSeconds,
      encodeQuestions(questions)
    )

  const created = rowById(Number(result.lastInsertRowid))
  if (!created) throw new ValidationError('对局不存在')
  return mapMatch(created)
}

export function getRelayMatch(matchId: number): RelayQuestionState {
  const id = assertId(matchId, '对局不存在')
  const row = rowById(id)
  if (!row) throw new ValidationError('对局不存在')

  const match = mapMatch(row)
  let question: Question | null = null
  if (match.status === 'running') {
    const questions = decodeQuestions(row.payload)
    question = questions[match.currentIndex] ?? null
  }

  return { match, question, answered: parseMarks(row.answers) }
}

export function answerRelayTurn(input: {
  matchId: number
  userId: number
  answer: unknown
  timeout?: boolean
}): RelayTurnOutcome {
  const matchId = assertId(input.matchId, '对局不存在')
  const userId = assertId(input.userId, '账号不正确')

  const db = getDb()
  const row = rowById(matchId)
  if (!row) throw new ValidationError('对局不存在')
  if (row.status !== 'running') throw new ValidationError('对局已结束')
  if (userId !== row.user_a && userId !== row.user_b) {
    throw new ValidationError('你不是本局参与者')
  }

  const currentUserId = row.current_index % 2 === 0 ? row.user_a : row.user_b
  if (userId !== currentUserId) throw new ValidationError('还没轮到你作答')

  const questions = decodeQuestions(row.payload)
  const question = questions[row.current_index]
  if (!question) throw new ValidationError('对局不存在')

  const timeout = input.timeout === true
  const answer = timeout ? null : input.answer
  const isCorrect: boolean | null = timeout
    ? false
    : (scoreAnswers([question], [{ questionId: question.id, answer }])[0]?.isCorrect ?? null)

  const marks: RelayMark[] = [
    ...parseMarks(row.answers),
    { index: row.current_index, userId, isCorrect }
  ]
  const nextIndex = row.current_index + 1
  const finished = nextIndex >= questions.length

  const commit = db.transaction(() => {
    if (finished) {
      db.prepare(
        `UPDATE relay_match
         SET answers = ?, current_index = ?, status = 'finished', finished_at = datetime('now','localtime')
         WHERE id = ?`
      ).run(JSON.stringify(marks), nextIndex, matchId)
      settleRelay(matchId, row.user_a, row.user_b, winnerOf(marks, row.user_a, row.user_b))
    } else {
      db.prepare('UPDATE relay_match SET answers = ?, current_index = ? WHERE id = ?').run(
        JSON.stringify(marks),
        nextIndex,
        matchId
      )
    }
  })
  commit()

  const state = getRelayMatch(matchId)
  return {
    isCorrect,
    finished,
    winnerId: state.match.winnerId,
    state
  }
}

export function voidRelayMatch(matchId: number, userId: number): RelayQuestionState {
  const id = assertId(matchId, '对局不存在')
  const uid = assertId(userId, '账号不正确')

  const db = getDb()
  const row = rowById(id)
  if (!row) throw new ValidationError('对局不存在')
  if (row.status !== 'running') throw new ValidationError('对局已结束')
  if (uid !== row.user_a && uid !== row.user_b) {
    throw new ValidationError('你不是本局参与者')
  }

  db.prepare(
    "UPDATE relay_match SET status = 'void', finished_at = datetime('now','localtime') WHERE id = ?"
  ).run(id)

  return getRelayMatch(id)
}
