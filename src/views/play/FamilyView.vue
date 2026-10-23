<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">{{ t.family.desc }}</p>
        <h1 class="page-title">{{ t.family.title }}</h1>
      </div>
      <Button
        v-if="activeId === null && !creating"
        :label="t.family.newMatch"
        icon="pi pi-plus"
        size="small"
        @click="openCreate"
      />
    </header>

    <template v-if="activeId === null">
      <section v-if="creating" class="paper-card panel form-card">
        <h2 class="form-title">{{ t.family.createTitle }}</h2>

        <div class="field-grid">
          <label class="field">
            <span class="field-label">{{ t.family.titleField }}</span>
            <InputText
              v-model="formTitle"
              :placeholder="t.family.titlePlaceholder"
              maxlength="40"
            />
          </label>
          <label class="field">
            <span class="field-label">{{ t.family.subject }}</span>
            <Select
              v-model="formSubjectId"
              :options="subjects"
              option-label="name"
              option-value="id"
              :placeholder="t.family.subjectPlaceholder"
            />
          </label>
        </div>

        <div class="field-grid">
          <label class="field">
            <span class="field-label">{{ t.family.count }}</span>
            <InputNumber v-model="formCount" :min="5" :max="20" show-buttons />
          </label>
          <label class="field">
            <span class="field-label">{{ t.family.endDate }}</span>
            <DatePicker
              v-model="formEndDate"
              date-format="yy-mm-dd"
              show-icon
              :min-date="today"
              :placeholder="t.family.endDatePlaceholder"
            />
          </label>
        </div>

        <p class="field-hint">
          {{ t.family.countHint }} · {{ t.family.endDateHint }} ·
          {{ t.family.gradeLabel(grade) }}
        </p>

        <p v-if="createError" class="error-text">{{ createError }}</p>

        <div class="form-actions">
          <Button
            :label="t.family.cancel"
            size="small"
            text
            :disabled="submitting"
            @click="cancelCreate"
          />
          <Button
            :label="t.family.create"
            size="small"
            :loading="submitting"
            @click="createMatch"
          />
        </div>
      </section>

      <div v-if="loading" class="paper-card panel">
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
          <Button :label="t.common.actions.retry" size="small" text @click="loadList" />
        </div>
      </div>

      <div v-else-if="matches.length === 0" class="paper-card panel">
        <div class="empty-state compact">
          <i class="pi pi-users" />
          <div class="title">{{ t.family.emptyTitle }}</div>
          <div class="hint">{{ t.family.emptyHint }}</div>
        </div>
      </div>

      <section v-else class="match-grid">
        <article
          v-for="match in matches"
          :key="match.id"
          class="match-card"
          :class="{ joined: match.joined }"
        >
          <div class="card-head">
            <h2 class="card-title">{{ match.title }}</h2>
            <span class="card-tag" :class="tagClass(match)">{{ tagText(match) }}</span>
          </div>

          <p class="card-meta">
            {{ match.subjectName }} · {{ t.family.gradeLabel(match.grade) }} ·
            {{ t.family.questionCount(match.questionCount) }}
          </p>
          <p class="card-meta">
            {{ isEnded(match) ? t.family.ended : deadlineText(match) }}
          </p>

          <div class="card-foot">
            <span class="count num">{{ t.family.participants(match.entryCount) }}</span>
            <Button
              size="small"
              :label="match.joined ? t.family.viewRank : t.family.join"
              :disabled="!canEnter(match)"
              @click="openMatch(match)"
            />
          </div>
        </article>
      </section>
    </template>

    <template v-else>
      <div class="detail-head">
        <Button
          :label="t.family.backToList"
          icon="pi pi-arrow-left"
          size="small"
          text
          @click="back"
        />
        <span v-if="detail" class="detail-meta">
          {{ detail.subjectName }} · {{ t.family.gradeLabel(detail.grade) }} ·
          {{ t.family.questionCount(detail.questionCount) }}
        </span>
      </div>

      <div v-if="detailLoading" class="paper-card panel">
        <div class="empty-state compact">
          <i class="pi pi-spin pi-spinner" />
          <div class="title">{{ t.common.status.loading }}</div>
        </div>
      </div>

      <div v-else-if="!detail" class="paper-card panel">
        <div class="empty-state compact">
          <i class="pi pi-exclamation-circle" />
          <div class="title">{{ t.common.status.error }}</div>
          <div class="hint">{{ detailError }}</div>
        </div>
      </div>

      <template v-else>
        <section v-if="outcome" class="paper-card panel result-card">
          <span class="result-label">{{ t.family.resultTitle }}</span>
          <strong class="result-value num">
            {{ t.family.scoreText(outcome.correct, outcome.total) }}
          </strong>
          <span class="result-meta num">
            {{ t.family.durationText(t.common.formatDuration(outcome.durationSec)) }}
          </span>
        </section>

        <section v-else-if="!detail.joined" class="paper-card panel runner-card">
          <QuizRunner
            :questions="detail.questions"
            :title="detail.title"
            :submit-label="t.family.submitLabel"
            :submitting="submitting"
            @submit="submitAnswers"
          />
          <p v-if="detailError" class="error-text">{{ detailError }}</p>
        </section>

        <section class="paper-card panel board-card">
          <h2 class="board-title">{{ t.family.leaderboard }}</h2>

          <div v-if="boardEntries.length === 0" class="empty-state compact">
            <i class="pi pi-users" />
            <div class="title">{{ t.family.noEntries }}</div>
          </div>

          <template v-else>
            <div class="board-row board-head">
              <span class="rank">{{ t.family.rank }}</span>
              <span class="name">{{ t.family.player }}</span>
              <span class="score">{{ t.family.score }}</span>
              <span class="duration">{{ t.family.duration }}</span>
            </div>

            <ol class="board">
              <li
                v-for="(entry, index) in boardEntries"
                :key="entry.userId"
                class="board-row"
                :class="{ me: entry.userId === currentUserId }"
              >
                <span class="rank num">{{ index + 1 }}</span>
                <span class="name">{{ entry.name || t.common.studentFallback }}</span>
                <span class="score num">
                  {{ t.family.scoreText(entry.correct, entry.total) }}
                </span>
                <span class="duration num">
                  {{ t.common.formatDuration(entry.durationSec) }}
                </span>
              </li>
            </ol>
          </template>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import QuizRunner from '@/components/quiz/QuizRunner.vue'
