import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { getBankPath } from '../connection'
import { KNOWLEDGE_TOPICS, matchTopic } from '../knowledge'
import { generateChinese } from './chinese'
import { generateMath } from './math'
import { generateEnglish } from './english'
import type { GeneratorContext, GeneratedQuestion } from './types'
import type { QuestionType } from '../../../shared/types'

export interface RuntimeGeneratorContext {
  /** 用户库连接，用于读 subject / knowledge_point（bank schema 已 ATTACH） */
  db: Database.Database
  subjectId: number
  grade: number
  type: QuestionType
  difficulty: number | null
  knowledgeIds?: number[]
  /** 需要补多少题 */
  deficit: number
}

interface SubjectRow {
  id: number
  stage: string
  name: string
}

interface KnowledgeRow {
  id: number
  subject_id: number
  grade: number
  name: string
}

function runtimeSourceOf(type: QuestionType): string {
  return `generator:runtime:${type}`
}

function fingerprintOf(input: {
  subjectId: number
  grade: number
  type: string
  stem: string
  options?: unknown
}): string {
  const optionsKey = input.options === undefined ? '' : JSON.stringify(input.options)
  return createHash('sha1')
    .update(`${input.subjectId}|${input.grade}|${input.type}|${input.stem.trim()}|${optionsKey}`)
    .digest('hex')
}

function getSubjectName(db: Database.Database, subjectId: number): string | null {
  const row = db.prepare('SELECT id, stage, name FROM bank.subject WHERE id = ?').get(subjectId) as
    | SubjectRow
    | undefined
  return row?.name ?? null
}

function buildKnowledgeMap(
  db: Database.Database,
  subjectId: number,
  grade: number
): Map<string, number> {
  const rows = db
    .prepare(
      'SELECT id, subject_id, grade, name FROM bank.knowledge_point WHERE subject_id = ? AND grade = ?'
    )
    .all(subjectId, grade) as KnowledgeRow[]
  const map = new Map<string, number>()
  for (const row of rows) map.set(`${row.name}`, row.id)
  return map
}

function resolveKnowledgeId(
  knowledgeMap: Map<string, number>,
  subjectName: string,
  grade: number,
  topic: string
): number | null {
  const mapped = matchTopic(subjectName, topic) || topic
  return knowledgeMap.get(mapped) ?? null
}

/**
 * 运行时兜底：当某 subject×grade×type×difficulty 组合题量不足时，
 * 调用既有构建期生成器在独立 bank.db 连接上实时生成并写入。
 *
 * 实现要点：
 * - 独立打开 bank.db 连接（同 build-bank.ts），让生成器原 SQL（无前缀表名）原样执行
 * - 通过 GeneratorContext.insert 过滤目标 grade / type / difficulty，并限制 deficit 题
 * - source 改写为 `generator:runtime:<type>`，fingerprint 命中则 ON CONFLICT DO NOTHING
 * - 返回实际写入数
 */
export function topUp(ctx: RuntimeGeneratorContext): number {
  if (ctx.deficit <= 0) return 0
  const subjectName = getSubjectName(ctx.db, ctx.subjectId)
  if (!subjectName) return 0
  if (!KNOWLEDGE_TOPICS[subjectName]) return 0

  const knowledgeMap = buildKnowledgeMap(ctx.db, ctx.subjectId, ctx.grade)
  const targetDifficulty = ctx.difficulty
  const targetType = ctx.type
  const runtimeSource = runtimeSourceOf(targetType)
  const subjectId = ctx.subjectId
  const grade = ctx.grade
  const deficit = ctx.deficit

  const bankDb = new Database(getBankPath(), { timeout: 5000 })
  bankDb.pragma('journal_mode = WAL')
  bankDb.pragma('foreign_keys = ON')

  const insertQuestion = bankDb.prepare(
    `INSERT INTO question(subject_id, stage, grade, knowledge_id, type, difficulty, stem, options, answer, solution, score, source, fingerprint)
     VALUES (?, 'primary', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(fingerprint) DO NOTHING`
  )

  let inserted = 0
  let mixIndex = 0

  const generatorCtx: GeneratorContext = {
    db: bankDb,
    subjectId: (name: string) => (name === subjectName ? subjectId : 0),
    knowledgeId: (subject, g, topic) =>
      g === grade && subject === subjectName
        ? resolveKnowledgeId(knowledgeMap, subject, grade, topic)
        : null,
    insert: (q: GeneratedQuestion): boolean => {
      if (inserted >= deficit) return false
      if (q.subject !== subjectName) return false
      if (q.grade !== grade) return false
      if (q.type !== targetType) return false

      // 生成器内部按年级硬编码难度；运行时用用户选择的难度，未选时均匀混合
      const effectiveDifficulty = targetDifficulty ?? ((mixIndex++ % 3) + 1)
      const knowledgeId = resolveKnowledgeId(knowledgeMap, subjectName, grade, q.topic)
      const fp = fingerprintOf({ subjectId, grade, type: q.type, stem: q.stem, options: q.options })
      const result = insertQuestion.run(
        subjectId,
        grade,
        knowledgeId,
        q.type,
        effectiveDifficulty,
        q.stem,
        q.options === undefined ? null : JSON.stringify(q.options),
        JSON.stringify(q.answer),
        q.solution ?? null,
        q.score ?? 2,
        runtimeSource,
        fp
      )
      if (result.changes > 0) {
        inserted += 1
        return true
      }
      return false
    }
  }

  try {
    if (subjectName === '语文') generateChinese(generatorCtx)
    else if (subjectName === '数学') generateMath(generatorCtx)
    else if (subjectName === '英语') generateEnglish(generatorCtx)
    console.log(`[runtime] topUp subject=${subjectName} grade=${grade} type=${targetType} difficulty=${targetDifficulty ?? 'any'} deficit=${deficit} inserted=${inserted}`)
  } finally {
    bankDb.close()
  }

  return inserted
}