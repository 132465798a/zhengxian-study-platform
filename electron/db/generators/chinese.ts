import type { GeneratorContext } from './types'
import { generatePinyin } from './chinese/pinyin'
import { generateStroke } from './chinese/stroke'
import { generateRadical } from './chinese/radical'
import { generateWords } from './chinese/words'
import { generateIdiom } from './chinese/idiom'
import { generateSynonym } from './chinese/synonym'
import { generateAntonym } from './chinese/antonym'
import { generateXiehouyu } from './chinese/xiehouyu'
import { generateClassifier } from './chinese/classifier'
import { generatePoem } from './chinese/poem'
import { generateMultiple } from './chinese/multiple'
import { generateJudge } from './chinese/judge'
import { generateMatching } from './chinese/matching'
import { generateSorting } from './chinese/sorting'
import { generateChineseCloze } from './chinese/cloze'
import { generateChineseShortAnswer } from './chinese/short-answer'
import { generateChineseReading } from './chinese/reading'
import { generateChineseWriting } from './chinese/writing'
import { generateChineseCharForm } from './chinese/char-form'
import { generatePinyinWord } from './chinese/pinyin-word'

export function generateChinese(ctx: GeneratorContext): number {
  const total =
    generatePinyin(ctx) +
    generateStroke(ctx) +
    generateRadical(ctx) +
    generateWords(ctx) +
    generateIdiom(ctx) +
    generateSynonym(ctx) +
    generateAntonym(ctx) +
    generateXiehouyu(ctx) +
    generateClassifier(ctx) +
    generatePoem(ctx) +
    generateMultiple(ctx) +
    generateJudge(ctx) +
    generateMatching(ctx) +
    generateSorting(ctx) +
    generateChineseCloze(ctx) +
    generateChineseShortAnswer(ctx) +
    generateChineseReading(ctx) +
    generateChineseWriting(ctx) +
    generateChineseCharForm(ctx) +
    generatePinyinWord(ctx)
  console.log(`[generator] 语文生成 ${total} 题`)
  return total
}
