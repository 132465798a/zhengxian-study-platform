<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">{{ t.nav.groupManage }}</p>
        <h1 class="page-title">{{ t.admin.title }}</h1>
        <p class="page-desc">{{ t.admin.desc }}</p>
      </div>
      <div class="head-actions">
        <Button :label="t.admin.newQuestion" icon="pi pi-plus" size="small" @click="openCreate" />
        <Button
          :label="t.admin.tabImport"
          icon="pi pi-upload"
          size="small"
          outlined
          @click="router.push('/admin/import')"
        />
      </div>
    </header>

    <QuestionFilterBar
      v-model:subject-id="filter.subjectId"
      v-model:grade="filter.grade"
      v-model:question-type="filter.type"
      v-model:keyword="filter.keyword"
      :subjects="subjects"
      @change="applyFilters"
      @reset="resetFilters"
    />

    <section class="paper-card table-card">
      <div class="table-scroll">
        <table v-if="rows.length > 0" class="q-table">
          <colgroup>
            <col class="col-stem" />
            <col class="col-subject" />
            <col class="col-grade" />
            <col class="col-type" />
            <col class="col-difficulty" />
            <col class="col-knowledge" />
            <col class="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th>{{ t.admin.columnStem }}</th>
              <th>{{ t.admin.columnSubject }}</th>
              <th>{{ t.admin.columnGrade }}</th>
              <th>{{ t.admin.columnType }}</th>
              <th>{{ t.admin.columnDifficulty }}</th>
              <th>{{ t.admin.columnKnowledge }}</th>
              <th class="align-right">{{ t.admin.columnActions }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td>
                <span class="stem" :title="row.stem">{{ row.stem }}</span>
              </td>
              <td>{{ subjectName(row.subjectId) }}</td>
              <td>{{ GRADE_LABEL(row.grade) }}</td>
              <td>
                <Tag :value="t.common.questionTypes[row.type]" severity="secondary" />
              </td>
              <td>
                <Tag
                  :value="t.common.difficulty[row.difficulty]"
                  :severity="difficultySeverity(row.difficulty)"
                />
              </td>
              <td class="ellipsis" :title="row.knowledgeName ?? ''">{{ row.knowledgeName ?? '—' }}</td>
              <td class="actions-cell">
                <Button
                  icon="pi pi-pencil"
                  size="small"
                  text
                  rounded
                  :aria-label="t.common.actions.edit"
                  :title="t.common.actions.edit"
                  @click="openEdit(row)"
                />
                <Button
                  icon="pi pi-trash"
                  size="small"
                  text
                  rounded
                  severity="danger"
                  :aria-label="t.common.actions.delete"
                  :title="t.common.actions.delete"
                  @click="askDelete(row)"
                />
              </td>
            </tr>
          </tbody>
        </table>

        <div v-else-if="!loading" class="empty-state">
          <i class="pi pi-inbox" />
          <div class="title">{{ t.admin.emptyTitle }}</div>
          <div class="hint">{{ t.admin.emptyHint }}</div>
        </div>

        <div v-if="loading" class="loading muted">{{ t.common.status.loading }}</div>
      </div>

      <div class="table-foot spread">
        <span class="muted total-count">{{ t.admin.totalCount(total) }}</span>
        <Paginator
          v-if="total > 0"
          :first="(page - 1) * pageSize"
          :rows="pageSize"
          :total-records="total"
          @page="onPage"
        />
      </div>
    </section>

    <QuestionEditorDialog
      v-model:visible="dialogVisible"
      :question="editing"
      :subjects="subjects"
      :default-subject-id="filter.subjectId"
      :default-grade="filter.grade"
      @saved="load"
    />

    <Dialog
      v-model:visible="deleteVisible"
      modal
      :header="t.common.actions.delete"
      :style="{ width: '380px' }"
      :dismissable-mask="false"
      :draggable="false"
    >
      <p class="confirm-text">{{ t.admin.deleteConfirm }}</p>
      <template #footer>
        <Button :label="t.common.actions.cancel" text @click="deleteVisible = false" />
        <Button :label="t.common.actions.delete" severity="danger" :loading="deleting" @click="confirmDelete" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Paginator from 'primevue/paginator'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import type { PageState } from 'primevue/paginator'
import QuestionEditorDialog from '@/components/admin/QuestionEditorDialog.vue'
import QuestionFilterBar from '@/components/admin/QuestionFilterBar.vue'
import { contentApi, questionApi } from '@/api'
import { t } from '@/i18n'
import { GRADE_LABEL } from '@shared/constants'
import type { Question, QuestionType, Subject } from '@shared/types'

type TagSeverity = 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'contrast'

const router = useRouter()
const toast = useToast()

const pageSize = 20
const page = ref(1)
const rows = ref<Question[]>([])
const total = ref(0)
const loading = ref(false)
const subjects = ref<Subject[]>([])

interface QuestionFilterState {
  subjectId: number | null
  grade: number | null
  type: QuestionType | null
  keyword: string
}

const filter = reactive<QuestionFilterState>({ subjectId: null, grade: null, type: null, keyword: '' })

const dialogVisible = ref(false)
const editing = ref<Question | null>(null)

const deleteVisible = ref(false)
const deleting = ref(false)
const deleteTarget = ref<Question | null>(null)

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : t.common.status.error
}

