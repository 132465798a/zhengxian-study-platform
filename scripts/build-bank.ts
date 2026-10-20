/**
 * 构建题库库 build/bank.db
 * 运行：npm run seed:build
 * 该文件随安装包分发，用户首次启动时复制到用户目录。
 */
import Database from 'better-sqlite3'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'
import { BANK_SCHEMA } from '../electron/db/schema'
import { KNOWLEDGE_TOPICS, matchTopic } from '../electron/db/knowledge'
import { importReferenceData } from '../electron/db/importers/reference'
import { importAll } from '../electron/db/importers'
import { generateAll } from '../electron/db/generators'
import { reclassifyQuestionDifficulty } from '../electron/db/difficulty'
import { STAGE_CONFIG } from '../shared/constants'
import type { SeedContext, SeedQuestion } from '../electron/db/seed/types'
import type { QuestionAnswer } from '../shared/types'

const ROOT = process.cwd()
const DATASETS = join(ROOT, 'datasets')
const OUT = join(ROOT, 'build', 'bank.db')
/** 默认用构建时间做版本号，保证每次构建都能覆盖用户目录里的旧题库 */
const BANK_VERSION = process.env.BANK_VERSION ?? new Date().toISOString().slice(0, 19)

const SUBJECT_ICONS: Record<string, string> = {
  语文: 'pi pi-book',
  数学: 'pi pi-calculator',
  英语: 'pi pi-globe'
}

