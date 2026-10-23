import { getDb } from '../connection'
import { ACHIEVEMENTS, comboMultiplier, GROWTH_LEVELS } from '../../../shared/constants'
import { scoreAnswer } from '../scoring'
import { getQuestion } from './question.repo'
import type {
  AchievementItem,
  DailyChallenge,
  GrowthLevel,
  GrowthPoint,
  IncentiveOverview,
  QuestionAnswer,
  StudyCalendarDay
} from '../../../shared/types'

export interface SettleResult {
  gained: number
  unlocked: string[]
}

function localDate(): string {
  const row = getDb().prepare("SELECT date('now','localtime') AS d").get() as { d: string }
  return row.d
}

function formatDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function levelOf(growth: number): GrowthLevel {
  let index = 0
  for (let i = 0; i < GROWTH_LEVELS.length; i += 1) {
    if (growth >= GROWTH_LEVELS[i].min) index = i
  }
  const next = GROWTH_LEVELS[index + 1]
  return { index: index + 1, name: GROWTH_LEVELS[index].name, min: GROWTH_LEVELS[index].min, nextAt: next ? next.min : null }
}

function totalGrowth(userId: number): number {
  const row = getDb()
    .prepare('SELECT COALESCE(SUM(delta), 0) AS total FROM point_ledger WHERE user_id = ?')
    .get(userId) as { total: number }
  return row.total
}

function hasLedger(userId: number, reason: string, refId: number): boolean {
  const row = getDb()
    .prepare('SELECT 1 AS ok FROM point_ledger WHERE user_id = ? AND reason = ? AND ref_id = ? LIMIT 1')
    .get(userId, reason, refId)
  return Boolean(row)
}

function addPoint(userId: number, delta: number, reason: string, refType: string | null, refId: number | null): void {
  if (delta <= 0) return
  getDb()
    .prepare('INSERT INTO point_ledger(user_id, delta, reason, ref_type, ref_id) VALUES (?, ?, ?, ?, ?)')
    .run(userId, Math.round(delta), reason, refType, refId)
}

