<template>
  <div class="question-body">
    <div class="stem inline-stem">
      <template v-for="(segment, index) in segments" :key="index">
        <LatexText
          v-if="segment.kind === 'text' && segment.text"
          :text="segment.text"
          class="fragment"
        />
        <span v-else-if="segment.kind === 'blank'" class="blank-wrap">
          <InputText
            class="blank"
            :class="blankState(segment.index)"
            :model-value="answers[segment.index] ?? ''"
            :placeholder="t.practice.blankLabel(segment.index + 1)"
            :disabled="readonly"
            @update:model-value="(value: string | undefined) => setBlank(segment.index, value)"
          />
          <i
            v-if="blankState(segment.index) === 'correct'"
            class="blank-mark pi pi-check is-correct"
          />
          <i
            v-else-if="blankState(segment.index) === 'wrong'"
            class="blank-mark pi pi-times is-wrong"
          />
        </span>
      </template>
    </div>

    <div v-if="showCorrect && wrongIndexes.length > 0" class="result-bar is-wrong">
      <span class="result-mark">{{ t.practice.wrongMark }}</span>
      <span v-for="index in wrongIndexes" :key="index" class="result-answer">
        {{ t.practice.blankLabel(index + 1) }}
        <LatexText :text="correctAnswers[index]" />
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import InputText from 'primevue/inputtext'
import LatexText from '@/components/text/LatexText.vue'
import { t } from '@/i18n'
import type { Question } from '@shared/types'

interface ClozeSegment {
  kind: 'text' | 'blank'
  text: string
  index: number
}

const props = defineProps<{
  question: Question
  modelValue: unknown
  readonly?: boolean
  showCorrect?: boolean
  correctAnswer?: unknown
}>()

const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const parsed = computed<{ segments: ClozeSegment[]; count: number }>(() => {
  const stem = props.question.stem
  const segments: ClozeSegment[] = []
  const pattern = /___\{(\d+)\}/g
  let cursor = 0
  let order = 0
  let count = 0

  for (const match of stem.matchAll(pattern)) {
    const at = match.index ?? 0
    if (at > cursor) {
      segments.push({ kind: 'text', text: stem.slice(cursor, at), index: -1 })
    }
    const declared = Number(match[1]) - 1
    const index = declared >= 0 ? declared : order
    segments.push({ kind: 'blank', text: '', index })
    cursor = at + match[0].length
    order += 1
    count = Math.max(count, index + 1)
  }

  if (cursor < stem.length) {
    segments.push({ kind: 'text', text: stem.slice(cursor), index: -1 })
  }
  if (segments.length === 0) {
    segments.push({ kind: 'text', text: stem, index: -1 })
  }
  return { segments, count }
})

const segments = computed<ClozeSegment[]>(() => parsed.value.segments)

const placeholderCount = computed<number>(() => parsed.value.count)

const correctAnswers = computed<string[]>(() => {
  const value = props.correctAnswer ?? props.question.answer
  const list = Array.isArray(value) ? (value as unknown[]) : [value]
  return list.map((item) => String(item))
})

const blankCount = computed<number>(() =>
  Math.max(placeholderCount.value, correctAnswers.value.length)
)

const answers = computed<string[]>(() => {
  const source: unknown[] = Array.isArray(props.modelValue)
    ? (props.modelValue as unknown[])
    : []
  return Array.from({ length: Math.max(source.length, blankCount.value) }, (_, index) => {
    const item = source[index]
    return typeof item === 'string' ? item : ''
  })
})

const wrongIndexes = computed<number[]>(() => {
  const expected = correctAnswers.value
  if (expected.length === 0) return []
  const length = Math.min(blankCount.value, expected.length)
  return Array.from({ length }, (_, index) => index).filter(
    (index) => !matchAnswer(expected[index], answers.value[index])
  )
})

function matchAnswer(expected: string | undefined, actual: string | undefined): boolean {
  if (!expected || !actual) return false
  const value = actual.trim()
  if (!value) return false
  return expected.split('|').some((candidate) => candidate.trim() === value)
}

function blankState(index: number): 'correct' | 'wrong' | null {
  if (props.showCorrect !== true) return null
  const expected = correctAnswers.value[index]
  if (expected === undefined) return null
  return matchAnswer(expected, answers.value[index]) ? 'correct' : 'wrong'
}

function setBlank(index: number, value: string | undefined): void {
  if (props.readonly) return
  const current = answers.value
  const length = Math.max(current.length, blankCount.value, index + 1)
  const next = Array.from({ length }, (_, itemIndex) => current[itemIndex] ?? '')
  next[index] = value ?? ''
  emit('update:modelValue', next)
}
</script>

<style scoped>
.question-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stem {
  padding: 18px 20px;
  background: var(--bg-sunken);
  border-radius: 10px;
  color: var(--ink);
  font-size: 15px;
  line-height: 1.9;
}

.inline-stem {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 8px;
}

.fragment {
  flex: 0 1 auto;
  min-width: 0;
}

.blank-wrap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 1 auto;
}

.blank {
  width: 120px;
  min-width: 72px;
  flex: 0 1 120px;
}

.blank.correct {
  border-color: var(--success);
}

.blank.wrong {
  border-color: var(--danger);
  background: var(--danger-soft);
}

.blank-mark {
  flex: none;
  font-size: 12px;
}

.blank-mark.is-correct {
  color: var(--success);
}

.blank-mark.is-wrong {
  color: var(--danger);
}

.result-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--success-soft);
  color: var(--success);
  font-size: 13px;
}

.result-bar.is-wrong {
  background: var(--danger-soft);
  color: var(--danger);
}

.result-mark {
  font-weight: 600;
}

.result-answer {
  color: inherit;
}
</style>
