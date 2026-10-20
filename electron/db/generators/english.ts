import type { GeneratorContext } from './types'
import { generateVocabulary } from './english/vocabulary'
import { generatePhonetic } from './english/phonetic'
import { generateWordOrder } from './english/word-order'
import { generateDialogue } from './english/dialogue'
import { generateEnglishMultiple } from './english/multiple'
import { generateEnglishJudge } from './english/judge'
import { generateEnglishMatching } from './english/matching'
import { generateEnglishSorting } from './english/sorting'
import { generateEnglishFill } from './english/fill'
import { generateEnglishAlphabet } from './english/alphabet'
import { generateEnglishGrammar } from './english/grammar'
import { generateEnglishCloze } from './english/cloze'
import { generateEnglishReading } from './english/reading'
import { generateEnglishWriting } from './english/writing'

export function generateEnglish(ctx: GeneratorContext): number {
  const total =
    generateVocabulary(ctx) +
    generatePhonetic(ctx) +
    generateWordOrder(ctx) +
    generateDialogue(ctx) +
    generateEnglishMultiple(ctx) +
    generateEnglishJudge(ctx) +
    generateEnglishMatching(ctx) +
    generateEnglishSorting(ctx) +
    generateEnglishFill(ctx) +
    generateEnglishAlphabet(ctx) +
    generateEnglishGrammar(ctx) +
    generateEnglishCloze(ctx) +
    generateEnglishReading(ctx) +
    generateEnglishWriting(ctx)
  console.log(`[generator] 英语生成 ${total} 题`)
  return total
}
