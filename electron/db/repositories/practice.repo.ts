import { getDb } from '../connection'
import { CUSTOM_QUESTION_ID_BASE, QUESTION_TYPE_LABELS } from '../../../shared/constants'
import { scoreAnswer } from '../scoring'
import { generateCustomQuestions } from '../generators/custom'
import { topUp } from '../generators/runtime'
import { getSubject, knowledgeIdsUnder } from './content.repo'
import { insertCustomQuestions, linkCustomQuestions } from './custom.repo'
import { getQuestion, pickRandomQuestions } from './question.repo'
import {
  buildResult,
  findPaperScore,
  getAnswers,
  getPracticePaper,
  markMastered,
  markWrong,
  upsertAnswer
} from './session.shared'
import type {
  DoingPracticeItem,
  HistoryItem,
  PracticeConfig,
  PracticeRecord,
  PracticeSession,
  Question,
  SessionResult
} from '../../../shared/types'

interface RecordRow {
  id: number
  user_id: number
  paper_id: number | null
  subject_id: number | null
  grade: number | null
  question_count: number
  correct_count: number
  duration_sec: number
  status: string
  started_at: string
  finished_at: string | null
}

function mapRecord(row: RecordRow): PracticeRecord {
  return {
    id: row.id,
    userId: row.user_id,
    paperId: row.paper_id,
    subjectId: row.subject_id,
    grade: row.grade,
    questionCount: row.question_count,
    correctCount: row.correct_count,
    durationSec: row.duration_sec,
    status: row.status as PracticeRecord['status'],
    startedAt: row.started_at,
    finishedAt: row.finished_at
  }
}

function pickWrongQuestions(userId: number, config: PracticeConfig): Question[] {
  const params: unknown[] = [
    CUSTOM_QUESTION_ID_BASE,
    userId,
    config.subjectId,
    config.grade
  ]
  let sql = `
    SELECT wb.question_id AS id
    FROM wrong_book wb
    LEFT JOIN bank.question q ON q.id = wb.question_id
    LEFT JOIN custom_question cq ON cq.id = wb.question_id - ?
    WHERE wb.user_id = ? AND wb.mastered = 0
      AND COALESCE(q.subject_id, cq.subject_id) = ?
      AND COALESCE(q.grade, cq.grade) = ?
      AND (q.id IS NOT NULL OR cq.id IS NOT NULL)
  `
  if (config.types.length > 0) {
    sql += ` AND COALESCE(q.type, cq.type) IN (${config.types.map(() => '?').join(',')})`
    params.push(...config.types)
  }
  sql += ' ORDER BY wb.last_wrong_at DESC LIMIT ?'
  params.push(config.count)

  const ids = (getDb().prepare(sql).all(...params) as { id: number }[]).map((row) => row.id)
  return ids.map((id) => getQuestion(id)).filter((item): item is Question => Boolean(item))
}

function paperPayload(questions: Question[]): string {
  return JSON.stringify(
    questions.map((question, index) => ({
      questionId: question.id,
      sort: index + 1,
      score: question.score ?? 2,
      question
    }))
  )
}

function createCustomPracticeSession(
  config: PracticeConfig,
  subjectName: string,
  count: number
): PracticeSession {
  const custom = config.custom!
  const questions = generateCustomQuestions({
    subjectId: config.subjectId,
    subjectName,
    grade: config.grade,
    types: [custom.type],
    params: { [custom.type]: custom.params ?? {} },
    knowledgeIds: config.knowledgeIds,
    difficulties: config.difficulties,
    count
  })
  if (questions.length === 0) {
    throw new Error('当前参数无法生成题目，请放宽参数后重试')
  }

  const db = getDb()
  const totalScore = questions.reduce((sum, item) => sum + (item.score ?? 2), 0)
  const title = `自定义练习 · ${QUESTION_TYPE_LABELS[custom.type] ?? custom.type}`
  const paperResult = db
    .prepare(
      `INSERT INTO practice_paper(title, stage, grade, subject_id, type, rule, duration, total_score, payload)
       VALUES (?, 'primary', ?, ?, 'practice', ?, NULL, ?, NULL)`
    )
    .run(title, config.grade, config.subjectId, JSON.stringify(config), totalScore)
  const paperId = Number(paperResult.lastInsertRowid)
  const recordResult = db
    .prepare(
      `INSERT INTO practice_record(user_id, paper_id, subject_id, grade, question_count, status)
       VALUES (?, ?, ?, ?, ?, 'doing')`
    )
    .run(config.userId, paperId, config.subjectId, config.grade, questions.length)
  const recordId = Number(recordResult.lastInsertRowid)
  const ids = insertCustomQuestions(recordId, config.subjectId, questions)
  const snapshot = questions.map((question, index) => ({
    questionId: ids[index],
    sort: index + 1,
    score: question.score ?? 2,
    question: {
      id: ids[index],
      subjectId: config.subjectId,
      stage: 'primary',
      grade: question.grade,
      knowledgeId: question.knowledgeId ?? null,
      knowledgeName: null,
      type: question.type,
      difficulty: question.difficulty,
      stem: question.stem,
      options: question.options ?? null,
      answer: question.answer,
      solution: question.solution ?? null,
      score: question.score ?? 2,
      source: question.source
    }
  }))
  db.prepare('UPDATE practice_paper SET payload = ? WHERE id = ?').run(
    JSON.stringify(snapshot),
    paperId
  )

  const record = db.prepare('SELECT * FROM practice_record WHERE id = ?').get(recordId) as RecordRow
  return {
    record: mapRecord(record),
    paper: getPracticePaper(recordId)!,
    answers: []
  }
}

