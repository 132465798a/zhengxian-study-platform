import type { GeneratorContext } from './types'
import { generateOral } from './math/oral'
import { generateVertical } from './math/vertical'
import { generateEquation } from './math/equation'
import { generateUnit } from './math/unit'
import { generateGeometry } from './math/geometry'
import { generateMathMultiple } from './math/multiple'
import { generateMathJudge } from './math/judge'
import { generateMathMatching } from './math/matching'
import { generateMathSorting } from './math/sorting'
import { generateMathStatistics } from './math/statistics'
import { generateMathThinking } from './math/thinking'
import { generateMathWordProblem } from './math/word-problem'

export function generateMath(ctx: GeneratorContext): number {
  const total =
    generateOral(ctx) +
    generateVertical(ctx) +
    generateEquation(ctx) +
    generateUnit(ctx) +
    generateGeometry(ctx) +
    generateMathMultiple(ctx) +
    generateMathJudge(ctx) +
    generateMathMatching(ctx) +
    generateMathSorting(ctx) +
    generateMathStatistics(ctx) +
    generateMathThinking(ctx) +
    generateMathWordProblem(ctx)
  console.log(`[generator] 数学生成 ${total} 题`)
  return total
}
