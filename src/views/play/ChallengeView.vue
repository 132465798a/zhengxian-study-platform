<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">CHALLENGE</p>
        <h1 class="page-title">{{ t.challenge.title }}</h1>
        <p class="page-desc">{{ t.challenge.desc }}</p>
      </div>
    </header>

    <div v-if="error" class="paper-card error-card">
      <i class="pi pi-exclamation-circle" />
      <div class="error-text">
        <strong>{{ t.challenge.errorTitle }}</strong>
        <p>{{ error }}</p>
      </div>
    </div>

    <QuizRunner
      v-if="state === 'playing' && data"
      :questions="data.questions"
      :total-seconds="60"
      :title="t.challenge.title"
      :submit-label="t.challenge.submitLabel"
      :submitting="submitting"
      @submit="onSubmit"
      @timeup="onTimeUp"
    />

    <section v-else-if="state === 'result' && outcome" class="paper-card result-card">
      <p class="result-label">{{ t.challenge.resultTitle }}</p>
      <div class="result-score num">{{ outcome.score }}</div>
      <p class="result-tag" :class="{ on: outcome.improved }">
        {{ outcome.improved ? t.challenge.improved : t.challenge.notImproved }}
      </p>

      <div class="result-grid">
        <div class="result-item">
          <span class="label">{{ t.challenge.correct }}</span>
          <span class="value num">{{ outcome.correct }}</span>
        </div>
        <div class="result-item">
          <span class="label">{{ t.challenge.wrong }}</span>
          <span class="value num">{{ outcome.wrong }}</span>
        </div>
        <div class="result-item">
          <span class="label">{{ t.challenge.bestScore }}</span>
          <span class="value num">{{ outcome.bestScore }}</span>
        </div>
      </div>

      <Button :label="t.challenge.again" icon="pi pi-refresh" @click="restart" />
    </section>

    <section v-else class="paper-card setup-card">
      <div class="setup-head">
        <h2 class="section-title">{{ t.challenge.rules }}</h2>
        <div class="stat-row">
          <div class="stat">
            <span class="label">{{ t.challenge.bestScore }}</span>
            <span class="value num">{{ data?.bestScore ?? 0 }}</span>
          </div>
          <div class="stat">
            <span class="label">{{ t.challenge.plays }}</span>
            <span class="value num">{{ data?.plays ?? 0 }}</span>
          </div>
        </div>
      </div>

      <ul class="rule-list">
        <li>
          <i class="pi pi-clock" />
          {{ t.challenge.ruleTime }}
        </li>
        <li>
          <i class="pi pi-check" />
          {{ t.challenge.ruleCorrect }}
        </li>
        <li>
          <i class="pi pi-times" />
          {{ t.challenge.ruleWrong }}
        </li>
        <li>
          <i class="pi pi-minus" />
          {{ t.challenge.ruleSkip }}
        </li>
      </ul>

      <label class="field">
        <span class="field-label">{{ t.challenge.subject }}</span>
        <Select
          v-model="subjectId"
          :options="subjects"
          option-label="name"
          option-value="id"
          @change="onSubjectChange"
        />
      </label>

      <div class="setup-foot">
        <Button
          :label="loading ? t.challenge.loading : t.challenge.start"
          icon="pi pi-bolt"
          :loading="loading"
          :disabled="submitting || !subjectId"
          @click="startGame"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import QuizRunner from '@/components/quiz/QuizRunner.vue'
import { challengeApi, contentApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { t } from '@/i18n'
import type { ChallengeOutcome, QuizAnswerInput, Subject, TimedChallenge } from '@shared/types'

type ViewState = 'idle' | 'playing' | 'result'

const auth = useAuthStore()

const state = ref<ViewState>('idle')
const subjects = ref<Subject[]>([])
const subjectId = ref<number | null>(null)
const data = ref<TimedChallenge | null>(null)
const outcome = ref<ChallengeOutcome | null>(null)
const loading = ref(false)
const submitting = ref(false)
const error = ref('')

const grade = computed<number>(() => auth.currentUser?.grade ?? auth.currentGrade)

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : ''
}

