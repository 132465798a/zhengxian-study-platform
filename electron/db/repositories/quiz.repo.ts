import { getQuestion, pickRandomQuestions } from './question.repo'
import { scoreAnswer } from '../scoring'
import type { Question, QuizAnswerInput } from '../../../shared/types'

/** 玩法类功能的公共选题入口，统一走题库随机抽取 */
export function pickQuestions(
  subjectId: number,
  grade: number,
  count: number,
  knowledgeIds?: number[]
): Question[] {
  return pickRandomQuestions({ subjectId, grade, knowledgeIds }, count)
}

export function encodeQuestions(questions: Question[]): string {
  return JSON.stringify(questions)
}

export function decodeQuestions(payload: string): Question[] {
  try {
    const data = JSON.parse(payload) as unknown
    return Array.isArray(data) ? (data as Question[]) : []
  } catch {
    return []
  }
}

export interface ScoredAnswer {
  questionId: number
  answer: unknown
  isCorrect: boolean | null
  score: number
}

/** 按题目快照逐题判分，主观题返回 null 表示待人工判分 */
export function scoreAnswers(questions: Question[], answers: QuizAnswerInput[]): ScoredAnswer[] {
  const map = new Map(answers.map((item) => [item.questionId, item.answer]))
  return questions.map((question) => {
    const answer = map.has(question.id) ? map.get(question.id) : null
    const outcome = scoreAnswer(question.type, question.answer, answer, question.score ?? 2)
    return {
      questionId: question.id,
      answer,
      isCorrect: outcome.isCorrect,
      score: outcome.score
    }
  })
}

/** 按题目 ID 判分，用于不保存题目快照的限时挑战 */
export function scoreById(answers: QuizAnswerInput[]): ScoredAnswer[] {
  return answers.map((item) => {
    const question = getQuestion(item.questionId)
    if (!question) {
      return { questionId: item.questionId, answer: item.answer, isCorrect: false, score: 0 }
    }
    const outcome = scoreAnswer(question.type, question.answer, item.answer, question.score ?? 2)
    return {
      questionId: item.questionId,
      answer: item.answer,
      isCorrect: outcome.isCorrect,
      score: outcome.score
    }
  })
}
