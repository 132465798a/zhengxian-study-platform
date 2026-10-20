/**
 * 题库与词库健康检查，作为 npm test 的固定门禁。
 * 用法：node scripts/run-electron-node.cjs scripts/check-bank.cjs
 */
const { existsSync } = require('node:fs')
const { join } = require('node:path')
const Database = require('better-sqlite3')

const root = join(__dirname, '..')
const bankFile = join(root, 'build', 'bank.db')
const BLACKLIST = [
  '色情', '情色', '色欲', '下情', '钟情', '情人', '情夫', '情妇', '男女', '上床', '开房',
  '恋爱', '结婚', '离婚', '性感', '裸体', '自杀', '杀人', '吸毒', '赌博', '赌钱', '香烟',
  '喝酒', '啤酒', '酒吧', '死亡', '尸体', '枪杀', '爆炸', '恐怖', '暴力', '打架', '斗殴'
]

const failures = []

function check(name, condition, detail = '') {
  if (!condition) failures.push(`${name}${detail ? `：${detail}` : ''}`)
  console.log(`${condition ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`)
}

if (!existsSync(bankFile)) {
  console.error('[check-bank] 未找到 build/bank.db，请先执行 npm run seed:build')
  process.exit(1)
}

const db = new Database(bankFile, { readonly: true })

const tables = new Set(
  db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => row.name)
)
for (const table of ['subject', 'question', 'ref_word', 'ref_hanzi', 'ref_english_word']) {
  check(`表 ${table} 存在`, tables.has(table))
}

const total = db.prepare('SELECT COUNT(*) AS n FROM question').get().n
check('题库题量', total > 50000, `${total} 题`)

const subjects = db.prepare('SELECT COUNT(*) AS n FROM subject').get().n
check('学科数量', subjects === 3, `${subjects} 个`)

const emptyStem = db.prepare("SELECT COUNT(*) AS n FROM question WHERE TRIM(stem) = ''").get().n
check('空题干为 0', emptyStem === 0, `${emptyStem} 条`)

const perGrade = db
  .prepare("SELECT grade, COUNT(*) AS n FROM question WHERE type = 'pinyin_word' GROUP BY grade ORDER BY grade")
  .all()
const missingGrade = [1, 2, 3, 4, 5, 6].filter(
  (grade) => !perGrade.some((row) => row.grade === grade && row.n > 0)
)
check('看拼音写词语覆盖 1-6 年级', missingGrade.length === 0, missingGrade.join(','))

const words = db.prepare('SELECT word FROM ref_word').all().map((row) => row.word)
const badWords = words.filter((word) => BLACKLIST.includes(word))
check('词库无不适龄词', badWords.length === 0, badWords.join(','))

const answers = db
  .prepare("SELECT answer FROM question WHERE type = 'pinyin_word'")
  .all()
  .map((row) => {
    try {
      const parsed = JSON.parse(row.answer)
      return Array.isArray(parsed) ? String(parsed[0] ?? '') : ''
    } catch {
      return ''
    }
  })
  .filter(Boolean)
const badAnswers = answers.filter((word) => BLACKLIST.includes(word))
check('看拼音写词语答案无不适龄词', badAnswers.length === 0, badAnswers.join(','))

db.close()

if (failures.length > 0) {
  console.error(`\n[check-bank] 未通过 ${failures.length} 项：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log('\n[check-bank] 全部通过')
