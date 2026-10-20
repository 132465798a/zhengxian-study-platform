import type { QuestionType, Stage } from './types'

export const STAGE_LABELS: Record<Stage, string> = {
  primary: '小学',
  junior: '初中',
  senior: '高中'
}

/**
 * 自定义组卷题目使用独立 ID 段，避免与 bank.question 的自增 ID 冲突。
 * answer_record / paper 等表直接用这个 ID 引用自定义题。
 */
export const CUSTOM_QUESTION_ID_BASE = 1_000_000_000

export function isCustomQuestionId(id: number): boolean {
  return id >= CUSTOM_QUESTION_ID_BASE
}

/**
 * 学段配置。本次只实现小学语数英，
 * 后续加初高中 / 加科目只需在此处补配置，不改引擎代码。
 */
export const STAGE_CONFIG: Record<
  Stage,
  {
    name: string
    grades: number[]
    subjectsByGrade: Record<number, string[]>
  }
> = {
  primary: {
    name: '小学',
    grades: [1, 2, 3, 4, 5, 6],
    subjectsByGrade: {
      1: ['语文', '数学', '英语'],
      2: ['语文', '数学', '英语'],
      3: ['语文', '数学', '英语'],
      4: ['语文', '数学', '英语'],
      5: ['语文', '数学', '英语'],
      6: ['语文', '数学', '英语']
    }
  },
  junior: {
    name: '初中',
    grades: [7, 8, 9],
    subjectsByGrade: {
      7: ['语文', '数学', '英语', '道德与法治', '历史', '地理', '生物'],
      8: ['语文', '数学', '英语', '道德与法治', '历史', '地理', '生物', '物理'],
      9: ['语文', '数学', '英语', '道德与法治', '历史', '物理', '化学']
    }
  },
  senior: {
    name: '高中',
    grades: [10, 11, 12],
    subjectsByGrade: {
      10: ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理'],
      11: ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理'],
      12: ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理']
    }
  }
}

export const ACTIVE_STAGE: Stage = 'primary'

export const SUBJECT_STYLE: Record<string, { icon: string; color: string; soft: string }> = {
  语文: { icon: 'pi pi-book', color: '#b0432a', soft: '#f7e6df' },
  数学: { icon: 'pi pi-calculator', color: '#1f6f5c', soft: '#dfeee9' },
  英语: { icon: 'pi pi-globe', color: '#2f5d8a', soft: '#e2ebf4' }
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  fill: '填空题',
  short_answer: '简答题',
  cloze: '完形填空',
  matching: '连线题',
  sorting: '排序题',
  calculation: '计算题',
  pinyin_word: '看拼音写词语'
}

export const QUESTION_TYPE_HINT: Record<QuestionType, string> = {
  single: '四个选项中选一个',
  multiple: '可多选',
  judge: '判断对错',
  fill: '在空格中填写答案',
  short_answer: '文字作答，主观题',
  cloze: '按空位依次填写',
  matching: '左项与右项配对',
  sorting: '拖动调整顺序',
  calculation: '直接填写计算结果',
  pinyin_word: '根据拼音在格子里写词语'
}

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: '简单',
  2: '中等',
  3: '困难'
}

export const ALL_TYPES: QuestionType[] = [
  'single',
  'multiple',
  'judge',
  'fill',
  'short_answer',
  'cloze',
  'matching',
  'sorting',
  'calculation',
  'pinyin_word'
]

export const TYPES_BY_SUBJECT: Record<string, QuestionType[]> = {
  语文: [
    'single',
    'multiple',
    'judge',
    'fill',
    'pinyin_word',
    'cloze',
    'matching',
    'sorting',
    'short_answer'
  ],
  数学: ['single', 'multiple', 'judge', 'fill', 'calculation', 'matching', 'sorting'],
  英语: ['single', 'multiple', 'judge', 'fill', 'cloze', 'matching', 'sorting', 'short_answer']
}

export const GRADE_LABEL = (grade: number): string => {
  if (grade <= 6) return `${grade} 年级`
  const stage = grade <= 9 ? '初中' : '高中'
  const local = grade <= 9 ? grade - 6 : grade - 9
  return `${stage}${local}年级`
}
