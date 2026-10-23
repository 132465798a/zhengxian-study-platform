<template>
  <div class="page do-page">
    <header class="do-head">
      <div class="head-left">
        <Button icon="pi pi-arrow-left" text rounded size="small" @click="leave" />
        <div>
          <h1 class="do-title">{{ store.session?.paper.title ?? t.practice.doTitle }}</h1>
          <p class="do-sub">
            {{ t.practice.progress(store.answeredCount, store.total) }} ·
            {{ t.practice.elapsed }} <span class="num">{{ elapsedText }}</span>
            <span v-if="comboText" class="combo-tag">{{ comboText }}</span>
          </p>
        </div>
      </div>
      <div class="head-right">
        <div class="progress-track">
          <span class="progress-fill" :style="{ width: `${store.progress}%` }" />
        </div>
        <Button
          :label="t.practice.finish"
          icon="pi pi-flag"
          size="small"
          severity="secondary"
          outlined
          @click="askFinish"
        />
      </div>
    </header>

    <div v-if="loadError" class="paper-card error-state">
      <div class="empty-state">
        <i class="pi pi-exclamation-circle" />
        <div class="title">{{ loadError }}</div>
        <Button :label="t.common.actions.back" text @click="router.push('/practice/setup')" />
      </div>
    </div>

    <div v-else-if="!question" class="loading">{{ t.common.status.loading }}</div>

    <div v-else class="do-grid">
      <section class="paper-card question-card">
        <div class="question-meta">
          <span class="index num">{{ store.currentIndex + 1 }}</span>
          <span class="total">/ {{ store.total }}</span>
          <span class="knowledge" v-if="question.knowledgeName">{{ question.knowledgeName }}</span>
          <Tag
            v-if="isCustomQuestionId(question.id)"
            :value="t.common.generated"
            severity="info"
          />
        </div>

        <QuestionRenderer
          v-model="draft"
          :question="question"
          :readonly="Boolean(outcome)"
          :show-correct="Boolean(outcome)"
          :correct-answer="outcome?.correctAnswer ?? question.answer"
        />

        <transition name="fade">
          <div v-if="outcome" class="feedback" :class="feedbackClass">
            <div v-if="outcome.solution" class="feedback-body">
              <span class="label">{{ t.practice.solution }}</span>
              <LatexText :text="outcome.solution" />
            </div>
            <span v-if="outcome.isCorrect !== null" class="feedback-score num">
              +{{ outcome.score }}
            </span>
          </div>
        </transition>

        <footer class="question-actions">
          <Button
            :label="t.practice.prevQuestion"
            icon="pi pi-arrow-left"
            text
            :disabled="store.currentIndex === 0"
            @click="store.prev()"
          />
          <div class="action-main">
            <Button
              v-if="!outcome"
              :label="t.practice.submitAnswer"
              icon="pi pi-check"
              :loading="store.saving"
              @click="submitCurrent"
            />
            <Button
              v-if="store.currentIndex < store.total - 1"
              :label="t.practice.nextQuestion"
              icon="pi pi-arrow-right"
              icon-pos="right"
              severity="secondary"
              outlined
              @click="goNext"
            />
            <Button
              v-else
              :label="t.practice.finish"
              icon="pi pi-flag"
              icon-pos="right"
              severity="secondary"
              outlined
              @click="askFinish"
            />
          </div>
        </footer>
      </section>

      <AnswerSheet
        :question-ids="questionIds"
        :current-index="store.currentIndex"
        :answered-count="store.answeredCount"
        :outcomes="store.outcomes"
        @go="store.goTo"
        @finish="askFinish"
      />
    </div>

    <Dialog
      v-model:visible="finishDialog"
      modal
      :header="t.practice.finish"
      :style="{ width: '380px' }"
      :dismissable-mask="false"
      :draggable="false"
    >
      <p class="confirm-text">
        {{ unansweredCount > 0 ? t.practice.finishConfirm : t.practice.progress(store.answeredCount, store.total) }}
      </p>
      <template #footer>
        <Button :label="t.common.actions.cancel" text @click="finishDialog = false" />
        <Button :label="t.practice.finish" :loading="finishing" @click="doFinish" />
      </template>
    </Dialog>

    <Toast position="bottom-right" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import QuestionRenderer from '@/components/question/QuestionRenderer.vue'
import LatexText from '@/components/text/LatexText.vue'
import AnswerSheet from '@/components/practice/AnswerSheet.vue'
import { useAuthStore } from '@/stores/auth.store'
import { usePracticeStore } from '@/stores/practice.store'
import { t } from '@/i18n'
import { isCustomQuestionId, comboMultiplier } from '@shared/constants'
import type { QuestionType, SessionResult } from '@shared/types'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const store = usePracticeStore()

const draft = ref<unknown>(null)
const elapsed = ref(0)
const finishing = ref(false)
const finishDialog = ref(false)
const loadError = ref('')
let timer: number | null = null

const recordId = computed(() => Number(route.params.recordId))
const questionIds = computed(() => store.questions.map((item) => item.questionId))
const question = computed(() => store.currentQuestion)
const outcome = computed(() =>
  question.value ? store.outcomes[question.value.id] : undefined
)
const comboStreak = computed(() => {
  let streak = 0
  for (const item of store.questions) {
    const result = store.outcomes[item.questionId]
    if (!result) break
    if (result.isCorrect === true) streak += 1
    else if (result.isCorrect === false) streak = 0
  }
  return streak
})
const comboText = computed(() =>
  comboStreak.value >= 3
    ? t.incentive.practiceCombo(comboStreak.value, comboMultiplier(comboStreak.value))
    : ''
)
const unansweredCount = computed(() => store.total - store.answeredCount)

