/**
 * 对现有 build/bank.db 原地重分难度，保留题目 ID、题干和答案。
 * 运行：npm run seed:difficulty
 */
import Database from 'better-sqlite3'
import { join } from 'node:path'
import { reclassifyQuestionDifficulty } from '../electron/db/difficulty'

const dbPath = join(process.cwd(), 'build', 'bank.db')
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const summary = reclassifyQuestionDifficulty(db)
const version = new Date().toISOString().slice(0, 19)
db.prepare("INSERT OR REPLACE INTO ref_meta(key, value) VALUES ('version', ?)").run(version)
db.prepare("INSERT OR REPLACE INTO ref_meta(key, value) VALUES ('built_at', ?)").run(
  new Date().toISOString()
)
db.pragma('wal_checkpoint(TRUNCATE)')
db.exec('VACUUM')
db.close()

console.log(
  JSON.stringify(
    {
      dbPath,
      version,
      total: summary.total,
      groups: summary.groups,
      byDifficulty: summary.byDifficulty
    },
    null,
    2
  )
)
