import type { QuestionFilter, QuestionType } from './types'

/** 打印纸张，尺寸单位为毫米 */
export const PAPER_SIZES: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  B4: { width: 257, height: 364 },
  '8K': { width: 270, height: 390 },
  '16K': { width: 195, height: 270 },
  B5: { width: 176, height: 250 }
}

export type PaperSize = keyof typeof PAPER_SIZES
export type PrintOrientation = 'portrait' | 'landscape'
export type PrintTemplate = 'exam' | 'homework' | 'worksheet' | 'copybook'
export type PrintPart = 'student' | 'answer' | 'answerSheet'
export type PrintGrid = 'tian' | 'mi' | 'huigong' | 'pinyin-tian' | 'square' | 'four-line' | 'line'
export type PrintScratch = 'none' | 'below' | 'page'

export interface PrintHeaderOptions {
  school: string
  title: string
  duration: number | null
  totalScore: number | null
  infoLine: boolean
  /** 姓名班级等信息栏的位置：标题上方或标题左侧 */
  infoLayout: 'top' | 'left'
  /** 卷首说明 / 注意事项，按行显示 */
  notice: string
}

export interface PrintOptions {
  size: PaperSize
  orientation: PrintOrientation
  columns: 1 | 2
  template: PrintTemplate
  fontScale: number
  parts: PrintPart[]
  showScore: boolean
  showDifficulty: boolean
  judgeStyle: 'bracket' | 'options'
  scratch: PrintScratch
  blankScale: number
  answerLines: 'compact' | 'normal' | 'loose'
  showSolution: boolean
  /** PDF 页脚显示「第 X 页 共 X 页」 */
  pageNumber: boolean
  /** 卷头下方显示题号-得分统计表 */
  showScoreTable: boolean
  /** 统计表增加「阅卷人」一行 */
  scoreTableReviewer: boolean
  /** 口算题每行题数 */
  oralColumns: number
  /** 竖式计算每行题数 */
  verticalColumns: number
  /** 分值方案：题库原分值，或按小学常用分值 */
  scoreScheme: 'source' | 'standard'
  /** 每个大题前显示「得分/阅卷人」小框 */
  sectionScoreBox: boolean
  /** 大题命名风格：自动（1-2 年级用小学常用）、标准、小学常用 */
  sectionNaming: 'auto' | 'standard' | 'primary'
  /** 语文卷面书写分，0 表示不计 */
  handwritingScore: number
  /** 左侧密封线（仅首页） */
  sealLine: boolean
  /** 卷末作图区类型 */
  graphPaper: 'none' | 'grid' | 'dot'
  /** 作图区高度（毫米） */
  graphPaperHeight: number
  /** 附加题分值，0 表示没有附加题 */
  bonusScore: number
  /** 作文格每行格数 */
  essayColumns: number
  /** 作文格边长（毫米） */
  essayCellMm: number
  /** 作文格每 100 字刻度 */
  essayMark: boolean
  /** 答案页附评分标准 */
  answerStandard: boolean
  /** 卷型预设 */
  paperKind: 'custom' | 'unit' | 'midterm' | 'final' | 'monthly' | 'practice'
  /** 卷末打印校准尺 */
  printRuler: boolean
  /** 选择题选项排列：自动/单列/两列/一行 */
  choiceColumns: 'auto' | 1 | 2 | 4
  header: PrintHeaderOptions
}

/** 进入打印排版前的题目快照，手动组卷时由前端回传 */
export interface PrintSourceQuestion {
  id: number
  subjectId: number
  subjectName: string
  grade: number
  type: string
  stem: string
  options: unknown
  answer: unknown
  solution: string | null
  score: number
  difficulty: number
  knowledgeName: string | null
  source: string | null
}

export type PrintSource =
  | { kind: 'practice'; recordId: number }
  | { kind: 'exam'; recordId: number }
  | { kind: 'paper'; paperId: number }
  | { kind: 'wrongbook'; subjectId?: number; grade?: number; mastered?: boolean }
  | { kind: 'bank'; filter: QuestionFilter; limit: number }
  | {
      kind: 'manual'
      subjectId: number
      grade: number
      /** 手动挑选的题目，允许为空卷 */
      questions: PrintSourceQuestion[]
    }
  | {
      kind: 'custom'
      subjectId: number
      grade: number
      types: QuestionType[]
      params: Record<string, Record<string, string | number | boolean>>
      count: number
      knowledgeIds?: number[]
      difficulties?: number[]
    }
  | {
      kind: 'hanzi'
      grade: number
      grid: 'tian' | 'mi' | 'huigong' | 'pinyin-tian'
      limit: number
      /** 每行练几个字 */
      charsPerRow?: number
      /** 每个字占几格（含范字与描红） */
      cellsPerChar?: number
    }
  | { kind: 'english'; grade: number; mode: 'word' | 'sentence' | 'dictation'; limit: number }
  | {
      kind: 'oral-card'
      grade: number
      count: number
      maxValue: number
      operations: 'add' | 'sub' | 'mul' | 'div' | 'mixed' | 'all'
    }
  | { kind: 'pinyin-word'; grade: number; count: number }

