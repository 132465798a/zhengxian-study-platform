<template>
  <div class="page relay-page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">{{ t.relay.desc }}</p>
        <h1 class="page-title">{{ t.relay.title }}</h1>
      </div>
    </header>

    <template v-if="!state">
      <section class="paper-card panel form-card">
        <h2 class="form-title">{{ t.relay.formTitle }}</h2>

        <div class="field-grid">
          <label class="field">
            <span class="field-label">{{ t.relay.opponent }}</span>
            <Select
              v-model="opponentId"
              :options="otherUsers"
              option-label="name"
              option-value="id"
              :placeholder="t.relay.opponentPlaceholder"
            />
          </label>
          <label class="field">
            <span class="field-label">{{ t.relay.subject }}</span>
            <Select
              v-model="subjectId"
              :options="subjects"
              option-label="name"
              option-value="id"
              :placeholder="t.relay.subjectPlaceholder"
            />
          </label>
        </div>

        <div class="field-grid">
          <label class="field">
            <span class="field-label">{{ t.relay.count }}</span>
            <InputNumber v-model="questionCount" :min="5" :max="20" show-buttons />
          </label>
          <label class="field">
            <span class="field-label">{{ t.relay.turnSeconds }}</span>
            <Select
              v-model="turnSeconds"
              :options="turnOptions"
              option-label="label"
              option-value="value"
              :placeholder="t.relay.turnSeconds"
            />
          </label>
        </div>

        <p class="field-hint">{{ t.relay.countHint }}</p>
        <p v-if="createError" class="error-text">{{ createError }}</p>

        <div class="form-actions">
          <Button
            :label="t.relay.startMatch"
            icon="pi pi-play"
            size="small"
            :loading="creating || opening"
            :disabled="!opponentId || !subjectId"
            @click="startMatch"
          />
        </div>
      </section>

      <section class="history-section">
        <h2 class="section-title">{{ t.relay.historyTitle }}</h2>

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
            <Button :label="t.common.actions.retry" size="small" text @click="loadLobby" />
          </div>
        </div>

        <div v-else-if="matches.length === 0" class="paper-card panel">
          <div class="empty-state compact">
            <i class="pi pi-sync" />
            <div class="title">{{ t.relay.historyEmpty }}</div>
            <div class="hint">{{ t.relay.historyEmptyHint }}</div>
          </div>
        </div>

        <div v-else class="match-grid">
          <article
            v-for="item in matches"
            :key="item.id"
            class="match-card"
            :class="{ running: item.status === 'running' }"
            @click="openFromCard(item)"
          >
            <div class="card-head">
              <h3 class="card-title">{{ item.nameA }} vs {{ item.nameB }}</h3>
              <span class="card-tag" :class="item.status">{{ statusText(item.status) }}</span>
            </div>
            <p class="card-score num">{{ t.relay.scoreText(item.correctA, item.correctB) }}</p>
            <p class="card-meta">
              {{ t.relay.historyMeta(item.subjectName, item.grade, item.questionCount) }}
            </p>
            <div class="card-foot">
              <span class="card-time">{{ t.common.formatDateTime(item.createdAt) }}</span>
              <Button
                v-if="item.status === 'running'"
                :label="t.relay.continueMatch"
                size="small"
                :loading="opening"
                @click.stop="enterMatch(item.id)"
              />
            </div>
          </article>
        </div>
      </section>
    </template>

    <template v-else>
      <div class="match-head">
        <div class="head-left">
          <Button icon="pi pi-arrow-left" text rounded size="small" @click="backToLobby" />
          <div>
            <h1 class="match-title">{{ state.match.subjectName }}</h1>
            <p class="match-meta">{{ progressText }} · {{ state.match.nameA }} vs {{ state.match.nameB }}</p>
          </div>
        </div>
        <Button
          v-if="state.match.status === 'running'"
          :label="t.relay.endMatch"
          icon="pi pi-times"
          size="small"
          severity="secondary"
          outlined
          @click="endDialog = true"
        />
      </div>

      <section v-if="state.match.status === 'finished'" class="paper-card panel result-card">
        <p class="result-label">{{ t.relay.resultTitle }}</p>
        <div class="result-board">
          <div class="result-player">
            <span class="player-name">{{ state.match.nameA }}</span>
            <span class="player-score num">{{ t.relay.correctText(state.match.correctA) }}</span>
          </div>
          <span class="result-vs">VS</span>
          <div class="result-player">
            <span class="player-name">{{ state.match.nameB }}</span>
            <span class="player-score num">{{ t.relay.correctText(state.match.correctB) }}</span>
          </div>
        </div>
        <p class="result-summary">
          {{
            state.match.winnerId === null
              ? t.relay.drawText
              : t.relay.winnerText(nameOf(state.match.winnerId))
          }}
        </p>
        <p v-if="error" class="error-text">{{ error }}</p>
        <div class="result-actions">
          <Button
            :label="t.relay.again"
            icon="pi pi-refresh"
            :loading="replaying"
            @click="playAgain"
          />
          <Button :label="t.relay.backToLobby" severity="secondary" outlined @click="backToLobby" />
        </div>
      </section>

      <section v-else-if="state.question && !handoff" class="paper-card question-card">
        <div class="question-meta">
          <span class="index num">{{ state.match.currentIndex + 1 }}</span>
          <span class="total">/ {{ state.match.questionCount }}</span>
          <span class="player-tag">{{ t.relay.currentPlayer(nameOf(state.match.currentUserId)) }}</span>
          <span class="countdown num" :class="{ urgent: remaining <= 5 }">
            {{ t.relay.countdown(remaining) }}
          </span>
        </div>

        <QuestionRenderer
          :question="state.question"
          :model-value="answer"
          @update:model-value="answer = $event"
        />

        <p v-if="turnError" class="error-text">{{ turnError }}</p>

        <footer class="question-actions">
          <Button
            :label="t.relay.submit"
            icon="pi pi-check"
            :loading="submitting"
            :disabled="submitting"
            @click="submitTurn(false)"
          />
        </footer>
      </section>

      <section v-else class="paper-card panel">
        <div class="empty-state compact">
          <i class="pi pi-spin pi-spinner" />
          <div class="title">{{ t.common.status.loading }}</div>
        </div>
      </section>

      <div v-if="state.match.status === 'running' && handoff" class="handoff-mask">
        <div class="handoff-card">
          <span class="handoff-icon"><i class="pi pi-sync" /></span>
          <h2 class="handoff-title">{{ t.relay.handoffTitle(nameOf(state.match.currentUserId)) }}</h2>
          <p class="handoff-hint">{{ t.relay.handoffHint }}</p>
          <ul class="rule-list">
            <li>{{ t.relay.ruleTime(state.match.turnSeconds) }}</li>
            <li>{{ t.relay.ruleNoHint }}</li>
            <li>{{ t.relay.ruleReveal }}</li>
          </ul>
          <p class="handoff-progress">{{ progressText }}</p>
          <Button :label="t.relay.ready" icon="pi pi-check" @click="beginTurn" />
        </div>
      </div>
    </template>

    <Dialog
      v-model:visible="endDialog"
      modal
      :header="t.relay.endTitle"
      :style="{ width: '380px' }"
      :dismissable-mask="false"
      :draggable="false"
    >
      <p class="confirm-text">{{ t.relay.endHint }}</p>
      <template #footer>
        <Button :label="t.common.actions.cancel" text @click="endDialog = false" />
        <Button
          :label="t.relay.endAction"
          severity="danger"
          :loading="voiding"
          @click="confirmVoid"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import QuestionRenderer from '@/components/question/QuestionRenderer.vue'
