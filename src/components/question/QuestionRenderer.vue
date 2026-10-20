<template>
  <div class="question-renderer">
    <div class="meta">
      <span class="type-tag">{{ t.common.questionTypes[question.type] }}</span>
      <span class="difficulty-tag">{{ t.common.difficulty[question.difficulty] }}</span>
    </div>

    <div v-if="!inlineStem" class="stem">
      <LatexText :text="question.stem" />
    </div>

    <component
      v-if="componentMap[question.type]"
      :is="componentMap[question.type]"
      :question="question"
      :model-value="modelValue"
      :readonly="readonly"
      :show-correct="showCorrect"
      :correct-answer="correctAnswer"
      @update:model-value="onUpdate"
    />
    <p v-else class="no-renderer">该题型请在打印卷中使用（看拼音写词语）。</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import type { Question, QuestionType } from '@shared/types'
import { t } from '@/i18n'
import LatexText from '@/components/text/LatexText.vue'
import SingleChoice from './SingleChoice.vue'
import MultipleChoice from './MultipleChoice.vue'
import Judge from './Judge.vue'
import FillBlank from './FillBlank.vue'
import Cloze from './Cloze.vue'
import ShortAnswer from './ShortAnswer.vue'
import Matching from './Matching.vue'
import Sorting from './Sorting.vue'
import Calculation from './Calculation.vue'

const props = defineProps<{
  question: Question
  modelValue: unknown
  readonly?: boolean
  showCorrect?: boolean
  correctAnswer?: unknown
}>()

const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const componentMap: Partial<Record<QuestionType, Component>> = {
  single: SingleChoice,
  multiple: MultipleChoice,
  judge: Judge,
  fill: FillBlank,
  short_answer: ShortAnswer,
  cloze: Cloze,
  matching: Matching,
  sorting: Sorting,
  calculation: Calculation
}

const inlineStem = computed<boolean>(
  () => props.question.type === 'fill' || props.question.type === 'cloze'
)

function onUpdate(value: unknown): void {
  emit('update:modelValue', value)
}
</script>

<style scoped>
.question-renderer {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.type-tag {
  padding: 2px 9px;
  border-radius: 6px;
  background: var(--accent-soft);
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.6;
}

.difficulty-tag {
  padding: 2px 9px;
  border-radius: 6px;
  border: 1px solid var(--line);
  color: var(--ink-faint);
  font-size: 12px;
  line-height: 1.6;
}

.stem {
  padding: 18px 20px;
  background: var(--bg-sunken);
  border-radius: 10px;
  color: var(--ink);
  font-size: 15px;
  line-height: 1.9;
}
</style>
