<template>
  <div class="question-body">
    <div class="judge-options" role="radiogroup">
      <button
        v-for="(option, index) in options"
        :key="index"
        type="button"
        class="judge-option"
        :class="optionClass(index)"
        :disabled="readonly"
        role="radio"
        :aria-checked="selected === index"
        @click="select(index)"
      >
        <span class="judge-letter">{{ t.practice.optionPrefix(index) }}</span>
        <span class="judge-text">{{ option }}</span>
      </button>
    </div>

    <div v-if="showCorrect" class="result-bar" :class="isCorrect ? 'is-correct' : 'is-wrong'">
      <span class="result-mark">{{ isCorrect ? t.practice.correctMark : t.practice.wrongMark }}</span>
      <span v-if="!isCorrect && formattedCorrect" class="result-answer">
        {{ t.practice.correctAnswer }} {{ formattedCorrect }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
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

const options = computed<string[]>(() => {
  if (!Array.isArray(props.question.options)) return []
  return (props.question.options as unknown[]).filter(
    (item): item is string => typeof item === 'string'
  )
})

const selected = computed<number | null>(() =>
  typeof props.modelValue === 'number' ? props.modelValue : null
)

const correctIndex = computed<number | null>(() => {
  const value = props.correctAnswer ?? props.question.answer
  return typeof value === 'number' ? value : null
})

const isCorrect = computed<boolean>(
  () => selected.value !== null && selected.value === correctIndex.value
)

const formattedCorrect = computed<string>(() => {
  const value = correctIndex.value
  if (value === null) return ''
  return options.value[value] ?? String(value)
})

function select(index: number): void {
  if (props.readonly) return
  emit('update:modelValue', index)
}

function optionClass(index: number): Record<string, boolean> {
  const isSelected = selected.value === index
  const isCorrectOption = props.showCorrect === true && correctIndex.value === index
  return {
    selected: isSelected,
    correct: isCorrectOption,
    wrong: props.showCorrect === true && isSelected && !isCorrectOption
  }
}
</script>

<style scoped>
.question-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.judge-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.judge-option {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 18px 16px;
  border-radius: 10px;
  background: transparent;
  color: var(--ink);
  font-family: inherit;
  font-size: 16px;
  line-height: 1.4;
  cursor: pointer;
  transition: background-color 0.1s ease;
}

.judge-option:hover:not(:disabled) {
  background: var(--accent-soft);
}

.judge-option:disabled {
  cursor: default;
}

.judge-option.selected {
  background: var(--accent);
  color: var(--accent-contrast);
}

.judge-option.correct {
  background: var(--success);
  color: var(--accent-contrast);
}

.judge-option.wrong {
  background: var(--danger-soft);
}

.judge-letter {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--ink-soft);
  font-family: var(--font-num);
  font-size: 12.5px;
  line-height: 24px;
  text-align: center;
}

.judge-option.selected .judge-letter,
.judge-option.correct .judge-letter {
  background: var(--accent-contrast);
  color: var(--accent);
}

.judge-option.wrong .judge-letter {
  background: var(--danger);
  color: var(--accent-contrast);
}

.judge-text {
  font-weight: 600;
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
