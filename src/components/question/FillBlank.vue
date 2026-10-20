<template>
  <div class="question-body">
    <div v-if="hasPlaceholders" class="stem inline-stem">
      <template v-for="(fragment, index) in fragments" :key="index">
        <LatexText :text="fragment" class="fragment" />
        <InputText
          v-if="index < fragments.length - 1"
          class="blank"
          :model-value="answers[index] ?? ''"
          :placeholder="t.practice.blankLabel(index + 1)"
          :disabled="readonly"
          @update:model-value="(value: string | undefined) => setBlank(index, value)"
        />
      </template>
    </div>

    <template v-else>
      <div class="stem">
        <LatexText :text="question.stem" />
      </div>
      <div v-if="blankCount > 0" class="blank-list">
        <label v-for="index in blankCount" :key="index" class="blank-row">
          <span class="blank-label">{{ t.practice.blankLabel(index) }}</span>
          <InputText
            class="blank-input"
            :model-value="answers[index - 1] ?? ''"
            :disabled="readonly"
            @update:model-value="(value: string | undefined) => setBlank(index - 1, value)"
          />
        </label>
      </div>
    </template>

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
import LatexText from '@/components/text/LatexText.vue'
import { t } from '@/i18n'
import type { Question } from '@shared/types'

const props = defineProps<{
  question: Question
  modelValue: unknown
  readonly?: boolean
  showCorrect?: boolean
  correctAnswer?: unknown
}>()

const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const fragments = computed<string[]>(() => props.question.stem.split(/_{2,}/))

const hasPlaceholders = computed<boolean>(() => fragments.value.length > 1)

const answers = computed<string[]>(() => {
  if (!Array.isArray(props.modelValue)) return []
  return (props.modelValue as unknown[]).map((item) => (typeof item === 'string' ? item : ''))
})

const correctAnswers = computed<string[]>(() => {
  const value = props.correctAnswer ?? props.question.answer
  if (!Array.isArray(value)) return []
  return (value as unknown[]).map((item) => String(item))
})

const blankCount = computed<number>(() =>
  hasPlaceholders.value ? fragments.value.length - 1 : correctAnswers.value.length
)

const formattedCorrect = computed<string>(() =>
  correctAnswers.value.map((item) => item.split(/[|｜]/).join('、')).join('、')
)

const isCorrect = computed<boolean>(() => {
  const expected = correctAnswers.value
  if (expected.length === 0) return false
  return expected.every((item, index) => matchAnswer(item, answers.value[index]))
})

function matchAnswer(expected: string, actual: string | undefined): boolean {
  if (!actual) return false
  const value = actual.trim()
  if (!value) return false
  return expected.split('|').some((candidate) => candidate.trim() === value)
}

function setBlank(index: number, value: string | undefined): void {
  const current = answers.value
  const length = Math.max(current.length, index + 1, blankCount.value)
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

.blank {
  width: 120px;
  flex: 0 1 120px;
}

.blank-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.blank-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.blank-label {
  width: 64px;
  flex: none;
  color: var(--ink-soft);
  font-size: 13px;
}

.blank-input {
  width: 100%;
  max-width: 320px;
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
</style>