import { contentApi, relayApi, userApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { t } from '@/i18n'
import type {
  QuestionType,
  RelayMatch,
  RelayQuestionState,
  RelayStatus,
  Subject,
  User
} from '@shared/types'

const auth = useAuthStore()

const users = ref<User[]>([])
const subjects = ref<Subject[]>([])
const matches = ref<RelayMatch[]>([])
const loading = ref(true)
const error = ref('')

const opponentId = ref<number | null>(null)
const subjectId = ref<number | null>(null)
const questionCount = ref<number>(10)
const turnSeconds = ref<number>(30)
const turnOptions = [15, 30, 60].map((value) => ({ value, label: t.relay.seconds(value) }))
const creating = ref(false)
const createError = ref('')

const opening = ref(false)
const state = ref<RelayQuestionState | null>(null)
const handoff = ref(true)
const answer = ref<unknown>(null)
const submitting = ref(false)
const remaining = ref(0)
const turnError = ref('')
const endDialog = ref(false)
const voiding = ref(false)
const replaying = ref(false)

let countdown: number | null = null

const grade = computed<number>(() => auth.currentUser?.grade ?? auth.currentGrade)
const otherUsers = computed<User[]>(() =>
  users.value.filter((item) => item.id !== auth.currentUser?.id)
)
const match = computed(() => state.value?.match ?? null)
const progressText = computed<string>(() => {
  const current = match.value
  if (!current) return ''
  const index = Math.min(current.currentIndex + 1, current.questionCount)
  return t.relay.progress(index, current.questionCount)
})

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : ''
}

