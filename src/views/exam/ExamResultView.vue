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
      <Button
        class="retry"
        :label="t.common.actions.retry"
        size="small"
        outlined
        @click="load"
      />
    </div>

    <template v-else-if="result">
      <header class="page-head">
        <div>
          <p class="page-eyebrow">{{ t.nav.exam }}</p>
          <h1 class="page-title">{{ t.exam.resultTitle }}</h1>
          <p class="page-desc">{{ result.title }}</p>
        </div>
      </header>

      <ResultSummaryCard :result="result" show-score />

      <section class="review">
        <div class="spread review-head">
          <h2 class="section-title">{{ t.practice.reviewTitle }}</h2>
          <span class="muted review-count">
            {{ result.questionCount }} {{ t.common.units.question }}
          </span>
        </div>

        <article
          v-for="(item, index) in result.items"
          :key="item.question.id"
          class="paper-card review-item"
        >
          <header class="review-top">
            <span class="question-no num">{{ index + 1 }}</span>
            <Tag
              :value="t.common.questionTypes[item.question.type]"
              severity="secondary"
            />
            <Tag
              :value="statusLabel(item.isCorrect)"
              :severity="statusSeverity(item.isCorrect)"
            />
            <span class="muted item-score num">
              {{ item.score }} {{ t.common.units.score }}
            </span>
          </header>

          <QuestionRenderer
            :question="item.question"
            :model-value="item.userAnswer"
            readonly
            show-correct
            :correct-answer="item.question.answer"
          />

          <div class="answer-blocks">
            <div class="answer-block">
              <span class="block-label">{{ t.practice.yourAnswer }}</span>
              <div class="block-text">
                <LatexText :text="formatAnswer(item.userAnswer)" />
              </div>
            </div>
            <div class="answer-block">
              <span class="block-label">{{ t.practice.correctAnswer }}</span>
              <div class="block-text correct">
                <LatexText :text="formatAnswer(item.question.answer)" />
              </div>
            </div>
            <div v-if="item.question.solution" class="answer-block">
              <span class="block-label">{{ t.practice.solution }}</span>
              <div class="block-text">
                <LatexText :text="item.question.solution" />
              </div>
            </div>
          </div>
        </article>
      </section>

      <footer class="result-actions">
        <Button
          :label="t.practice.again"
          icon="pi pi-refresh"
          @click="router.push('/exam')"
        />
        <Button
          :label="t.practice.reviewWrong"
          icon="pi pi-bookmark"
          outlined
          @click="router.push('/wrongbook')"
        />
        <Button
          :label="t.practice.backHome"
          icon="pi pi-home"
          text
          @click="router.push('/home')"
        />
      </footer>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import LatexText from '@/components/text/LatexText.vue'
import QuestionRenderer from '@/components/question/QuestionRenderer.vue'
import ResultSummaryCard from '@/components/result/ResultSummaryCard.vue'
import { examApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { t } from '@/i18n'
import type { SessionResult } from '@shared/types'

type TagSeverity = 'success' | 'danger' | 'warn'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const recordId = Number(route.params.recordId)
const result = ref<SessionResult | null>(null)
const loading = ref(true)
const loadError = ref('')

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : t.common.status.error
}

function statusLabel(value: boolean | null): string {
  if (value === true) return t.practice.correct
  if (value === false) return t.practice.wrong
  return t.practice.pending
}

function statusSeverity(value: boolean | null): TagSeverity {
  if (value === true) return 'success'
  if (value === false) return 'danger'
  return 'warn'
}

function formatAnswer(value: unknown): string {
  if (value === null || value === undefined || value === '') return t.practice.noAnswer
  if (Array.isArray(value)) {
    if (value.length === 0) return t.practice.noAnswer
    return value
      .map((entry) =>
        typeof entry === 'object' && entry !== null
          ? (JSON.stringify(entry) ?? String(entry))
          : String(entry)
      )
      .join('、')
  }
  if (typeof value === 'object') return JSON.stringify(value) ?? String(value)
  return String(value)
}

async function load(): Promise<void> {
  if (!auth.currentUser || !Number.isFinite(recordId)) {
    loading.value = false
    loadError.value = t.common.status.error
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    result.value = await examApi.result(auth.currentUser.id, recordId)
  } catch (error) {
    loadError.value = errorText(error)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.score-card {
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 24px 28px;
}

.score-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-right: 28px;
  border-right: 1px solid var(--line);
  flex-shrink: 0;
}

.score-label {
  font-size: 11.5px;
  letter-spacing: 0.12em;
  color: var(--ink-faint);
}

.score-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--accent);
}

.score-value strong {
  font-family: var(--font-num);
  font-size: 48px;
  line-height: 1;
  font-weight: 700;
}

.score-value span {
  font-size: 16px;
  color: var(--ink-faint);
}

.score-unit {
  font-size: 11.5px;
}

.score-stats {
  flex: 1;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
}

.score-stats .stat-tile {
  box-shadow: none;
  background: var(--bg-sunken);
}

.score-stats .value small {
  font-size: 12px;
  color: var(--ink-faint);
  margin-left: 3px;
}

.review {
  margin-top: 26px;
}

.review-head {
  margin-bottom: 12px;
}

.review-count {
  font-size: 12px;
}

.review-item {
  padding: 20px 24px;
  margin-bottom: 14px;
}

.review-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.question-no {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12.5px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.item-score {
  margin-left: auto;
  font-size: 12px;
}

.answer-blocks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.answer-block {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.block-label {
  font-size: 11.5px;
  letter-spacing: 0.06em;
  color: var(--ink-faint);
}

.block-text {
  font-size: 13px;
  line-height: 1.75;
  color: var(--ink-soft);
  background: var(--bg-sunken);
  border-radius: var(--radius-sm);
  padding: 9px 12px;
  overflow-wrap: anywhere;
}

.block-text.correct {
  color: var(--success);
  background: var(--success-soft);
}

.result-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}

.retry {
  margin-top: 14px;
}

@media (max-width: 900px) {
  .score-card {
    flex-direction: column;
    align-items: stretch;
    gap: 18px;
  }
  .score-main {
    border-right: none;
    border-bottom: 1px solid var(--line);
    padding: 0 0 16px;
    align-items: flex-start;
  }
  .answer-blocks {
    grid-template-columns: 1fr;
  }
}
</style>
