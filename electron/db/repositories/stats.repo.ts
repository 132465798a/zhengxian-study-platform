import { getDb } from '../connection'
import type { StatsOverview, SubjectStat, TrendPoint } from '../../../shared/types'

export function overview(userId: number): StatsOverview {
  const db = getDb()
  const practice = db
    .prepare(
      "SELECT COUNT(*) AS count, COALESCE(SUM(duration_sec), 0) AS seconds FROM practice_record WHERE user_id = ? AND status = 'done'"
    )
    .get(userId) as { count: number; seconds: number }

  const exam = db
    .prepare(
      "SELECT COUNT(*) AS count, COALESCE(SUM(duration_sec), 0) AS seconds FROM exam_record WHERE user_id = ? AND status != 'doing'"
    )
    .get(userId) as { count: number; seconds: number }

  const answers = db
    .prepare(
      `SELECT COUNT(*) AS answered,
              COALESCE(SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct,
              COALESCE(SUM(CASE WHEN is_correct IS NOT NULL THEN 1 ELSE 0 END), 0) AS graded
       FROM answer_record WHERE user_id = ?`
    )
    .get(userId) as { answered: number; correct: number; graded: number }

  const wrong = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN mastered = 0 THEN 1 ELSE 0 END), 0) AS unmastered,
              COALESCE(SUM(CASE WHEN mastered = 1 THEN 1 ELSE 0 END), 0) AS mastered
       FROM wrong_book WHERE user_id = ?`
    )
    .get(userId) as { unmastered: number; mastered: number }

  return {
    practiceCount: practice.count,
    examCount: exam.count,
    answeredCount: answers.answered,
    correctCount: answers.correct,
    accuracy: answers.graded === 0 ? 0 : Math.round((answers.correct / answers.graded) * 100),
    studyMinutes: Math.round((practice.seconds + exam.seconds) / 60),
    wrongCount: wrong.unmastered,
    masteredCount: wrong.mastered
  }
}

export function subjectStats(userId: number): SubjectStat[] {
  const rows = getDb()
    .prepare(
      `SELECT s.id AS subjectId, s.name AS name,
              COUNT(ar.id) AS answered,
              COALESCE(SUM(CASE WHEN ar.is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct,
              COALESCE(SUM(CASE WHEN ar.is_correct IS NOT NULL THEN 1 ELSE 0 END), 0) AS graded
       FROM answer_record ar
       JOIN bank.question q ON q.id = ar.question_id
       JOIN bank.subject s ON s.id = q.subject_id
       WHERE ar.user_id = ?
       GROUP BY s.id ORDER BY s.sort`
    )
    .all(userId) as {
    subjectId: number
    name: string
    answered: number
    correct: number
    graded: number
  }[]

  return rows.map((row) => ({
    subjectId: row.subjectId,
    name: row.name,
    answered: row.answered,
    correct: row.correct,
    accuracy: row.graded === 0 ? 0 : Math.round((row.correct / row.graded) * 100)
  }))
}

export function trend(userId: number, days = 14): TrendPoint[] {
  const rows = getDb()
    .prepare(
      `SELECT date(answered_at) AS date,
              COUNT(*) AS answered,
              COALESCE(SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct
       FROM answer_record
       WHERE user_id = ? AND date(answered_at) >= date('now', 'localtime', ?)
       GROUP BY date ORDER BY date ASC`
    )
    .all(userId, `-${days - 1} days`) as { date: string; answered: number; correct: number }[]

  const map = new Map(rows.map((row) => [row.date, row]))
  const result: TrendPoint[] = []
  const today = new Date()

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - index)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`
    const row = map.get(key)
    result.push({
      date: key,
      answered: row?.answered ?? 0,
      correct: row?.correct ?? 0,
      accuracy: row && row.answered > 0 ? Math.round((row.correct / row.answered) * 100) : 0
    })
  }
  return result
}
