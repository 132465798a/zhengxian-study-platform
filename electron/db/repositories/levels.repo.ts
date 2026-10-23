import { getDb } from '../connection'
import { ValidationError } from '../../errors'
import { pickQuestions, scoreAnswers } from './quiz.repo'
import { getQuestion } from './question.repo'
import type { LevelNode, LevelOutcome, LevelQuiz, QuizAnswerInput } from '../../../shared/types'

interface LevelRow {
  id: number
  name: string
  n: number
}

interface ProgressRow {
  level_index: number
  best_rate: number
  passed: number
}

const PASS_RATE = 80
const LEVEL_QUESTION_COUNT = 10

function assertScope(userId: number, subjectId: number, grade: number): void {
  if (!Number.isInteger(userId) || userId <= 0) throw new ValidationError('用户编号不合法')
  if (!Number.isInteger(subjectId) || subjectId <= 0) throw new ValidationError('学科编号不合法')
  if (!Number.isInteger(grade) || grade < 1 || grade > 6) throw new ValidationError('年级不合法')
}

function assertLevelIndex(levelIndex: number): void {
  if (!Number.isInteger(levelIndex) || levelIndex < 0) throw new ValidationError('关卡编号不合法')
}

export function listLevels(userId: number, subjectId: number, grade: number): LevelNode[] {
  assertScope(userId, subjectId, grade)

  const rows = getDb()
    .prepare(
      `SELECT k.id, k.name, COUNT(q.id) AS n
       FROM bank.knowledge_point k
       JOIN bank.question q ON q.knowledge_id = k.id
       WHERE k.subject_id = ? AND k.grade = ?
       GROUP BY k.id
       ORDER BY k.sort ASC, k.id ASC`
    )
    .all(subjectId, grade) as LevelRow[]

  const progressRows = getDb()
    .prepare('SELECT level_index, best_rate, passed FROM level_progress WHERE user_id = ? AND subject_id = ?')
    .all(userId, subjectId) as ProgressRow[]
  const progress = new Map(progressRows.map((row) => [row.level_index, row]))

  let currentAssigned = false
  return rows.map((row, index) => {
    const record = progress.get(index)
    let status: LevelNode['status']
    if (record?.passed === 1) {
      status = 'passed'
    } else if (!currentAssigned) {
      status = 'current'
      currentAssigned = true
    } else {
      status = 'locked'
    }
    return {
      index,
      knowledgeId: row.id,
      name: row.name,
      questionCount: row.n,
      status,
      bestRate: record ? record.best_rate : null
    }
  })
}

export function startLevel(
  userId: number,
  subjectId: number,
  grade: number,
  levelIndex: number
): LevelQuiz {
  assertScope(userId, subjectId, grade)
  assertLevelIndex(levelIndex)

  const node = listLevels(userId, subjectId, grade)[levelIndex]
  if (!node) throw new ValidationError('关卡不存在')
  if (node.status === 'locked') throw new ValidationError('请先通过前一关')

  const questions = pickQuestions(subjectId, grade, LEVEL_QUESTION_COUNT, [node.knowledgeId])
  if (questions.length === 0) throw new ValidationError('本关暂无可用题目')

  return { subjectId, levelIndex, name: node.name, questions }
}

export function submitLevel(
  userId: number,
  subjectId: number,
  grade: number,
  levelIndex: number,
  answers: QuizAnswerInput[]
): LevelOutcome {
  assertScope(userId, subjectId, grade)
  assertLevelIndex(levelIndex)

  const nodes = listLevels(userId, subjectId, grade)
  if (!nodes[levelIndex]) throw new ValidationError('关卡不存在')
  if (answers.length === 0) throw new ValidationError('请先作答')

  const questions = answers.map((item) => {
    const question = getQuestion(item.questionId)
    if (!question) throw new ValidationError('题目不存在')
    return question
  })

  const scored = scoreAnswers(questions, answers)
  const correct = scored.filter((item) => item.isCorrect === true).length
  const total = answers.length
  const rate = Math.round((correct / total) * 100)
  const passed = rate >= PASS_RATE

  const previous = getDb()
    .prepare(
      'SELECT best_rate, passed FROM level_progress WHERE user_id = ? AND subject_id = ? AND level_index = ?'
    )
    .get(userId, subjectId, levelIndex) as { best_rate: number; passed: number } | undefined
  const bestRate = Math.max(previous?.best_rate ?? 0, rate)
  const passedValue = (passed || previous?.passed === 1) ? 1 : 0

  getDb()
    .prepare(
      `INSERT INTO level_progress(user_id, subject_id, level_index, best_rate, passed, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
       ON CONFLICT(user_id, subject_id, level_index)
       DO UPDATE SET best_rate = excluded.best_rate, passed = excluded.passed, updated_at = excluded.updated_at`
    )
    .run(userId, subjectId, levelIndex, bestRate, passedValue)

  return {
    rate,
    correct,
    total,
    passed,
    unlockedNext: passed && levelIndex + 1 < nodes.length,
    bestRate
  }
}
