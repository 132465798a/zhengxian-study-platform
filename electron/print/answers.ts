import type { PrintSourceQuestion } from './parsers'

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function letter(index: number): string {
  return index >= 0 && index < 26 ? String.fromCharCode(65 + index) : String(index + 1)
}

function circled(index: number): string {
  return CIRCLED[index] ?? `(${index + 1})`
}

function normalizedAlternative(value: string): string {
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(' 或 ')
}

function fillAnswer(value: unknown): string {
  const list = asArray(value).map((item) => normalizedAlternative(String(item)))
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]
  return list.map((item, index) => `${circled(index)}${item}`).join('  ')
}

function matchingAnswer(value: unknown, options: unknown): string {
  const right =
    options !== null && typeof options === 'object' && !Array.isArray(options)
      ? asArray((options as Record<string, unknown>).right).map((item) => String(item))
      : []
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return ''
  return Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([left, target]) => {
      const text = String(target)
      const index = right.indexOf(text)
      return `${Number(left) + 1}—${index >= 0 ? letter(index) : text}`
    })
    .join('  ')
}

function sortingAnswer(value: unknown, options: unknown): string {
  const order = asArray(value).map((item) => String(item))
  const items = asArray(options).map((item) => String(item))
  if (order.length === 0) return ''
  if (items.length === 0) return order.join(' → ')
  const used = new Set<number>()
  const numbers = order.map((item) => {
    const index = items.findIndex((candidate, at) => candidate === item && !used.has(at))
    if (index >= 0) used.add(index)
    return index >= 0 ? index + 1 : null
  })
  if (numbers.every((item) => item !== null)) return numbers.join(' → ')
  return order.join(' → ')
}

function shortAnswer(value: unknown): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return asText(value)
  }
  const payload = value as Record<string, unknown>
  const reference = asText(payload.reference)
  const keywords = asArray(payload.keywords).map((item) => String(item))
  if (reference) return reference
  if (keywords.length > 0) return keywords.join('、')
  return ''
}

/** 把题库答案转成答案页可直接排版的文本 */
export function formatAnswer(question: PrintSourceQuestion): string {
  const { answer, options, type } = question
  if (type === 'single') {
    return typeof answer === 'number' ? letter(answer) : asText(answer)
  }
  if (type === 'multiple') {
    const indexes = asArray(answer).filter((item): item is number => typeof item === 'number')
    return indexes.sort((a, b) => a - b).map(letter).join('、')
  }
  if (type === 'judge') {
    if (typeof answer === 'number') return answer === 0 ? '√' : '×'
    const text = asText(answer)
    if (text === '正确') return '√'
    if (text === '错误') return '×'
    return text
  }
  if (type === 'fill' || type === 'cloze') return fillAnswer(answer)
  if (type === 'matching') return matchingAnswer(answer, options)
  if (type === 'sorting') return sortingAnswer(answer, options)
  if (type === 'short_answer') return shortAnswer(answer)
  if (type === 'pinyin_word') {
    const list = asArray(answer).map((item) => String(item).trim()).filter(Boolean)
    if (list.length > 0) return list.join('、')
    return asText(answer)
  }
  if (type === 'calculation') {
    if (typeof answer === 'number') return String(Number(answer.toFixed(4)))
    return asText(answer)
  }
  return typeof answer === 'string' ? answer : JSON.stringify(answer)
}
