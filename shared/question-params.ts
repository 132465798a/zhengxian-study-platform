import type { QuestionType } from './types'

export type ParamValue = string | number | boolean

export interface ParamOption {
  label: string
  value: string | number
}

export interface ParamField {
  key: string
  label: string
  type: 'select' | 'number' | 'toggle'
  default: ParamValue
  min?: number
  max?: number
  step?: number
  options?: ParamOption[]
}

/**
 * 自定义组卷参数。
 * 这里的每个字段都必须有生成器真正支持；不支持的字段不要放进来。
 */
export const QUESTION_PARAMS: Partial<Record<QuestionType, ParamField[]>> = {
  calculation: [
    {
      key: 'maxValue',
      label: '数值上限',
      type: 'select',
      default: '100',
      options: [
        { label: '20 以内', value: '20' },
        { label: '50 以内', value: '50' },
        { label: '100 以内', value: '100' },
        { label: '1000 以内', value: '1000' },
        { label: '10000 以内', value: '10000' }
      ]
    },
    {
      key: 'operations',
      label: '运算类型',
      type: 'select',
      default: 'mixed',
      options: [
        { label: '加法', value: 'add' },
        { label: '减法', value: 'sub' },
        { label: '乘法', value: 'mul' },
        { label: '除法', value: 'div' },
        { label: '加减混合', value: 'mixed' }
      ]
    },
    {
      key: 'operands',
      label: '运算项数',
      type: 'select',
      default: '2',
      options: [
        { label: '两个数', value: '2' },
        { label: '三个数', value: '3' }
      ]
    },
    {
      key: 'carry',
      label: '进位要求',
      type: 'select',
      default: 'any',
      options: [
        { label: '不限', value: 'any' },
        { label: '必须进位', value: 'require' },
        { label: '不进位', value: 'forbid' }
      ]
    },
    {
      key: 'borrow',
      label: '退位要求',
      type: 'select',
      default: 'any',
      options: [
        { label: '不限', value: 'any' },
        { label: '必须退位', value: 'require' },
        { label: '不退位', value: 'forbid' }
      ]
    }
  ],
  single: [
    {
      key: 'optionCount',
      label: '选项数量',
      type: 'select',
      default: '4',
      options: [
        { label: '3 个', value: '3' },
        { label: '4 个', value: '4' }
      ]
    }
  ],
  multiple: [
    {
      key: 'optionCount',
      label: '选项数量',
      type: 'select',
      default: '4',
      options: [
        { label: '4 个', value: '4' },
        { label: '5 个', value: '5' }
      ]
    },
    {
      key: 'correctCount',
      label: '正确项数量',
      type: 'select',
      default: '2',
      options: [
        { label: '2 个', value: '2' },
        { label: '3 个', value: '3' }
      ]
    }
  ],
  judge: [
    {
      key: 'trueRatio',
      label: '正确说法占比',
      type: 'select',
      default: '50',
      options: [
        { label: '一半', value: '50' },
        { label: '六成', value: '60' },
        { label: '七成', value: '70' }
      ]
    }
  ],
  fill: [],
  matching: [
    {
      key: 'pairCount',
      label: '配对数量',
      type: 'select',
      default: '4',
      options: [
        { label: '4 对', value: '4' },
        { label: '5 对', value: '5' },
        { label: '6 对', value: '6' }
      ]
    }
  ],
  sorting: [
    {
      key: 'itemCount',
      label: '排序项数',
      type: 'select',
      default: '4',
      options: [
        { label: '4 项', value: '4' },
        { label: '5 项', value: '5' },
        { label: '6 项', value: '6' }
      ]
    }
  ],
  cloze: [
    {
      key: 'blankCount',
      label: '空位数量',
      type: 'select',
      default: '1',
      options: [
        { label: '1 空', value: '1' },
        { label: '2 空', value: '2' }
      ]
    }
  ],
  short_answer: [
    {
      key: 'keywordCount',
      label: '关键词数量',
      type: 'select',
      default: '1',
      options: [
        { label: '1 个', value: '1' },
        { label: '2 个', value: '2' },
        { label: '3 个', value: '3' }
      ]
    }
  ]
}

export function defaultParams(type: QuestionType): Record<string, ParamValue> {
  const params: Record<string, ParamValue> = {}
  for (const field of QUESTION_PARAMS[type] ?? []) params[field.key] = field.default
  return params
}
