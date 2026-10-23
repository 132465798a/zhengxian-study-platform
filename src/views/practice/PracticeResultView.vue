<template>
  <div class="page">
    <div v-if="loading" class="empty-state">
      <i class="pi pi-spin pi-spinner" />
      <div class="title">{{ t.common.status.loading }}</div>
    </div>

    <div v-else-if="loadError" class="paper-card empty-state">
      <i class="pi pi-exclamation-circle" />
      <div class="title">{{ t.common.status.error }}</div>
      <div class="hint">{{ loadError }}</div>
      <Button :label="t.common.actions.retry" size="small" outlined @click="load" />
    </div>

    <template v-else-if="result">
      <header class="page-head">
        <div>
          <p class="page-eyebrow">PRACTICE RESULT</p>
          <h1 class="page-title">{{ t.practice.resultTitle }}</h1>
          <p class="page-desc">{{ result.title }}</p>
        </div>
        <div class="head-actions">
          <Button
            :label="t.practice.again"
            icon="pi pi-refresh"
            size="small"
            @click="router.push('/practice/setup')"
          />
          <Button
            :label="t.practice.reviewWrong"
            icon="pi pi-bookmark"
            size="small"
            outlined
            @click="router.push('/wrongbook')"
          />
          <Button
            :label="t.practice.backHome"
            icon="pi pi-home"
            size="small"
            text
            @click="router.push('/home')"
          />
        </div>
      </header>

      <ResultSummaryCard :result="result" />

      <section class="review">
        <div class="spread review-head">
          <h2 class="section-title">{{ t.practice.reviewTitle }}</h2>
          <span class="muted small">
            {{ result.questionCount }} {{ t.common.units.question }}
          </span>
        </div>

        <article
          v-for="item in result.items"
          :key="item.question.id"
          class="paper-card review-item"
          :class="statusClass(item.isCorrect)"
        >
          <header class="item-head">
            <span class="order num">{{ item.order }}</span>
            <div class="item-meta">
              <strong>{{ t.common.questionTypes[item.question.type] }}</strong>
              <small v-if="item.question.knowledgeName">{{ item.question.knowledgeName }}</small>
            </div>
            <Tag
              v-if="isCustomQuestionId(item.question.id)"
              :value="t.common.generated"
              severity="info"
            />
            <span class="status" :class="statusClass(item.isCorrect)">
              {{ statusLabel(item.isCorrect) }}
            </span>
            <span class="score num muted">+{{ item.score }}</span>
          </header>

          <QuestionRenderer
            :question="item.question"
            :model-value="item.userAnswer"
            readonly
            show-correct
            :correct-answer="item.question.answer"
          />

          <div class="answer-line">
            <span class="label">{{ t.practice.yourAnswer }}</span>
            <LatexText :text="formatAnswer(item.userAnswer, item.question)" />
          </div>

          <div v-if="item.question.solution" class="solution">
            <span class="label">{{ t.practice.solution }}</span>
            <LatexText :text="item.question.solution" />
          </div>

          <div v-if="item.isCorrect === null && item.answerId" class="manual-grade">
            <span class="muted small">{{ t.practice.manualGrade }}</span>
            <div class="manual-actions">
              <Button
                :label="t.practice.markCorrect"
                size="small"
                outlined
                severity="success"
                :loading="gradingId === item.answerId"
                @click="grade(item, true)"
              />
              <Button
                :label="t.practice.markWrong"
                size="small"
                outlined
                severity="danger"
                :loading="gradingId === item.answerId"
                @click="grade(item, false)"
              />
            </div>
          </div>
        </article>
      </section>
    </template>

    <Toast position="bottom-right" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import QuestionRenderer from '@/components/question/QuestionRenderer.vue'
