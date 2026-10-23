import { ipcMain } from 'electron'
import type { ZodType } from 'zod'
import { IPC } from '../shared/ipc'
import { parseImportSource, commitImportSource } from './db/import'
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  verifyPin
} from './db/repositories/user.repo'
import { listKnowledgeTree, listSubjects } from './db/repositories/content.repo'
import {
  explainWord,
  getCharacterDetail,
  listCharacters,
  readStrokeData
} from './db/repositories/character.repo'
import {
  createQuestion,
  deleteQuestion,
  pageQuestions,
  typeStats,
  updateQuestion
} from './db/repositories/question.repo'
import {
  answerPracticeQuestion,
  createPracticeSession,
  discardDoingPractices,
  finishPractice,
  getPracticeResult,
  getPracticeSession,
  gradeAnswer,
  listDoingPractices,
  listPracticeHistory
} from './db/repositories/practice.repo'
import {
  answerExamQuestion,
  getExamResult,
  getExamSession,
  listExamHistory,
  listExamTemplates,
  startExam,
  submitExam
} from './db/repositories/exam.repo'
import {
  pageWrongBook,
  removeWrong,
  setMastered,
  wrongSummary
} from './db/repositories/wrong.repo'
import { overview, subjectStats, trend } from './db/repositories/stats.repo'
import {
  achievements,
  answerDailyChallenge,
  calendar,
  dailyChallenge,
  growthPoints,
  overview as incentiveOverview
} from './db/repositories/incentive.repo'
import { listEnglishWords } from './db/repositories/english.repo'
import { getWeeklyGoal, setWeeklyGoal } from './db/repositories/goal.repo'
import { listLevels, startLevel, submitLevel } from './db/repositories/levels.repo'
import {
  startTimedChallenge,
  submitTimedChallenge
} from './db/repositories/challenge.repo'
import {
  createFamilyMatch,
  getFamilyMatch,
  listFamilyMatches,
  submitFamilyAnswer
} from './db/repositories/family.repo'
import { listPrintHistory, removePrintHistory } from './db/repositories/portfolio.repo'
import {
  answerRelayTurn,
  createRelayMatch,
  getRelayMatch,
  listRelayMatches,
  voidRelayMatch
} from './db/repositories/relay.repo'
import { isAsrAvailable, transcribePcm } from './asr'
import { synthesizeSpeech } from './tts'
import {
  buildDocument,
  getPayload,
  markReady,
  previewPdf,
  previewRequest,
  printRequest,
  saveBatch,
  saveJob,
  saveRequest,
  startPrintJanitor
} from './print/service'
import { generateQuestionSources } from './print/document'
import {
  deletePrintTemplate,
  getPrintTemplate,
  listPrintTemplates,
  savePrintTemplate
} from './db/repositories/print-template.repo'
import type { IpcResponse, NewQuestion, PracticeConfig, QuizAnswerInput } from '../shared/types'
import {
  answerSchema,
  examStartSchema,
  finishSchema,
  gradeSchema,
  importCommitSchema,
  importPreviewSchema,
  practiceConfigSchema,
  practiceDiscardDoingSchema,
  practiceDoingSchema,
  printBatchSchema,
  printGenerateSchema,
  printRequestSchema,
  printTemplateIdSchema,
  printTemplateListSchema,
  printTemplateSaveSchema,
  printTokenSchema,
  questionFilterSchema,
  questionInputSchema,
  userCreateSchema,
  userUpdateSchema,
  verifyPinSchema,
  wrongFilterSchema
} from '../shared/validators'
import { ValidationError } from './errors'

type Payload = Record<string, unknown>

function success<T>(data: T): IpcResponse<T> {
  return { code: 200, message: '成功', data }
}

function failure(code: number, message: string): IpcResponse<never> {
  return { code, message }
}

function validate<T>(schema: ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload ?? {})
  if (!result.success) {
    const first = result.error.issues[0]
    throw new ValidationError(first?.message ?? '参数不合法')
  }
  return result.data
}

function handle<T>(channel: string, fn: (payload: Payload) => T | Promise<T>): void {
  ipcMain.handle(channel, async (_event, payload: Payload) => {
    try {
      return success(await fn(payload ?? {}))
    } catch (error) {
      if (error instanceof ValidationError) {
        return failure(400, error.message)
      }
      const message = error instanceof Error ? error.message : '操作失败'
      console.error(`[ipc] ${channel} 失败：`, error)
      return failure(500, message)
    }
  })
}

function readAnswers(value: unknown): QuizAnswerInput[] {
  if (!Array.isArray(value)) throw new ValidationError('答案参数不合法')
  return value as QuizAnswerInput[]
}