export function createPracticeSession(config: PracticeConfig): PracticeSession {
  const subject = getSubject(config.subjectId)
  if (!subject) throw new Error('学科不存在')
  const count = Math.min(100, Math.max(1, Number(config.count) || 10))
  if (config.custom) return createCustomPracticeSession(config, subject.name, count)

  let questions: Question[] = []

  if (config.mode === 'wrong') {
    questions = pickWrongQuestions(config.userId, config)
    if (questions.length < count) {
      const exclude = questions.map((item) => item.id)
      questions = [
        ...questions,
        ...pickRandomQuestions(
          {
            stage: 'primary',
            subjectId: config.subjectId,
            grade: config.grade,
            types: config.types,
            difficulties: config.difficulties
          },
          count - questions.length,
          exclude
        )
      ]
    }
  } else {
    const knowledgeIds =
      config.mode === 'knowledge' && config.knowledgeIds?.length
        ? knowledgeIdsUnder(config.subjectId, config.grade, config.knowledgeIds)
        : undefined
    questions = pickRandomQuestions(
      {
        stage: 'primary',
        subjectId: config.subjectId,
        grade: config.grade,
        types: config.types,
        difficulties: config.difficulties,
        knowledgeIds
      },
      count
    )
    if (questions.length < count && config.types.length > 0) {
      const deficit = count - questions.length
      topUp({
        db: getDb(),
        subjectId: config.subjectId,
        grade: config.grade,
        type: config.types[0],
        difficulty: config.difficulties[0] ?? null,
        knowledgeIds,
        deficit
      })
      questions = pickRandomQuestions(
        {
          stage: 'primary',
          subjectId: config.subjectId,
          grade: config.grade,
          types: config.types,
          difficulties: config.difficulties,
          knowledgeIds
        },
        count,
        questions.map((item) => item.id)
      )
    }
  }

  if (questions.length === 0) throw new Error('题库中没有符合条件的题目，试试放宽筛选条件')

  const totalScore = questions.reduce((sum, item) => sum + item.score, 0)
  const titleBase =
    config.mode === 'wrong'
      ? '错题专练'
      : config.mode === 'knowledge'
        ? '知识点练习'
        : '随机练习'
  const title = `${subject.name} · ${config.grade} 年级 · ${titleBase}`
  const db = getDb()

  const create = db.transaction(() => {
    const paper = db
      .prepare(
        `INSERT INTO practice_paper(title, stage, grade, subject_id, type, rule, duration, total_score, payload)
         VALUES (?, 'primary', ?, ?, 'practice', ?, NULL, ?, ?)`
      )
      .run(
        title,
        config.grade,
        config.subjectId,
        JSON.stringify(config),
        totalScore,
        paperPayload(questions)
      )

    const paperId = Number(paper.lastInsertRowid)
    const insertPaperQuestion = db.prepare(
      'INSERT INTO practice_paper_question(paper_id, question_id, sort, score) VALUES (?, ?, ?, ?)'
    )
    const customIds: number[] = []
    const customSorts: number[] = []
    questions.forEach((question, index) => {
      if (question.id >= CUSTOM_QUESTION_ID_BASE) {
        customIds.push(question.id)
        customSorts.push(index + 1)
        return
      }
      insertPaperQuestion.run(paperId, question.id, index + 1, question.score)
    })

    const record = db
      .prepare(
        `INSERT INTO practice_record(user_id, paper_id, subject_id, grade, question_count, correct_count, duration_sec, status)
         VALUES (?, ?, ?, ?, ?, 0, 0, 'doing')`
      )
      .run(config.userId, paperId, config.subjectId, config.grade, questions.length)

    const recordId = Number(record.lastInsertRowid)
    linkCustomQuestions(recordId, customIds, customSorts)
    return recordId
  })

  const recordId = create()
  return getPracticeSession(config.userId, recordId)!
}

