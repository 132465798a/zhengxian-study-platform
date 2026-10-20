<template>
  <template v-if="flat && question.kind === 'pinyin-word'">
    <div v-for="(item, index) in question.items" :key="index" class="pinyin-word-item">
      <span class="pinyin-word-text">
        <span v-if="index === 0" class="pinyin-word-no">{{ question.no }}.</span>
        {{ item.pinyin.join(' ') }}
      </span>
      <div class="pinyin-word-cells">
        <HanziGrid
          v-for="(char, charIndex) in item.chars"
          :key="charIndex"
          char=""
          mode="blank"
          :size-mm="14"
          grid="tian"
          :paths="[]"
        />
      </div>
    </div>
  </template>

  <div v-else class="question-item">
    <div class="question-head">
      <span class="question-no">{{ question.no }}.</span>
      <span class="question-stem">
        <template v-if="question.kind === 'fill' || question.kind === 'cloze'">
          <template v-for="(segment, index) in question.segments" :key="index">
            <LatexText v-if="segment.type === 'text'" :text="segment.text" />
            <span v-else class="p-blank" :style="blankStyle(segment.width)">
              <span v-if="showBlankIndex" class="p-blank-index">{{ circled(segment.index + 1) }}</span>
            </span>
          </template>
        </template>
        <template v-else-if="question.kind === 'calc' && question.mode === 'oral'">
          <LatexText :text="question.expression" /> =
          <span class="calc-line" />
        </template>
        <template v-else>
          <LatexText
            v-if="!(question.kind === 'calc' && question.mode === 'oral')"
            :text="question.stem"
          />
          <span v-if="question.kind === 'judge' && options.judgeStyle === 'bracket'" class="judge-bracket">（&nbsp;&nbsp;&nbsp;&nbsp;）</span>
        </template>
        <span v-if="showChoiceBracket" class="choice-bracket">（&nbsp;&nbsp;&nbsp;&nbsp;）</span>
        <span v-if="options.showDifficulty" class="question-score">难度 {{ question.difficulty }}</span>
        <span v-if="options.showScore" class="question-score">（{{ question.score }} 分）</span>
      </span>
    </div>

    <div v-if="question.kind === 'choice'" class="question-body">
      <div class="choice-options" :class="{ 'is-grid': question.layout === 'grid', 'is-list': question.layout === 'list' }">
        <span v-for="(option, index) in question.options" :key="index" class="choice-item">
          <span class="choice-letter">{{ letter(index) }}</span>
          <span class="choice-label"><LatexText :text="option" /></span>
        </span>
      </div>
    </div>

    <div
      v-else-if="question.kind === 'judge' && options.judgeStyle === 'options'"
      class="question-body is-indent"
    >
      <div class="choice-options">
        <span v-for="(label, index) in question.optionLabels" :key="label" class="choice-item">
          <span class="choice-letter">{{ letter(index) }}</span>
          <span class="choice-label">{{ label }}</span>
        </span>
      </div>
    </div>

    <div v-else-if="question.kind === 'fill'" class="question-body is-indent">
      <div v-if="question.trailingBlanks > 0" class="choice-options">
        <span v-for="index in question.trailingBlanks" :key="index" class="choice-item">
          <span class="p-blank-index">{{ circled(index - 1) }}</span>
          <span class="p-blank" :style="blankStyle(5)" />
        </span>
      </div>
    </div>

    <div v-else-if="question.kind === 'matching'" class="question-body">
      <div class="matching-columns">
        <div class="matching-col">
          <div v-for="(item, index) in question.left" :key="`l-${index}`" class="matching-row">
            <span class="matching-mark">{{ index + 1 }}.</span>
            <LatexText :text="item" />
          </div>
        </div>
        <div class="matching-col">
          <div v-for="(item, index) in question.right" :key="`r-${index}`" class="matching-row">
            <span class="matching-mark">{{ letter(index) }}.</span>
            <LatexText :text="item" />
          </div>
        </div>
      </div>
      <div class="matching-answer-line">
        答案：<span v-for="(item, index) in question.left" :key="`a-${index}`">{{ index + 1 }}—（&nbsp;&nbsp;）</span>
      </div>
    </div>

    <div v-else-if="question.kind === 'sorting'" class="question-body">
      <div class="sorting-list">
        <div v-for="(item, index) in question.items" :key="index" class="sorting-item">
          <span class="sorting-box" />
          <span class="sorting-text" :class="{ 'is-glyph': question.glyphItems }">
            <LatexText :text="item" />
          </span>
        </div>
      </div>
    </div>

    <div v-else-if="question.kind === 'short'" class="question-body">
      <div v-if="question.ruling === 'line'" class="answer-lines">
        <div v-for="index in question.lines" :key="index" class="p-answer-line" />
      </div>
      <div v-else-if="question.ruling === 'four-line'" class="answer-lines">
        <FourLine v-for="index in question.lines" :key="index" text="" />
      </div>
      <EssayGrid
        v-else-if="question.ruling === 'square'"
        :rows="question.lines"
        :columns="options.essayColumns"
        :cell-mm="options.essayCellMm"
        :mark="options.essayMark"
      />
      <div v-else class="answer-lines">
        <div v-for="index in question.lines" :key="index" class="p-answer-line" />
      </div>
    </div>

    <div v-else-if="question.kind === 'calc' && question.mode !== 'oral'" class="question-body">
      <div v-if="question.mode === 'equation'" class="calc-solve">解：</div>
      <div class="answer-lines">
        <div v-for="index in question.lines" :key="index" class="p-answer-line" />
      </div>
      <div v-if="question.mode === 'answer'" class="calc-answer-line">
        答：<span class="calc-line" />
      </div>
      <div v-if="options.scratch === 'below'" class="vertical-scratch" />
    </div>

    <div v-else-if="question.kind === 'vertical'" class="question-body">
      <div class="vertical-grid">
        <div
          v-for="(item, index) in verticalItems"
          :key="index"
          class="vertical-cell"
        >
          <span class="vertical-no">{{ index + 1 }}</span>
          <VerticalCalc
            :operands="item.operands"
            :operators="item.operators"
            :division="item.division"
            :scratch="options.scratch === 'below'"
          />
        </div>
      </div>
    </div>

    <div v-else-if="question.kind === 'generic'" class="question-body is-indent">
      <div v-if="question.options.length > 0" class="choice-options">
        <span v-for="(option, index) in question.options" :key="index" class="choice-item">
          <span class="choice-letter">{{ letter(index) }}</span>
          <span class="choice-label"><LatexText :text="option" /></span>
        </span>
      </div>
      <div class="answer-lines">
        <div v-for="index in question.lines" :key="index" class="p-answer-line" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PrintOptions, PrintQuestion, VerticalPrintQuestion } from '@shared/print'
