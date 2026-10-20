import Database from 'better-sqlite3'
import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { BANK_SCHEMA, LEGACY_TABLES, USER_SCHEMA } from './schema'

let db: Database.Database | null = null
let bankPath = ''

export function getDb(): Database.Database {
  if (!db) throw new Error('数据库尚未初始化')
  return db
}

export function getBankPath(): string {
  return bankPath
}

export function getUserDbPath(): string {
  return join(app.getPath('userData'), 'study-platform.db')
}

function hasTable(target: Database.Database, name: string): boolean {
  const row = target
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { name: string } | undefined
  return Boolean(row)
}

function readBankVersion(file: string): string | null {
  try {
    const probe = new Database(file, { readonly: true })
    const row = probe.prepare("SELECT value FROM ref_meta WHERE key = 'version'").get() as
      | { value: string }
      | undefined
    probe.close()
    return row?.value ?? null
  } catch {
    return null
  }
}

/** 随包分发的题库库位置 */
function bundledBankPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'bank.db')
    : join(app.getAppPath(), 'build', 'bank.db')
}

/**
 * 首次启动把题库库复制到用户目录；题库版本升级时用新文件覆盖。
 * 用户库永远不随包分发，缺失时自动创建。
 */
function ensureBankFile(): string {
  const target = join(app.getPath('userData'), 'bank.db')
  const source = bundledBankPath()
  mkdirSync(app.getPath('userData'), { recursive: true })

  if (!existsSync(source)) {
    // 开发环境尚未构建题库时，退化为在本地生成空库，避免启动失败
    return target
  }

  const sourceVersion = readBankVersion(source)
  const targetVersion = existsSync(target) ? readBankVersion(target) : null
  if (!existsSync(target) || sourceVersion !== targetVersion) {
    copyFileSync(source, target)
  }
  return target
}

function prefixBankSchema(sql: string): string {
  // bank.db 随包分发时表结构已完整，这里只是缺库时的兜底建表。
  // 附加库不支持跨库外键，索引也已在构建阶段创建，故一并剔除。
  return sql
    .replace(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS [^\n]*\n/g, '')
    .replace(/ REFERENCES \w+\(id\)( ON DELETE CASCADE)?/g, '')
    .replace(/CREATE TABLE IF NOT EXISTS (\w+)/g, 'CREATE TABLE IF NOT EXISTS bank.$1')
}

/**
 * 在题库被新版本覆盖前，把用户练习卷引用的 paper 快照复制进用户库。
 * 这样题库升级后历史练习仍能打开；已被旧版本覆盖的数据无法恢复。
 */
function migratePracticePapers(bankFile: string, userFile: string): void {
  if (!existsSync(bankFile) || !existsSync(userFile)) return
  try {
    const bank = new Database(bankFile, { readonly: true })
    if (!hasTable(bank, 'paper')) {
      bank.close()
      return
    }
    const user = new Database(userFile)
    user.exec(USER_SCHEMA)
    const paperIds = user
      .prepare('SELECT DISTINCT paper_id FROM practice_record WHERE paper_id IS NOT NULL')
      .all() as { paper_id: number }[]
    if (paperIds.length === 0) {
      bank.close()
      user.close()
      return
    }
    const readPaper = bank.prepare('SELECT * FROM paper WHERE id = ?')
    const readQuestions = bank.prepare('SELECT * FROM paper_question WHERE paper_id = ?')
    const insertPaper = user.prepare(
      `INSERT OR IGNORE INTO practice_paper(id, title, stage, grade, subject_id, type, rule, duration, total_score, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const insertQuestion = user.prepare(
      'INSERT OR IGNORE INTO practice_paper_question(paper_id, question_id, sort, score) VALUES (?, ?, ?, ?)'
    )
    let copied = 0
    const copy = user.transaction(() => {
      for (const { paper_id: id } of paperIds) {
        const paper = readPaper.get(id) as
          | {
              id: number
              title: string
              stage: string
              grade: number | null
              subject_id: number | null
              type: string
              rule: string | null
              duration: number | null
              total_score: number | null
              created_at: string
            }
          | undefined
        if (!paper) continue
        insertPaper.run(
          paper.id,
          paper.title,
          paper.stage,
          paper.grade,
          paper.subject_id,
          paper.type,
          paper.rule,
          paper.duration,
          paper.total_score,
          paper.created_at
        )
        for (const question of readQuestions.all(id) as Array<{
          question_id: number
          sort: number
          score: number
        }>) {
          insertQuestion.run(id, question.question_id, question.sort, question.score)
        }
        copied += 1
      }
    })
    copy()
    bank.close()
    user.close()
    if (copied > 0) console.log(`[db] 已迁移 ${copied} 份练习卷到用户库`)
  } catch (error) {
    console.warn('[db] 练习卷迁移失败，跳过', error)
  }
}

function migrateUserColumns(target: Database.Database): void {
  const columns = target.prepare('PRAGMA table_info(print_template)').all() as { name: string }[]
  if (!columns.some((column) => column.name === 'user_id')) {
    target.exec('ALTER TABLE print_template ADD COLUMN user_id INTEGER')
  }
  target.exec('CREATE INDEX IF NOT EXISTS idx_print_template_user ON print_template(user_id)')
}

export function initDb(): Database.Database {
  const userFile = getUserDbPath()
  migratePracticePapers(join(app.getPath('userData'), 'bank.db'), userFile)
  bankPath = ensureBankFile()
  db = new Database(userFile)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(USER_SCHEMA)
  migrateUserColumns(db)

  db.exec(`ATTACH DATABASE '${bankPath.replace(/'/g, "''")}' AS bank`)
  // 附加库建表时，未限定的外键父表名会被解析到 main，临时关闭外键校验
  db.pragma('foreign_keys = OFF')
  db.exec(prefixBankSchema(BANK_SCHEMA))
  db.pragma('foreign_keys = ON')

  migrateLegacy(db)

  return db
}

/** 旧版单库结构：题库表已移到 bank.db，用户库中的旧表直接清理 */
function migrateLegacy(target: Database.Database): void {
  if (!hasTable(target, 'question')) return
  const legacy = (
    target.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]
  ).map((row) => row.version)
  target.exec('PRAGMA foreign_keys = OFF')
  const drop = target.transaction(() => {
    for (const table of LEGACY_TABLES) {
      target.exec(`DROP TABLE IF EXISTS main.${table}`)
    }
    target.exec('DROP TABLE IF EXISTS main.schema_migrations')
  })
  drop()
  target.exec(USER_SCHEMA)
  target.exec('PRAGMA foreign_keys = ON')
  console.log(`[db] 已从旧版单库结构迁移（原版本 ${legacy.join(',') || '无'}），题库改由 bank.db 提供`)
}

export function isFreshDatabase(): boolean {
  const file = join(app.getPath('userData'), 'study-platform.db')
  return !existsSync(file)
}

export function closeDb(): void {
  if (db) {
    try {
      db.exec('DETACH DATABASE bank')
    } catch {
      // 忽略未附加的情况
    }
    db.close()
    db = null
  }
}
