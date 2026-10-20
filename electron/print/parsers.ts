import type { PrintSourceQuestion } from '../../shared/print'

export type { PrintSourceQuestion }

export type CalcLayout =
  | { mode: 'vertical'; operands: string[]; operators: string[]; division: boolean }
  | { mode: 'oral' | 'equation' | 'answer' }

const VERTICAL_PREFIX = /^用竖式计算\s*[：:]?\s*/
const TRAILING_BLANK = /\s*=\s*_{2,}\s*$/
const NUMERIC_TERM = /^\d+(?:\.\d+)?$/

/** 去掉单位说明，如“（填小数）”“（单位：厘米）” */
function stripNotes(text: string): string {
  return text.replace(/（[^）]*）\s*$/g, '').trim()
}

/**
 * 识别竖式题。只有“纯数字 + 四则运算符”才按竖式排版，
 * 分数、百分数、带空格的算式一律退回普通计算题，避免画错版式。
 */
export function parseVertical(stem: string): Extract<CalcLayout, { mode: 'vertical' }> | null {
  const text = stripNotes(stem.replace(VERTICAL_PREFIX, ''))
    .replace(TRAILING_BLANK, '')
    .trim()
  if (!text || /[_/%]/.test(text)) return null
  if (!/^[\d.\s+\-×÷*]+$/.test(text)) return null

  const parts = text.split(/\s*([+\-×÷*/])\s*/).filter((item) => item.length > 0)
  if (parts.length < 3 || parts.length % 2 === 0) return null

  const operands: string[] = []
  const operators: string[] = []
  for (let index = 0; index < parts.length; index += 1) {
    const value = parts[index]
    if (index % 2 === 0) {
      if (!NUMERIC_TERM.test(value)) return null
      operands.push(value)
    } else {
      operators.push(value === '*' ? '×' : value === '/' ? '÷' : value)
    }
  }
  if (operands.length < 2) return null
  const division = operators.some((item) => item === '÷')
  if (division && operands.length !== 2) return null
  return { mode: 'vertical', operands, operators, division }
}

/** 结合生成器来源、知识点与题干，判断计算题该用哪种版式 */
export function classifyCalculation(question: PrintSourceQuestion): CalcLayout {
  const stem = question.stem.trim()
  if (question.source === 'generator:vertical' || VERTICAL_PREFIX.test(stem)) {
    return parseVertical(stem) ?? { mode: 'answer' }
  }
  if (question.source === 'generator:equation' || /^-?\d*\.?\d*x\b/.test(stem)) {
    return { mode: 'equation' }
  }
  if (question.source === 'generator:oral') return { mode: 'oral' }
  if (
    question.knowledgeName === '数与运算' &&
    /^\s*-?\d+(?:\.\d+)?(?:\s*[+\-×÷]\s*-?\d+(?:\.\d+)?)+\s*=\s*_{2,}\s*$/.test(stem)
  ) {
    return { mode: 'oral' }
  }
  return { mode: 'answer' }
}

export interface BlankParseResult {
  segments: Array<{ type: 'text'; text: string } | { type: 'blank'; index: number; width: number }>
  trailingBlanks: number
}

/** 按答案长度估算横线宽度（字符数） */
export function blankWidth(answer: string | undefined): number {
  const text = (answer ?? '').split('|')[0]?.trim() ?? ''
  if (!text) return 4
  return Math.min(12, Math.max(4, Math.ceil(text.length * 0.9)))
}

/** 普通填空：连续两个以上下划线视为空位 */
export function parseFill(stem: string, answers: string[]): BlankParseResult {
  const parts = stem.split(/_{2,}/)
  if (parts.length > 1) {
    const segments: BlankParseResult['segments'] = []
    let blankIndex = 0
    parts.forEach((part, index) => {
      if (part) segments.push({ type: 'text', text: part })
      if (index < parts.length - 1) {
        segments.push({ type: 'blank', index: blankIndex, width: blankWidth(answers[blankIndex]) })
        blankIndex += 1
      }
    })
    return { segments, trailingBlanks: 0 }
  }
  return {
    segments: [{ type: 'text', text: stem }],
    trailingBlanks: Math.max(1, answers.length)
  }
}

/** 完形填空：___{1} 形式的带序号空位 */
export function parseCloze(stem: string, answers: string[]): BlankParseResult {
  const segments: BlankParseResult['segments'] = []
  const pattern = /___\{(\d+)\}/g
  let cursor = 0
  let matched = false
  for (const match of stem.matchAll(pattern)) {
    matched = true
    const at = match.index ?? 0
    if (at > cursor) segments.push({ type: 'text', text: stem.slice(cursor, at) })
    const declared = Number(match[1]) - 1
    const index = Number.isInteger(declared) && declared >= 0 ? declared : segments.filter((item) => item.type === 'blank').length
    segments.push({ type: 'blank', index, width: blankWidth(answers[index]) })
    cursor = at + match[0].length
  }
  if (!matched) return parseFill(stem, answers)
  if (cursor < stem.length) segments.push({ type: 'text', text: stem.slice(cursor) })
  return { segments, trailingBlanks: 0 }
}

/** 选项一行放得下就横排，稍长两列，很长则整行一条 */
export function optionLayout(options: string[]): 'inline' | 'grid' | 'list' {
  const plain = options.map((item) =>
    item
      .replace(/\$\$?[^$]*\$\$?/g, '0')
      .replace(/\\[a-zA-Z]+/g, '')
      .trim()
  )
  const total = plain.reduce((sum, item) => sum + item.length, 0)
  const longest = plain.reduce((max, item) => Math.max(max, item.length), 0)
  if (longest > 18 || total > 70) return 'list'
  if (plain.length <= 3 && total <= 26) return 'inline'
  if (longest <= 8 && total <= 34) return 'inline'
  return 'grid'
}

export function isStrokeGlyph(text: string): boolean {
  if (text.length !== 1) return false
  const code = text.codePointAt(0) ?? 0
  return code >= 0x31c0 && code <= 0x31e3
}

/** 简答题预留行数，按分值与年级给出下限 */
export function shortLines(score: number, grade: number, loose: 'compact' | 'normal' | 'loose'): number {
  const base = score >= 8 ? 8 : score >= 5 ? 6 : score >= 3 ? 4 : 3
  const factor = loose === 'compact' ? 0.75 : loose === 'loose' ? 1.3 : 1
  const gradeBias = grade <= 2 ? 1 : 0
  return Math.max(2, Math.round(base * factor) + gradeBias)
}
