import { getDb } from '../connection'
import { ValidationError } from '../../errors'
import { pickQuestions, scoreById } from './quiz.repo'
import type { ChallengeOutcome, QuizAnswerInput, TimedChallenge } from '../../../shared/types'

const QUESTION_COUNT = 30
const TIME_LIMIT_SECONDS = 60

interface ChallengeRow {
  best_score: number
  plays: number
}

function assertPositiveInt(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new ValidationError(`${label}不合法`)
}

function readRecord(userId: number): ChallengeRow {
  const row = getDb()
    .prepare('SELECT best_score, plays FROM challenge_record WHERE user_id = ?')
    .get(userId) as ChallengeRow | undefined
  return row ?? { best_score: 0, plays: 0 }
}

export function startTimedChallenge(userId: number, subjectId: number, grade: number): TimedChallenge {
  assertPositiveInt(userId, '用户编号')
  assertPositiveInt(subjectId, '学科编号')
  assertPositiveInt(grade, '年级')

  const questions = pickQuestions(subjectId, grade, QUESTION_COUNT)
  if (questions.length === 0) throw new ValidationError('当前年级暂无可用题目')

  const record = readRecord(userId)
  return {
    questions,
    seconds: TIME_LIMIT_SECONDS,
    bestScore: record.best_score,
    plays: record.plays
  }
}

export function submitTimedChallenge(
  userId: number,
  subjectId: number,
  grade: number,
  answers: QuizAnswerInput[]
): ChallengeOutcome {
  assertPositiveInt(userId, '用户编号')
  assertPositiveInt(subjectId, '学科编号')
  assertPositiveInt(grade, '年级')

  const scored = scoreById(answers)
  const correct = scored.filter((item) => item.isCorrect === true).length
  const wrong = scored.filter((item) => item.isCorrect === false).length
  const score = correct - wrong

  const previous = readRecord(userId)
  getDb()
    .prepare(
      `INSERT INTO challenge_record(user_id, best_score, best_correct, plays) VALUES (?, ?, ?, 1)
       ON CONFLICT(user_id) DO UPDATE SET
         best_score = MAX(best_score, excluded.best_score),
         best_correct = MAX(best_correct, excluded.best_correct),
         plays = plays + 1,
         updated_at = datetime('now','localtime')`
    )
    .run(userId, score, correct)

  return {
    score,
    correct,
    wrong,
    bestScore: readRecord(userId).best_score,
    improved: score > previous.best_score
  }
}
