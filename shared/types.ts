export type Stage = 'primary' | 'junior' | 'senior'

export type QuestionType =
  | 'single'
  | 'multiple'
  | 'judge'
  | 'fill'
  | 'short_answer'
  | 'cloze'
  | 'matching'
  | 'sorting'
  | 'calculation'
  | 'pinyin_word'

export interface Subject {
  id: number
  stage: Stage
  name: string
  icon: string
  sort: number
}

export interface KnowledgePoint {
  id: number
  subjectId: number
  grade: number
  parentId: number | null
  name: string
  sort: number
  children?: KnowledgePoint[]
}

export interface User {
  id: number
  name: string
  avatar: string | null
  stage: Stage
  grade: number
  role: 'student' | 'parent' | 'teacher'
  hasPin: boolean
  createdAt: string
}

/** 答案类型随题型变化，落库为 JSON 字符串 */
export type QuestionAnswer =
  | number
  | number[]
  | string
  | string[]
  | Record<string, unknown>

export interface Question {
  id: number
  subjectId: number
  stage: Stage
  grade: number
  knowledgeId: number | null
  knowledgeName?: string | null
  type: QuestionType
  difficulty: number
  stem: string
  options: unknown
  answer: QuestionAnswer
  solution: string | null
  score: number
  source: string | null
}

export interface CharacterSummary {
  char: string
  grade: number
}

export interface EnglishWord {
  id: number
  word: string
  grade: number
  volume: string | null
  phonetic: string | null
  meaning: string
  sentence: string | null
  sentenceZh: string | null
}

export interface CharacterStroke {
  name: string
  glyph: string
  type: string | null
  foldCount: number | null
}

export interface CharacterCode {
  unicode: string
  gbk: string
  sijiao: string
  cangjie: string
  fiveStroke: string
  uniform: string
}

export interface CharacterDetail {
  char: string
  pinyin: string
  initial: string
  final: string
  tone: number
  polyphonic: string[]
  isPolyphonic: boolean
  radical: string | null
  radicalCount: number | null
  structure: string | null
  strokeCount: number
  strokes: CharacterStroke[]
  words: string[]
  idioms: string[]
  traditional: string | null
  fiveElement: string | null
  method: string | null
  markSpell: string | null
  codes: CharacterCode
}

export interface QuestionFilter {
  subjectId?: number
  grade?: number
  stage?: Stage
  types?: QuestionType[]
  difficulties?: number[]
  knowledgeIds?: number[]
  keyword?: string
  page?: number
  pageSize?: number
}

export interface QuestionPage {
  items: Question[]
  total: number
  page: number
  pageSize: number
}

export interface NewQuestion {
  subjectId: number
  grade: number
  knowledgeId?: number | null
  type: QuestionType
  difficulty: number
  stem: string
  options?: unknown
  answer: QuestionAnswer
  solution?: string | null
  score?: number
  source?: string | null
}

export type PaperType = 'practice' | 'exam'

export interface PaperQuestion {
  questionId: number
  sort: number
  score: number
  question: Question
}

export interface Paper {
  id: number
  title: string
  stage: Stage
  grade: number | null
  subjectId: number | null
  type: PaperType
  duration: number | null
  totalScore: number | null
  questions: PaperQuestion[]
}

export interface CustomPracticeConfig {
  /** 要生成的题型；与标准题型互斥 */
  type: QuestionType
  /** 生成参数，键来自 shared/question-params.ts */
  params: Record<string, string | number | boolean>
}

export interface PracticeConfig {
  userId: number
  subjectId: number
  grade: number
  types: QuestionType[]
  difficulties: number[]
  count: number
  knowledgeIds?: number[]
  mode: 'random' | 'wrong' | 'knowledge'
  /** 自定义组卷：由生成器实时生成，不写入题库 */
  custom?: CustomPracticeConfig
}

export interface PracticeRecord {
  id: number
  userId: number
  paperId: number | null
  subjectId: number | null
  grade: number | null
  questionCount: number
  correctCount: number
  durationSec: number
  status: 'doing' | 'done'
  startedAt: string
  finishedAt: string | null
}

export interface ExamRecord {
  id: number
  userId: number
  paperId: number
  totalScore: number | null
  userScore: number | null
  durationSec: number
  status: 'doing' | 'done' | 'expired'
  startedAt: string
  finishedAt: string | null
}

export interface AnswerRecord {
  id: number
  recordId: number
  recordType: PaperType
  questionId: number
  userAnswer: unknown
  isCorrect: boolean | null
  score: number
  answeredAt: string
}

export interface PracticeSession {
  record: PracticeRecord
  paper: Paper
  answers: AnswerRecord[]
}

export interface ExamSession {
  record: ExamRecord
  paper: Paper
  answers: AnswerRecord[]
}

export interface ResultItem {
  question: Question
  userAnswer: unknown
  isCorrect: boolean | null
  score: number
  order: number
  answerId: number | null
}

export interface SessionResult {
  title: string
  type: PaperType
  recordId: number
  questionCount: number
  correctCount: number
  wrongCount: number
  pendingCount: number
  userScore: number
  totalScore: number
  durationSec: number
  accuracy: number
  items: ResultItem[]
}

export interface WrongBookItem {
  id: number
  question: Question
  wrongCount: number
  lastWrongAt: string
  mastered: boolean
}

export interface WrongBookFilter {
  userId: number
  subjectId?: number
  grade?: number
  mastered?: boolean
  page?: number
  pageSize?: number
}

export interface WrongBookPage {
  items: WrongBookItem[]
  total: number
}

export interface StatsOverview {
  practiceCount: number
  examCount: number
  answeredCount: number
  correctCount: number
  accuracy: number
  studyMinutes: number
  wrongCount: number
  masteredCount: number
}

export interface SubjectStat {
  subjectId: number
  name: string
  answered: number
  correct: number
  accuracy: number
}

export interface TrendPoint {
  date: string
  answered: number
  correct: number
  accuracy: number
}

export interface ImportPreview {
  kind: 'questions'
  total: number
  preview: Record<string, unknown>[]
  columns: string[]
}

export interface ImportResult {
  inserted: number
  skipped: number
  errors: string[]
}

export interface ExamTemplate {
  paper: Paper
  bestScore: number | null
  attemptCount: number
}

/** IPC 统一响应结构，对齐 HTTP 语义：code=200 成功，4xx 参数错误，5xx 内部错误 */
export interface IpcResponse<T> {
  code: number
  message: string
  data?: T
}

export interface HistoryItem {
  id: number
  type: PaperType
  title: string
  subjectName: string
  grade: number
  questionCount: number
  correctCount: number
  score: number
  totalScore: number
  accuracy: number
  durationSec: number
  startedAt: string
  finishedAt: string | null
}

export interface DoingPracticeItem {
  id: number
  title: string
  subjectName: string
  questionCount: number
  startedAt: string
  resumable: boolean
}

/** 自定义标题栏窗口控制 API，由 preload 暴露到渲染进程 */
export interface StudyWindowApi {
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
  onMaximizeChange: (callback: (maximized: boolean) => void) => () => void
}

export interface StudyApi {
  invoke: (channel: string, payload?: unknown) => Promise<unknown>
  window: StudyWindowApi
}
