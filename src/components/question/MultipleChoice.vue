<template>
  <div class="question-body">
    <div class="options">
      <button
        v-for="(option, index) in options"
        :key="index"
        type="button"
        class="option"
        :class="optionClass(index)"
        :disabled="readonly"
        role="checkbox"
        :aria-checked="selected.includes(index)"
        @click="toggle(index)"
      >
        <span class="letter">{{ t.practice.optionPrefix(index) }}</span>
        <span class="option-text"><LatexText :text="option" /></span>
        <Checkbox
          class="indicator"
          :model-value="selected.includes(index)"
          :binary="true"
          readonly
          :tabindex="-1"
        />
      </button>
    </div>

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
import Checkbox from 'primevue/checkbox'
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

const options = computed<string[]>(() => {
  if (!Array.isArray(props.question.options)) return []
  return (props.question.options as unknown[]).filter(
    (item): item is string => typeof item === 'string'
  )
})

const selected = computed<number[]>(() => {
  if (!Array.isArray(props.modelValue)) return []
  return (props.modelValue as unknown[]).filter((item): item is number => typeof item === 'number')
})

const correctIndexes = computed<number[]>(() => {
  const value = props.correctAnswer ?? props.question.answer
  if (!Array.isArray(value)) return []
  return (value as unknown[]).filter((item): item is number => typeof item === 'number')
})

const isCorrect = computed<boolean>(() => {
  const expected = correctIndexes.value
  const current = selected.value
  if (expected.length === 0 || current.length !== expected.length) return false
  return expected.every((index) => current.includes(index))
})

const formattedCorrect = computed<string>(() =>
  correctIndexes.value
    .map((index) => `${t.practice.optionPrefix(index)} ${options.value[index] ?? String(index)}`)
    .join('、')
)

function toggle(index: number): void {
  if (props.readonly) return
  const current = selected.value
  const next = current.includes(index)
    ? current.filter((item) => item !== index)
    : [...current, index].sort((a, b) => a - b)
  emit('update:modelValue', next)
}

function optionClass(index: number): Record<string, boolean> {
  const isSelected = selected.value.includes(index)
  const isCorrectOption = props.showCorrect === true && correctIndexes.value.includes(index)
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

.options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.7;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.1s ease;
}

.option:hover:not(:disabled) {
  background: var(--accent-soft);
}

.option:disabled {
  cursor: default;
}

.option.selected {
  background: var(--accent);
  color: var(--accent-contrast);
}

.option.correct {
  background: var(--success);
  color: var(--accent-contrast);
}

.option.wrong {
  background: var(--danger-soft);
}

.letter {
  flex: none;
  width: 24px;
  height: 24px;
  margin-top: 1px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--ink-soft);
  font-family: var(--font-num);
  font-size: 12.5px;
  line-height: 24px;
  text-align: center;
}

.option.selected .letter,
.option.correct .letter {
  background: var(--accent-contrast);
  color: var(--accent);
}

.option.wrong .letter {
  background: var(--danger);
  color: var(--accent-contrast);
}

.option-text {
  flex: 1;
  min-width: 0;
}

.indicator {
  flex: none;
  margin-top: 2px;
  pointer-events: none;
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
