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

    <template v-else-if="exam.session">
      <header class="paper-card exam-bar">
        <div class="bar-left">
          <div class="bar-title">
            <span class="muted">{{ t.exam.doTitle }}</span>
            <strong>{{ exam.session.paper.title }}</strong>
          </div>
          <div class="bar-progress">
            <ProgressBar :value="exam.progress" :show-value="false" />
          </div>
          <span class="progress-text num muted">{{ exam.answeredCount }} / {{ exam.total }}</span>
        </div>

        <div class="bar-center" :class="{ danger: exam.remainingSec < 60 }">
          <span class="clock-label">{{ t.exam.remaining }}</span>
          <span class="clock num">{{ formatClock(exam.remainingSec) }}</span>
        </div>

        <div class="bar-right">
          <span v-if="exam.answeredCount < exam.total" class="unanswered-hint">
            {{ t.exam.unansweredHint(exam.total - exam.answeredCount) }}
          </span>
          <Button
            :label="t.exam.submit"
            icon="pi pi-send"
            severity="danger"
            size="small"
            @click="confirmVisible = true"
          />
        </div>
      </header>

      <div class="exam-body">
        <section class="paper-card question-panel">
          <div v-if="exam.currentQuestion" class="question-content">
            <div class="question-head">
              <span class="question-no num">
                {{ exam.currentIndex + 1 }} / {{ exam.total }}
              </span>
              <Tag
                :value="t.common.questionTypes[exam.currentQuestion.type]"
                severity="secondary"
              />
            </div>

            <QuestionRenderer
              :question="exam.currentQuestion"
              :model-value="exam.answers[exam.currentQuestion.id]"
              @update:model-value="onAnswer"
            />
          </div>

          <div v-else class="empty-state">
            <i class="pi pi-file" />
            <div class="title">{{ t.common.status.empty }}</div>
          </div>

          <footer class="question-foot spread">
            <Button
              :label="t.practice.prevQuestion"
              icon="pi pi-arrow-left"
              size="small"
              text
              :disabled="exam.currentIndex === 0"
              @click="exam.goTo(exam.currentIndex - 1)"
            />
            <Button
              :label="t.practice.nextQuestion"
              icon="pi pi-arrow-right"
              icon-pos="right"
              size="small"
              :disabled="exam.currentIndex >= exam.total - 1"
              @click="exam.goTo(exam.currentIndex + 1)"
            />
          </footer>
        </section>

        <aside class="paper-card answer-panel">
          <h2 class="section-title">{{ t.exam.questionCard }}</h2>

          <div class="answer-grid">
            <button
              v-for="(entry, index) in exam.questions"
              :key="entry.questionId"
              type="button"
              class="answer-cell num"
              :class="{
                answered: hasAnswer(exam.answers[entry.questionId]),
                current: index === exam.currentIndex
              }"
              @click="exam.goTo(index)"
            >
              {{ index + 1 }}
            </button>
          </div>

          <div class="answer-legend">
            <span class="legend-item">
              <i class="legend-dot answered" />
              {{ t.exam.answered }}
            </span>
            <span class="legend-item">
              <i class="legend-dot" />
              {{ t.exam.unanswered }}
            </span>
          </div>
        </aside>
      </div>
    </template>

    <Dialog
      v-model:visible="confirmVisible"
      modal
      :header="t.exam.submitConfirmTitle"
      :style="{ width: '380px' }"
      :dismissable-mask="false"
      :draggable="false"
    >
      <p class="confirm-text">{{ t.exam.submitConfirm }}</p>
      <template #footer>
        <Button :label="t.common.actions.cancel" text @click="confirmVisible = false" />
        <Button
          :label="t.exam.submit"
          severity="danger"
          :loading="submitting"
          @click="submitExam"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ProgressBar from 'primevue/progressbar'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import QuestionRenderer from '@/components/question/QuestionRenderer.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useExamStore } from '@/stores/exam.store'
import { t } from '@/i18n'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const exam = useExamStore()
const toast = useToast()

const recordId = Number(route.params.recordId)
const loading = ref(true)
const loadError = ref('')
const confirmVisible = ref(false)
const submitting = ref(false)
const finished = ref(false)

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : t.common.status.error
}