export function getPracticeSession(userId: number, recordId: number): PracticeSession | null {
  const row = getDb()
    .prepare('SELECT * FROM practice_record WHERE id = ? AND user_id = ?')
    .get(recordId, userId) as RecordRow | undefined
  if (!row) return null
  const paper = getPracticePaper(recordId)
  if (!paper) return null
  return { record: mapRecord(row), paper, answers: getAnswers('practice', recordId) }
}

export function answerPracticeQuestion(input: {
  userId: number
  recordId: number
  questionId: number
  answer: unknown
}): { isCorrect: boolean | null; score: number; answer: unknown; solution: string | null } {
  const db = getDb()
  const record = db
    .prepare("SELECT * FROM practice_record WHERE id = ? AND user_id = ? AND status = 'doing'")
    .get(input.recordId, input.userId) as RecordRow | undefined
  if (!record) throw new Error('练习不存在或已结束')

  const question = getQuestion(input.questionId)
  if (!question) throw new Error('题目不存在')

  const fullScore = findPaperScore('practice', input.recordId, input.questionId)
  const outcome = scoreAnswer(question.type, question.answer, input.answer, fullScore)

  upsertAnswer({
    userId: input.userId,
    recordId: input.recordId,
    recordType: 'practice',
    questionId: input.questionId,
    userAnswer: input.answer,
    isCorrect: outcome.isCorrect,
    score: outcome.score
  })

  if (outcome.isCorrect === false) {
    markWrong(input.userId, input.questionId)
  }
  if (outcome.isCorrect === true) {
    markMastered(input.userId, input.questionId)
  }

  return {
    isCorrect: outcome.isCorrect,
    score: outcome.score,
    answer: question.answer,
    solution: question.solution
  }
}

export function finishPractice(recordId: number, userId: number, durationSec: number): SessionResult {
  const db = getDb()
  const record = db
    .prepare('SELECT * FROM practice_record WHERE id = ? AND user_id = ?')
    .get(recordId, userId) as RecordRow | undefined
  if (!record) throw new Error('练习不存在')

  const paper = getPracticePaper(recordId)
  const answered = new Set(getAnswers('practice', recordId).map((item) => item.questionId))
  const fillUnanswered = db.transaction(() => {
    for (const item of paper?.questions ?? []) {
      if (answered.has(item.questionId)) continue
      upsertAnswer({
        userId,
        recordId,
        recordType: 'practice',
        questionId: item.questionId,
        userAnswer: null,
        isCorrect: false,
        score: 0
      })
      markWrong(userId, item.questionId)
    }
  })
  fillUnanswered()

  const stats = db
    .prepare(
      `SELECT
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct,
        SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) AS wrong
       FROM answer_record WHERE record_type = 'practice' AND record_id = ?`
    )
    .get(recordId) as { correct: number | null; wrong: number | null }

  db.prepare(
    `UPDATE practice_record SET status = 'done', correct_count = ?, duration_sec = ?,
       finished_at = datetime('now','localtime') WHERE id = ?`
  ).run(stats.correct ?? 0, Math.max(0, Math.round(durationSec)), recordId)

  return buildResult('practice', recordId, paper?.title ?? '练习', Math.round(durationSec))
}

