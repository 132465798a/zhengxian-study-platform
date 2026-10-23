import { IPC } from '@shared/ipc'
import type {
  AchievementItem,
  AnswerRecord,
  ChallengeOutcome,
  CharacterDetail,
  CharacterSummary,
  DailyChallenge,
  DoingPracticeItem,
  EnglishWord,
  ExamSession,
  ExamTemplate,
  FamilyMatchDetail,
  FamilyMatchSummary,
  FamilyOutcome,
  GoalKind,
  GrowthPoint,
  HistoryItem,
  ImportPreview,
  ImportResult,
  IncentiveOverview,
  KnowledgePoint,
  LevelNode,
  LevelOutcome,
  LevelQuiz,
  NewQuestion,
  PaperType,
  PracticeConfig,
  PracticeRecord,
  PracticeSession,
  PrintHistoryPage,
  Question,
  QuestionAnswer,
  QuestionFilter,
  QuestionPage,
  QuestionType,
  QuizAnswerInput,
  RelayMatch,
  RelayQuestionState,
  RelayTurnOutcome,
  SessionResult,
  Stage,
  StatsOverview,
  StudyCalendarDay,
  Subject,
  SubjectStat,
  TimedChallenge,
  TrendPoint,
  User,
  WeeklyGoal,
  WrongBookFilter,
  WrongBookPage
} from '@shared/types'
import type {
  PrintDocument,
  PrintOptions,
  PrintRequest,
  PrintSource,
  PrintSourceQuestion
} from '@shared/print'
import { invoke } from './client'

export const userApi = {
  list: () => invoke<User[]>(IPC.userList),
  create: (input: { name: string; grade: number; stage?: Stage; pin?: string | null }) =>
    invoke<User>(IPC.userCreate, input),
  update: (
    id: number,
    patch: { name?: string; grade?: number; stage?: Stage; pin?: string | null; avatar?: string | null }
  ) => invoke<User>(IPC.userUpdate, { id, patch }),
  remove: (id: number) => invoke<{ deleted: boolean }>(IPC.userDelete, { id }),
  verifyPin: (id: number, pin: string) =>
    invoke<{ valid: boolean }>(IPC.userVerifyPin, { id, pin })
}

export const contentApi = {
  subjects: (grade?: number) => invoke<Subject[]>(IPC.subjectList, { grade }),
  knowledge: (subjectId: number, grade: number) =>
    invoke<KnowledgePoint[]>(IPC.knowledgeTree, { subjectId, grade })
}

export const characterApi = {
  list: (grade: number) => invoke<CharacterSummary[]>(IPC.characterList, { grade }),
  detail: (char: string) => invoke<CharacterDetail>(IPC.characterDetail, { char }),
  strokeData: (char: string) => invoke<{ data: string }>(IPC.characterStrokeData, { char }),
  explain: (word: string) => invoke<{ text: string | null }>(IPC.characterExplain, { word })
}

export const speechApi = {
  synthesize: (text: string, lang: 'zh-CN' | 'en-US' = 'zh-CN') =>
    invoke<{ audio: string; mime: string; source: 'bundled' | 'edge' }>(IPC.ttsSynthesize, { text, lang })
}

export const englishApi = {
  words: (grade: number) => invoke<EnglishWord[]>(IPC.englishWords, { grade })
}

export const asrApi = {
  status: () => invoke<{ available: boolean }>(IPC.asrStatus),
  transcribe: (audio: string, sampleRate = 16000) =>
    invoke<{ text: string }>(IPC.asrTranscribe, { audio, sampleRate })
}

export const printApi = {
  preview: (request: PrintRequest) => invoke<{ token: string }>(IPC.printPreview, request),
  save: (request: PrintRequest) =>
    invoke<{ canceled: boolean; path?: string }>(IPC.printSave, request),
  print: (request: PrintRequest) => invoke<{ ok: boolean }>(IPC.printPrint, request),
  build: (request: PrintRequest) => invoke<PrintDocument>(IPC.printBuild, request),
  generate: (input: {
    subjectId: number
    grade: number
    types: QuestionType[]
    params: Record<string, Record<string, string | number | boolean>>
    count: number
    knowledgeIds?: number[]
    difficulties?: number[]
  }) => invoke<PrintSourceQuestion[]>(IPC.printGenerate, input),
  payload: (token: string) => invoke<PrintDocument>(IPC.printPayload, { token }),
  ready: (token: string) => invoke<{ ready: boolean }>(IPC.printReady, { token }),
  saveJob: (token: string) =>
    invoke<{ canceled: boolean; path?: string }>(IPC.printSaveJob, { token }),
  previewPdf: (token: string) => invoke<{ pdf: string }>(IPC.printPreviewPdf, { token }),
  batch: (input: {
    userId: number
    requests: Array<{ source: PrintSource; options: PrintOptions }>
  }) => invoke<{ canceled: boolean; dir?: string; count?: number }>(IPC.printBatch, input)
}