async function loadPreview(): Promise<boolean> {
  if (!auth.currentUser || !subjectId.value) return false
  loading.value = true
  error.value = ''
  data.value = null
  try {
    data.value = await challengeApi.start(auth.currentUser.id, subjectId.value, grade.value)
    return true
  } catch (cause) {
    error.value = messageOf(cause)
    return false
  } finally {
    loading.value = false
  }
}

async function loadSubjects(): Promise<void> {
  if (!auth.currentUser) return
  try {
    subjects.value = await contentApi.subjects(grade.value)
    subjectId.value = subjects.value[0]?.id ?? null
    if (subjects.value.length === 0) error.value = t.challenge.noSubject
  } catch (cause) {
    error.value = messageOf(cause)
  }
}

async function startGame(): Promise<void> {
  if (loading.value || submitting.value) return
  error.value = ''
  if (!data.value) {
    const ok = await loadPreview()
    if (!ok) return
  }
  if (data.value) state.value = 'playing'
}

async function submitAnswers(answers: QuizAnswerInput[]): Promise<void> {
  if (submitting.value || !auth.currentUser || !subjectId.value) return
  submitting.value = true
  error.value = ''
  try {
    outcome.value = await challengeApi.submit({
      userId: auth.currentUser.id,
      subjectId: subjectId.value,
      grade: grade.value,
      answers
    })
    state.value = 'result'
  } catch (cause) {
    error.value = messageOf(cause)
  } finally {
    submitting.value = false
  }
}

function onSubmit(answers: QuizAnswerInput[]): void {
  void submitAnswers(answers)
}

function onTimeUp(answers: QuizAnswerInput[]): void {
  void submitAnswers(answers)
}

async function onSubjectChange(): Promise<void> {
  state.value = 'idle'
  outcome.value = null
  await loadPreview()
}

async function restart(): Promise<void> {
  state.value = 'idle'
  outcome.value = null
  const ok = await loadPreview()
  if (ok) state.value = 'playing'
}

onMounted(async () => {
  if (!auth.currentUser) {
    error.value = t.challenge.noUser
    return
  }
  await loadSubjects()
  if (subjectId.value) await loadPreview()
})
</script>

<style scoped>
.page {
  font-size: 13.5px;
}

.error-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 14px;
  border: 1px solid var(--line);
}

.error-card > i {
  color: var(--danger);
  font-size: 16px;
  margin-top: 2px;
}

.error-text strong {
  display: block;
  font-size: 13.5px;
  color: var(--ink);
  margin-bottom: 4px;
}

.error-text p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 12.5px;
  line-height: 1.7;
}

.setup-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 620px;
}

.setup-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px dashed var(--line);
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 26px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: right;
}

.stat .label {
  font-size: 11.5px;
  letter-spacing: 0.06em;
  color: var(--ink-faint);
}

.stat .value {
  font-size: 22px;
  line-height: 1.2;
  color: var(--ink);
}

.rule-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
}

.rule-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  color: var(--ink-soft);
  font-size: 12.5px;
  background: var(--bg-sunken);
}

.rule-list i {
  color: var(--accent);
  font-size: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 240px;
}

.field-label {
  font-size: 11.5px;
  letter-spacing: 0.08em;
  color: var(--ink-faint);
}

.setup-foot {
  padding-top: 14px;
  border-top: 1px dashed var(--line);
}

.result-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 520px;
  padding: 28px 24px;
  text-align: center;
}

.result-label {
  margin: 0;
  color: var(--ink-faint);
  font-size: 12px;
  letter-spacing: 0.12em;
}

.result-score {
  font-size: 60px;
  line-height: 1.05;
  color: var(--ink);
}

.result-tag {
  margin: 0;
  padding: 3px 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  color: var(--ink-faint);
  font-size: 12px;
}

.result-tag.on {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
  margin: 8px 0 6px;
}

.result-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--bg-sunken);
}

.result-item .label {
  font-size: 11.5px;
  color: var(--ink-faint);
}

.result-item .value {
  font-size: 22px;
  line-height: 1.2;
  color: var(--ink);
}

@media (max-width: 700px) {
  .rule-list {
    grid-template-columns: 1fr;
  }

  .setup-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .stat {
    text-align: left;
  }
}
</style>
