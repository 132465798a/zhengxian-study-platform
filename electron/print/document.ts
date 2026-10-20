import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import cnchar from 'cnchar'
import words from 'cnchar-words'
import { getDb } from '../db/connection'
import { generateCustomQuestions, generateOralQuestions } from '../db/generators/custom'
import { getPracticeSession } from '../db/repositories/practice.repo'
import { getExamSession } from '../db/repositories/exam.repo'
import { getPaper } from '../db/repositories/session.shared'
import { sampleQuestions } from '../db/repositories/question.repo'
import { pageWrongBook } from '../db/repositories/wrong.repo'
import { formatAnswer } from './answers'
import { ValidationError } from '../errors'
import {
  classifyCalculation,
  isStrokeGlyph,
  optionLayout,
  parseCloze,
  parseFill,
  shortLines
} from './parsers'
import type { PrintSourceQuestion } from './parsers'
import type { Paper, Question, QuestionType } from '../../shared/types'
import type {
  PracticeRow,
  PracticeSheet,
  PrintDocument,
  PrintOptions,
  PrintQuestion,
  PrintRequest,
  PrintSection,
  PrintSource
} from '../../shared/print'

cnchar.use(words)

interface Collected {
  title: string
  subjectName: string
  grade: number
  duration: number | null
  questions: PrintSourceQuestion[]
  practice: PracticeSheet | null
}

const SECTION_TITLES: Record<string, Record<string, string>> = {
  语文: {
    single: '选择题',
    multiple: '多选题',
    judge: '判断题',
    fill: '字词填空',
    pinyin_word: '看拼音写词语',
    cloze: '古诗文填空',
    matching: '连线题',
    sorting: '排序题',
    calculation: '计算题',
    short_answer: '简答题',
    composition: '习作'
  },
  数学: {
    single: '选择题',
    multiple: '多选题',
    judge: '判断题',
    fill: '填空题',
    cloze: '填空题',
    matching: '连线题',
    sorting: '排序题',
    oral: '口算',
    vertical: '竖式计算',
    equation: '解方程',
    calculation: '计算题',
    short_answer: '解答题'
  },
  英语: {
    single: '选择题',
    multiple: '多选题',
    judge: '判断题',
    fill: '填空题',
    cloze: '完形填空',
    matching: '匹配题',
    sorting: '排序题',
    calculation: '计算题',
    short_answer: '书面表达'
  }
}

/** 小学常用大题名，低年级卷面更贴近真实写法 */
const PRIMARY_TITLES: Record<string, Record<string, string>> = {
  语文: {
    single: '选一选',
    multiple: '选一选',
    judge: '判一判',
    fill: '填一填',
    pinyin_word: '看拼音写词语',
    cloze: '背一背',
    matching: '连一连',
    sorting: '排一排',
    calculation: '算一算',
    short_answer: '读一读',
    composition: '写一写'
  },
  数学: {
    single: '选一选',
    multiple: '选一选',
    judge: '判一判',
    fill: '填一填',
    cloze: '填一填',
    matching: '连一连',
    sorting: '排一排',
    oral: '算一算',
    vertical: '算一算',
    equation: '解一解',
    calculation: '算一算',
    short_answer: '解决问题'
  },
  英语: {
    single: '选一选',
    multiple: '选一选',
    judge: '判一判',
    fill: '填一填',
    cloze: '填一填',
    matching: '配一配',
    sorting: '排一排',
    calculation: '算一算',
    short_answer: '写一写'
  }
}

const ORDER: Record<string, string[]> = {
  数学: ['oral', 'vertical', 'equation', 'fill', 'single', 'multiple', 'judge', 'matching', 'sorting', 'calculation', 'short_answer'],
  语文: ['single', 'multiple', 'fill', 'pinyin_word', 'judge', 'cloze', 'matching', 'sorting', 'calculation', 'short_answer', 'composition'],
  英语: ['single', 'multiple', 'fill', 'judge', 'cloze', 'matching', 'sorting', 'calculation', 'short_answer']
}