import LatexText from '@/components/text/LatexText.vue'
import FourLine from './parts/FourLine.vue'
import EssayGrid from './parts/EssayGrid.vue'
import HanziGrid from './parts/HanziGrid.vue'
import VerticalCalc from './parts/VerticalCalc.vue'

const props = defineProps<{
  question: PrintQuestion
  options: PrintOptions
  /** 看拼音写词语按整节平铺，由外层统一换行 */
  flat?: boolean
}>()

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'

function circled(index: number): string {
  return CIRCLED[index] ?? `(${index + 1})`
}

function letter(index: number): string {
  return String.fromCharCode(65 + index)
}

const showBlankIndex = computed<boolean>(() => {
  if (props.question.kind !== 'fill' && props.question.kind !== 'cloze') return false
  if (props.question.kind === 'cloze') return true
  return props.question.segments.filter((item) => item.type === 'blank').length > 1
})

/** 选择题在题干末尾留答题括号，题干本身已带括号时不重复添加 */
const showChoiceBracket = computed<boolean>(() => {
  if (props.question.kind !== 'choice') return false
  return !/[（(]\s*[）)]/.test(props.question.stem)
})

function blankStyle(width: number): Record<string, string> {
  const mm = Math.max(18, width * 4.2 * props.options.blankScale)
  return { width: `${mm.toFixed(1)}mm` }
}

/** 竖式按 4 题一组铺满，超过 4 题换行；低年级题量少时保持 4 列网格更整齐 */
const verticalItems = computed<VerticalPrintQuestion[]>(() => {
  const question = props.question
  if (question.kind !== 'vertical') return []
  return [question]
})
</script>
