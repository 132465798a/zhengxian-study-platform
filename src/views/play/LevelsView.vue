<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">LEVELS</p>
        <h1 class="page-title">{{ t.levels.title }}</h1>
        <p class="page-desc">{{ t.levels.desc }}</p>
      </div>
      <span v-if="stage === 'map' && levels.length > 0" class="progress num">
        {{ t.levels.progress(passedCount, levels.length) }}
      </span>
    </header>

    <template v-if="stage === 'map'">
      <div v-if="subjects.length > 0" class="subject-bar">
        <button
          v-for="item in subjects"
          :key="item.id"
          type="button"
          class="subject-chip"
          :class="{ on: item.id === subjectId }"
          :disabled="starting"
          @click="selectSubject(item.id)"
        >
          <i :class="item.icon" />
          {{ item.name }}
        </button>
      </div>

      <div v-if="loading || starting" class="paper-card panel">
        <div class="empty-state compact">
          <i class="pi pi-spin pi-spinner" />
          <div class="title">{{ t.common.status.loading }}</div>
        </div>
      </div>

      <div v-else-if="error" class="paper-card panel">
        <div class="empty-state compact">
          <i class="pi pi-exclamation-circle" />
          <div class="title">{{ t.common.status.error }}</div>
          <div class="hint">{{ error }}</div>
        </div>
      </div>

      <div v-else-if="levels.length === 0" class="paper-card panel">
        <div class="empty-state compact">
          <i class="pi pi-map" />
          <div class="title">{{ t.levels.empty }}</div>
        </div>
      </div>

      <section v-else class="level-grid">
        <button
          v-for="node in levels"
          :key="node.index"
          type="button"
          class="level-node"
          :class="node.status"
          :disabled="node.status === 'locked'"
          @click="openLevel(node)"
        >
          <span class="node-head">
            <span class="node-index num">{{ node.index + 1 }}</span>
            <i v-if="node.status === 'locked'" class="pi pi-lock" />
            <i v-else-if="node.status === 'passed'" class="pi pi-check-circle" />
          </span>
          <span class="node-name">{{ node.name }}</span>
          <span class="node-meta num">{{ t.levels.questionCount(node.questionCount) }}</span>
          <span class="node-foot">
            <span class="node-status">{{ statusText(node) }}</span>
            <span class="node-rate num">{{ rateText(node) }}</span>
          </span>
        </button>
      </section>
    </template>

    <template v-else-if="stage === 'quiz' && quiz">
      <div v-if="error" class="paper-card panel">
        <div class="empty-state compact">
          <i class="pi pi-exclamation-circle" />
          <div class="title">{{ t.common.status.error }}</div>
          <div class="hint">{{ error }}</div>
        </div>
      </div>
      <QuizRunner
        :questions="quiz.questions"
        :title="quiz.name"
        :submit-label="t.levels.submitLabel"
        :submitting="submitting"
        @submit="onSubmit"
      />
    </template>

    <template v-else-if="stage === 'result' && outcome">
      <section class="paper-card result-card">
        <div class="result-rate num" :class="outcome.passed ? 'pass' : 'fail'">{{ outcome.rate }}%</div>
        <p class="result-correct num">{{ t.levels.resultCorrect(outcome.correct, outcome.total) }}</p>
        <p class="result-status" :class="outcome.passed ? 'pass' : 'fail'">
          {{ outcome.passed ? t.levels.resultPassed : t.levels.resultFailed }}
        </p>
        <p class="result-text">{{ resultText }}</p>
        <p class="result-best num">{{ t.levels.bestRate(outcome.bestRate) }}</p>
        <div class="result-actions">
          <Button
            :label="t.levels.backToMap"
            icon="pi pi-map"
            size="small"
            outlined
            @click="backToMap"
          />
          <Button
            :label="t.levels.retry"
            icon="pi pi-refresh"
            size="small"
            :loading="starting"
            @click="retry"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import QuizRunner from '@/components/quiz/QuizRunner.vue'
