import type { PaperSize, PrintGrid, PrintOptions, PrintOrientation } from '@shared/print'

export const SIZE_OPTIONS = [
  { label: 'A4（210×297）', value: 'A4' },
  { label: 'A3（297×420）', value: 'A3' },
  { label: 'B4（257×364）', value: 'B4' },
  { label: '8 开（270×390）', value: '8K' },
  { label: '16 开（195×270）', value: '16K' },
  { label: 'B5（176×250）', value: 'B5' }
]

export interface LayoutPreset {
  label: string
  value: string
  size: PaperSize
  orientation: PrintOrientation
  columns: 1 | 2
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  { label: 'A4 纵向 · 单栏', value: 'a4', size: 'A4', orientation: 'portrait', columns: 1 },
  { label: 'A4 横向 · 双栏', value: 'a4-wide', size: 'A4', orientation: 'landscape', columns: 2 },
  { label: 'A3 横向 · 双栏（对折成 A4）', value: 'a3-wide', size: 'A3', orientation: 'landscape', columns: 2 },
  { label: '8 开横向 · 双栏（常见试卷）', value: '8k-wide', size: '8K', orientation: 'landscape', columns: 2 },
  { label: 'B4 横向 · 双栏', value: 'b4-wide', size: 'B4', orientation: 'landscape', columns: 2 },
  { label: '16 开纵向 · 单栏', value: '16k', size: '16K', orientation: 'portrait', columns: 1 }
]

export const ORIENTATION_OPTIONS = [
  { label: '纵向', value: 'portrait' },
  { label: '横向', value: 'landscape' }
]

export const COLUMN_OPTIONS = [
  { label: '单栏', value: 1 },
  { label: '双栏', value: 2 }
]

export const TEMPLATE_OPTIONS = [
  { label: '标准试卷', value: 'exam' },
  { label: '课后作业', value: 'homework' },
  { label: '专项练习', value: 'worksheet' }
]

export const FONT_OPTIONS = [
  { label: '小', value: 0.9 },
  { label: '标准', value: 1 },
  { label: '大', value: 1.1 }
]

export const LINE_OPTIONS = [
  { label: '紧凑', value: 'compact' },
  { label: '标准', value: 'normal' },
  { label: '宽松', value: 'loose' }
]

export const SCRATCH_OPTIONS = [
  { label: '不保留', value: 'none' },
  { label: '每题下方', value: 'below' },
  { label: '单独一页', value: 'page' }
]

export const JUDGE_OPTIONS = [
  { label: '括号作答', value: 'bracket' },
  { label: '正确 / 错误', value: 'options' }
]

export const BLANK_OPTIONS = [
  { label: '窄', value: 0.8 },
  { label: '标准', value: 1 },
  { label: '宽', value: 1.3 }
]

export const HEADER_INFO_OPTIONS = [
  { label: '标题上方', value: 'top' },
  { label: '标题左侧', value: 'left' }
]

export const SCORE_SCHEME_OPTIONS = [
  { label: '题库原分值', value: 'source' },
  { label: '小学常用分值', value: 'standard' }
]

export const ORAL_COLUMN_OPTIONS = [
  { label: '每行 3 题', value: 3 },
  { label: '每行 4 题', value: 4 },
  { label: '每行 5 题', value: 5 }
]

export const VERTICAL_COLUMN_OPTIONS = [
  { label: '每行 3 题', value: 3 },
  { label: '每行 4 题', value: 4 }
]

export const SECTION_NAMING_OPTIONS = [
  { label: '自动（1-2 年级用小学常用名）', value: 'auto' },
  { label: '标准（选择题 / 填空题）', value: 'standard' },
  { label: '小学常用（选一选 / 填一填）', value: 'primary' }
]

export const HANDWRITING_OPTIONS = [
  { label: '不计', value: 0 },
  { label: '3 分', value: 3 },
  { label: '5 分', value: 5 },
  { label: '10 分', value: 10 }
]

export const GRAPH_PAPER_OPTIONS = [
  { label: '不制作图区', value: 'none' },
  { label: '方格纸（5mm 小格 / 1cm 粗格）', value: 'grid' },
  { label: '点子图（1cm 间距）', value: 'dot' }
]

export const GRAPH_HEIGHT_OPTIONS = [
  { label: '40 mm', value: 40 },
  { label: '60 mm', value: 60 },
  { label: '80 mm', value: 80 },
  { label: '120 mm', value: 120 }
]

export const BONUS_OPTIONS = [
  { label: '无附加题', value: 0 },
  { label: '5 分', value: 5 },
  { label: '10 分', value: 10 },
  { label: '20 分', value: 20 }
]

export const CHOICE_COLUMN_OPTIONS = [
  { label: '自动', value: 'auto' },
  { label: '单列', value: 1 },
  { label: '两列', value: 2 },
  { label: '一行', value: 4 }
]

export const ESSAY_COLUMN_OPTIONS = [
  { label: '每行 15 格', value: 15 },
  { label: '每行 20 格', value: 20 }
]

export const ESSAY_CELL_OPTIONS = [
  { label: '8 mm', value: 8 },
  { label: '9 mm', value: 9 },
  { label: '10 mm', value: 10 }
]

export const PAPER_KIND_OPTIONS = [
  { label: '自定义', value: 'custom' },
  { label: '单元卷', value: 'unit' },
  { label: '月考卷', value: 'monthly' },
  { label: '期中卷', value: 'midterm' },
  { label: '期末卷', value: 'final' },
  { label: '专项练习', value: 'practice' }
]

const PAPER_KIND_NAMES: Record<string, string> = {
  unit: '单元测试卷',
  monthly: '月考卷',
  midterm: '期中测试卷',
  final: '期末测试卷',
  practice: '专项练习'
}

const PAPER_KIND_PRESETS: Record<
  string,
  { duration: number; sealLine: boolean; handwriting: number; scoreScheme: 'source' | 'standard' }
> = {
  unit: { duration: 60, sealLine: false, handwriting: 0, scoreScheme: 'standard' },
  monthly: { duration: 60, sealLine: false, handwriting: 0, scoreScheme: 'standard' },
  midterm: { duration: 90, sealLine: true, handwriting: 5, scoreScheme: 'standard' },
  final: { duration: 90, sealLine: true, handwriting: 5, scoreScheme: 'standard' },
  practice: { duration: 0, sealLine: false, handwriting: 0, scoreScheme: 'source' }
}

/** 按卷型套用真实试卷的常用设置 */
export function applyPaperKind(
  options: PrintOptions,
  kind: string,
  meta: { subject?: string; grade?: number }
): void {
  const preset = PAPER_KIND_PRESETS[kind]
  if (!preset) return
  options.header.duration = preset.duration > 0 ? preset.duration : null
  options.sealLine = preset.sealLine
  options.scoreScheme = preset.scoreScheme
  options.showScoreTable = true
  if (meta.subject === '语文') options.handwritingScore = preset.handwriting
  if (!options.header.title.trim() && meta.subject && meta.grade) {
    const name = PAPER_KIND_NAMES[kind]
    if (name) options.header.title = `${meta.grade}年级${meta.subject}${name}`
  }
}

export const GRID_OPTIONS: Array<{ label: string; value: PrintGrid }> = [
  { label: '田字格', value: 'tian' },
  { label: '米字格', value: 'mi' },
  { label: '回宫格', value: 'huigong' },
  { label: '拼音田字格', value: 'pinyin-tian' }
]

export const ENGLISH_OPTIONS = [
  { label: '单词书写', value: 'word' },
  { label: '句子书写', value: 'sentence' },
  { label: '听写纸', value: 'dictation' }
]
