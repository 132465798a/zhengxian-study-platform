import type { QuestionType } from '../../shared/types'

export interface ScoreOutcome {
  isCorrect: boolean | null
  score: number
}

const ALT_SEPARATOR = /\s*[|｜;；]\s*/

export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/[。．.，,；;！!？?、]$/g, '')
    .toLowerCase()
}

function parseNumeric(value: string): number | null {
  const text = value.replace(/[％%]$/, '')
  const percent = /[％%]$/.test(value)
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    const num = Number(text)
    return percent ? num / 100 : num
  }
  const fraction = text.match(/^(-?\d+)\s*\/\s*(\d+)$/)
  if (fraction) return Number(fraction[1]) / Number(fraction[2])
  return null
}

function matchOne(expected: unknown, actual: unknown): boolean {
  if (expected === null || expected === undefined) return false
  const expectedText = normalizeText(expected)
  const actualText = normalizeText(actual)
  if (!actualText) return false
  if (expectedText === actualText) return true

  const alternatives = String(expected).split(ALT_SEPARATOR)
  if (alternatives.length > 1) {
    return alternatives.some((item) => matchOne(item, actual))
  }

  const expectedNumber = parseNumeric(expectedText)
  const actualNumber = parseNumeric(actualText)
  if (expectedNumber !== null && actualNumber !== null) {
    return Math.abs(expectedNumber - actualNumber) < 1e-6
  }
  return false
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (value === null || value === undefined || value === '') return []
  return [value]
}

function sameSet(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false
  const left = a.map(normalizeText).sort()
  const right = b.map(normalizeText).sort()
  return left.every((item, index) => item === right[index])
}

/**
 * 判分逻辑集中在主进程，渲染层无法绕过。
 * 返回值中的 null 表示主观题待人工判分。
 */
export function scoreAnswer(
  type: QuestionType,
  expected: unknown,
  actual: unknown,
  fullScore: number
): ScoreOutcome {
  const wrong: ScoreOutcome = { isCorrect: false, score: 0 }

  switch (type) {
    case 'single':
    case 'judge':
      return matchOne(expected, actual) ? { isCorrect: true, score: fullScore } : wrong

    case 'multiple': {
      const expectedList = toArray(expected)
      const actualList = toArray(actual)
      return sameSet(expectedList, actualList)
        ? { isCorrect: true, score: fullScore }
        : wrong
    }

    case 'sorting': {
      const expectedList = toArray(expected).map(normalizeText)
      const actualList = toArray(actual).map(normalizeText)
      if (expectedList.length === 0 || expectedList.length !== actualList.length) return wrong
      return expectedList.every((item, index) => item === actualList[index])
        ? { isCorrect: true, score: fullScore }
        : wrong
    }

    case 'fill':
    case 'cloze': {
      const expectedList = toArray(expected)
      const actualList = toArray(actual)
      if (expectedList.length === 0) return wrong
      const allCorrect = expectedList.every((item, index) => matchOne(item, actualList[index] ?? ''))
      return allCorrect ? { isCorrect: true, score: fullScore } : wrong
    }

    case 'calculation': {
      return matchOne(expected, actual) ? { isCorrect: true, score: fullScore } : wrong
    }

    case 'matching': {
      if (!expected || typeof expected !== 'object' || !actual || typeof actual !== 'object') {
        return wrong
      }
      const expectedMap = expected as Record<string, unknown>
      const actualMap = actual as Record<string, unknown>
      const keys = Object.keys(expectedMap)
      if (keys.length === 0) return wrong
      const allCorrect = keys.every(
        (key) => normalizeText(actualMap[key]) === normalizeText(expectedMap[key])
      )
      return allCorrect ? { isCorrect: true, score: fullScore } : wrong
    }

    case 'short_answer': {
      const actualText = normalizeText(actual)
      if (typeof expected === 'object' && expected !== null) {
        const payload = expected as { keywords?: unknown; reference?: unknown }
        const keywords = toArray(payload.keywords).map(normalizeText).filter(Boolean)
        if (keywords.length === 0) return { isCorrect: null, score: 0 }
        if (!actualText) return wrong
        const hit = keywords.filter((keyword) => actualText.includes(keyword)).length
        const ratio = hit / keywords.length
        return ratio >= 0.6 ? { isCorrect: true, score: fullScore } : wrong
      }
      return { isCorrect: null, score: 0 }
    }

    default:
      return wrong
  }
}
