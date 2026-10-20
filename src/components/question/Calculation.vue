<template>
  <div class="question-body">
    <InputText
      class="calc-input"
      inputmode="decimal"
      :model-value="answer"
      :placeholder="t.practice.answerPlaceholder"
      :disabled="readonly"
      @update:model-value="onInput"
    />

    <div v-if="showCorrect" class="result-bar" :class="isCorrect ? 'is-correct' : 'is-wrong'">
      <span class="result-mark">{{ isCorrect ? t.practice.correctMark : t.practice.wrongMark }}</span>
      <span v-if="!isCorrect && formattedCorrect" class="result-answer">
        {{ t.practice.correctAnswer }} <LatexText :text="formattedCorrect" />
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import InputText from 'primevue/inputtext'
import { t } from '@/i18n'
import LatexText from '@/components/text/LatexText.vue'
import type { Question } from '@shared/types'

const ALT_SEPARATOR = /\s*[|｜;；]\s*/

const props = defineProps<{
  question: Question
  modelValue: unknown
  readonly?: boolean
  showCorrect?: boolean
  correctAnswer?: unknown
}>()

const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const answer = computed<string>(() =>
  typeof props.modelValue === 'string' ? props.modelValue : ''
)

const expected = computed<unknown>(() => props.correctAnswer ?? props.question.answer)

const isCorrect = computed<boolean>(() => matchAnswer(expected.value, answer.value))

const formattedCorrect = computed<string>(() => {
  const value = expected.value
  return value === null || value === undefined ? '' : String(value)
})

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/[。．.，,；;！!？?、]$/g, '')
    .toLowerCase()
}

function parseNumeric(value: string): number | null {
  const percent = /[％%]$/.test(value)
  const text = percent ? value.slice(0, -1) : value
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    const num = Number(text)
    return percent ? num / 100 : num
  }
  const fraction = text.match(/^(-?\d+)\s*\/\s*(\d+)$/)
  if (fraction) return Number(fraction[1]) / Number(fraction[2])
  return null
}

function matchAnswer(expectedValue: unknown, actual: string): boolean {
  if (expectedValue === null || expectedValue === undefined) return false
  const expectedText = normalizeText(expectedValue)
  const actualText = normalizeText(actual)
  if (!actualText) return false
  if (expectedText === actualText) return true

  const alternatives = String(expectedValue).split(ALT_SEPARATOR)
  if (alternatives.length > 1) {
    return alternatives.some((item) => matchAnswer(item, actual))
  }

  const expectedNumber = parseNumeric(expectedText)
  const actualNumber = parseNumeric(actualText)
  if (expectedNumber !== null && actualNumber !== null) {
    return Math.abs(expectedNumber - actualNumber) < 1e-6
  }
  return false
}

function onInput(value: string | undefined): void {
  if (props.readonly) return
  emit('update:modelValue', value ?? '')
}
</script>

<style scoped>
.question-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.calc-input {
  width: 100%;
  max-width: 280px;
}

.result-bar {
  display: flex;
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