function fail(detail: string): void {
  toast.add({ severity: 'error', summary: t.common.status.error, detail, life: 3200 })
}

function subjectName(id: number): string {
  return subjects.value.find((item) => item.id === id)?.name ?? '—'
}

function difficultySeverity(value: number): TagSeverity {
  if (value === 1) return 'success'
  if (value === 3) return 'danger'
  return 'warn'
}

async function loadSubjects(): Promise<void> {
  try {
    subjects.value = await contentApi.subjects()
  } catch {
    subjects.value = []
  }
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await questionApi.page({
      subjectId: filter.subjectId ?? undefined,
      grade: filter.grade ?? undefined,
      types: filter.type ? [filter.type] : undefined,
      keyword: filter.keyword.trim() || undefined,
      page: page.value,
      pageSize
    })
    rows.value = result.items
    total.value = result.total
  } catch (error) {
    fail(messageOf(error))
  } finally {
    loading.value = false
  }
}

function applyFilters(): void {
  page.value = 1
  void load()
}

function resetFilters(): void {
  filter.subjectId = null
  filter.grade = null
  filter.type = null
  filter.keyword = ''
  applyFilters()
}

function onPage(event: PageState): void {
  page.value = event.page + 1
  void load()
}

function openCreate(): void {
  editing.value = null
  dialogVisible.value = true
}

function openEdit(row: Question): void {
  editing.value = row
  dialogVisible.value = true
}

function askDelete(row: Question): void {
  deleteTarget.value = row
  deleteVisible.value = true
}

async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await questionApi.remove(deleteTarget.value.id)
    deleteVisible.value = false
    if (rows.value.length === 1 && page.value > 1) page.value -= 1
    await load()
    toast.add({ severity: 'success', summary: t.admin.deleteSuccess, life: 2500 })
  } catch (error) {
    fail(messageOf(error))
  } finally {
    deleting.value = false
    deleteTarget.value = null
  }
}

onMounted(async () => {
  await loadSubjects()
  await load()
})
</script>

<style scoped>
.head-actions { display: flex; gap: 10px; }

.table-card { margin-top: 10px; overflow: hidden; }

.table-scroll { overflow: auto; }

.q-table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
  font-size: 13px;
  table-layout: fixed;
}

.q-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 14px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-faint);
  background: var(--bg-raised);
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}

.q-table td {
  padding: 8px 14px;
  border-bottom: 1px solid var(--line);
  vertical-align: middle;
}

.q-table tbody tr:hover { background: var(--bg-sunken); }

.col-stem { width: 34%; }
.col-subject { width: 8%; }
.col-grade { width: 9%; }
.col-type { width: 10%; }
.col-difficulty { width: 8%; }
.col-knowledge { width: 19%; }
.col-actions { width: 100px; }

.stem { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.actions-cell { text-align: right; white-space: nowrap; }

.align-right { text-align: right; }

.table-foot { padding: 4px 10px 4px 16px; border-top: 1px solid var(--line); }

.total-count { font-size: 12.5px; }

.loading { padding: 42px 16px; text-align: center; font-size: 13px; }

.hint { font-size: 11.5px; line-height: 1.6; color: var(--ink-faint); }

.confirm-text { margin: 0; font-size: 13px; line-height: 1.7; color: var(--ink-soft); }
</style>
