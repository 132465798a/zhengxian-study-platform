<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">{{ t.nav.wrongbookDesc }}</p>
        <h1 class="page-title">{{ t.wrongbook.title }}</h1>
        <p class="page-desc">{{ t.wrongbook.desc }}</p>
      </div>
      <Button
        :label="t.wrongbook.practiceWrong"
        icon="pi pi-play"
        size="small"
        :disabled="total === 0 || !subjectId"
        :title="subjectId ? t.wrongbook.practiceHint : t.wrongbook.selectSubjectFirst"
        @click="startWrongPractice"
      />
    </header>

    <section class="stat-grid">
      <div class="stat-tile">
        <div class="label">{{ t.wrongbook.summaryTotal }}</div>
        <div class="value total">{{ summary.total }}</div>
        <div class="foot">{{ t.common.units.question }}</div>
      </div>
      <div class="stat-tile">
        <div class="label">{{ t.wrongbook.summaryUnmastered }}</div>
        <div class="value">{{ summary.unmastered }}</div>
        <div class="foot">{{ t.common.units.question }}</div>
      </div>
      <div class="stat-tile">
        <div class="label">{{ t.wrongbook.summaryMastered }}</div>
        <div class="value">{{ summary.mastered }}</div>
        <div class="foot">{{ t.common.units.question }}</div>
      </div>
    </section>

    <section class="paper-card filters">
      <label class="field">
        <span class="field-label">{{ t.wrongbook.filterSubject }}</span>
        <Select v-model="subjectId" :options="subjectOptions" option-label="label" option-value="value" size="small" @change="applyFilter" />
      </label>
      <label class="field">
        <span class="field-label">{{ t.wrongbook.filterGrade }}</span>
        <Select v-model="grade" :options="gradeOptions" option-label="label" option-value="value" size="small" @change="applyFilter" />
      </label>
      <label class="field">
        <span class="field-label">{{ t.wrongbook.filterStatus }}</span>
        <Select v-model="status" :options="statusOptions" option-label="label" option-value="value" size="small" @change="applyFilter" />
      </label>
      <span class="filter-hint muted">{{ subjectId ? t.wrongbook.practiceHint : t.wrongbook.selectSubjectFirst }}</span>
    </section>

    <div v-if="loading" class="paper-card empty-state">
      <i class="pi pi-spin pi-spinner" />
      <div class="title">{{ t.common.status.loading }}</div>
    </div>

    <div v-else-if="items.length === 0" class="paper-card empty-state">
      <i class="pi pi-bookmark" />
      <div class="title">{{ t.wrongbook.emptyTitle }}</div>
      <div class="hint">{{ t.wrongbook.emptyHint }}</div>
    </div>

    <template v-else>
      <div class="wrong-list">
        <WrongBookCard
          v-for="item in items"
          :key="item.id"
          :item="item"
          :subject-name="subjectName(item.question.subjectId)"
          @master="toggleMastered"
          @remove="askRemove"
          @detail="openDetail"
        />
      </div>

      <div class="pager">
        <Button icon="pi pi-angle-left" size="small" text :disabled="page <= 1" @click="goPage(page - 1)" />
        <span class="muted num">{{ t.admin.pageInfo(page, totalPages) }}</span>
        <Button icon="pi pi-angle-right" size="small" text :disabled="page >= totalPages" @click="goPage(page + 1)" />
      </div>
    </template>

    <WrongBookDetailDialog
      v-model:visible="detailVisible"
      :item="active"
      :subject-name="active ? subjectName(active.question.subjectId) : '—'"
      @master="toggleMastered"
    />

    <Dialog
      v-model:visible="removeVisible"
      modal
      :header="t.wrongbook.remove"
      :style="{ width: 'min(430px, 92vw)' }"
      :dismissable-mask="false"
      :draggable="false"
    >
      <p class="remove-text">{{ t.wrongbook.removeConfirm }}</p>
      <template #footer>
        <Button :label="t.common.actions.cancel" text @click="removeVisible = false" />
        <Button :label="t.wrongbook.remove" severity="danger" size="small" :loading="removing" @click="confirmRemove" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { contentApi, practiceApi, wrongApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { t } from '@/i18n'
import { ALL_TYPES, GRADE_LABEL } from '@shared/constants'
import type { PracticeConfig, Subject, WrongBookItem } from '@shared/types'
import WrongBookCard from '@/components/wrongbook/WrongBookCard.vue'
import WrongBookDetailDialog from '@/components/wrongbook/WrongBookDetailDialog.vue'

type StatusFilter = 'all' | 'unmastered' | 'mastered'
const PAGE_SIZE = 10

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const userId = computed(() => auth.currentUser?.id ?? 0)
const subjects = ref<Subject[]>([])
const summary = ref({ total: 0, unmastered: 0, mastered: 0 })
const subjectId = ref(0)
const grade = ref(0)
const status = ref<StatusFilter>('all')
const items = ref<WrongBookItem[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const detailVisible = ref(false)
const active = ref<WrongBookItem | null>(null)
const removeVisible = ref(false)
const removeTarget = ref<WrongBookItem | null>(null)
const removing = ref(false)

const subjectOptions = computed(() => [
  { label: t.wrongbook.allSubjects, value: 0 },
  ...subjects.value.map((subject) => ({ label: subject.name, value: subject.id }))
])
const gradeOptions = computed(() => [
  { label: t.wrongbook.allGrades, value: 0 },
  ...[1, 2, 3, 4, 5, 6].map((value) => ({ label: GRADE_LABEL(value), value }))
])
const statusOptions = computed<{ label: string; value: StatusFilter }[]>(() => [
  { label: t.wrongbook.statusAll, value: 'all' },
  { label: t.wrongbook.statusUnmastered, value: 'unmastered' },
  { label: t.wrongbook.statusMastered, value: 'mastered' }
])
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

function subjectName(id: number): string {
  return subjects.value.find((subject) => subject.id === id)?.name ?? '—'
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : t.common.status.error
}

function statusToMastered(value: StatusFilter): boolean | undefined {
  if (value === 'unmastered') return false
  if (value === 'mastered') return true
  return undefined
}

async function loadSubjects(): Promise<void> {
  try {
    subjects.value = await contentApi.subjects()
  } catch {
    subjects.value = []
  }
}

async function loadSummary(): Promise<void> {
  if (!auth.currentUser) return
  try {
    const data = await wrongApi.summary(userId.value)
    summary.value = { total: data.total, unmastered: data.unmastered, mastered: data.mastered }
  } catch {
    summary.value = { total: 0, unmastered: 0, mastered: 0 }
  }
}

async function loadPage(): Promise<void> {
  if (!auth.currentUser) return
  loading.value = true
  try {
    const result = await wrongApi.page({
      userId: userId.value,
      subjectId: subjectId.value || undefined,
      grade: grade.value || undefined,
      mastered: statusToMastered(status.value),
      page: page.value,
      pageSize: PAGE_SIZE
    })
    items.value = result.items
    total.value = result.total
  } catch (error) {
    items.value = []
    total.value = 0
    toast.add({ severity: 'error', summary: t.common.status.error, detail: errorText(error), life: 3000 })
  } finally {
    loading.value = false
  }
}

function applyFilter(): void {
  page.value = 1
  void loadPage()
}

function goPage(target: number): void {
  if (target < 1 || target > totalPages.value || target === page.value) return
  page.value = target
  void loadPage()
}

function openDetail(item: WrongBookItem): void {
  active.value = item
  detailVisible.value = true
}

async function toggleMastered(item: WrongBookItem): Promise<void> {
  if (!auth.currentUser) return
  const next = !item.mastered
  try {
    await wrongApi.master(userId.value, item.id, next)
    item.mastered = next
    toast.add({ severity: 'success', summary: t.common.status.success, detail: next ? t.wrongbook.markMastered : t.wrongbook.unmarkMastered, life: 2000 })
    await Promise.all([loadSummary(), loadPage()])
    if (active.value) {
      active.value = items.value.find((entry) => entry.id === active.value?.id) ?? null
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: t.common.status.error, detail: errorText(error), life: 3000 })
  }
}

function askRemove(item: WrongBookItem): void {
  removeTarget.value = item
  removeVisible.value = true
}

async function confirmRemove(): Promise<void> {
  const target = removeTarget.value
  if (!target || !auth.currentUser) return
  removing.value = true
  try {
    await wrongApi.remove(userId.value, target.id)
    removeVisible.value = false
    if (active.value?.id === target.id) {
      detailVisible.value = false
      active.value = null
    }
    removeTarget.value = null
    const maxPage = Math.max(1, Math.ceil(Math.max(0, total.value - 1) / PAGE_SIZE))
    if (page.value > maxPage) page.value = maxPage
    await Promise.all([loadSummary(), loadPage()])
    toast.add({ severity: 'success', summary: t.common.status.success, detail: t.wrongbook.remove, life: 2000 })
  } catch (error) {
    toast.add({ severity: 'error', summary: t.common.status.error, detail: errorText(error), life: 3000 })
  } finally {
    removing.value = false
  }
}

async function startWrongPractice(): Promise<void> {
  if (!auth.currentUser) return
  if (!subjectId.value) {
    toast.add({ severity: 'warn', summary: t.wrongbook.practiceWrong, detail: t.wrongbook.selectSubjectFirst, life: 3000 })
    return
  }
  const config: PracticeConfig = {
    userId: userId.value,
    subjectId: subjectId.value,
    grade: grade.value || auth.currentUser.grade,
    types: ALL_TYPES,
    difficulties: [1, 2, 3],
    count: Math.min(10, total.value),
    mode: 'wrong'
  }
  try {
    const session = await practiceApi.create(config)
    await router.push(`/practice/${session.record.id}`)
  } catch (error) {
    toast.add({ severity: 'error', summary: t.common.status.error, detail: errorText(error), life: 3000 })
  }
}
onMounted(async () => {
  if (!auth.currentUser) return
  await Promise.all([loadSubjects(), loadSummary(), loadPage()])
})
</script>

<style scoped>
.page { font-size: 13.5px; }

.stat-grid { margin-bottom: 12px; }
.stat-tile .value.total { color: var(--accent); }

.filters {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 14px;
  padding: 12px 18px;
  margin-bottom: 12px;
  background: var(--bg-sunken);
}

.field { display: flex; flex-direction: column; gap: 5px; }

.field-label { font-size: 11.5px; letter-spacing: 0.08em; color: var(--ink-faint); }

.field :deep(.p-select) { min-width: 132px; }

.filter-hint { margin-left: auto; font-size: 12px; padding-bottom: 4px; }

.wrong-list { display: flex; flex-direction: column; gap: 10px; }

.pager { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 14px; }

.pager .num { font-size: 12.5px; }

.remove-text { margin: 0; line-height: 1.7; color: var(--ink-soft); }
</style>