function fingerprint(input: {
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

function main(): void {
  mkdirSync(dirname(OUT), { recursive: true })
  if (existsSync(OUT)) rmSync(OUT)

  const db = new Database(OUT)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(BANK_SCHEMA)

  console.log('=== 1/5 导入参考数据 ===')
  const ref = importReferenceData(db, DATASETS)

  console.log('=== 2/5 建立学科与知识点 ===')
  const subjectIds = new Map<string, number>()
  const insertSubject = db.prepare(
    'INSERT INTO subject(stage, name, icon, sort) VALUES (?, ?, ?, ?)'
  )
  const findSubject = db.prepare('SELECT id FROM subject WHERE stage = ? AND name = ?')
  const config = STAGE_CONFIG.primary
  const subjectNames = [...new Set(Object.values(config.subjectsByGrade).flat())]
  subjectNames.forEach((name, index) => {
    insertSubject.run('primary', name, SUBJECT_ICONS[name] ?? 'pi pi-circle', index)
    subjectIds.set(name, (findSubject.get('primary', name) as { id: number }).id)
  })

  const insertKnowledge = db.prepare(
    'INSERT INTO knowledge_point(subject_id, grade, parent_id, name, sort) VALUES (?, ?, NULL, ?, ?)'
  )
  const knowledgeMap = new Map<string, number>()
  for (const [subjectName, topics] of Object.entries(KNOWLEDGE_TOPICS)) {
    const subjectId = subjectIds.get(subjectName)
    if (!subjectId) continue
    for (const grade of config.grades) {
      if (!(config.subjectsByGrade[grade] ?? []).includes(subjectName)) continue
      topics.forEach((topic, index) => {
        const result = insertKnowledge.run(subjectId, grade, topic, index)
        knowledgeMap.set(`${subjectName}|${grade}|${topic}`, Number(result.lastInsertRowid))
      })
    }
  }

  console.log('=== 3/5 导入真实题库 ===')
  const insertQuestion = db.prepare(
    `INSERT INTO question(subject_id, stage, grade, knowledge_id, type, difficulty, stem, options, answer, solution, score, source, fingerprint)
     VALUES (?, 'primary', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(fingerprint) DO NOTHING`
  )

  let inserted = 0
  const add = (item: SeedQuestion): void => {
    const subjectId = subjectIds.get(item.subject)
    if (!subjectId) return
    const topic = matchTopic(item.subject, item.topic)
    const knowledgeId = topic ? (knowledgeMap.get(`${item.subject}|${item.grade}|${topic}`) ?? null) : null
    const result = insertQuestion.run(
      subjectId,
      item.grade,
      knowledgeId,
      item.type,
      item.difficulty,
      item.stem,
      item.options === undefined ? null : JSON.stringify(item.options),
      JSON.stringify(item.answer as QuestionAnswer),
      item.solution ?? null,
      item.score ?? 2,
      item.source ?? '未知来源',
      fingerprint({
        subjectId,
        grade: item.grade,
        type: item.type,
        stem: item.stem,
        options: item.options
      })
    )
    if (result.changes > 0) inserted += 1
  }

  const context: SeedContext = {
    subjectId: (name) => subjectIds.get(name) ?? 0,
    knowledgeId: (subject, grade, topic) => {
      const mapped = matchTopic(subject, topic) || topic
      return knowledgeMap.get(`${subject}|${grade}|${mapped}`) ?? null
    },
    add,
    random: () => Math.random,
    insertQuestion: (input) => {
      const result = insertQuestion.run(
        input.subjectId,
        input.grade,
        input.knowledgeId,
        input.type,
        input.difficulty,
        input.stem,
        input.options === undefined ? null : JSON.stringify(input.options),
        JSON.stringify(input.answer),
        input.solution,
        input.score,
        input.source,
        fingerprint({
          subjectId: input.subjectId,
          grade: input.grade,
          type: input.type,
          stem: input.stem,
          options: input.options
        })
      )
      if (result.changes > 0) inserted += 1
    }
  }

  const imported = importAll(context)
  console.log(`真实题库写入 ${inserted} 题`, imported)

  console.log('=== 4/5 生成题目 ===')
  const beforeGenerate = inserted
  const generated = generateAll({
    db,
    subjectId: (name) => subjectIds.get(name) ?? 0,
    knowledgeId: (subject, grade, topic) => {
      const mapped = matchTopic(subject, topic) || topic
      return knowledgeMap.get(`${subject}|${grade}|${mapped}`) ?? null
    },
    insert: (question) => {
      const subjectId = subjectIds.get(question.subject)
      if (!subjectId) return false
      const topic = matchTopic(question.subject, question.topic) || question.topic
      const knowledgeId = knowledgeMap.get(`${question.subject}|${question.grade}|${topic}`) ?? null
      const result = insertQuestion.run(
        subjectId,
        question.grade,
        knowledgeId,
        question.type,
        question.difficulty,
        question.stem,
        question.options === undefined ? null : JSON.stringify(question.options),
        JSON.stringify(question.answer),
        question.solution ?? null,
        question.score ?? 2,
        question.source,
        fingerprint({
          subjectId,
          grade: question.grade,
          type: question.type,
          stem: question.stem,
          options: question.options
        })
      )
      if (result.changes > 0) inserted += 1
      return result.changes > 0
    }
  })
  console.log(`生成题目写入 ${inserted - beforeGenerate} 题`, generated)

  console.log('=== 4.5/5 按内容重新划分难度 ===')
  const difficulty = reclassifyQuestionDifficulty(db)
  console.log('难度分布', difficulty.byDifficulty)

  console.log('=== 5/5 生成考试模板 ===')
  const insertPaper = db.prepare(
    `INSERT INTO paper(title, stage, grade, subject_id, type, rule, duration, total_score)
     VALUES (?, 'primary', ?, ?, 'exam', ?, ?, ?)`
  )
  const insertPaperQuestion = db.prepare(
    'INSERT INTO paper_question(paper_id, question_id, sort, score) VALUES (?, ?, ?, ?)'
  )
  const pick = db.prepare(
    'SELECT id, score FROM question WHERE subject_id = ? AND grade = ? ORDER BY RANDOM() LIMIT 10'
  )
  let paperCount = 0
  for (const [subjectName, subjectId] of subjectIds) {
    for (const grade of config.grades) {
      if (!(config.subjectsByGrade[grade] ?? []).includes(subjectName)) continue
      const picked = pick.all(subjectId, grade) as { id: number; score: number }[]
      if (picked.length === 0) continue
      const totalScore = picked.reduce((sum, item) => sum + item.score, 0)
      const duration = grade <= 2 ? 30 : grade <= 4 ? 40 : 45
      const rule = { mode: 'auto', filters: { subjectId, grade }, count: picked.length, duration }
      const paper = insertPaper.run(
        `${grade} 年级基础知识检测`,
        grade,
        subjectId,
        JSON.stringify(rule),
        duration,
        totalScore
      )
      const paperId = Number(paper.lastInsertRowid)
      picked.forEach((item, index) => {
        insertPaperQuestion.run(paperId, item.id, index + 1, item.score)
      })
      paperCount += 1
    }
  }

  db.prepare("INSERT OR REPLACE INTO ref_meta(key, value) VALUES ('version', ?)").run(BANK_VERSION)
  db.prepare("INSERT OR REPLACE INTO ref_meta(key, value) VALUES ('built_at', ?)").run(
    new Date().toISOString()
  )

  const total = (db.prepare('SELECT COUNT(*) AS c FROM question').get() as { c: number }).c
  const bySubject = db
    .prepare(
      'SELECT s.name AS n, COUNT(*) AS c FROM question q JOIN subject s ON s.id = q.subject_id GROUP BY s.name'
    )
    .all() as { n: string; c: number }[]

  console.log('\n=== 构建完成 ===')
  console.log('参考数据', ref)
  console.log('试卷数', paperCount)
  console.log('题目总数', total)
  bySubject.forEach((row) => console.log(`  ${row.n}: ${row.c}`))
  console.log('输出文件', OUT)

  db.pragma('wal_checkpoint(TRUNCATE)')
  db.exec('VACUUM')
  db.close()
}

main()