import LatexText from '@/components/text/LatexText.vue'
import ResultSummaryCard from '@/components/result/ResultSummaryCard.vue'
import { practiceApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { t } from '@/i18n'
import { isCustomQuestionId } from '@shared/constants'
import type { ResultItem, SessionResult } from '@shared/types'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()

const recordId = Number(route.params.recordId)
const result = ref<SessionResult | null>(null)
const loading = ref(true)
const loadError = ref('')
const gradingId = ref<number | null>(null)

function statusClass(value: boolean | null): string {
  if (value === true) return 'ok'
  if (value === false) return 'bad'
  return 'pending'
}

function statusLabel(value: boolean | null): string {
  if (value === true) return t.practice.correct
  if (value === false) return t.practice.wrong
  return t.practice.pending
}

function formatAnswer(value: unknown, question: ResultItem['question']): string {
  const optionText = (index: number): string => {
    const options = Array.isArray(question.options) ? question.options : []
    return typeof options[index] === 'string' ? options[index] : String(index)
  }
  if (value === null || value === undefined || value === '') return t.practice.noAnswer
  if (typeof value === 'number') return optionText(value)
  if (Array.isArray(value)) {
    const text = value
      .filter((item) => String(item ?? '').trim() !== '')
      .map((item) => (typeof item === 'number' ? optionText(item) : String(item)))
      .join('、')
    return text || t.practice.noAnswer
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return t.practice.noAnswer
    return entries.map(([key, val]) => `${Number(key) + 1} → ${String(val)}`).join('；')
  }
  return String(value)
}

function applySettle(data: SessionResult): SessionResult {
  const raw = route.query.gained
  if (raw !== undefined) {
    const gained = Number(raw)
    if (Number.isFinite(gained)) data.growthGained = gained
  }
  const unlocked = String(route.query.unlocked ?? '')
  if (unlocked) data.unlockedAchievements = unlocked.split(',').filter(Boolean)
  return data
}

async function load(): Promise<void> {
  if (!auth.currentUser) return
  loading.value = true
  loadError.value = ''
  try {
    result.value = applySettle(await practiceApi.result(auth.currentUser.id, recordId))
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : t.common.status.error
  } finally {
    loading.value = false
  }
}

async function grade(item: ResultItem, isCorrect: boolean): Promise<void> {
  if (!auth.currentUser || !item.answerId) return
  gradingId.value = item.answerId
  try {
    await practiceApi.grade(auth.currentUser.id, item.answerId, isCorrect)
    await load()
    toast.add({
      severity: 'success',
      summary: t.common.status.success,
      detail: isCorrect ? t.practice.correctMark : t.practice.wrongMark,
      life: 1800
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t.common.status.error,
      detail: error instanceof Error ? error.message : t.common.status.error,
      life: 3000
    })
  } finally {
    gradingId.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.head-actions {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
}

.small {
  font-size: 12px;
}

.review {
  margin-top: 26px;
}

.review-head {
  margin-bottom: 14px;
}

.review-item {
  padding: 18px 22px;
  margin-bottom: 14px;
}

.review-item.ok {
  background: var(--success-soft);
}

.review-item.bad {
  background: var(--danger-soft);
}

.item-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.order {
  font-size: 18px;
  color: var(--accent);
  min-width: 26px;
}

.item-meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.item-meta strong {
  font-size: 12.5px;
  color: var(--ink-soft);
}

.item-meta small {
  font-size: 11px;
  color: var(--ink-faint);
}

.status {
  margin-left: auto;
  font-size: 11.5px;
  padding: 3px 10px;
  border-radius: 999px;
}

.status.ok {
  background: var(--success-soft);
  color: var(--success);
}

.status.bad {
  background: var(--danger-soft);
  color: var(--danger);
}

.status.pending {
  background: var(--bg-sunken);
  color: var(--ink-soft);
}

.score {
  font-size: 12px;
}

.answer-line,
.solution {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  font-size: 13px;
  line-height: 1.85;
  color: var(--ink-soft);
}

.answer-line .label,
.solution .label {
  display: block;
  font-size: 11.5px;
  letter-spacing: 0.06em;
  color: var(--ink-faint);
  margin-bottom: 3px;
}

.answer-line .value {
  color: var(--ink);
}

.manual-grade {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.manual-actions {
  display: flex;
  gap: 8px;
}
</style>
