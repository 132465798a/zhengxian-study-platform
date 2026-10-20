import type { QuestionAnswer, QuestionType } from '../../../shared/types'

export interface SeedQuestion {
  subject: string
  grade: number
  topic: string
  type: QuestionType
  difficulty: number
  stem: string
  options?: unknown
  answer: QuestionAnswer
  solution?: string
  score?: number
  source?: string
}

export interface SeedContext {
  subjectId(name: string): number
  knowledgeId(subject: string, grade: number, topic: string): number | null
  add(question: SeedQuestion): void
  random(seed: number): () => number
  insertQuestion(input: {
    subjectId: number
    grade: number
    knowledgeId: number | null
    type: QuestionType
    difficulty: number
    stem: string
    options: unknown
    answer: QuestionAnswer
    solution: string | null
    score: number
    source: string
  }): void
}