function formatClock(total: number): string {
  const safe = Math.max(0, total)
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function hasAnswer(value: unknown): boolean {
  return value !== null && value !== undefined && value !== ''
}

function onAnswer(value: unknown): void {
  const question = exam.currentQuestion
  if (!question) return
  void exam.saveAnswer(question.id, value)
}

async function onTimeUp(): Promise<void> {
  if (finished.value || submitting.value) return
  submitting.value = true
  try {
    await exam.submit()
    finished.value = true
    toast.add({
      severity: 'info',
      summary: t.exam.timeUp,
      detail: t.exam.autoSubmit,
      life: 4000
    })
    await router.replace(`/exam/${recordId}/result`)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t.common.status.error,
      detail: errorText(error),
      life: 4000
    })
  } finally {
    submitting.value = false
  }
}

async function submitExam(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  try {
    await exam.submit()
    finished.value = true
    confirmVisible.value = false
    await router.replace(`/exam/${recordId}/result`)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t.common.status.error,
      detail: errorText(error),
      life: 4000
    })
  } finally {
    submitting.value = false
  }
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
    const session = await exam.load(auth.currentUser.id, recordId)
    if (session.record.status !== 'doing') {
      finished.value = true
      await router.replace(`/exam/${recordId}/result`)
      return
    }
    exam.startTimer(onTimeUp)
  } catch (error) {
    loadError.value = errorText(error)
  } finally {
    loading.value = false
  }
}

onMounted(load)
onBeforeUnmount(() => exam.clearTimer())

onBeforeRouteLeave(() => {
  if (finished.value) return true
  return window.confirm(t.exam.leaveConfirm)
})
</script>

<style scoped>
.exam-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 18px;
  margin-bottom: 18px;
  background: var(--bg-sunken);
}

.bar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.bar-title {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.bar-title .muted {
  font-size: 11px;
  letter-spacing: 0.08em;
}

.bar-title strong {
  font-family: var(--font-display);
  font-size: 15px;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-progress {
  width: 130px;
  flex-shrink: 0;
}

.bar-progress :deep(.p-progressbar) {
  height: 6px;
  border-radius: 999px;
  background: var(--bg);
}

.bar-progress :deep(.p-progressbar-value) {
  background: var(--accent);
}

.progress-text {
  font-size: 12px;
  flex-shrink: 0;
}

.bar-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  min-width: 92px;
}

.clock-label {
  font-size: 11px;
  color: var(--ink-faint);
  letter-spacing: 0.06em;
}

.clock {
  font-size: 25px;
  line-height: 1.1;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.bar-center.danger .clock {
  color: var(--danger);
}

.bar-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex: 1;
}

.unanswered-hint {
  font-size: 12px;
  color: var(--ink-soft);
  white-space: nowrap;
}

.exam-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 250px;
  gap: 18px;
  align-items: start;
}

.question-panel {
  padding: 22px 26px 16px;
  min-height: 420px;
  display: flex;
  flex-direction: column;
}

.question-content {
  flex: 1;
}

.question-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.question-no {
  font-size: 13px;
  color: var(--ink-faint);
  letter-spacing: 0.06em;
}

.question-foot {
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.answer-panel {
  position: sticky;
  top: 86px;
  padding: 18px 18px 16px;
}

.answer-panel .section-title {
  margin-bottom: 14px;
}

.answer-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.answer-cell {
  aspect-ratio: 1;
  border-radius: var(--radius);
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--ink-soft);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.1s ease, border-color 0.1s ease, color 0.1s ease;
}

.answer-cell:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.answer-cell.answered {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-contrast);
}

.answer-cell.current {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.answer-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--ink-faint);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  border: 1px solid var(--line-strong);
}

.legend-dot.answered {
  background: var(--accent);
  border-color: var(--accent);
}

.confirm-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--ink-soft);
}

.retry {
  margin-top: 14px;
}

@media (max-width: 960px) {
  .exam-bar {
    flex-wrap: wrap;
    gap: 10px 18px;
  }
  .bar-left {
    flex-basis: 100%;
  }
  .bar-right {
    flex: 0;
  }
  .exam-body {
    grid-template-columns: 1fr;
  }
  .answer-panel {
    position: static;
  }
}
</style>
