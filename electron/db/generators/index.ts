import type { GeneratorContext } from './types'
import { generateChinese } from './chinese'
import { generateMath } from './math'
import { generateEnglish } from './english'

export function generateAll(ctx: GeneratorContext): {
  chinese: number
  math: number
  english: number
  total: number
} {
  const chinese = generateChinese(ctx)
  const math = generateMath(ctx)
  const english = generateEnglish(ctx)
  return { chinese, math, english, total: chinese + math + english }
}

export type { GeneratorContext, GeneratedQuestion } from './types'
