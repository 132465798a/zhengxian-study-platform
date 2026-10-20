<template>
  <div class="question-body">
    <div class="options" role="radiogroup">
      <button
        v-for="(option, index) in options"
        :key="index"
        type="button"
        class="option"
        :class="optionClass(index)"
        :disabled="readonly"
        role="radio"
        :aria-checked="selected === index"
        @click="select(index)"
      >
        <span class="letter">{{ t.practice.optionPrefix(index) }}</span>
        <span class="option-text"><LatexText :text="option" /></span>
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
  return `${t.practice.optionPrefix(value)} ${options.value[value] ?? String(value)}`
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
