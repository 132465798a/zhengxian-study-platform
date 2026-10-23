<template>
  <div class="quiz-runner">
    <header class="runner-head">
      <div class="head-left">
        <span v-if="title" class="runner-title">{{ title }}</span>
        <span class="runner-progress num">{{ index + 1 }} / {{ questions.length }}</span>
        <span class="runner-answered">{{ t.play.quizRunner.answered(answeredCount) }}</span>
      </div>
      <span v-if="remaining !== null" class="runner-timer num" :class="{ urgent: remaining <= 10 }">
        <i class="pi pi-clock" />
        {{ timeText }}
      </span>
    </header>

    <div v-if="current" class="paper-card question-card">
      <QuestionRenderer
        :question="current"
        :model-value="answers[current.id]"
        @update:model-value="setAnswer"
      />
    </div>
    <div v-else class="paper-card question-card">
      <div class="empty-state compact">
        <i class="pi pi-inbox" />
        <div class="title">{{ t.common.status.empty }}</div>
      </div>
    </div>

    <div class="runner-foot">
      <Button
        :label="t.practice.prevQuestion"
        icon="pi pi-arrow-left"
        size="small"
        text
        :disabled="index === 0 || submitting"
        @click="go(index - 1)"
      />
      <div class="foot-right">
        <Button
          v-if="index < questions.length - 1"
          :label="t.practice.nextQuestion"
          icon="pi pi-arrow-right"
          icon-pos="right"
          size="small"
          outlined
          :disabled="submitting"
          @click="go(index + 1)"
        />
        <Button
          :label="submitLabel"
          icon="pi pi-send"
          size="small"
          :loading="submitting"
          :disabled="questions.length === 0"
          @click="finish()"
        />
      </div>
    </div>

    <div v-if="questions.length > 1" class="steps">
      <button
        v-for="(item, position) in questions"
        :key="item.id"
        class="step num"
        :class="{ active: position === index, done: isAnswered(item.id) }"
        :disabled="submitting"
        @click="go(position)"
      >
        {{ position + 1 }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import QuestionRenderer from '@/components/question/QuestionRenderer.vue'
import { t } from '@/i18n'
import type { Question, QuizAnswerInput } from '@shared/types'

const props = withDefaults(
  defineProps<{
    questions: Question[]
    title?: string
    submitLabel?: string
    submitting?: boolean
    totalSeconds?: number | null
  }>(),
  {
    title: '',
    submitLabel: '',
    submitting: false,
    totalSeconds: null
  }
)

const emit = defineEmits<{
  submit: [answers: QuizAnswerInput[], durationSec: number]
  timeup: [answers: QuizAnswerInput[], durationSec: number]
}>()

const index = ref(0)
const answers = ref<Record<number, unknown>>({})
const remaining = ref<number | null>(props.totalSeconds)
const startedAt = Date.now()
let timer: ReturnType<typeof setInterval> | null = null

const current = computed<Question | null>(() => props.questions[index.value] ?? null)
const submitLabel = computed<string>(() => props.submitLabel || t.practice.finish)

function isAnswered(questionId: number): boolean {
  const value = answers.value[questionId]
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0
  return true
}

const answeredCount = computed<number>(
  () => props.questions.filter((item) => isAnswered(item.id)).length
)

const timeText = computed<string>(() => {
  const seconds = Math.max(0, remaining.value ?? 0)
  const minute = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minute).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
})

function setAnswer(value: unknown): void {
  if (!current.value) return
  answers.value = { ...answers.value, [current.value.id]: value }
}

function go(position: number): void {
  if (position < 0 || position >= props.questions.length) return
  index.value = position
}

function collect(): QuizAnswerInput[] {
  return props.questions
    .filter((item) => isAnswered(item.id))
    .map((item) => ({ questionId: item.id, answer: answers.value[item.id] }))
}

function duration(): number {
  return Math.round((Date.now() - startedAt) / 1000)
}

function finish(): void {
  if (props.submitting) return
  emit('submit', collect(), duration())
}

function stop(): void {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

watch(
  () => props.totalSeconds,
  (value) => {
    stop()
    remaining.value = value ?? null
  }
)

if (remaining.value !== null) {
  timer = setInterval(() => {
    if (remaining.value === null) return
    remaining.value -= 1
    if (remaining.value <= 0) {
      stop()
      remaining.value = 0
      emit('timeup', collect(), duration())
    }
  }, 1000)
}

onUnmounted(stop)
</script>

<style scoped>
.quiz-runner {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.runner-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.head-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.runner-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--ink);
}

.runner-progress,
.runner-timer {
  font-family: var(--font-num);
  color: var(--ink-soft);
  font-size: 13px;
}

.runner-answered {
  color: var(--ink-faint);
  font-size: 12px;
}

.runner-timer {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--bg-raised);
}

.runner-timer.urgent {
  color: var(--danger);
  border-color: var(--danger);
}

.question-card {
  padding: 18px 20px;
}

.runner-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.foot-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.steps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.step {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  background: var(--bg-raised);
  color: var(--ink-soft);
  font-size: 12px;
  cursor: pointer;
}

.step.done {
  border-color: var(--accent);
  color: var(--accent);
}

.step.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-contrast);
}

.step:disabled {
  cursor: default;
  opacity: 0.7;
}
</style>