const elapsedText = computed(() => {
  const minutes = Math.floor(elapsed.value / 60)
  const seconds = elapsed.value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

const feedbackClass = computed(() => {
  if (!outcome.value) return ''
  if (outcome.value.isCorrect === true) return 'ok'
  if (outcome.value.isCorrect === false) return 'bad'
  return 'pending'
})

function defaultAnswer(type: QuestionType): unknown {
  switch (type) {
    case 'multiple':
    case 'fill':
    case 'cloze':
    case 'sorting':
      return []
    case 'matching':
      return {}
    case 'short_answer':
    case 'calculation':
      return ''
    default:
      return null
  }
}

function isAnswered(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false
  if (Array.isArray(value)) return value.some((item) => item !== '' && item !== null)
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0
  return true
}

function syncDraft(): void {
  if (!question.value) {
    draft.value = null
    return
  }
  const existing = store.answers[question.value.id]
  draft.value = existing !== undefined ? existing : defaultAnswer(question.value.type)
}

watch(question, syncDraft)

async function submitCurrent(): Promise<void> {
  if (!question.value) return
  if (!isAnswered(draft.value)) {
    toast.add({
      severity: 'warn',
      summary: t.common.status.error,
      detail: t.practice.answerRequired,
      life: 2200
    })
    return
  }
  try {
    await store.submit(question.value.id, draft.value)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t.common.status.error,
      detail: error instanceof Error ? error.message : t.common.status.error,
      life: 3000
    })
  }
}

function goNext(): void {
  if (store.currentIndex < store.total - 1) store.next()
}

function askFinish(): void {
  finishDialog.value = true
}

function settleQuery(result: SessionResult): Record<string, string> {
  const query: Record<string, string> = {}
  if (result.growthGained !== undefined) query.gained = String(result.growthGained)
  if (result.unlockedAchievements?.length) query.unlocked = result.unlockedAchievements.join(',')
  return query
}

async function doFinish(): Promise<void> {
  finishing.value = true
  try {
    const finished = await store.finish()
    finishDialog.value = false
    router.push({ path: `/practice/${recordId.value}/result`, query: settleQuery(finished) })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t.common.status.error,
      detail: error instanceof Error ? error.message : t.common.status.error,
      life: 3000
    })
  } finally {
    finishing.value = false
  }
}

function leave(): void {
  router.push('/practice/setup')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter') return
  const target = event.target as HTMLElement
  if (target.tagName === 'TEXTAREA') return
  if (question.value && !store.outcomes[question.value.id]) {
    void submitCurrent()
  } else {
    goNext()
  }
}

onMounted(async () => {
  if (!auth.currentUser) return
  try {
    if (store.session?.record.id !== recordId.value) {
      await store.load(auth.currentUser.id, recordId.value)
    }
    syncDraft()
    elapsed.value = Math.max(
      0,
      Math.round((Date.now() - new Date(store.session!.record.startedAt).getTime()) / 1000)
    )
    timer = window.setInterval(() => {
      elapsed.value += 1
    }, 1000)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : t.common.status.error
  }
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  if (timer !== null) window.clearInterval(timer)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.do-page {
  max-width: 1240px;
}

.do-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.do-title {
  font-size: 18px;
  letter-spacing: 0.03em;
}

.do-sub {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--ink-faint);
}

.combo-tag {
  margin-left: 8px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
}

.head-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.progress-track {
  width: 160px;
  height: 6px;
  border-radius: 999px;
  background: var(--bg-sunken);
  overflow: hidden;
}

.progress-fill {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 0.1s ease;
}

.do-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 268px;
  gap: 16px;
  align-items: start;
}

.question-card {
  padding: 22px 24px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 460px;
}

.question-meta {
  display: flex;
  align-items: baseline;
  gap: 5px;
  color: var(--ink-faint);
}

.question-meta .index {
  font-size: 24px;
  color: var(--accent);
}

.question-meta .total {
  font-size: 12px;
}

.knowledge {
  margin-left: auto;
  font-size: 11.5px;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--bg-sunken);
  color: var(--ink-soft);
}

.feedback {
  border-radius: var(--radius);
  padding: 13px 16px;
  background: var(--bg-sunken);
  position: relative;
  padding-right: 52px;
}

.feedback.ok {
  background: var(--success-soft);
}

.feedback.bad {
  background: var(--danger-soft);
}

.feedback.pending {
  background: var(--bg-sunken);
}

.feedback-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
}

.feedback.ok .feedback-head {
  color: var(--success);
}

.feedback.bad .feedback-head {
  color: var(--danger);
}

.feedback.pending .feedback-head {
  color: var(--ink-soft);
}

.feedback-score {
  position: absolute;
  top: 11px;
  right: 14px;
  font-size: 12.5px;
  color: var(--ink-faint);
}

.feedback-body {
  font-size: 13px;
  line-height: 1.85;
  color: var(--ink-soft);
}

.feedback-body .label {
  display: block;
  font-size: 11.5px;
  letter-spacing: 0.08em;
  color: var(--ink-faint);
  margin-bottom: 3px;
}

.question-actions {
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.action-main {
  display: flex;
  gap: 10px;
}

.confirm-text {
  font-size: 13.5px;
  line-height: 1.8;
  color: var(--ink-soft);
}

.loading {
  padding: 80px 0;
  text-align: center;
  color: var(--ink-faint);
}

.error-state {
  padding: 30px;
}

@media (max-width: 1080px) {
  .do-grid {
    grid-template-columns: 1fr;
  }
  .sheet {
    position: static;
  }
}
</style>
