<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">{{ t.incentive.dailyDesc }}</p>
        <h1 class="page-title">{{ t.incentive.dailyTitle }}</h1>
      </div>
      <span v-if="daily" class="daily-date num">{{ daily.date }}</span>
    </header>

    <div v-if="loading" class="paper-card panel">
      <div class="empty-state compact">
        <i class="pi pi-spin pi-spinner" />
        <div class="title">{{ t.common.status.loading }}</div>
      </div>
    </div>

    <div v-else-if="error" class="paper-card panel">
      <div class="empty-state compact">
        <i class="pi pi-calendar" />
        <div class="title">{{ t.incentive.dailyEmpty }}</div>
        <div v-if="error" class="hint">{{ error }}</div>
      </div>
    </div>

    <section v-else-if="daily" class="paper-card panel daily-card">
      <QuestionRenderer
        v-model="answer"
        :question="daily.question"
        :readonly="answered"
        :show-correct="answered"
        :correct-answer="correctAnswer"
      />

      <div v-if="!answered" class="submit-row">
        <Button :label="t.incentive.dailySubmit" :loading="submitting" @click="submit" />
      </div>

      <p v-if="submitError" class="error-text">{{ submitError }}</p>

      <div v-if="answered" class="result-block">
        <div class="result-status" :class="statusClass">{{ statusText }}</div>

        <div class="result-row">
          <span class="label">{{ t.incentive.dailyAnswer }}</span>
          <div class="value">
            <LatexText :text="formatAnswer(correctAnswer)" />
          </div>
        </div>

        <div v-if="solution" class="result-row">
          <span class="label">{{ t.incentive.dailySolution }}</span>
          <div class="value">
            <LatexText :text="solution" />
          </div>
        </div>

        <div class="result-actions">
          <Button :label="t.practice.backHome" outlined @click="router.push('/home')" />
        </div>
      </div>
    </section>

    <div v-else class="paper-card panel">
      <div class="empty-state compact">
        <i class="pi pi-calendar" />
        <div class="title">{{ t.incentive.dailyEmpty }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import QuestionRenderer from '@/components/question/QuestionRenderer.vue'
import LatexText from '@/components/text/LatexText.vue'
import { incentiveApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { t } from '@/i18n'
import type { DailyChallenge, QuestionAnswer } from '@shared/types'

type DailyAnswerResult = Awaited<ReturnType<typeof incentiveApi.answerDaily>>

const auth = useAuthStore()
const router = useRouter()

const daily = ref<DailyChallenge | null>(null)
const answer = ref<unknown>(null)
const result = ref<DailyAnswerResult | null>(null)
const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const submitError = ref('')

const answered = computed<boolean>(() => result.value !== null || daily.value?.answered === true)

const isCorrect = computed<boolean | null>(() => {
  if (result.value) return result.value.isCorrect
  return daily.value?.isCorrect ?? null
})

const correctAnswer = computed<QuestionAnswer | null>(() => {
  if (result.value) return result.value.answer
  return daily.value?.answer ?? null
})

const solution = computed<string | null>(() => {
  if (result.value) return result.value.solution
  return daily.value?.solution ?? null
})

const statusText = computed<string>(() => {
  if (isCorrect.value === true) return t.incentive.dailyCorrect
  if (isCorrect.value === false) return t.incentive.dailyWrong
  return t.incentive.dailyAnswered
})

const statusClass = computed<string>(() => {
  if (isCorrect.value === true) return 'ok'
  if (isCorrect.value === false) return 'bad'
  return 'pending'
})

function optionText(index: unknown): string | null {
  const options = daily.value?.question.options
  if (!Array.isArray(options) || typeof index !== 'number') return null
  const value = options[index]
  return typeof value === 'string' ? value : null
}

function formatAnswer(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  const single = optionText(value)
  if (single) return single
  if (Array.isArray(value)) {
    const text = value
      .filter((item) => String(item ?? '').trim() !== '')
      .map((item) => optionText(item) ?? String(item))
      .join('、')
    return text || '—'
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return '—'
    return entries.map(([key, val]) => `${Number(key) + 1} → ${String(val)}`).join('；')
  }
  return String(value)
}

async function load(): Promise<void> {
  if (!auth.currentUser) {
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const data = await incentiveApi.daily(auth.currentUser.id)
    daily.value = data
    answer.value = data.userAnswer ?? null
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : ''
  } finally {
    loading.value = false
  }
}

async function submit(): Promise<void> {
  if (!auth.currentUser || submitting.value) return
  submitting.value = true
  submitError.value = ''
  try {
    result.value = await incentiveApi.answerDaily(auth.currentUser.id, answer.value)
  } catch (cause) {
    submitError.value = cause instanceof Error ? cause.message : t.common.status.error
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page {
  font-size: 13.5px;
}

.panel {
  padding: 20px 22px;
}

.daily-card {
  width: 100%;
}

.daily-date {
  color: var(--ink-faint);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.submit-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

.error-text {
  margin: 12px 0 0;
  color: var(--danger);
  font-size: 12.5px;
}

.result-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed var(--line);
}

.result-status {
  font-size: 14px;
  font-family: var(--font-display);
}

.result-status.ok {
  color: var(--success);
}

.result-status.bad {
  color: var(--danger);
}

.result-status.pending {
  color: var(--ink-soft);
}

.result-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.result-row .label {
  color: var(--ink-faint);
  font-size: 11.5px;
  letter-spacing: 0.08em;
}

.result-row .value {
  color: var(--ink-soft);
  font-size: 14px;
  line-height: 1.8;
}

.result-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}
</style>