/** 小学常用分值：按题型给出整题分值 */
const STANDARD_SCORES: Record<string, Record<string, number>> = {
  语文: { single: 2, multiple: 2, judge: 1, fill: 2, cloze: 2, matching: 2, sorting: 2, calculation: 2, short_answer: 4 },
  数学: { single: 2, multiple: 2, judge: 1, fill: 2, cloze: 2, matching: 2, sorting: 2, short_answer: 5 },
  英语: { single: 2, multiple: 2, judge: 1, fill: 2, cloze: 2, matching: 2, sorting: 2, short_answer: 5 }
}

function standardScoreOf(question: PrintSourceQuestion, subjectName: string): number {
  if (question.type === 'short_answer') {
    if (subjectName === '语文' && question.knowledgeName === '习作') return 30
    return subjectName === '语文' ? 4 : 5
  }
  if (question.type === 'calculation') {
    const layout = classifyCalculation(question)
    if (layout.mode === 'oral') return 1
    return 3
  }
  return STANDARD_SCORES[subjectName]?.[question.type] ?? 2
}

function subjectNames(): Map<number, string> {
  const rows = getDb().prepare('SELECT id, name FROM bank.subject').all() as Array<{
    id: number
    name: string
  }>
  return new Map(rows.map((row) => [row.id, row.name]))
}

function cnNumber(value: number): string {
  const digits = '零一二三四五六七八九十'
  if (value <= 10) return digits[value] ?? String(value)
  if (value < 20) return `十${digits[value - 10]}`
  return String(value)
}

function toSource(question: Question, subjectName: string, score?: number): PrintSourceQuestion {
  return {
    id: question.id,
    subjectId: question.subjectId,
    subjectName,
    grade: question.grade,
    type: question.type,
    stem: question.stem,
    options: question.options,
    answer: question.answer,
    solution: question.solution,
    score: score ?? question.score,
    difficulty: question.difficulty,
    knowledgeName: question.knowledgeName ?? null,
    source: question.source
  }
}

function fromPaper(paper: Paper, subjectName: string): Collected {
  return {
    title: paper.title,
    subjectName,
    grade: paper.grade ?? 1,
    duration: paper.duration,
    questions: paper.questions.map((item) => toSource(item.question, subjectName, item.score)),
    practice: null
  }
}

function collectBank(source: Extract<PrintSource, { kind: 'bank' }>): Collected {
  const names = subjectNames()
  const limit = Math.min(200, Math.max(1, source.limit || 20))
  const selected = sampleQuestions(source.filter, limit)
  const subjectName =
    (source.filter.subjectId ? names.get(source.filter.subjectId) : undefined) ??
    (selected[0] ? names.get(selected[0].subjectId) : undefined) ??
    ''
  return {
    title: `${subjectName || '题库'} · 专项练习`,
    subjectName,
    grade: source.filter.grade ?? selected[0]?.grade ?? 1,
    duration: null,
    questions: selected.map((item) => toSource(item, names.get(item.subjectId) ?? '')),
    practice: null
  }
}

function collectWrongbook(
  source: Extract<PrintSource, { kind: 'wrongbook' }>,
  userId: number
): Collected {
  const names = subjectNames()
  const items: Question[] = []
  for (let page = 1; page <= 3; page += 1) {
    const result = pageWrongBook({
      userId,
      subjectId: source.subjectId,
      grade: source.grade,
      mastered: source.mastered ?? false,
      page,
      pageSize: 100
    })
    items.push(...result.items.map((item) => item.question))
    if (items.length >= result.total || result.items.length === 0) break
  }
  const subjectName =
    (source.subjectId ? names.get(source.subjectId) : undefined) ??
    (items[0] ? names.get(items[0].subjectId) : undefined) ??
    ''
  return {
    title: '错题重练',
    subjectName,
    grade: source.grade ?? items[0]?.grade ?? 1,
    duration: null,
    questions: items.map((item) => toSource(item, names.get(item.subjectId) ?? '')),
    practice: null
  }
}

function mapGenerated(
  generated: ReturnType<typeof generateCustomQuestions>,
  subjectId: number,
  subjectName: string,
  grade: number
): PrintSourceQuestion[] {
  return generated.map((item, index) => ({
    id: 1_000_000_000 + index,
    subjectId,
    subjectName,
    grade,
    type: item.type,
    stem: item.stem,
    options: item.options ?? null,
    answer: item.answer,
    solution: item.solution ?? null,
    score: item.score ?? 2,
    difficulty: item.difficulty,
    knowledgeName: item.topic ?? null,
    source: item.source
  }))
}

