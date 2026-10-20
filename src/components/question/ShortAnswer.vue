<template>
  <div class="question-body">
    <Textarea
      class="answer-input"
      :model-value="answer"
      :rows="6"
      :placeholder="t.practice.shortAnswerPlaceholder"
      :disabled="readonly"
      @update:model-value="onInput"
    />

    <div v-if="showCorrect && reference" class="reference">
      <div class="reference-label">{{ t.practice.correctAnswer }}</div>
      <div class="reference-text">
        <LatexText :text="reference" />
      </div>
    </div>

    <div v-if="showCorrect && pending" class="result-bar is-pending">
      <span class="result-mark">{{ t.practice.waitingGrade }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Textarea from 'primevue/textarea'
import LatexText from '@/components/text/LatexText.vue'
import { t } from '@/i18n'
import type { Question } from '@shared/types'

interface AnswerPayload {
  reference?: unknown
  keywords?: unknown
}

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

const payload = computed<AnswerPayload | null>(() => {
  const value = props.correctAnswer ?? props.question.answer
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  return value as AnswerPayload
})

const reference = computed<string>(() => {
  const value = payload.value?.reference
  return typeof value === 'string' && value.trim() ? value : ''
})

const pending = computed<boolean>(
  () => payload.value !== null && Array.isArray(payload.value.keywords) && payload.value.keywords.length === 0
)

function onInput(value: string): void {
  if (props.readonly) return
  emit('update:modelValue', value)
}
</script>

<style scoped>
.question-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.answer-input {
  width: 100%;
  font-size: 13.5px;
  line-height: 1.8;
  resize: vertical;
}

.reference {
  padding: 12px 14px;
  border: 1px dashed var(--line-strong);
  border-radius: 10px;
  background: var(--bg-sunken);
  color: var(--ink);
  font-size: 13px;
  line-height: 1.8;
}

.reference-label {
  margin-bottom: 4px;
  color: var(--ink-faint);
  font-size: 12px;
}

.reference-text {
  color: var(--ink);
}

.result-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--bg-sunken);
  color: var(--ink-soft);
  font-size: 13px;
}

.result-mark {
  font-weight: 600;
}
</style>