export function registerIpcHandlers(): void {
  startPrintJanitor()
  handle(IPC.userList, () => listUsers())

  handle(IPC.userCreate, (payload) => createUser(validate(userCreateSchema, payload)))

  handle(IPC.userUpdate, (payload) => {
    const input = validate(userUpdateSchema, payload)
    return updateUser(input.id, input.patch)
  })

  handle(IPC.userDelete, (payload) => {
    const id = Number(payload.id)
    if (!Number.isInteger(id) || id <= 0) throw new ValidationError('用户编号不合法')
    if (listUsers().length <= 1) throw new ValidationError('至少保留一个用户')
    deleteUser(id)
    return { deleted: true }
  })

  handle(IPC.userVerifyPin, (payload) => {
    const input = validate(verifyPinSchema, payload)
    return { valid: verifyPin(input.id, input.pin) }
  })

  handle(IPC.subjectList, (payload) => {
    const grade = payload.grade === undefined ? undefined : Number(payload.grade)
    return listSubjects('primary', grade)
  })

  handle(IPC.knowledgeTree, (payload) => {
    const subjectId = Number(payload.subjectId)
    const grade = Number(payload.grade)
    if (!subjectId || !grade) throw new ValidationError('请选择学科和年级')
    return listKnowledgeTree(subjectId, grade)
  })

  handle(IPC.characterList, (payload) => {
    const grade = Number(payload.grade)
    if (!Number.isInteger(grade) || grade < 1 || grade > 6) throw new ValidationError('年级不合法')
    return listCharacters(grade)
  })

  handle(IPC.characterDetail, (payload) => {
    const detail = getCharacterDetail(String(payload.char ?? '').trim())
    if (!detail) throw new ValidationError('汉字不存在')
    return detail
  })

  handle(IPC.characterStrokeData, (payload) => {
    const data = readStrokeData(String(payload.char ?? '').trim())
    if (!data) throw new ValidationError('暂无笔顺动画数据')
    return { data }
  })

  handle(IPC.characterExplain, async (payload) => {
    const word = String(payload.word ?? '').trim()
    if (!word) throw new ValidationError('词语不能为空')
    return { text: await explainWord(word) }
  })

  handle(IPC.ttsSynthesize, (payload) => {
    const text = String(payload.text ?? '').trim()
    if (!text) throw new ValidationError('朗读内容不能为空')
    if (text.length > 400) throw new ValidationError('朗读内容过长')
    if (payload.lang !== 'zh-CN' && payload.lang !== 'en-US') {
      throw new ValidationError('朗读语言不合法')
    }
    return synthesizeSpeech({ text, lang: payload.lang })
  })

  handle(IPC.englishWords, (payload) => {
    if (typeof payload.grade !== 'number' || !Number.isInteger(payload.grade)) {
      throw new ValidationError('年级不合法')
    }
    if (payload.grade < 1 || payload.grade > 6) throw new ValidationError('年级不合法')
    return listEnglishWords(payload.grade)
  })

  handle(IPC.asrStatus, () => ({ available: isAsrAvailable() }))

  handle(IPC.asrTranscribe, (payload) => {
    const audio = String(payload.audio ?? '')
    if (!audio) throw new ValidationError('录音数据为空')
    if (audio.length > 2_000_000) throw new ValidationError('录音过长')
    if (payload.sampleRate !== 16000) throw new ValidationError('采样率不合法')
    return transcribePcm(audio, payload.sampleRate)
  })

  handle(IPC.questionPage, (payload) => pageQuestions(validate(questionFilterSchema, payload)))

  handle(IPC.questionCreate, (payload) =>
    createQuestion(validate(questionInputSchema, payload) as NewQuestion)
  )

  handle(IPC.questionUpdate, (payload) => {
    const id = Number(payload.id)
    if (!Number.isInteger(id) || id <= 0) throw new ValidationError('题目编号不合法')
    return updateQuestion(id, validate(questionInputSchema, payload.input) as NewQuestion)
  })

  handle(IPC.questionDelete, (payload) => {
    const id = Number(payload.id)
    if (!Number.isInteger(id) || id <= 0) throw new ValidationError('题目编号不合法')
    deleteQuestion(id)
    return { deleted: true }
  })

  handle(IPC.questionTypeStats, (payload) => typeStats(validate(questionFilterSchema, payload)))

  handle(IPC.practiceCreate, (payload) =>
    createPracticeSession(validate(practiceConfigSchema, payload) as PracticeConfig)
  )

  handle(IPC.practiceGet, (payload) => {
    const session = getPracticeSession(Number(payload.userId), Number(payload.recordId))
    if (!session) throw new ValidationError('练习不存在')
    return session
  })

  handle(IPC.practiceList, (payload) =>
    listPracticeHistory(Number(payload.userId), Number(payload.limit ?? 20))
  )

  handle(IPC.practiceDoing, (payload) => {
    const input = validate(practiceDoingSchema, payload)
    return listDoingPractices(input.userId, input.limit ?? 5)
  })

  handle(IPC.practiceDiscardDoing, (payload) => {
    const input = validate(practiceDiscardDoingSchema, payload)
    return { deleted: discardDoingPractices(input.userId) }
  })

  handle(IPC.practiceAnswer, (payload) => {
    const input = validate(answerSchema, payload)
    return answerPracticeQuestion(input)
  })

  handle(IPC.practiceFinish, (payload) => {
    const input = validate(finishSchema, payload)
    return finishPractice(input.recordId, input.userId, input.durationSec)
  })

  handle(IPC.practiceGrade, (payload) => gradeAnswer(validate(gradeSchema, payload)))

  handle(IPC.practiceResult, (payload) => {
    const result = getPracticeResult(Number(payload.userId), Number(payload.recordId))
    if (!result) throw new ValidationError('练习结果不存在')
    return result
  })

  handle(IPC.examTemplates, (payload) => listExamTemplates(Number(payload.userId)))

  handle(IPC.examStart, (payload) => {
    const input = validate(examStartSchema, payload)
    return startExam(input.userId, input.paperId)
  })

  handle(IPC.examGet, (payload) => {
    const session = getExamSession(Number(payload.userId), Number(payload.recordId))
    if (!session) throw new ValidationError('考试不存在')
    return session
  })

  handle(IPC.examAnswer, (payload) => {
    const input = validate(answerSchema, payload)
    return answerExamQuestion(input)
  })

  handle(IPC.examSubmit, (payload) => {
    const input = validate(finishSchema, payload)
    return submitExam(input.recordId, input.userId, input.durationSec)
  })

  handle(IPC.examRecords, (payload) =>
    listExamHistory(Number(payload.userId), Number(payload.limit ?? 20))
  )

  handle(IPC.examResult, (payload) => {
    const result = getExamResult(Number(payload.userId), Number(payload.recordId))
    if (!result) throw new ValidationError('考试结果不存在')
    return result
  })

  handle(IPC.wrongPage, (payload) =>
    pageWrongBook(validate(wrongFilterSchema, payload) as Parameters<typeof pageWrongBook>[0])
  )

  handle(IPC.wrongMaster, (payload) => {
    const id = Number(payload.id)
    const userId = Number(payload.userId)
    if (!id || !userId) throw new ValidationError('参数不合法')
    setMastered(userId, id, Boolean(payload.mastered))
    return { updated: true }
  })

  handle(IPC.wrongRemove, (payload) => {
    const id = Number(payload.id)
    const userId = Number(payload.userId)
    if (!id || !userId) throw new ValidationError('参数不合法')
    removeWrong(userId, id)
    return { deleted: true }
  })

  handle(IPC.wrongSummary, (payload) => wrongSummary(Number(payload.userId)))

  handle(IPC.statsOverview, (payload) => overview(Number(payload.userId)))

  handle(IPC.statsSubjects, (payload) => subjectStats(Number(payload.userId)))

  handle(IPC.statsTrend, (payload) =>
    trend(Number(payload.userId), Number(payload.days ?? 14))
  )

  handle(IPC.incentiveOverview, (payload) => incentiveOverview(Number(payload.userId)))

  handle(IPC.incentiveAchievements, (payload) => achievements(Number(payload.userId)))

  handle(IPC.incentiveDailyGet, (payload) => dailyChallenge(Number(payload.userId)))

  handle(IPC.incentiveDailyAnswer, (payload) => {
    const userId = Number(payload.userId)
    if (!userId) throw new ValidationError('参数不合法')
    return answerDailyChallenge(userId, payload.answer)
  })

  handle(IPC.incentiveCalendar, (payload) => {
    const month = String(payload.month ?? '')
    if (!/^\d{4}-\d{2}$/.test(month)) throw new ValidationError('月份格式应为 YYYY-MM')
    return calendar(Number(payload.userId), month)
  })

  handle(IPC.incentiveGrowth, (payload) =>
    growthPoints(Number(payload.userId), Number(payload.days ?? 14))
  )

  handle(IPC.goalGet, (payload) => getWeeklyGoal(Number(payload.userId)))

  handle(IPC.goalSet, (payload) => {
    const userId = Number(payload.userId)
    const kind = String(payload.kind)
    if (!userId) throw new ValidationError('参数不合法')
    if (kind !== 'count' && kind !== 'accuracy') throw new ValidationError('目标类型不合法')
    return setWeeklyGoal(userId, kind, Number(payload.target))
  })

  handle(IPC.levelList, (payload) =>
    listLevels(Number(payload.userId), Number(payload.subjectId), Number(payload.grade))
  )

  handle(IPC.levelStart, (payload) =>
    startLevel(
      Number(payload.userId),
      Number(payload.subjectId),
      Number(payload.grade),
      Number(payload.levelIndex)
    )
  )

  handle(IPC.levelSubmit, (payload) =>
    submitLevel(
      Number(payload.userId),
      Number(payload.subjectId),
      Number(payload.grade),
      Number(payload.levelIndex),
      readAnswers(payload.answers)
    )
  )

  handle(IPC.challengeStart, (payload) =>
    startTimedChallenge(Number(payload.userId), Number(payload.subjectId), Number(payload.grade))
  )

  handle(IPC.challengeSubmit, (payload) =>
    submitTimedChallenge(
      Number(payload.userId),
      Number(payload.subjectId),
      Number(payload.grade),
      readAnswers(payload.answers)
    )
  )

  handle(IPC.familyList, (payload) => listFamilyMatches(Number(payload.userId)))

  handle(IPC.familyCreate, (payload) =>
    createFamilyMatch({
      userId: Number(payload.userId),
      subjectId: Number(payload.subjectId),
      grade: Number(payload.grade),
      title: String(payload.title ?? ''),
      count: Number(payload.count),
      endDate: payload.endDate ? String(payload.endDate) : null
    })
  )

  handle(IPC.familyGet, (payload) =>
    getFamilyMatch(Number(payload.userId), Number(payload.matchId))
  )

  handle(IPC.familySubmit, (payload) =>
    submitFamilyAnswer({
      userId: Number(payload.userId),
      matchId: Number(payload.matchId),
      answers: readAnswers(payload.answers),
      durationSec: Number(payload.durationSec)
    })
  )

  handle(IPC.portfolioList, (payload) =>
    listPrintHistory(Number(payload.userId), Number(payload.page ?? 1), Number(payload.pageSize ?? 20))
  )

  handle(IPC.portfolioRemove, (payload) =>
    removePrintHistory(Number(payload.userId), Number(payload.id))
  )

  handle(IPC.relayCreate, (payload) =>
    createRelayMatch({
      userA: Number(payload.userA),
      userB: Number(payload.userB),
      subjectId: Number(payload.subjectId),
      grade: Number(payload.grade),
      count: Number(payload.count),
      turnSeconds: Number(payload.turnSeconds)
    })
  )

  handle(IPC.relayGet, (payload) => getRelayMatch(Number(payload.matchId)))

  handle(IPC.relayAnswer, (payload) =>
    answerRelayTurn({
      matchId: Number(payload.matchId),
      userId: Number(payload.userId),
      answer: payload.answer,
      timeout: payload.timeout === true
    })
  )

  handle(IPC.relayVoid, (payload) =>
    voidRelayMatch(Number(payload.matchId), Number(payload.userId))
  )

  handle(IPC.relayHistory, (payload) =>
    listRelayMatches(Number(payload.userId), Number(payload.limit ?? 10))
  )

  handle(IPC.importPreview, (payload) => {
    const input = validate(importPreviewSchema, payload)
    return parseImportSource(input.raw, input.fileName)
  })

  handle(IPC.importCommit, (payload) => {
    const input = validate(importCommitSchema, payload)
    return commitImportSource(input.raw, input.fileName)
  })

  handle(IPC.printSave, (payload) => saveRequest(validate(printRequestSchema, payload)))

  handle(IPC.printPreview, (payload) => previewRequest(validate(printRequestSchema, payload)))

  handle(IPC.printPayload, (payload) =>
    getPayload(validate(printTokenSchema, payload).token)
  )

  handle(IPC.printReady, (payload) => {
    markReady(validate(printTokenSchema, payload).token)
    return { ready: true }
  })

  handle(IPC.printSaveJob, (payload) =>
    saveJob(validate(printTokenSchema, payload).token)
  )

  handle(IPC.printPreviewPdf, (payload) =>
    previewPdf(validate(printTokenSchema, payload).token)
  )

  handle(IPC.printPrint, (payload) => printRequest(validate(printRequestSchema, payload)))

  handle(IPC.printBuild, (payload) => buildDocument(validate(printRequestSchema, payload)))

  handle(IPC.printGenerate, (payload) =>
    generateQuestionSources(validate(printGenerateSchema, payload))
  )

  handle(IPC.printTemplateList, (payload) =>
    listPrintTemplates(validate(printTemplateListSchema, payload).userId)
  )

  handle(IPC.printTemplateGet, (payload) => {
    const input = validate(printTemplateIdSchema, payload)
    return getPrintTemplate(input.userId, input.id)
  })

  handle(IPC.printTemplateSave, (payload) => savePrintTemplate(validate(printTemplateSaveSchema, payload)))

  handle(IPC.printTemplateDelete, (payload) => {
    const input = validate(printTemplateIdSchema, payload)
    return { deleted: deletePrintTemplate(input.userId, input.id) }
  })

  handle(IPC.printBatch, (payload) => saveBatch(validate(printBatchSchema, payload)))
}