export const printTemplateApi = {
  list: (userId: number) =>
    invoke<
      Array<{
        id: number
        name: string
        subjectId: number | null
        grade: number | null
        createdAt: string
      }>
    >(IPC.printTemplateList, { userId }),
  get: (userId: number, id: number) =>
    invoke<{
      id: number
      name: string
      subjectId: number | null
      grade: number | null
      createdAt: string
      payload: string
    } | null>(IPC.printTemplateGet, { userId, id }),
  save: (input: {
    userId: number
    name: string
    subjectId: number
    grade: number
    payload: string
  }) => invoke<{ id: number; name: string }>(IPC.printTemplateSave, input),
  remove: (userId: number, id: number) =>
    invoke<{ deleted: boolean }>(IPC.printTemplateDelete, { userId, id })
}

export const questionApi = {
  page: (filter: QuestionFilter) => invoke<QuestionPage>(IPC.questionPage, filter),
  create: (input: NewQuestion) => invoke<Question>(IPC.questionCreate, input),
  update: (id: number, input: NewQuestion) =>
    invoke<Question>(IPC.questionUpdate, { id, input }),
  remove: (id: number) => invoke<{ deleted: boolean }>(IPC.questionDelete, { id }),
  typeStats: (filter: QuestionFilter) =>
    invoke<{ type: QuestionType; count: number }[]>(IPC.questionTypeStats, filter)
}

export const practiceApi = {
  create: (config: PracticeConfig) => invoke<PracticeSession>(IPC.practiceCreate, config),
  get: (userId: number, recordId: number) =>
    invoke<PracticeSession>(IPC.practiceGet, { userId, recordId }),
  list: (userId: number, limit = 20) => invoke<HistoryItem[]>(IPC.practiceList, { userId, limit }),
  doing: (userId: number, limit = 5) =>
    invoke<DoingPracticeItem[]>(IPC.practiceDoing, { userId, limit }),
  discardDoing: (userId: number) =>
    invoke<{ deleted: number }>(IPC.practiceDiscardDoing, { userId }),
  answer: (input: { userId: number; recordId: number; questionId: number; answer: unknown }) =>
    invoke<{ isCorrect: boolean | null; score: number; answer: unknown; solution: string | null }>(
      IPC.practiceAnswer,
      input
    ),
  finish: (userId: number, recordId: number, durationSec: number) =>
    invoke<SessionResult>(IPC.practiceFinish, { userId, recordId, durationSec }),
  grade: (userId: number, answerRecordId: number, isCorrect: boolean) =>
    invoke<{ correctCount: number }>(IPC.practiceGrade, { userId, answerRecordId, isCorrect }),
  result: (userId: number, recordId: number) =>
    invoke<SessionResult>(IPC.practiceResult, { userId, recordId })
}

export const examApi = {
  templates: (userId: number) => invoke<ExamTemplate[]>(IPC.examTemplates, { userId }),
  start: (userId: number, paperId: number) =>
    invoke<ExamSession>(IPC.examStart, { userId, paperId }),
  get: (userId: number, recordId: number) =>
    invoke<ExamSession>(IPC.examGet, { userId, recordId }),
  answer: (input: { userId: number; recordId: number; questionId: number; answer: unknown }) =>
    invoke<{ saved: boolean }>(IPC.examAnswer, input),
  submit: (userId: number, recordId: number, durationSec: number) =>
    invoke<SessionResult>(IPC.examSubmit, { userId, recordId, durationSec }),
  records: (userId: number, limit = 20) => invoke<HistoryItem[]>(IPC.examRecords, { userId, limit }),
  result: (userId: number, recordId: number) =>
    invoke<SessionResult>(IPC.examResult, { userId, recordId })
}

export const wrongApi = {
  page: (filter: WrongBookFilter) => invoke<WrongBookPage>(IPC.wrongPage, filter),
  master: (userId: number, id: number, mastered: boolean) =>
    invoke<{ updated: boolean }>(IPC.wrongMaster, { userId, id, mastered }),
  remove: (userId: number, id: number) => invoke<{ deleted: boolean }>(IPC.wrongRemove, { userId, id }),
  summary: (userId: number) =>
    invoke<{
      total: number
      unmastered: number
      mastered: number
      bySubject: { subjectId: number; name: string; count: number }[]
    }>(IPC.wrongSummary, { userId })
}