function nameOf(userId: number | null): string {
  const current = match.value
  if (!current || userId === null) return ''
  if (userId === current.userA) return current.nameA
  if (userId === current.userB) return current.nameB
  return ''
}

function statusText(status: RelayStatus): string {
  if (status === 'running') return t.relay.statusRunning
  if (status === 'void') return t.relay.statusVoid
  return t.relay.statusFinished
}

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

function stopCountdown(): void {
  if (countdown !== null) {
    window.clearInterval(countdown)
    countdown = null
  }
}

function startCountdown(): void {
  const current = match.value
  if (!current) return
  stopCountdown()
  remaining.value = current.turnSeconds
  countdown = window.setInterval(() => {
    remaining.value -= 1
    if (remaining.value <= 0) {
      remaining.value = 0
      stopCountdown()
      void submitTurn(true)
    }
  }, 1000)
}

async function refreshHistory(): Promise<void> {
  if (!auth.currentUser) return
  try {
    matches.value = await relayApi.history(auth.currentUser.id, 20)
  } catch (cause) {
    error.value = messageOf(cause)
  }
}

async function loadLobby(): Promise<void> {
  if (!auth.currentUser) {
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const [userList, subjectList, history] = await Promise.all([
      userApi.list(),
      contentApi.subjects(grade.value),
      relayApi.history(auth.currentUser.id, 20)
    ])
    users.value = userList
    subjects.value = subjectList
    matches.value = history
    if (!subjects.value.some((item) => item.id === subjectId.value)) {
      subjectId.value = subjects.value[0]?.id ?? null
    }
  } catch (cause) {
    error.value = messageOf(cause)
  } finally {
    loading.value = false
  }
}

function openFromCard(current: RelayMatch): void {
  if (current.status === 'running') void enterMatch(current.id)
}

async function enterMatch(matchId: number): Promise<void> {
  if (opening.value) return
  opening.value = true
  error.value = ''
  turnError.value = ''
  try {
    const next = await relayApi.get(matchId)
    if (next.match.status === 'void') {
      state.value = null
      await refreshHistory()
      return
    }
    state.value = next
    handoff.value = true
    answer.value = null
    stopCountdown()
  } catch (cause) {
    error.value = messageOf(cause)
  } finally {
    opening.value = false
  }
}

async function startMatch(): Promise<void> {
  if (!auth.currentUser || creating.value) return
  if (!opponentId.value) {
    createError.value = t.relay.opponentRequired
    return
  }
  if (!subjectId.value) {
    createError.value = t.relay.subjectRequired
    return
  }
  creating.value = true
  createError.value = ''
  try {
    const created = await relayApi.create({
      userA: auth.currentUser.id,
      userB: opponentId.value,
      subjectId: subjectId.value,
      grade: grade.value,
      count: Number(questionCount.value),
      turnSeconds: Number(turnSeconds.value)
    })
    await enterMatch(created.id)
    await refreshHistory()
  } catch (cause) {
    createError.value = messageOf(cause)
  } finally {
    creating.value = false
  }
}

function beginTurn(): void {
  if (!match.value || match.value.status !== 'running') return
  handoff.value = false
  turnError.value = ''
  answer.value = state.value?.question ? defaultAnswer(state.value.question.type) : null
  startCountdown()
}

async function submitTurn(timeout: boolean): Promise<void> {
  const current = match.value
  const playerId = current?.currentUserId ?? null
  if (!current || playerId === null || submitting.value) return
  submitting.value = true
  turnError.value = ''
  stopCountdown()
  try {
    const outcome = await relayApi.answer({
      matchId: current.id,
      userId: playerId,
      answer: timeout ? null : answer.value,
      timeout
    })
    state.value = outcome.state
    answer.value = null
    if (outcome.finished) {
      handoff.value = false
      await refreshHistory()
    } else {
      handoff.value = true
    }
  } catch (cause) {
    turnError.value = messageOf(cause)
    startCountdown()
  } finally {
    submitting.value = false
  }
}