import { contentApi, familyApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { t } from '@/i18n'
import type {
  FamilyEntry,
  FamilyMatchDetail,
  FamilyMatchSummary,
  FamilyOutcome,
  QuizAnswerInput,
  Subject
} from '@shared/types'

const auth = useAuthStore()

const matches = ref<FamilyMatchSummary[]>([])
const loading = ref(true)
const error = ref('')
const creating = ref(false)
const submitting = ref(false)
const createError = ref('')

const subjects = ref<Subject[]>([])
const formTitle = ref('')
const formSubjectId = ref<number | null>(null)
const formCount = ref<number>(10)
const formEndDate = ref<Date | null>(null)
const today = new Date()

const activeId = ref<number | null>(null)
const detail = ref<FamilyMatchDetail | null>(null)
const detailLoading = ref(false)
const detailError = ref('')
const outcome = ref<FamilyOutcome | null>(null)

const grade = computed<number>(() => auth.currentUser?.grade ?? 1)
const currentUserId = computed<number | null>(() => auth.currentUser?.id ?? null)
const boardEntries = computed<FamilyEntry[]>(
  () => outcome.value?.entries ?? detail.value?.entries ?? []
)

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : ''
}

function formatDate(value: Date | null): string | null {
  if (!value) return null
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localToday(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function isEnded(match: FamilyMatchSummary): boolean {
  return match.endDate !== null && match.endDate.slice(0, 10) < localToday()
}

function canEnter(match: FamilyMatchSummary): boolean {
  return match.joined || !isEnded(match)
}

function deadlineText(match: FamilyMatchSummary): string {
  return match.endDate ? t.family.deadline(match.endDate.slice(0, 10)) : t.family.noDeadline
}

function tagText(match: FamilyMatchSummary): string {
  if (match.joined) return t.family.joined
  return isEnded(match) ? t.family.ended : t.family.open
}

function tagClass(match: FamilyMatchSummary): string {
  if (match.joined) return 'joined'
  return isEnded(match) ? 'ended' : 'open'
}

async function loadList(): Promise<void> {
  if (!auth.currentUser) {
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    matches.value = await familyApi.list(auth.currentUser.id)
  } catch (cause) {
    error.value = messageOf(cause)
  } finally {
    loading.value = false
  }
}

async function loadSubjects(): Promise<void> {
  try {
    subjects.value = await contentApi.subjects(grade.value)
  } catch {
    subjects.value = []
  }
  if (!subjects.value.some((item) => item.id === formSubjectId.value)) {
    formSubjectId.value = subjects.value[0]?.id ?? null
  }
}

function openCreate(): void {
  creating.value = true
  createError.value = ''
  formTitle.value = ''
  formCount.value = 10
  formEndDate.value = null
  if (!subjects.value.some((item) => item.id === formSubjectId.value)) {
    formSubjectId.value = subjects.value[0]?.id ?? null
  }
}

function cancelCreate(): void {
  creating.value = false
  createError.value = ''
}

async function createMatch(): Promise<void> {
  if (!auth.currentUser || submitting.value) return
  const subjectId = formSubjectId.value
  if (!subjectId) {
    createError.value = t.family.subjectRequired
    return
  }
  submitting.value = true
  createError.value = ''
  try {
    const created = await familyApi.create({
      userId: auth.currentUser.id,
      subjectId,
      grade: grade.value,
      title: formTitle.value,
      count: formCount.value,
      endDate: formatDate(formEndDate.value)
    })
    matches.value = [created, ...matches.value]
    creating.value = false
  } catch (cause) {
    createError.value = messageOf(cause)
  } finally {
    submitting.value = false
  }
}

async function openMatch(match: FamilyMatchSummary): Promise<void> {
  if (!auth.currentUser) return
  activeId.value = match.id
  detail.value = null
  outcome.value = null
  detailError.value = ''
  detailLoading.value = true
  try {
    detail.value = await familyApi.get(auth.currentUser.id, match.id)
  } catch (cause) {
    detailError.value = messageOf(cause)
  } finally {
    detailLoading.value = false
  }
}

async function submitAnswers(answers: QuizAnswerInput[], durationSec: number): Promise<void> {
  const current = detail.value
  if (!auth.currentUser || !current || submitting.value) return
  const given = new Map(answers.map((item) => [item.questionId, item.answer]))
  const completed: QuizAnswerInput[] = current.questions.map((question) => ({
    questionId: question.id,
    answer: given.has(question.id) ? given.get(question.id) : null
  }))

  submitting.value = true
  detailError.value = ''
  try {
    const result = await familyApi.submit({
      userId: auth.currentUser.id,
      matchId: current.id,
      answers: completed,
      durationSec
    })
    outcome.value = result
    matches.value = matches.value.map((item) =>
      item.id === current.id
        ? { ...item, joined: true, entryCount: result.entries.length }
        : item
    )
  } catch (cause) {
    detailError.value = messageOf(cause)
  } finally {
    submitting.value = false
  }
}

function back(): void {
  activeId.value = null
  detail.value = null
  outcome.value = null
  detailError.value = ''
  void loadList()
}

onMounted(async () => {
  await Promise.all([loadList(), loadSubjects()])
})
</script>

<style scoped>
.page {
  font-size: 13.5px;
}

.panel {
  padding: 18px 20px;
}

.form-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
}

.form-title {
  font-size: 15px;
  color: var(--ink);
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field :deep(.p-datepicker) {
  width: 100%;
}

.field-label {
  font-size: 12.5px;
  color: var(--ink-soft);
}

.field-hint {
  margin: 0;
  font-size: 11.5px;
  color: var(--ink-faint);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.error-text {
  margin: 0;
  color: var(--danger);
  font-size: 12.5px;
}

.match-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.match-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 18px;
  background: var(--bg-raised);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.match-card.joined {
  border-color: var(--line-strong);
  background: linear-gradient(180deg, var(--accent-soft), transparent 72%), var(--bg-raised);
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.card-title {
  font-size: 14.5px;
  color: var(--ink);
  line-height: 1.5;
}

.card-tag {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 0.04em;
  border: 1px solid var(--line);
  color: var(--ink-faint);
}

.card-tag.joined {
  color: var(--accent);
  border-color: var(--accent);
}

.card-tag.ended {
  color: var(--ink-faint);
}

.card-meta {
  margin: 0;
  color: var(--ink-soft);
  font-size: 12.5px;
  line-height: 1.7;
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px dashed var(--line);
}

.count {
  color: var(--ink-faint);
  font-size: 11.5px;
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.detail-meta {
  color: var(--ink-faint);
  font-size: 12px;
}

.result-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.result-label {
  color: var(--ink-faint);
  font-size: 11.5px;
  letter-spacing: 0.08em;
}

.result-value {
  font-family: var(--font-num);
  font-size: 26px;
  color: var(--accent);
}

.result-meta {
  color: var(--ink-soft);
  font-size: 12.5px;
}

.runner-card {
  margin-bottom: 14px;
}

.board-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.board-title {
  font-size: 14.5px;
  color: var(--ink);
}

.board {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.board-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 110px 100px;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  color: var(--ink-soft);
  font-size: 13px;
}

.board-row.me {
  background: var(--accent-soft);
  color: var(--ink);
}

.board-head {
  padding-bottom: 2px;
  color: var(--ink-faint);
  font-size: 11.5px;
  letter-spacing: 0.04em;
}

.board-head .score,
.board-head .duration {
  color: var(--ink-faint);
}

.rank {
  color: var(--ink-faint);
  font-family: var(--font-num);
}

.board-row.me .rank {
  color: var(--accent);
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score,
.duration {
  text-align: right;
  font-family: var(--font-num);
  color: var(--ink-soft);
  font-size: 12.5px;
}

@media (max-width: 1000px) {
  .match-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .field-grid {
    grid-template-columns: 1fr;
  }
  .board-row {
    grid-template-columns: 32px minmax(0, 1fr) 90px 80px;
  }
}
</style>
