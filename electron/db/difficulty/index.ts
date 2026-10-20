import type Database from 'better-sqlite3'
import { scoreDifficulty, type DifficultyRow } from './score'

export type Difficulty = 1 | 2 | 3

export interface DifficultySummary {
  total: number
  groups: number
  byDifficulty: Record<Difficulty, number>
}

type Ratio = [easy: number, medium: number, hard: number]

function ratioForGrade(grade: number): Ratio {
  if (grade <= 2) return [0.5, 0.35, 0.15]
  if (grade <= 4) return [0.35, 0.45, 0.2]
  return [0.25, 0.4, 0.35]
}

function splitCounts(total: number, ratio: Ratio): [number, number, number] {
  if (total <= 0) return [0, 0, 0]
  if (total === 1) return [0, 1, 0]
  if (total === 2) return [1, 0, 1]

  let easy = Math.max(1, Math.round(total * ratio[0]))
  let hard = Math.max(1, Math.round(total * ratio[2]))
  let medium = total - easy - hard

  if (medium < 1) {
    medium = 1
    if (easy >= hard) easy = total - medium - hard
    else hard = total - medium - easy
  }

  return [easy, medium, hard]
}

/**
 * 在 subject×grade×type 分组内按内容复杂度排序，再按比例切分为 1/2/3 档。
 * 只更新 difficulty 字段，不改题目 ID、题干和答案。
 */
export function reclassifyQuestionDifficulty(db: Database.Database): DifficultySummary {
  const rows = db
    .prepare('SELECT id, subject_id, grade, type, stem, options FROM question')
    .all() as DifficultyRow[]

  const groups = new Map<string, DifficultyRow[]>()
  for (const row of rows) {
    const key = `${row.subject_id}|${row.grade}|${row.type}`
    const list = groups.get(key)
    if (list) list.push(row)
    else groups.set(key, [row])
  }

  const update = db.prepare('UPDATE question SET difficulty = ? WHERE id = ?')
  const summary: DifficultySummary = {
    total: rows.length,
    groups: groups.size,
    byDifficulty: { 1: 0, 2: 0, 3: 0 }
  }

  const apply = db.transaction(() => {
    for (const list of groups.values()) {
      list.sort((a, b) => scoreDifficulty(a) - scoreDifficulty(b) || a.id - b.id)
      const [easy, medium] = splitCounts(list.length, ratioForGrade(list[0].grade))
      list.forEach((row, index) => {
        const difficulty: Difficulty = index < easy ? 1 : index < easy + medium ? 2 : 3
        update.run(difficulty, row.id)
        summary.byDifficulty[difficulty] += 1
      })
    }
  })

  apply()
  return summary
}
