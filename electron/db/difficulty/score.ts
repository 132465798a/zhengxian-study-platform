export interface DifficultyRow {
  id: number
  subject_id: number
  grade: number
  type: string
  stem: string
  options: string | null
}

const TYPE_WEIGHT: Record<string, number> = {
  single: 1,
  multiple: 2,
  judge: 1,
  fill: 1.5,
  cloze: 2.5,
  matching: 2,
  sorting: 2,
  calculation: 1,
  short_answer: 3
}

const CHINESE_RE = /[\u4e00-\u9fa5]/g
const NUMBER_RE = /\d+(?:\.\d+)?/g
const FRACTION_RE = /\d{1,3}\s*\/\s*\d{1,3}/g
const OPERATOR_RE = /[+－\-×÷*/]/g
const BLANK_RE = /_{2,}|＿{2,}/g
const SENTENCE_RE = /[。！？!?；;]/g

function count(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length
}

function optionCountOf(raw: string | null): number {
  if (!raw) return 0
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}

/**
 * 题目难度评分：只依赖题干、选项和学科，不依赖年级。
 * 分数本身没有绝对意义，重分类时在同一 subject×grade×type 内按分位切档。
 */
export function scoreDifficulty(row: DifficultyRow): number {
  const stem = row.stem ?? ''
  const chinese = count(stem, CHINESE_RE)
  const numbers = count(stem, NUMBER_RE)
  const fractions = count(stem, FRACTION_RE)
  const operators = count(stem, OPERATOR_RE)
  const blanks = count(stem, BLANK_RE)
  const sentences = count(stem, SENTENCE_RE)
  const words = stem.trim() ? stem.trim().split(/\s+/).length : 0
  const maxDigits = (stem.match(NUMBER_RE) ?? []).reduce(
    (max, item) => Math.max(max, item.replace('.', '').length),
    0
  )

  let score =
    (TYPE_WEIGHT[row.type] ?? 1) + stem.length / 40 + sentences * 0.35 + blanks * 1.4

  if (row.subject_id === 2) {
    score +=
      operators * 1.1 +
      numbers * 0.25 +
      maxDigits * 0.45 +
      fractions * 1.8 +
      chinese / 18
  } else if (row.subject_id === 3) {
    score += words * 0.45 + stem.length / 80 + blanks * 0.6
  } else {
    score += chinese / 14 + blanks * 0.8
  }

  score += Math.min(optionCountOf(row.options), 6) * 0.25
  return score
}