export interface PrintRequest {
  userId: number
  source: PrintSource
  options: PrintOptions
}

export type PrintSegment =
  | { type: 'text'; text: string }
  | { type: 'blank'; index: number; width: number }

interface BasePrintQuestion {
  no: number
  stem: string
  score: number
  difficulty: number
  answerText: string
  solution?: string
}

export interface ChoicePrintQuestion extends BasePrintQuestion {
  kind: 'choice'
  options: string[]
  multiple: boolean
  layout: 'inline' | 'grid' | 'list'
}

export interface JudgePrintQuestion extends BasePrintQuestion {
  kind: 'judge'
  optionLabels: string[]
}

export interface FillPrintQuestion extends BasePrintQuestion {
  kind: 'fill'
  segments: PrintSegment[]
  trailingBlanks: number
}

export interface ClozePrintQuestion extends BasePrintQuestion {
  kind: 'cloze'
  segments: PrintSegment[]
}

export interface ShortPrintQuestion extends BasePrintQuestion {
  kind: 'short'
  lines: number
  ruling: PrintGrid
}

export interface MatchingPrintQuestion extends BasePrintQuestion {
  kind: 'matching'
  left: string[]
  right: string[]
}

export interface SortingPrintQuestion extends BasePrintQuestion {
  kind: 'sorting'
  items: string[]
  glyphItems: boolean
}

export interface CalcPrintQuestion extends BasePrintQuestion {
  kind: 'calc'
  mode: 'oral' | 'equation' | 'answer'
  expression: string
  lines: number
}

export interface VerticalPrintQuestion extends BasePrintQuestion {
  kind: 'vertical'
  operands: string[]
  operators: string[]
  division: boolean
}

export interface GenericPrintQuestion extends BasePrintQuestion {
  kind: 'generic'
  options: string[]
  lines: number
}

export interface PinyinWordPrintQuestion extends BasePrintQuestion {
  kind: 'pinyin-word'
  items: Array<{ pinyin: string[]; chars: string[] }>
}

export type PrintQuestion =
  | ChoicePrintQuestion
  | JudgePrintQuestion
  | FillPrintQuestion
  | ClozePrintQuestion
  | ShortPrintQuestion
  | MatchingPrintQuestion
  | SortingPrintQuestion
  | CalcPrintQuestion
  | VerticalPrintQuestion
  | GenericPrintQuestion
  | PinyinWordPrintQuestion

export interface PrintSection {
  title: string
  instruction: string
  questions: PrintQuestion[]
  /** 大题序号，如「一」 */
  label?: string
  /** 大题总分 */
  score?: number
}

export interface PrintAnswerItem {
  no: number
  answer: string
  solution?: string
  /** 评分标准或给分说明 */
  note?: string
}

export interface PracticeCell {
  text: string
  mode: 'model' | 'trace' | 'blank'
  /** 拼音田字格中该格上方显示的拼音 */
  pinyin?: string
}

export interface PracticeRow {
  label?: string
  pinyin?: string
  caption?: string
  cells: PracticeCell[]
}

export interface PracticeSheet {
  kind: 'hanzi' | 'english-word' | 'english-sentence' | 'dictation' | 'pinyin-word'
  title: string
  grid: PrintGrid
  cellMm: number
  /** 汉字练习中每个字占用的格数 */
  cellsPerChar?: number
  rows: PracticeRow[]
  /** 汉字笔画路径，key 为单字，坐标系 1024×1024 */
  glyphs: Record<string, string[]>
}

export interface PrintDocument {
  title: string
  subtitle: string
  meta: {
    subject: string
    grade: number
    duration: number | null
    totalScore: number
    questionCount: number
  }
  options: PrintOptions
  sections: PrintSection[]
  answers: PrintAnswerItem[]
  practice: PracticeSheet | null
  /** 语文卷面书写分，0 或未设置表示不计 */
  handwritingScore?: number
  /** 附加题分值，0 或未设置表示没有 */
  bonusScore?: number
  /** 仅供页脚展示 */
  createdAt: string
}

export function defaultPrintOptions(): PrintOptions {
  return {
    size: 'A4',
    orientation: 'portrait',
    columns: 1,
    template: 'exam',
    fontScale: 0.9,
    parts: ['student'],
    showScore: true,
    showDifficulty: false,
    judgeStyle: 'bracket',
    scratch: 'none',
    blankScale: 0.8,
    answerLines: 'compact',
    showSolution: true,
    pageNumber: true,
    showScoreTable: true,
    scoreTableReviewer: false,
    oralColumns: 4,
    verticalColumns: 4,
    scoreScheme: 'source',
    sectionScoreBox: false,
    sectionNaming: 'auto',
    handwritingScore: 0,
    sealLine: false,
    graphPaper: 'none',
    graphPaperHeight: 60,
    bonusScore: 0,
    essayColumns: 20,
    essayCellMm: 8,
    essayMark: false,
    answerStandard: false,
    paperKind: 'custom',
    printRuler: true,
    choiceColumns: 'auto',
    header: {
      school: '',
      title: '',
      duration: null,
      totalScore: null,
      infoLine: true,
      infoLayout: 'top',
      notice: ''
    }
  }
}