export interface GenerateSourcesInput {
  subjectId: number
  grade: number
  types: QuestionType[]
  params?: Record<string, Record<string, string | number | boolean>>
  knowledgeIds?: number[]
  difficulties?: number[]
  count: number
}

function runGenerate(input: GenerateSourcesInput, subjectName: string): PrintSourceQuestion[] {
  if (!input.types.length) return []
  if (!subjectName) throw new ValidationError('学科不存在')
  const generated = generateCustomQuestions({
    subjectId: input.subjectId,
    subjectName,
    grade: input.grade,
    types: input.types,
    params: input.params ?? {},
    knowledgeIds: input.knowledgeIds,
    difficulties: input.difficulties,
    count: Math.min(200, Math.max(1, input.count))
  })
  return mapGenerated(generated, input.subjectId, subjectName, input.grade)
}

/** 手动组卷编辑器：只生成题目快照，不创建打印任务 */
export function generateQuestionSources(input: GenerateSourcesInput): PrintSourceQuestion[] {
  return runGenerate(input, subjectNames().get(input.subjectId) ?? '')
}

function collectCustom(source: Extract<PrintSource, { kind: 'custom' }>): Collected {
  const names = subjectNames()
  const subjectName = names.get(source.subjectId) ?? ''
  if (!source.types.length) throw new Error('自定义练习至少需要一个题型')
  const questions = runGenerate(
    {
      subjectId: source.subjectId,
      grade: source.grade,
      types: source.types,
      params: source.params ?? {},
      knowledgeIds: source.knowledgeIds,
      difficulties: source.difficulties,
      count: source.count
    },
    subjectName
  )
  return {
    title: `${subjectName} · 自定义练习`,
    subjectName,
    grade: source.grade,
    duration: null,
    questions,
    practice: null
  }
}

function collectManual(source: Extract<PrintSource, { kind: 'manual' }>): Collected {
  const names = subjectNames()
  const subjectName = names.get(source.subjectId) ?? ''
  return {
    title: `${subjectName} · 手动组卷`,
    subjectName,
    grade: source.grade,
    duration: null,
    questions: source.questions,
    practice: null
  }
}

function pinyinOf(char: string): string {
  const result = cnchar.spell(char, 'array', 'tone')
  if (!Array.isArray(result) || result.length === 0) return ''
  return String(result[0]).trim().toLowerCase()
}

/** 读取 hanzi-writer-data 的笔画路径，打包后从 asar 内读取同样有效 */
function hanziGlyphs(chars: string[]): Record<string, string[]> {
  const root = join(app.getAppPath(), 'node_modules', 'hanzi-writer-data')
  const result: Record<string, string[]> = {}
  for (const char of chars) {
    try {
      const data = JSON.parse(readFileSync(join(root, `${char}.json`), 'utf8')) as {
        strokes?: unknown
      }
      if (Array.isArray(data.strokes)) {
        result[char] = data.strokes.filter((item): item is string => typeof item === 'string')
      }
    } catch {
      // 没有笔画数据时由渲染层回退到楷体
    }
  }
  return result
}

function collectHanzi(source: Extract<PrintSource, { kind: 'hanzi' }>): Collected {
  const rows = getDb()
    .prepare('SELECT char FROM ref_hanzi WHERE grade = ? ORDER BY char LIMIT ?')
    .all(source.grade, Math.min(60, Math.max(1, source.limit))) as Array<{ char: string }>
  const chars = rows.map((row) => row.char)
  const cellMm = source.grade <= 2 ? 18 : source.grade <= 4 ? 16 : 14
  const charsPerRow = Math.min(4, Math.max(1, source.charsPerRow ?? 2))
  const cellsPerChar = Math.min(7, Math.max(3, source.cellsPerChar ?? 4))
  const practiceRows: PracticeRow[] = []
  for (let index = 0; index < chars.length; index += charsPerRow) {
    const group = chars.slice(index, index + charsPerRow)
    const cells: PracticeRow['cells'] = []
    group.forEach((char) => {
      const pinyin = source.grid === 'pinyin-tian' ? pinyinOf(char) : undefined
      cells.push({ text: char, mode: 'model', pinyin })
      cells.push({ text: char, mode: 'trace' })
      for (let cell = 2; cell < cellsPerChar; cell += 1) {
        cells.push({ text: '', mode: 'blank' })
      }
    })
    practiceRows.push({ cells })
  }
  const sheet: PracticeSheet = {
    kind: 'hanzi',
    title: `${source.grade} 年级生字练习`,
    grid: source.grid,
    cellMm,
    cellsPerChar,
    rows: practiceRows,
    glyphs: hanziGlyphs(chars)
  }
  return {
    title: sheet.title,
    subjectName: '语文',
    grade: source.grade,
    duration: null,
    questions: [],
    practice: sheet
  }
}