async function playAgain(): Promise<void> {
  const current = match.value
  if (!current || !auth.currentUser || replaying.value) return
  replaying.value = true
  error.value = ''
  try {
    const created = await relayApi.create({
      userA: current.userA,
      userB: current.userB,
      subjectId: current.subjectId,
      grade: current.grade,
      count: current.questionCount,
      turnSeconds: current.turnSeconds
    })
    await enterMatch(created.id)
    await refreshHistory()
  } catch (cause) {
    error.value = messageOf(cause)
  } finally {
    replaying.value = false
  }
}

async function confirmVoid(): Promise<void> {
  const current = match.value
  if (!current || !auth.currentUser || voiding.value) return
  voiding.value = true
  try {
    await relayApi.void(current.id, auth.currentUser.id)
    endDialog.value = false
    state.value = null
    handoff.value = true
    answer.value = null
    stopCountdown()
    await refreshHistory()
  } catch (cause) {
    turnError.value = messageOf(cause)
    endDialog.value = false
  } finally {
    voiding.value = false
  }
}

function backToLobby(): void {
  stopCountdown()
  state.value = null
  handoff.value = true
  answer.value = null
  turnError.value = ''
  endDialog.value = false
  void refreshHistory()
}

onMounted(loadLobby)

onBeforeUnmount(stopCountdown)
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
  margin-bottom: 22px;
}

.form-title,
.section-title {
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
}

.error-text {
  margin: 0;
  color: var(--danger);
  font-size: 12.5px;
}

.history-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.match-card.running {
  border-color: var(--line-strong);
  background: linear-gradient(180deg, var(--accent-soft), transparent 72%), var(--bg-raised);
  cursor: pointer;
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.card-title {
  font-size: 14px;
  line-height: 1.5;
  color: var(--ink);
}

.card-tag {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--line);
  color: var(--ink-faint);
  font-size: 11px;
  letter-spacing: 0.04em;
}

.card-tag.running {
  color: var(--accent);
  border-color: var(--accent);
}

.card-score {
  font-family: var(--font-num);
  font-size: 22px;
  color: var(--ink);
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

.card-time {
  color: var(--ink-faint);
  font-size: 11.5px;
}

.match-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.match-title {
  font-size: 18px;
  letter-spacing: 0.03em;
}

.match-meta {
  margin: 3px 0 0;
  color: var(--ink-faint);
  font-size: 12px;
}

.question-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 420px;
  padding: 22px 24px 18px;
}

.question-meta {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--ink-faint);
}

.question-meta .index {
  font-size: 24px;
  color: var(--accent);
}

.question-meta .total {
  font-size: 12px;
}

.player-tag {
  margin-left: 10px;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--bg-sunken);
  color: var(--ink-soft);
  font-size: 11.5px;
}

.countdown {
  margin-left: auto;
  font-size: 13px;
  color: var(--ink-soft);
}

.countdown.urgent {
  color: var(--danger);
}

.question-actions {
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: flex-end;
}

.handoff-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  backdrop-filter: blur(6px);
}

.handoff-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  width: min(440px, 100%);
  padding: 34px 32px 30px;
  background: var(--bg-raised);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  box-shadow: 0 24px 60px rgb(0 0 0 / 18%);
  text-align: center;
}

.handoff-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 20px;
}

.handoff-title {
  font-size: 20px;
  color: var(--ink);
}

.handoff-hint {
  margin: 0;
  color: var(--ink-soft);
  font-size: 12.5px;
}

.rule-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--ink-faint);
  font-size: 12.5px;
}

.handoff-progress {
  margin: 0;
  color: var(--ink-faint);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.result-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 30px 24px;
}

.result-label {
  margin: 0;
  color: var(--ink-faint);
  font-size: 11.5px;
  letter-spacing: 0.08em;
}

.result-board {
  display: flex;
  align-items: center;
  gap: 28px;
}

.result-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 120px;
}

.player-name {
  font-size: 14px;
  color: var(--ink);
}

.player-score {
  font-family: var(--font-num);
  font-size: 20px;
  color: var(--accent);
}

.result-vs {
  color: var(--ink-faint);
  font-size: 12px;
}

.result-summary {
  margin: 0;
  font-size: 16px;
  color: var(--ink);
  letter-spacing: 0.04em;
}

.result-actions {
  display: flex;
  gap: 10px;
}

.confirm-text {
  font-size: 13.5px;
  line-height: 1.8;
  color: var(--ink-soft);
}

@media (max-width: 1000px) {
  .match-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
