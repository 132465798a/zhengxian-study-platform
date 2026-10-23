<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">{{ t.portfolio.eyebrow }}</p>
        <h1 class="page-title">{{ t.portfolio.title }}</h1>
        <p class="page-desc">{{ t.portfolio.desc }}</p>
      </div>
    </header>

    <section class="paper-card panel">
      <div v-if="loading" class="empty-state">
        <i class="pi pi-spin pi-spinner" />
        <div class="title">{{ t.portfolio.loading }}</div>
      </div>

      <div v-else-if="error" class="empty-state">
        <i class="pi pi-exclamation-circle" />
        <div class="title">{{ t.portfolio.errorTitle }}</div>
        <div class="hint">{{ error }}</div>
        <Button :label="t.portfolio.retry" size="small" outlined @click="load" />
      </div>

      <div v-else-if="items.length === 0" class="empty-state">
        <i class="pi pi-file-pdf" />
        <div class="title">{{ t.portfolio.emptyTitle }}</div>
        <div class="hint">{{ t.portfolio.emptyHint }}</div>
        <Button
          :label="t.portfolio.emptyAction"
          size="small"
          icon="pi pi-book"
          @click="router.push('/offline')"
        />
      </div>

      <template v-else>
        <div class="history-table">
          <div class="history-row head">
            <span>{{ t.portfolio.columnTitle }}</span>
            <span>{{ t.portfolio.columnSubject }}</span>
            <span>{{ t.portfolio.columnGrade }}</span>
            <span>{{ t.portfolio.columnQuestionCount }}</span>
            <span>{{ t.portfolio.columnPages }}</span>
            <span>{{ t.portfolio.columnCreatedAt }}</span>
            <span class="actions-head">{{ t.portfolio.columnActions }}</span>
          </div>
          <div v-for="item in items" :key="item.id" class="history-row">
            <span class="history-title" :title="item.title">{{ item.title }}</span>
            <span>{{ item.subjectName || t.portfolio.unknown }}</span>
            <span>{{ item.grade === null ? t.portfolio.unknown : t.portfolio.gradeText(item.grade) }}</span>
            <span class="num">{{ t.portfolio.questionCount(item.questionCount) }}</span>
            <span class="num">
              {{ item.pages > 0 ? t.portfolio.pageCount(item.pages) : t.portfolio.questionCount(item.questionCount) }}
            </span>
            <span class="num muted">{{ formatTime(item.createdAt) }}</span>
            <span class="row-actions">
              <Button
                :label="confirmingId === item.id ? t.portfolio.confirmDelete : t.portfolio.delete"
                size="small"
                text
                severity="danger"
                :loading="removingId === item.id"
                :disabled="removingId !== null && removingId !== item.id"
                @click="onDelete(item)"
              />
            </span>
          </div>
        </div>

        <p v-if="deleteError" class="delete-error">{{ deleteError }}</p>

        <div class="pager">
          <Button
            :label="t.portfolio.prevPage"
            icon="pi pi-angle-left"
            size="small"
            text
            :disabled="page <= 1"
            @click="goPage(page - 1)"
          />
          <span class="muted num">{{ t.portfolio.pageInfo(page, total) }}</span>
          <Button
            :label="t.portfolio.nextPage"
            icon="pi pi-angle-right"
            icon-pos="right"
            size="small"
            text
            :disabled="page >= totalPages"
            @click="goPage(page + 1)"
          />
        </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import { portfolioApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { t } from '@/i18n'
import type { PrintHistoryItem } from '@shared/types'

const PAGE_SIZE = 10

const auth = useAuthStore()
const router = useRouter()

const items = ref<PrintHistoryItem[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(true)
const error = ref('')
const deleteError = ref('')
const confirmingId = ref<number | null>(null)
const removingId = ref<number | null>(null)

const totalPages = computed<number>(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

function formatTime(value: string): string {
  return value ? value.slice(0, 16) : t.portfolio.unknown
}

async function load(): Promise<void> {
  if (!auth.currentUser) {
    items.value = []
    total.value = 0
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  deleteError.value = ''
  confirmingId.value = null
  try {
    const result = await portfolioApi.list(auth.currentUser.id, page.value, PAGE_SIZE)
    items.value = result.items
    total.value = result.total
  } catch (cause) {
    items.value = []
    total.value = 0
    error.value = cause instanceof Error ? cause.message : ''
  } finally {
    loading.value = false
  }
}

function goPage(target: number): void {
  if (target < 1 || target > totalPages.value || target === page.value) return
  page.value = target
  void load()
}

async function onDelete(item: PrintHistoryItem): Promise<void> {
  if (!auth.currentUser || removingId.value !== null) return
  if (confirmingId.value !== item.id) {
    confirmingId.value = item.id
    deleteError.value = ''
    return
  }

  removingId.value = item.id
  deleteError.value = ''
  try {
    const result = await portfolioApi.remove(auth.currentUser.id, item.id)
    if (!result.deleted) {
      deleteError.value = t.portfolio.deleteFailed
      return
    }
    const maxPage = Math.max(1, Math.ceil(Math.max(0, total.value - 1) / PAGE_SIZE))
    if (page.value > maxPage) page.value = maxPage
    await load()
  } catch (cause) {
    deleteError.value = cause instanceof Error ? cause.message : t.portfolio.deleteFailed
  } finally {
    removingId.value = null
    confirmingId.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.page {
  font-size: 13.5px;
}

.panel {
  padding: 14px 20px;
}

.history-table {
  margin-top: 2px;
}

.history-row {
  display: grid;
  grid-template-columns: 2.2fr 0.8fr 0.7fr 0.7fr 0.7fr 1.2fr 0.9fr;
  gap: 10px;
  align-items: center;
  padding: 9px 4px;
  font-size: 12.5px;
}

.history-row + .history-row {
  border-top: 1px solid var(--line);
}

.history-row.head {
  color: var(--ink-faint);
  font-size: 11.5px;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--line);
}

.history-title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions-head {
  text-align: right;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
}

.delete-error {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--danger);
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 12px;
}

.pager .num {
  font-size: 12.5px;
}

.empty-state {
  padding: 46px 16px;
}

@media (max-width: 1100px) {
  .history-row {
    grid-template-columns: 1.8fr 0.7fr 0.6fr 0.7fr 0.7fr 1.1fr 0.8fr;
  }
}
</style>
