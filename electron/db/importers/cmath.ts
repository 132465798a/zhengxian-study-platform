import { readFileSync } from 'node:fs'
import type { SeedContext, SeedQuestion } from '../seed/types'
import type { QuestionAnswer } from '../../../shared/types'
import { datasetPath } from './dataset'

interface CmathRecord {
  grade: number
  input: string
  golden: string | number
  reasoning_step?: number
  num_digits?: number
}

const DATA_FILE = datasetPath('math', 'cmath.jsonl')

function readJsonl(filePath: string): CmathRecord[] {
  const raw = readFileSync(filePath, 'utf8').trim()
  if (!raw) return []
  const records: CmathRecord[] = []
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      records.push(JSON.parse(line) as CmathRecord)
    } catch {
      // 跳过解析失败的行
    }
  }
  return records
}

function difficultyOf(grade: number): number {
  if (grade <= 2) return 1
  if (grade <= 4) return 2
  return 3
}

function parseAnswer(golden: string | number): QuestionAnswer {
  const text = String(golden).trim()
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text
}

export function importCmath(seed: SeedContext): number {
  let count = 0
  let records: CmathRecord[]
  try {
    records = readJsonl(DATA_FILE)
  } catch (error) {
    console.warn(`[cmath] 读取数据文件失败: ${(error as Error).message}`)
    return 0
  }

  console.log(`[cmath] 发现 ${records.length} 条记录`)

  for (const record of records) {
    const stem = (record.input ?? '').trim()
    if (!stem) continue

    const grade = Number(record.grade)
    if (!Number.isInteger(grade) || grade < 1 || grade > 6) continue

    const answer = parseAnswer(record.golden)
    const question: SeedQuestion = {
      subject: '数学',
      grade,
      topic: '应用题',
      type: 'calculation',
      difficulty: difficultyOf(grade),
      stem,
      options: undefined,
      answer,
      solution: undefined,
      score: 2,
      source: 'CMATH'
    }
    seed.add(question)
    count += 1
  }

  console.log(`[cmath] 导入完成, 共 ${count} 题`)
  return count
}