export const statsApi = {
  overview: (userId: number) => invoke<StatsOverview>(IPC.statsOverview, { userId }),
  subjects: (userId: number) => invoke<SubjectStat[]>(IPC.statsSubjects, { userId }),
  trend: (userId: number, days = 14) => invoke<TrendPoint[]>(IPC.statsTrend, { userId, days })
}

export const importApi = {
  preview: (raw: string, fileName: string) =>
    invoke<ImportPreview>(IPC.importPreview, { raw, fileName }),
  commit: (raw: string, fileName: string) =>
    invoke<ImportResult>(IPC.importCommit, { raw, fileName })
}

export const incentiveApi = {
  overview: (userId: number) => invoke<IncentiveOverview>(IPC.incentiveOverview, { userId }),
  achievements: (userId: number) => invoke<AchievementItem[]>(IPC.incentiveAchievements, { userId }),
  daily: (userId: number) => invoke<DailyChallenge>(IPC.incentiveDailyGet, { userId }),
  answerDaily: (userId: number, answer: unknown) =>
    invoke<{ isCorrect: boolean | null; answer: QuestionAnswer; solution: string | null; gained: number }>(
      IPC.incentiveDailyAnswer,
      { userId, answer }
    ),
  calendar: (userId: number, month: string) =>
    invoke<StudyCalendarDay[]>(IPC.incentiveCalendar, { userId, month }),
  growth: (userId: number, days = 14) => invoke<GrowthPoint[]>(IPC.incentiveGrowth, { userId, days })
}

export const goalApi = {
  get: (userId: number) => invoke<WeeklyGoal>(IPC.goalGet, { userId }),
  set: (userId: number, kind: GoalKind, target: number) =>
    invoke<WeeklyGoal>(IPC.goalSet, { userId, kind, target })
}

export const levelApi = {
  list: (userId: number, subjectId: number, grade: number) =>
    invoke<LevelNode[]>(IPC.levelList, { userId, subjectId, grade }),
  start: (userId: number, subjectId: number, grade: number, levelIndex: number) =>
    invoke<LevelQuiz>(IPC.levelStart, { userId, subjectId, grade, levelIndex }),
  submit: (input: {
    userId: number
    subjectId: number
    grade: number
    levelIndex: number
    answers: QuizAnswerInput[]
  }) => invoke<LevelOutcome>(IPC.levelSubmit, input)
}

export const challengeApi = {
  start: (userId: number, subjectId: number, grade: number) =>
    invoke<TimedChallenge>(IPC.challengeStart, { userId, subjectId, grade }),
  submit: (input: {
    userId: number
    subjectId: number
    grade: number
    answers: QuizAnswerInput[]
  }) => invoke<ChallengeOutcome>(IPC.challengeSubmit, input)
}

export const familyApi = {
  list: (userId: number) => invoke<FamilyMatchSummary[]>(IPC.familyList, { userId }),
  create: (input: {
    userId: number
    subjectId: number
    grade: number
    title: string
    count: number
    endDate: string | null
  }) => invoke<FamilyMatchSummary>(IPC.familyCreate, input),
  get: (userId: number, matchId: number) =>
    invoke<FamilyMatchDetail>(IPC.familyGet, { userId, matchId }),
  submit: (input: {
    userId: number
    matchId: number
    answers: QuizAnswerInput[]
    durationSec: number
  }) => invoke<FamilyOutcome>(IPC.familySubmit, input)
}

export const portfolioApi = {
  list: (userId: number, page = 1, pageSize = 20) =>
    invoke<PrintHistoryPage>(IPC.portfolioList, { userId, page, pageSize }),
  remove: (userId: number, id: number) =>
    invoke<{ deleted: boolean }>(IPC.portfolioRemove, { userId, id })
}

export const relayApi = {
  history: (userId: number, limit = 10) =>
    invoke<RelayMatch[]>(IPC.relayHistory, { userId, limit }),
  create: (input: {
    userA: number
    userB: number
    subjectId: number
    grade: number
    count: number
    turnSeconds: number
  }) => invoke<RelayMatch>(IPC.relayCreate, input),
  get: (matchId: number) => invoke<RelayQuestionState>(IPC.relayGet, { matchId }),
  answer: (input: {
    matchId: number
    userId: number
    answer: unknown
    timeout?: boolean
  }) => invoke<RelayTurnOutcome>(IPC.relayAnswer, input),
  void: (matchId: number, userId: number) =>
    invoke<RelayQuestionState>(IPC.relayVoid, { matchId, userId })
}

export type { PracticeRecord, AnswerRecord, PaperType, Question }
