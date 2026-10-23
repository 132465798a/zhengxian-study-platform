import { getDb } from '../connection'
import { ValidationError } from '../../errors'
import type { GoalKind, WeeklyGoal } from '../../../shared/types'

function formatDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 本周周一，本地时间 */
function currentWeekStart(): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const offset = (today.getDay() + 6) % 7
  today.setDate(today.getDate() - offset)
  return formatDate(today)
}

function weekProgress(userId: number, weekStart: string, kind: GoalKind): number {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(answered), 0) AS answered, COALESCE(SUM(correct), 0) AS correct
       FROM study_day WHERE user_id = ? AND date >= ?`
    )
    .get(userId, weekStart) as { answered: number; correct: number }
  if (kind === 'accuracy') {
    return row.answered === 0 ? 0 : Math.round((row.correct / row.answered) * 100)
  }
  return row.answered
}

export function getWeeklyGoal(userId: number): WeeklyGoal {
  const weekStart = currentWeekStart()
  const row = getDb()
    .prepare('SELECT kind, target FROM weekly_goal WHERE user_id = ? AND week_start = ?')
    .get(userId, weekStart) as { kind: string; target: number } | undefined

  const kind: GoalKind = row?.kind === 'accuracy' ? 'accuracy' : 'count'
  const target = row?.target ?? 0
  const current = weekProgress(userId, weekStart, kind)
  return { weekStart, kind, target, current, achieved: target > 0 && current >= target }
}

export function setWeeklyGoal(userId: number, kind: GoalKind, target: number): WeeklyGoal {
  if (kind !== 'count' && kind !== 'accuracy') throw new ValidationError('目标类型不合法')
  if (!Number.isInteger(target)) throw new ValidationError('目标值必须是整数')
  if (kind === 'count' && (target < 1 || target > 1000)) {
    throw new ValidationError('题量目标应在 1 到 1000 之间')
  }
  if (kind === 'accuracy' && (target < 50 || target > 100)) {
    throw new ValidationError('正确率目标应在 50 到 100 之间')
  }

  getDb()
    .prepare(
      `INSERT INTO weekly_goal(user_id, week_start, kind, target) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, week_start) DO UPDATE SET kind = excluded.kind, target = excluded.target`
    )
    .run(userId, currentWeekStart(), kind, target)

  return getWeeklyGoal(userId)
}
