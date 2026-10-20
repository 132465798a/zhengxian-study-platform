import type Database from 'better-sqlite3'
import type { QuestionAnswer, QuestionType } from '../../../shared/types'

export interface GeneratedQuestion {
  subject: string
  grade: number
  topic: string
  /** 自定义组卷时解析出的知识点 ID；构建期忽略 */
  knowledgeId?: number | null
  type: QuestionType
  difficulty: number
  stem: string
  options?: unknown
  answer: QuestionAnswer
  solution?: string
  score?: number
  source: string
}

export interface GeneratorOptions {
  /** 只生成指定年级 */
  grade?: number
  /** 只生成指定题型 */
  type?: QuestionType
  /** 单个生成器的最大产出 */
  limit?: number
  /** 自定义组卷参数 */
  params?: Record<string, string | number | boolean>
  /** 需要挂载的知识点；为空表示不限 */
  knowledgeIds?: number[]
  /** 运行时随机种子偏移；构建期不传，保证题库可复现 */
  seed?: number
}

export interface GeneratorContext {
  /** 题库库连接（独立打开，非 ATTACH，表名不加前缀） */
  db: Database.Database
  subjectId(name: string): number
  knowledgeId(subject: string, grade: number, topic: string): number | null
  /** 指纹去重后写入，返回是否真正插入 */
  insert(question: GeneratedQuestion): boolean
  /** 自定义组卷时传入；构建期不传 */
  options?: GeneratorOptions
}

/** 生成器是否应该处理当前年级/题型 */
export function accepts(options: GeneratorOptions | undefined, type: QuestionType, grade: number): boolean {
  if (options?.type && options.type !== type) return false
  if (options?.grade && options.grade !== grade) return false
  return true
}

/** 读取自定义组卷参数中的整数，缺失或越界时回退默认值 */
export function paramInt(
  options: GeneratorOptions | undefined,
  key: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = options?.params?.[key]
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN
  if (!Number.isInteger(value) || value < min || value > max) return fallback
  return value
}