function collectEnglish(source: Extract<PrintSource, { kind: 'english' }>): Collected {
  const limit = Math.min(40, Math.max(1, source.limit))
  const rows = getDb()
    .prepare(
      `SELECT word, phonetic, meaning, sentence, sentence_zh
       FROM ref_english_word WHERE grade = ? AND word <> ''
       ORDER BY id ASC LIMIT ?`
    )
    .all(source.grade, limit) as Array<{
    word: string
    phonetic: string | null
    meaning: string
    sentence: string | null
    sentence_zh: string | null
  }>

  const seen = new Set<string>()
  const words = rows.filter((row) => {
    const key = row.word.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  let sheet: PracticeSheet
  if (source.mode === 'dictation') {
    sheet = {
      kind: 'dictation',
      title: `${source.grade} 年级单词听写`,
      grid: 'four-line',
      cellMm: 12,
      rows: words.slice(0, 20).map((row, index) => ({
        label: `${index + 1}.`,
        cells: [{ text: '', mode: 'blank' }],
        caption: row.meaning
      })),
      glyphs: {}
    }
  } else if (source.mode === 'sentence') {
    sheet = {
      kind: 'english-sentence',
      title: `${source.grade} 年级句子书写`,
      grid: 'four-line',
      cellMm: 12,
      rows: words
        .filter((row) => row.sentence)
        .slice(0, 12)
        .flatMap((row) => [
          {
            cells: [{ text: row.sentence ?? '', mode: 'model' as const }],
            caption: row.sentence_zh ?? ''
          },
          { cells: [{ text: '', mode: 'blank' as const }] },
          { cells: [{ text: '', mode: 'blank' as const }] }
        ]),
      glyphs: {}
    }
  } else {
    sheet = {
      kind: 'english-word',
      title: `${source.grade} 年级单词书写`,
      grid: 'four-line',
      cellMm: 12,
      rows: words.flatMap((row) => [
        {
          cells: [{ text: row.word, mode: 'model' as const }],
          caption: `${row.phonetic && row.phonetic !== '-' ? `${row.phonetic} ` : ''}${row.meaning}`
        },
        { cells: [{ text: '', mode: 'blank' as const }] },
        { cells: [{ text: '', mode: 'blank' as const }] }
      ]),
      glyphs: {}
    }
  }

  return {
    title: sheet.title,
    subjectName: '英语',
    grade: source.grade,
    duration: null,
    questions: [],
    practice: sheet
  }
}

function subjectIdOf(name: string): number {
  for (const [id, value] of subjectNames()) {
    if (value === name) return id
  }
  return 0
}

function collectOralCard(source: Extract<PrintSource, { kind: 'oral-card' }>): Collected {
  const subjectName = '数学'
  const generated = generateOralQuestions({
    grade: source.grade,
    count: Math.min(200, Math.max(1, source.count)),
    maxValue: source.maxValue,
    operations: source.operations
  })
  return {
    title: `${source.grade} 年级口算题卡`,
    subjectName,
    grade: source.grade,
    duration: null,
    questions: mapGenerated(generated, subjectIdOf(subjectName), subjectName, source.grade),
    practice: null
  }
}

function twoCharWord(char: string, allowed: Set<string>): string | null {
  try {
    const list = cnchar.words(char) as unknown
    if (!Array.isArray(list)) return null
    const found = list.find(
      (item): item is string =>
        typeof item === 'string' &&
        item.length === 2 &&
        item.includes(char) &&
        item.split('').every((part) => allowed.has(part))
    )
    return found ?? null
  } catch {
    return null
  }
}

function collectPinyinWord(
  source: Extract<PrintSource, { kind: 'pinyin-word' }>,
  options: PrintOptions
): Collected {
  const count = Math.min(60, Math.max(1, source.count))
  const limit = count * 2
  const db = getDb()
  // 只使用本年级及以下学过的字组词，避免出现生僻词
  const allowedRows = db
    .prepare('SELECT char FROM ref_hanzi WHERE grade <= ?')
    .all(source.grade) as Array<{ char: string }>
  const allowed = new Set(allowedRows.map((row) => row.char))
  const rows = db
    .prepare('SELECT char FROM ref_hanzi WHERE grade = ? ORDER BY char LIMIT ?')
    .all(source.grade, limit) as Array<{ char: string }>
  const cells: PracticeRow['cells'] = []
  for (const row of rows) {
    const word = twoCharWord(row.char, allowed)
    if (!word) continue
    for (const char of word.split('')) {
      cells.push({ text: '', mode: 'blank', pinyin: pinyinOf(char) })
    }
    if (cells.length >= limit) break
  }

  // 单栏一行 4 个词，双栏一行 2 个词，尽量铺满行宽
  const perRow = (options.columns === 2 ? 2 : 4) * 2
  const practiceRows: PracticeRow[] = []
  for (let index = 0; index < cells.length; index += perRow) {
    practiceRows.push({ cells: cells.slice(index, index + perRow) })
  }
  const sheet: PracticeSheet = {
    kind: 'pinyin-word',
    title: `${source.grade} 年级看拼音写词语`,
    grid: 'pinyin-tian',
    cellMm: source.grade <= 2 ? 18 : 16,
    cellsPerChar: 2,
    rows: practiceRows,
    glyphs: {}
  }
  return {
    title: sheet.title,
    subjectName: '语文',
    grade: source.grade,
    duration: null,
    questions: [],
    practice: sheet
  }
}

function collect(request: PrintRequest): Collected {
  const names = subjectNames()
  const { source } = request
  if (source.kind === 'practice') {
    const session = getPracticeSession(request.userId, source.recordId)
    if (!session) throw new Error('练习记录不存在')
    return fromPaper(session.paper, names.get(session.paper.subjectId ?? 0) ?? '')
  }
  if (source.kind === 'exam') {
    const session = getExamSession(request.userId, source.recordId)
    if (!session) throw new Error('考试记录不存在')
    return fromPaper(session.paper, names.get(session.paper.subjectId ?? 0) ?? '')
  }
  if (source.kind === 'paper') {
    const paper = getPaper(source.paperId)
    if (!paper) throw new Error('试卷不存在')
    return fromPaper(paper, names.get(paper.subjectId ?? 0) ?? '')
  }
  if (source.kind === 'wrongbook') return collectWrongbook(source, request.userId)
  if (source.kind === 'bank') return collectBank(source)
  if (source.kind === 'custom') return collectCustom(source)
  if (source.kind === 'manual') return collectManual(source)
  if (source.kind === 'oral-card') return collectOralCard(source)
  if (source.kind === 'pinyin-word') return collectPinyinWord(source, request.options)
  if (source.kind === 'hanzi') return collectHanzi(source)
  return collectEnglish(source)
}

function sectionKey(question: PrintSourceQuestion, print: PrintQuestion): string {
  if (print.kind === 'choice') return print.multiple ? 'multiple' : 'single'
  if (print.kind === 'pinyin-word') return 'pinyin_word'
  if (print.kind === 'short') {
    if (question.subjectName === '语文' && question.knowledgeName === '习作') return 'composition'
    return 'short_answer'
  }
  if (print.kind === 'calc') {
    if (print.mode === 'oral') return 'oral'
    if (print.mode === 'equation') return 'equation'
    return 'calculation'
  }
  return print.kind === 'generic' ? 'calculation' : print.kind
}

function choiceLayout(
  list: string[],
  options: PrintOptions
): 'inline' | 'grid' | 'list' {
  if (options.choiceColumns === 1) return 'list'
  if (options.choiceColumns === 2) return 'grid'
  if (options.choiceColumns === 4) return 'inline'
  return optionLayout(list)
}

function buildPrintQuestion(question: PrintSourceQuestion, options: PrintOptions): PrintQuestion {
  const common = {
    no: 0,
    stem: question.stem,
    score: Number(question.score) || 2,
    difficulty: question.difficulty,
    answerText: formatAnswer(question),
    solution: question.solution ?? undefined
  }

  if (question.type === 'single' || question.type === 'multiple') {
    const list = Array.isArray(question.options)
      ? question.options.filter((item): item is string => typeof item === 'string')
      : []
    return {
      ...common,
      kind: 'choice',
      options: list,
      multiple: question.type === 'multiple',
      layout: choiceLayout(list, options)
    }
  }
  if (question.type === 'judge') {
    return {
      ...common,
      kind: 'judge',
      optionLabels: ['正确', '错误']
    }
  }
  if (question.type === 'fill') {
    const answers = Array.isArray(question.answer) ? question.answer.map(String) : []
    const parsed = parseFill(question.stem, answers)
    return { ...common, kind: 'fill', ...parsed }
  }
  if (question.type === 'cloze') {
    const answers = Array.isArray(question.answer) ? question.answer.map(String) : []
    const parsed = parseCloze(question.stem, answers)
    return { ...common, kind: 'cloze', segments: parsed.segments }
  }
  if (question.type === 'matching') {
    const options =
      question.options !== null && typeof question.options === 'object' && !Array.isArray(question.options)
        ? (question.options as Record<string, unknown>)
        : {}
    const left = Array.isArray(options.left) ? options.left.map(String) : []
    const right = Array.isArray(options.right) ? options.right.map(String) : []
    return { ...common, kind: 'matching', left, right }
  }
  if (question.type === 'sorting') {
    const items = Array.isArray(question.options)
      ? question.options.filter((item): item is string => typeof item === 'string')
      : []
    return { ...common, kind: 'sorting', items, glyphItems: items.some(isStrokeGlyph) }
  }
  if (question.type === 'calculation') {
    const layout = classifyCalculation(question)
    if (layout.mode === 'vertical') {
      return {
        ...common,
        kind: 'vertical',
        operands: layout.operands,
        operators: layout.operators,
        division: layout.division
      }
    }
    return {
      ...common,
      kind: 'calc',
      mode: layout.mode,
      expression: question.stem.replace(/\s*=\s*_{2,}\s*$/, '').trim(),
      lines: layout.mode === 'answer' ? shortLines(common.score, question.grade, options.answerLines) : 0
    }
  }
  if (question.type === 'short_answer') {
    const isEssay = question.subjectName === '语文' && question.knowledgeName === '习作'
    const ruling = question.subjectName === '英语' ? 'four-line' : isEssay ? 'square' : 'line'
    return {
      ...common,
      kind: 'short',
      lines: isEssay ? 15 : shortLines(common.score, question.grade, options.answerLines),
      ruling
    }
  }
  if (question.type === 'pinyin_word') {
    const raw =
      question.options !== null && typeof question.options === 'object'
        ? (question.options as { words?: unknown })
        : {}
    const list = Array.isArray(raw.words) ? raw.words : []
    const items = list.map((entry) => {
      const value = entry as { pinyin?: unknown; chars?: unknown }
      return {
        pinyin: Array.isArray(value.pinyin) ? value.pinyin.map(String) : [],
        chars: Array.isArray(value.chars) ? value.chars.map(String) : []
      }
    })
    return { ...common, kind: 'pinyin-word', items }
  }
  const optionsList = Array.isArray(question.options)
    ? question.options.filter((item): item is string => typeof item === 'string')
    : []
  return {
    ...common,
    kind: 'generic',
    options: optionsList,
    lines: shortLines(common.score, question.grade, options.answerLines)
  }
}

function answerNote(
  question: PrintSourceQuestion,
  score: number,
  subjectName: string
): string | undefined {
  if (subjectName === '数学') {
    if (question.type === 'short_answer') {
      const part = Math.max(1, Math.round(score / 3))
      const last = Math.max(1, score - part * 2)
      return `列式 ${part} 分，计算 ${part} 分，答句 ${last} 分`
    }
    if (question.type === 'calculation') return '过程略'
  }
  if (subjectName === '语文' && question.type === 'short_answer') {
    return question.knowledgeName === '习作' ? '按内容、结构、语言分档给分' : '答出要点即可得分'
  }
  if (subjectName === '英语' && question.type === 'short_answer') {
    return '语句通顺、拼写正确'
  }
  return undefined
}

function buildSections(
  questions: PrintSourceQuestion[],
  subjectName: string,
  grade: number,
  options: PrintOptions
): { sections: PrintSection[]; answers: PrintDocument['answers']; totalScore: number } {
  const usePrimary =
    options.sectionNaming === 'primary' || (options.sectionNaming === 'auto' && grade <= 2)
  const titles = usePrimary ? PRIMARY_TITLES : SECTION_TITLES

  const buckets = new Map<string, Array<{ print: PrintQuestion; source: PrintSourceQuestion }>>()
  for (const question of questions) {
    const print = buildPrintQuestion(question, options)
    const key = sectionKey(question, print)
    const bucket = buckets.get(key)
    if (bucket) bucket.push({ print, source: question })
    else buckets.set(key, [{ print, source: question }])
  }

  const order = ORDER[subjectName] ?? ORDER['语文']
  const keys = [...buckets.keys()].sort((a, b) => {
    const ai = order.indexOf(a)
    const bi = order.indexOf(b)
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
  })

  const sections: PrintSection[] = []
  const answers: PrintDocument['answers'] = []
  let totalScore = 0
  let no = 0
  let sectionIndex = 0

  for (const key of keys) {
    const items = buckets.get(key) ?? []
    if (items.length === 0) continue
    sectionIndex += 1
    const sectionScore = items.reduce((sum, item) => sum + item.print.score, 0)
    const firstScore = items[0].print.score
    const sameScore = items.every((item) => item.print.score === firstScore)
    const instruction = items.length > 1 && sameScore ? `每题 ${firstScore} 分` : ''
    const title = titles[subjectName]?.[key] ?? '题目'
    items.forEach((item) => {
      no += 1
      item.print.no = no
      answers.push({
        no,
        answer: item.print.answerText,
        solution: item.print.solution,
        note: options.answerStandard
          ? answerNote(item.source, item.print.score, subjectName)
          : undefined
      })
      totalScore += item.print.score
    })
    sections.push({
      title: `${cnNumber(sectionIndex)}、${title}（${sectionScore} 分）`,
      instruction,
      questions: items.map((item) => item.print),
      label: cnNumber(sectionIndex),
      score: sectionScore
    })
  }

  return { sections, answers, totalScore: Math.round(totalScore * 100) / 100 }
}

export function buildPrintDocument(request: PrintRequest): PrintDocument {
  const collected = collect(request)
  const options = request.options

  if (options.scoreScheme === 'standard' && collected.questions.length > 0) {
    collected.questions = collected.questions.map((question) => ({
      ...question,
      score: standardScoreOf(question, collected.subjectName)
    }))
  }

  if (
    collected.questions.length === 0 &&
    collected.practice === null &&
    request.source.kind !== 'manual'
  ) {
    throw new Error('没有可打印的题目')
  }

  const { sections, answers, totalScore } = buildSections(
    collected.questions,
    collected.subjectName,
    collected.grade,
    options
  )
  const title = options.header.title.trim() || collected.title
  const handwritingScore =
    options.handwritingScore > 0 && collected.subjectName === '语文' ? options.handwritingScore : 0
  const score = options.header.totalScore ?? totalScore + handwritingScore
  const subjectGrade = `${collected.subjectName} · ${collected.grade} 年级`
  const subtitle = title.includes(subjectGrade) ? '' : subjectGrade

  return {
    title,
    subtitle,
    meta: {
      subject: collected.subjectName,
      grade: collected.grade,
      duration: options.header.duration ?? collected.duration,
      totalScore: score,
      questionCount: collected.questions.length
    },
    options,
    sections,
    answers,
    practice: collected.practice,
    handwritingScore,
    bonusScore: options.bonusScore > 0 ? options.bonusScore : 0,
    createdAt: new Date().toLocaleString('zh-CN', { hour12: false })
  }
}