export function gradeAnswer(input: {
  userId: number
  answerRecordId: number
  isCorrect: boolean
}): { correctCount: number } {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT ar.id, ar.record_id, ar.record_type, ar.question_id
       FROM answer_record ar
       JOIN practice_record pr ON pr.id = ar.record_id AND ar.record_type = 'practice'
       WHERE ar.id = ? AND ar.user_id = ?`
    )
    .get(input.answerRecordId, input.userId) as
    | { id: number; record_id: number; record_type: string; question_id: number }
    | undefined
  if (!row) throw new Error('答题记录不存在')

  const fullScore = findPaperScore('practice', row.record_id, row.question_id)
  db.prepare('UPDATE answer_record SET is_correct = ?, score = ? WHERE id = ?').run(
    input.isCorrect ? 1 : 0,
    input.isCorrect ? fullScore : 0,
    input.answerRecordId
  )

  if (input.isCorrect) {
    markMastered(input.userId, row.question_id)
  } else {
    markWrong(input.userId, row.question_id)
  }

  const stats = db
    .prepare(
      `SELECT SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct
       FROM answer_record WHERE record_type = 'practice' AND record_id = ?`
    )
    .get(row.record_id) as { correct: number | null }

  const correctCount = stats.correct ?? 0
  db.prepare('UPDATE practice_record SET correct_count = ? WHERE id = ?').run(
    correctCount,
    row.record_id
  )
  return { correctCount }
}

export function getPracticeResult(userId: number, recordId: number): SessionResult | null {
  const row = getDb()
    .prepare('SELECT * FROM practice_record WHERE id = ? AND user_id = ?')
    .get(recordId, userId) as RecordRow | undefined
  if (!row) return null
  const paper = getPracticePaper(recordId)
  return buildResult('practice', recordId, paper?.title ?? '练习', row.duration_sec)
}

export function listPracticeHistory(userId: number, limit = 20): HistoryItem[] {
  const rows = getDb()
    .prepare(
      `SELECT pr.id, pr.grade, pr.question_count, pr.correct_count, pr.duration_sec,
              pr.started_at, pr.finished_at, COALESCE(p.title, '练习记录') AS title,
              s.name AS subject_name
       FROM practice_record pr
       LEFT JOIN practice_paper p ON p.id = pr.paper_id
       LEFT JOIN bank.subject s ON s.id = pr.subject_id
       WHERE pr.user_id = ? AND pr.status = 'done'
       ORDER BY pr.finished_at DESC LIMIT ?`
    )
    .all(userId, limit) as {
    id: number
    grade: number
    question_count: number
    correct_count: number
    duration_sec: number
    started_at: string
    finished_at: string | null
    title: string
    subject_name: string | null
  }[]

  return rows.map((row) => ({
    id: row.id,
    type: 'practice',
    title: row.title,
    subjectName: row.subject_name ?? '',
    grade: row.grade,
    questionCount: row.question_count,
    correctCount: row.correct_count,
    score: 0,
    totalScore: 0,
    accuracy:
      row.question_count > 0 ? Math.round((row.correct_count / row.question_count) * 100) : 0,
    durationSec: row.duration_sec,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  }))
}

/** 未完成的练习，供「继续 / 清理」入口使用 */
export function listDoingPractices(userId: number, limit = 5): DoingPracticeItem[] {
  const rows = getDb()
    .prepare(
      `SELECT pr.id, pr.question_count, pr.started_at, p.title,
              CASE WHEN p.id IS NULL THEN 0 ELSE 1 END AS resumable,
              s.name AS subject_name
       FROM practice_record pr
       LEFT JOIN practice_paper p ON p.id = pr.paper_id
       LEFT JOIN bank.subject s ON s.id = pr.subject_id
       WHERE pr.user_id = ? AND pr.status = 'doing'
       ORDER BY pr.started_at DESC, pr.id DESC LIMIT ?`
    )
    .all(userId, limit) as {
    id: number
    question_count: number
    started_at: string
    title: string | null
    resumable: number
    subject_name: string | null
  }[]

  return rows.map((row) => ({
    id: row.id,
    title: row.title ?? '练习记录',
    subjectName: row.subject_name ?? '',
    questionCount: row.question_count,
    startedAt: row.started_at,
    resumable: row.resumable === 1
  }))
}

/** 清理该用户所有未完成练习，并删除不再被引用的试卷快照 */
export function discardDoingPractices(userId: number): number {
  const db = getDb()
  const remove = db.transaction((id: number) => {
    db.prepare(
      `DELETE FROM answer_record
       WHERE user_id = ? AND record_type = 'practice'
         AND record_id IN (SELECT id FROM practice_record WHERE user_id = ? AND status = 'doing')`
    ).run(id, id)
    const result = db
      .prepare("DELETE FROM practice_record WHERE user_id = ? AND status = 'doing'")
      .run(id)
    db.prepare(
      `DELETE FROM practice_paper
       WHERE id NOT IN (SELECT paper_id FROM practice_record WHERE paper_id IS NOT NULL)`
    ).run()
    return result.changes
  })
  return remove(userId)
}
