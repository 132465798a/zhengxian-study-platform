<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">{{ t.nav.exam }}</p>
        <h1 class="page-title">{{ t.exam.title }}</h1>
        <p class="page-desc">{{ t.exam.desc }}</p>
      </div>
    </header>

    <div v-if="loading" class="empty-state">
      <i class="pi pi-spin pi-spinner" />
      <div class="title">{{ t.common.status.loading }}</div>
    </div>

    <template v-else>
      <div v-if="templates.length === 0" class="paper-card empty-state">
        <i class="pi pi-file-edit" />
        <div class="title">{{ t.exam.noTemplates }}</div>
        <div class="hint">{{ t.exam.noTemplatesHint }}</div>
      </div>

      <section v-else class="template-grid">
        <article v-for="item in templates" :key="item.paper.id" class="paper-card exam-card">
          <div class="card-head">
            <h2 class="card-title">{{ item.paper.title }}</h2>
            <span v-if="item.paper.grade !== null" class="muted grade">
              {{ item.paper.grade }}{{ t.practice.grade }}
            </span>
          </div>

          <div class="exam-meta">
            <div class="meta-item">
              <span class="meta-label">{{ t.exam.duration }}</span>
              <span class="meta-value num">
                {{ item.paper.duration ?? '—' }}
                <small>{{ t.common.units.minute }}</small>
              </span>
            </div>
            <div class="meta-item">
              <span class="meta-label">{{ t.exam.totalScore }}</span>
              <span class="meta-value num">
                {{ item.paper.totalScore ?? '—' }}
                <small>{{ t.common.units.score }}</small>
              </span>
            </div>
            <div class="meta-item">
              <span class="meta-label">{{ t.exam.bestScore }}</span>
              <span v-if="item.bestScore !== null" class="meta-value num">
                {{ item.bestScore }}
                <small>{{ t.common.units.score }}</small>
              </span>
              <span v-else class="meta-value muted small-value">{{ t.exam.notAttempted }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">{{ t.exam.attempts }}</span>
              <span class="meta-value num">
                {{ item.attemptCount }}
                <small>{{ t.common.units.times }}</small>
              </span>
            </div>
          </div>

          <Button
            :label="t.exam.start"
            icon="pi pi-play"
            size="small"
            class="exam-action"
            @click="openConfirm(item)"
          />
        </article>
      </section>

      <section class="paper-card history">
        <h2 class="section-title">{{ t.exam.history }}</h2>

        <div v-if="history.length === 0" class="empty-state compact">
          <i class="pi pi-history" />
          <div class="title">{{ t.exam.noHistory }}</div>
        </div>

        <ul v-else class="history-list">
          <li v-for="item in history" :key="item.id" class="history-item">
            <div class="history-main">
              <strong>{{ item.title }}</strong>
              <small class="muted">{{ formatTime(item.finishedAt ?? item.startedAt) }}</small>
            </div>
            <span class="history-score num">
              {{ item.score }} / {{ item.totalScore }}
              <small>{{ t.common.units.score }}</small>
            </span>
            <span class="history-duration num muted">
              {{ minutesOf(item.durationSec) }} {{ t.common.units.minute }}
            </span>
          </li>
        </ul>
      </section>
    </template>

    <Dialog
      v-model:visible="confirmVisible"
      modal
      :header="t.exam.confirmTitle"
      :style="{ width: '360px' }"
      :dismissable-mask="false"
      :draggable="false"
    >
      <p v-if="pendingTemplate" class="confirm-body num">
        {{ pendingTemplate.paper.duration ?? 0 }} {{ t.common.units.minute }}
      </p>
      <template #footer>
        <Button :label="t.common.actions.cancel" text @click="confirmVisible = false" />
        <Button :label="t.exam.start" :loading="starting" @click="startExam" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import { examApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { t } from '@/i18n'
import type { ExamTemplate, HistoryItem } from '@shared/types'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const templates = ref<ExamTemplate[]>([])
const history = ref<HistoryItem[]>([])
const loading = ref(true)
const confirmVisible = ref(false)
const pendingTemplate = ref<ExamTemplate | null>(null)
const starting = ref(false)

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : t.common.status.error
}

function formatTime(value: string | null): string {
  if (!value) return '—'
  return value.slice(0, 16).replace('T', ' ')
}

function minutesOf(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60))
}

function openConfirm(item: ExamTemplate): void {
  pendingTemplate.value = item
  confirmVisible.value = true
}

async function startExam(): Promise<void> {
  if (!pendingTemplate.value || !auth.currentUser || starting.value) return
  starting.value = true
  try {
    const session = await examApi.start(auth.currentUser.id, pendingTemplate.value.paper.id)
    confirmVisible.value = false
    await router.push(`/exam/${session.record.id}`)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t.common.status.error,
      detail: errorText(error),
      life: 4000
    })
  } finally {
    starting.value = false
  }
}

async function load(): Promise<void> {
  if (!auth.currentUser) return
  loading.value = true
  try {
    const [templateList, recordList] = await Promise.all([
      examApi.templates(auth.currentUser.id),
      examApi.records(auth.currentUser.id, 20)
    ])
    templates.value = templateList
    history.value = recordList
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t.common.status.error,
      detail: errorText(error),
      life: 4000
    })
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.template-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.exam-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 22px;
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.card-title {
  font-size: 17px;
  line-height: 1.4;
  color: var(--ink);
}

.grade {
  font-size: 11.5px;
  white-space: nowrap;
}

.exam-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 11.5px;
  color: var(--ink-faint);
}

.meta-value {
  font-size: 17px;
  color: var(--ink);
}

.meta-value small {
  font-size: 11.5px;
  color: var(--ink-faint);
  margin-left: 2px;
}

.small-value {
  font-size: 12.5px;
  line-height: 1.7;
}

.exam-action {
  margin-top: auto;
  width: 100%;
}

.history {
  margin-top: 18px;
  padding: 16px 22px;
}

.history .section-title {
  margin-bottom: 10px;
}

.history-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 11px 2px;
}

.history-item + .history-item {
  border-top: 1px solid var(--line);
}

.history-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.history-main strong {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-main small {
  font-size: 11.5px;
}

.history-score {
  margin-left: auto;
  font-size: 14px;
  color: var(--accent);
  white-space: nowrap;
}

.history-score small {
  font-size: 11px;
  color: var(--ink-faint);
  margin-left: 2px;
}

.history-duration {
  font-size: 12px;
  white-space: nowrap;
  min-width: 64px;
  text-align: right;
}

.confirm-body {
  font-size: 20px;
  color: var(--accent);
  margin: 0;
}

.empty-state.compact {
  padding: 28px 12px;
}

@media (max-width: 1100px) {
  .template-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .template-grid {
    grid-template-columns: 1fr;
  }
}
</style>
