import { readFileSync } from 'node:fs'
import type { SeedContext, SeedQuestion } from '../seed/types'
import { datasetPath } from './dataset'

interface AoItem {
  aoVal: string
  content: string
}

interface TalRecord {
  problem: string
  answer_option_list: AoItem[][]
  answer_value: string
  knowledge_point_routes?: string[]
  answer_analysis?: string[]
  competition_source_list?: string[]
}

const CH_FILE = datasetPath('math', 'tal-scq5k-ch.jsonl')

function readJsonl(filePath: string): TalRecord[] {
  const raw = readFileSync(filePath, 'utf8').trim()
  if (!raw) return []
  const records: TalRecord[] = []
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      records.push(JSON.parse(line) as TalRecord)
    } catch {
      // 跳过解析失败的行
    }
  }
  return records
}

const GRADE_MAP: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6
}

function extractGrade(record: TalRecord): number | null {
  const sources = record.competition_source_list ?? []
  const text = sources.join('|')
  const cnMatch = text.match(/([一二三四五六])年级/)
  if (cnMatch && GRADE_MAP[cnMatch[1]]) return GRADE_MAP[cnMatch[1]]
  const numMatch = text.match(/([1-6])年级/)
  if (numMatch) return Number(numMatch[1])
  return null
}

function flattenOptions(list: AoItem[][]): string[] {
  return list.map((group) => (group[0]?.content ?? '').trim())
}

function answerToIndex(value: string): number | null {
  const text = value.trim()
  if (!/^[A-Z]$/.test(text)) return null
  return text.charCodeAt(0) - 65
}

function processRecord(
  record: TalRecord,
  subject: string,
  source: string
): SeedQuestion | null {
  const stem = (record.problem ?? '').trim()
  if (!stem) return null

  const options = flattenOptions(record.answer_option_list ?? [])
  // 少于 3 个选项的题目（自由作答占位、二选一）不符合单选题契约
  if (options.length < 3) return null

  const answer = answerToIndex(record.answer_value ?? '')
  if (answer === null) return null
  if (answer >= options.length) return null

  const grade = extractGrade(record)
  if (grade === null) return null
  const knowledgeRoutes = record.knowledge_point_routes ?? []
  const topic = knowledgeRoutes[0]?.split('->').pop()?.trim() ?? '竞赛综合'
  const analysis = record.answer_analysis ?? []
  const solution = analysis.join('\n').trim() || undefined

  return {
    subject,
    grade,
    topic,
    type: 'single',
    difficulty: 3,
    stem,
    options,
    answer,
    solution,
    score: 3,
    source
  }
}

function importFile(
  seed: SeedContext,
  filePath: string,
  subject: string,
  source: string
): number {
  let count = 0
  let records: TalRecord[]
  try {
    records = readJsonl(filePath)
  } catch {
    return 0
  }
  for (const record of records) {
    const question = processRecord(record, subject, source)
    if (!question) continue
    seed.add(question)
    count += 1
  }
  return count
}

export function importTalScq5k(seed: SeedContext): number {
  console.log('[talscq5k] 开始导入中文数学题')
  const count = importFile(seed, CH_FILE, '数学', 'TAL-SCQ5K')
  console.log(`[talscq5k] 导入完成, 共 ${count} 题`)
  return count
}