import { contentApi, levelApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { t } from '@/i18n'
import type { LevelNode, LevelOutcome, LevelQuiz, QuizAnswerInput, Subject } from '@shared/types'

type Stage = 'map' | 'quiz' | 'result'

const auth = useAuthStore()

const grade = computed<number>(() => auth.currentUser?.grade ?? 1)
const subjects = ref<Subject[]>([])
const subjectId = ref<number | null>(null)
const levels = ref<LevelNode[]>([])
const stage = ref<Stage>('map')
const quiz = ref<LevelQuiz | null>(null)
const activeNode = ref<LevelNode | null>(null)
const outcome = ref<LevelOutcome | null>(null)
const loading = ref(true)
const starting = ref(false)
const submitting = ref(false)
const error = ref('')

const passedCount = computed<number>(
  () => levels.value.filter((node) => node.status === 'passed').length
)

const resultText = computed<string>(() => {
  if (!outcome.value) return ''
  if (!outcome.value.passed) return t.levels.failedTip
  return outcome.value.unlockedNext ? t.levels.passedTip : t.levels.allPassedTip
})

function statusText(node: LevelNode): string {
  if (node.status === 'passed') return t.levels.statusPassed
  if (node.status === 'current') return t.levels.statusCurrent
  return t.levels.statusLocked
}

function rateText(node: LevelNode): string {
  return node.bestRate === null ? t.levels.noAttempt : t.levels.bestRate(node.bestRate)
}

async function loadSubjects(): Promise<void> {
  try {
    subjects.value = await contentApi.subjects(grade.value)
    if (subjectId.value === null && subjects.value.length > 0) {
      subjectId.value = subjects.value[0].id
    }
  } catch (cause) {
    subjects.value = []
    error.value = cause instanceof Error ? cause.message : ''
  }
}

async function loadLevels(): Promise<void> {
  if (!auth.currentUser || subjectId.value === null) {
    levels.value = []
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    levels.value = await levelApi.list(auth.currentUser.id, subjectId.value, grade.value)
  } catch (cause) {
    levels.value = []
    error.value = cause instanceof Error ? cause.message : ''
  } finally {
    loading.value = false
  }
}

function selectSubject(id: number): void {
  if (subjectId.value === id) return
  subjectId.value = id
  void loadLevels()
}

async function openLevel(node: LevelNode): Promise<void> {
  if (!auth.currentUser || subjectId.value === null) return
  if (node.status === 'locked') return
  error.value = ''
  starting.value = true
  try {
    const data = await levelApi.start(
      auth.currentUser.id,
      subjectId.value,
      grade.value,
      node.index
    )
    activeNode.value = node
    quiz.value = data
    outcome.value = null
    stage.value = 'quiz'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : ''
  } finally {
    starting.value = false
  }
}

async function onSubmit(answers: QuizAnswerInput[]): Promise<void> {
  if (!auth.currentUser || !quiz.value) return
  const answered = new Map<number, unknown>(answers.map((item) => [item.questionId, item.answer]))
  const full: QuizAnswerInput[] = quiz.value.questions.map((question) => ({
    questionId: question.id,
    answer: answered.get(question.id) ?? null
  }))

  submitting.value = true
  error.value = ''
  try {
    outcome.value = await levelApi.submit({
      userId: auth.currentUser.id,
      subjectId: quiz.value.subjectId,
      grade: grade.value,
      levelIndex: quiz.value.levelIndex,
      answers: full
    })
    stage.value = 'result'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : ''
  } finally {
    submitting.value = false
  }
}

async function retry(): Promise<void> {
  if (!activeNode.value) return
  stage.value = 'map'
  await openLevel(activeNode.value)
}

function backToMap(): void {
  stage.value = 'map'
  quiz.value = null
  outcome.value = null
  void loadLevels()
}

onMounted(async () => {
  if (!auth.currentUser) {
    loading.value = false
    return
  }
  await loadSubjects()
  await loadLevels()
})
</script>

<style scoped>
.page {
  font-size: 13.5px;
}

.panel {
  padding: 14px 20px;
}

.progress {
  color: var(--ink-soft);
  font-size: 13px;
  letter-spacing: 0.04em;
}

.subject-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.subject-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--bg-raised);
  color: var(--ink-soft);
  font-size: 12.5px;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.subject-chip i {
  font-size: var(--icon-size);
  color: var(--ink-faint);
}

.subject-chip.on {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
}

.subject-chip.on i {
  color: var(--accent);
}

.subject-chip:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.level-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 12px;
}

.level-node {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 14px 16px;
  text-align: left;
  background: var(--bg-raised);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease;
}

.level-node:hover:not(:disabled) {
  border-color: var(--line-strong);
}

.level-node.passed {
  border-color: var(--line-strong);
  background: linear-gradient(180deg, var(--accent-soft), transparent 72%), var(--bg-raised);
}

.level-node.current {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.level-node.locked {
  opacity: 0.55;
  cursor: not-allowed;
}

.node-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--ink-faint);
}

.node-index {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
}

.node-name {
  color: var(--ink);
  font-size: 14px;
}

.node-meta {
  color: var(--ink-soft);
  font-size: 12px;
}

.node-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--line);
}

.node-status {
  color: var(--ink-faint);
  font-size: 12px;
}

.level-node.passed .node-status {
  color: var(--accent);
}

.level-node.current .node-status {
  color: var(--accent);
}

.node-rate {
  color: var(--ink-faint);
  font-size: 11.5px;
}

.result-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 20px;
  text-align: center;
}

.result-rate {
  font-size: 40px;
  line-height: 1;
  font-weight: 600;
}

.result-rate.pass {
  color: var(--accent);
}

.result-rate.fail {
  color: var(--danger);
}

.result-correct {
  margin: 0;
  color: var(--ink-soft);
  font-size: 13px;
}

.result-status {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.result-status.pass {
  color: var(--accent);
}

.result-status.fail {
  color: var(--danger);
}

.result-text {
  margin: 0;
  color: var(--ink);
  font-size: 13.5px;
}

.result-best {
  margin: 0;
  color: var(--ink-faint);
  font-size: 12px;
}

.result-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
</style>