function streakDays(userId: number): number {
  const rows = getDb()
    .prepare('SELECT date FROM study_day WHERE user_id = ? ORDER BY date DESC LIMIT 400')
    .all(userId) as { date: string }[]
  if (rows.length === 0) return 0
  const set = new Set(rows.map((row) => row.date))
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  let streak = 0
  for (let i = 0; i < 400; i += 1) {
    const key = formatDate(cursor)
    if (!set.has(key)) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function addStreakBonus(userId: number): void {
  const date = localDate()
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM point_ledger WHERE user_id = ? AND date(created_at) = ? AND delta > 0")
    .get(userId, date) as { n: number }
  if (row.n > 0) return
  const streak = streakDays(userId)
  if (streak > 0) {
    addPoint(userId, Math.min(streak, 7), 'streak', 'day', null)
  }
}

function updateStudyDay(userId: number, answered: number, correct: number): void {
  const date = localDate()
  getDb()
    .prepare(
      `INSERT INTO study_day(user_id, date, answered, correct) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET answered = answered + excluded.answered,
         correct = correct + excluded.correct`
    )
    .run(userId, date, answered, correct)
}

function alreadyCountedToday(userId: number): Set<number> {
  const rows = getDb()
    .prepare(
      `SELECT ref_id FROM point_ledger
       WHERE user_id = ? AND reason = 'answer' AND date(created_at) = date('now','localtime')`
    )
    .all(userId) as { ref_id: number | null }[]
  return new Set(rows.map((row) => Number(row.ref_id)).filter((id) => Number.isFinite(id)))
}

interface AnswerRow {
  question_id: number
  is_correct: number | null
  user_answer: string | null
}

/** 判断答案是否真的填写过，未作答的占位记录不算 */
function hasAnswer(raw: string | null): boolean {
  if (raw === null || raw === '') return false
  try {
    const value = JSON.parse(raw) as unknown
    if (value === null || value === undefined) return false
    if (typeof value === 'string') return value.trim() !== ''
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0
    return true
  } catch {
    return raw.trim() !== ''
  }
}

function settleAnswers(userId: number, recordId: number, recordType: 'practice' | 'exam'): {
  answered: number
  correct: number
  accuracy: number
  gained: number
} {
  const rows = getDb()
    .prepare(
      `SELECT question_id, is_correct, user_answer FROM answer_record
       WHERE user_id = ? AND record_id = ? AND record_type = ? ORDER BY id`
    )
    .all(userId, recordId, recordType) as AnswerRow[]

  const counted = alreadyCountedToday(userId)
  let streak = 0
  let gained = 0
  for (const row of rows) {
    if (row.is_correct === 1) {
      streak += 1
      if (!counted.has(row.question_id)) {
        gained += comboMultiplier(streak)
        counted.add(row.question_id)
        addPoint(userId, comboMultiplier(streak), 'answer', 'question', row.question_id)
      }
    } else if (row.is_correct === 0) {
      streak = 0
    }
  }

  const answered = rows.filter((row) => hasAnswer(row.user_answer)).length
  const correct = rows.filter((row) => row.is_correct === 1).length
  const accuracy = answered === 0 ? 0 : correct / answered
  if (answered > 0) updateStudyDay(userId, answered, correct)

  return { answered, correct, accuracy, gained }
}

function unlockedCodes(userId: number): Set<string> {
  const rows = getDb()
    .prepare('SELECT code FROM achievement WHERE user_id = ?')
    .all(userId) as { code: string }[]
  return new Set(rows.map((row) => row.code))
}

export function settlePractice(userId: number, recordId: number): SettleResult {
  if (hasLedger(userId, 'practice', recordId)) return { gained: 0, unlocked: [] }
  const before = totalGrowth(userId)
  const beforeCodes = unlockedCodes(userId)
  const result = settleAnswers(userId, recordId, 'practice')
  getDb()
    .prepare("INSERT INTO point_ledger(user_id, delta, reason, ref_type, ref_id) VALUES (?, 0, 'practice', 'practice', ?)")
    .run(userId, recordId)
  if (result.answered > 0 && result.answered >= 10 && result.accuracy >= 0.6) {
    addPoint(userId, 10, 'practice-bonus', 'practice', recordId)
  }
  if (result.answered > 0) addStreakBonus(userId)
  checkAchievements(userId, { practiceAllRight: result.answered >= 20 && result.correct === result.answered })
  return {
    gained: totalGrowth(userId) - before,
    unlocked: [...unlockedCodes(userId)].filter((code) => !beforeCodes.has(code))
  }
}

export function settleExam(userId: number, recordId: number): SettleResult {
  if (hasLedger(userId, 'exam', recordId)) return { gained: 0, unlocked: [] }
  const before = totalGrowth(userId)
  const beforeCodes = unlockedCodes(userId)
  const result = settleAnswers(userId, recordId, 'exam')
  if (result.answered > 0) {
    addPoint(userId, 20, 'exam', 'exam', recordId)
    addStreakBonus(userId)
  }
  const row = getDb()
    .prepare('SELECT user_score, total_score FROM exam_record WHERE id = ?')
    .get(recordId) as { user_score: number | null; total_score: number | null } | undefined
  const perfect = Boolean(row && row.total_score && row.user_score !== null && row.user_score >= row.total_score)
  checkAchievements(userId, { perfect })
  return {
    gained: totalGrowth(userId) - before,
    unlocked: [...unlockedCodes(userId)].filter((code) => !beforeCodes.has(code))
  }
}

export function overview(userId: number): IncentiveOverview {
  const growth = totalGrowth(userId)
  const date = localDate()
  const day = getDb()
    .prepare('SELECT answered, correct FROM study_day WHERE user_id = ? AND date = ?')
    .get(userId, date) as { answered: number; correct: number } | undefined
  const week = getDb()
    .prepare(
      `SELECT COALESCE(SUM(delta), 0) AS total FROM point_ledger
       WHERE user_id = ? AND date(created_at) >= date('now','localtime','-6 day')`
    )
    .get(userId) as { total: number }
  const answered = day?.answered ?? 0
  const correct = day?.correct ?? 0
  return {
    growth,
    level: levelOf(growth),
    streak: streakDays(userId),
    today: { answered, correct, accuracy: answered === 0 ? 0 : Math.round((correct / answered) * 100) },
    weekGrowth: week.total
  }
}

export function achievements(userId: number): AchievementItem[] {
  const rows = getDb()
    .prepare('SELECT code, unlocked_at FROM achievement WHERE user_id = ?')
    .all(userId) as { code: string; unlocked_at: string }[]
  const unlocked = new Map(rows.map((row) => [row.code, row.unlocked_at]))
  return ACHIEVEMENTS.map((item) => ({
    ...item,
    unlocked: unlocked.has(item.code),
    unlockedAt: unlocked.get(item.code) ?? null
  }))
}

function checkAchievements(userId: number, context: { perfect?: boolean; practiceAllRight?: boolean } = {}): void {
  const db = getDb()
  const insert = db.prepare('INSERT OR IGNORE INTO achievement(user_id, code) VALUES (?, ?)')
  const correct = db
    .prepare('SELECT COUNT(*) AS n FROM answer_record WHERE user_id = ? AND is_correct = 1')
    .get(userId) as { n: number }
  const unmastered = db
    .prepare('SELECT COUNT(*) AS n FROM wrong_book WHERE user_id = ? AND mastered = 0')
    .get(userId) as { n: number }
  const mastered = db
    .prepare('SELECT COUNT(*) AS n FROM wrong_book WHERE user_id = ? AND mastered = 1')
    .get(userId) as { n: number }
  const monthDays = db
    .prepare("SELECT COUNT(*) AS n FROM study_day WHERE user_id = ? AND date LIKE strftime('%Y-%m','now','localtime') || '-%'")
    .get(userId) as { n: number }

  if (correct.n >= 100) insert.run(userId, 'hundred')
  if (context.perfect) insert.run(userId, 'perfect')
  if (streakDays(userId) >= 7) insert.run(userId, 'week7')
  if (unmastered.n === 0 && mastered.n > 0) insert.run(userId, 'wrong_clear')
  if (monthDays.n >= 20) insert.run(userId, 'month20')
  if (context.practiceAllRight) insert.run(userId, 'all_right20')
}

function userScope(userId: number): { stage: string; grade: number } {
  const row = getDb().prepare('SELECT stage, grade FROM user WHERE id = ?').get(userId) as
    | { stage: string; grade: number }
    | undefined
  if (!row) throw new Error('账号不存在')
  return row
}

export function dailyChallenge(userId: number): DailyChallenge {
  const db = getDb()
  const date = localDate()
  const scope = userScope(userId)
  let row = db
    .prepare('SELECT question_id, user_answer, is_correct FROM daily_challenge WHERE user_id = ? AND date = ?')
    .get(userId, date) as
    | { question_id: number; user_answer: string | null; is_correct: number | null }
    | undefined

  if (!row) {
    const picked = db
      .prepare(
        `SELECT id FROM bank.question
         WHERE stage = ? AND grade = ? AND type IN ('single','judge','fill')
         ORDER BY RANDOM() LIMIT 1`
      )
      .get(scope.stage, scope.grade) as { id: number } | undefined
    if (!picked) throw new Error('题库中还没有适合每日一题的题目')
    db.prepare('INSERT INTO daily_challenge(user_id, date, question_id) VALUES (?, ?, ?)').run(
      userId,
      date,
      picked.id
    )
    row = { question_id: picked.id, user_answer: null, is_correct: null }
  }

  const question = getQuestion(row.question_id)
  if (!question) throw new Error('题目不存在')
  const answered = row.is_correct !== null
  return {
    date,
    question,
    answered,
    isCorrect: answered ? row.is_correct === 1 : null,
    userAnswer: row.user_answer ? (JSON.parse(row.user_answer) as unknown) : null,
    answer: answered ? question.answer : null,
    solution: answered ? question.solution : null
  }
}

export function answerDailyChallenge(userId: number, answer: unknown): {
  isCorrect: boolean | null
  answer: QuestionAnswer
  solution: string | null
  gained: number
} {
  const current = dailyChallenge(userId)
  if (current.answered) throw new Error('今天的每日一题已经答过了')

  const outcome = scoreAnswer(current.question.type, current.question.answer, answer, current.question.score)
  getDb()
    .prepare(
      `UPDATE daily_challenge SET user_answer = ?, is_correct = ?, answered_at = datetime('now','localtime')
       WHERE user_id = ? AND date = ?`
    )
    .run(JSON.stringify(answer ?? null), outcome.isCorrect === true ? 1 : 0, userId, current.date)

  let gained = 0
  if (outcome.isCorrect === true) {
    addPoint(userId, 5, 'daily', 'question', current.question.id)
    gained = 5
  }
  updateStudyDay(userId, 1, outcome.isCorrect === true ? 1 : 0)
  addStreakBonus(userId)
  checkAchievements(userId)
  return { isCorrect: outcome.isCorrect, answer: current.question.answer, solution: current.question.solution, gained }
}

export function calendar(userId: number, month: string): StudyCalendarDay[] {
  return getDb()
    .prepare('SELECT date, answered, correct FROM study_day WHERE user_id = ? AND date LIKE ? ORDER BY date')
    .all(userId, `${month}-%`) as StudyCalendarDay[]
}

export function growthPoints(userId: number, days = 14): GrowthPoint[] {
  const span = Math.min(90, Math.max(7, Number(days) || 14))
  return getDb()
    .prepare(
      `SELECT date(created_at) AS date, SUM(delta) AS delta FROM point_ledger
       WHERE user_id = ? AND date(created_at) >= date('now','localtime',?)
       GROUP BY date(created_at) ORDER BY date`
    )
    .all(userId, `-${span - 1} day`) as GrowthPoint[]
}
