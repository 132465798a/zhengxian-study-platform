<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">{{ t.nav.groupManage }}</p>
        <h1 class="page-title">{{ t.admin.importTitle }}</h1>
        <p class="page-desc">{{ t.admin.importDesc }}</p>
      </div>
      <Button
        :label="t.common.actions.back"
        icon="pi pi-arrow-left"
        size="small"
        outlined
        @click="router.push('/admin/questions')"
      />
    </header>

    <div class="import-grid">
      <section class="paper-card panel">
        <h2 class="section-title">{{ t.admin.importFieldsTitle }}</h2>
        <ul class="field-list">
          <li v-for="field in t.admin.importFields" :key="field">{{ field }}</li>
        </ul>
        <Button
          :label="t.admin.templateDownload"
          icon="pi pi-download"
          size="small"
          outlined
          class="full"
          @click="downloadTemplate"
        />
      </section>

      <section class="paper-card panel">
        <template v-if="result">
          <h2 class="section-title">{{ t.admin.importDone }}</h2>

          <div class="result-stats">
            <div class="result-tile">
              <span>{{ t.admin.importInserted }}</span>
              <strong class="num">{{ result.inserted }}</strong>
            </div>
            <div class="result-tile">
              <span>{{ t.admin.importSkipped }}</span>
              <strong class="num">{{ result.skipped }}</strong>
            </div>
          </div>

          <div class="result-errors">
            <div class="muted small">{{ t.admin.importErrors }}</div>
            <p v-if="result.errors.length === 0" class="all-clear">
              <i class="pi pi-check-circle" /> {{ t.admin.noErrors }}
            </p>
            <ul v-else class="error-list">
              <li v-for="(item, index) in result.errors" :key="index">{{ item }}</li>
            </ul>
          </div>

          <div class="row actions">
            <Button :label="t.admin.reselect" icon="pi pi-refresh" size="small" outlined @click="reselect" />
            <Button
              :label="t.admin.tabQuestions"
              icon="pi pi-list"
              size="small"
              @click="router.push('/admin/questions')"
            />
          </div>
        </template>

        <template v-else>
          <div class="spread">
            <h2 class="section-title">{{ t.admin.chooseFile }}</h2>
            <span v-if="fileName" class="muted small file-name">{{ fileName }}</span>
          </div>

          <div
            class="drop-zone"
            :class="{ dragging }"
            @click="openPicker"
            @dragover.prevent="onDragOver"
            @dragleave.prevent="onDragLeave"
            @drop.prevent="onDrop"
          >
            <i class="pi pi-cloud-upload" />
            <p class="drop-title">{{ t.admin.chooseFile }}</p>
            <p class="muted small">{{ t.admin.dropHint }}</p>
            <Button
              :label="t.admin.chooseFile"
              icon="pi pi-folder-open"
              size="small"
              outlined
              @click.stop="openPicker"
            />
          </div>

          <input
            ref="fileInput"
            type="file"
            accept=".csv,.json"
            class="file-input"
            @change="onFileChange"
          />

          <div v-if="previewing" class="loading muted">
            <i class="pi pi-spin pi-spinner" /> {{ t.common.status.loading }}
          </div>

          <div v-else-if="preview" class="preview">
            <div class="spread preview-head">
              <strong>{{ t.admin.previewTitle }}</strong>
              <span class="muted small">{{ t.admin.previewCount(preview.total) }}</span>
            </div>

            <div class="preview-section">
              <span class="muted small">{{ t.admin.previewColumns }}</span>
              <div class="tag-row">
                <Tag v-for="column in preview.columns" :key="column" :value="column" severity="secondary" />
              </div>
            </div>

            <div class="preview-scroll">
              <table class="preview-table">
                <thead>
                  <tr>
                    <th v-for="column in preview.columns" :key="column">{{ column }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in preview.preview" :key="index">
                    <td
                      v-for="column in preview.columns"
                      :key="column"
                      :title="formatCell(item[column])"
                    >
                      {{ formatCell(item[column]) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Button
              class="full"
              icon="pi pi-check"
              :label="importing ? t.admin.importing : t.admin.confirmImport"
              :loading="importing"
              @click="confirmImport"
            />
          </div>

          <div v-else-if="!previewing" class="preview-empty muted small">
            {{ t.admin.dropHint }}
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { importApi } from '@/api'
import { t } from '@/i18n'
import type { ImportPreview, ImportResult } from '@shared/types'

const router = useRouter()
const toast = useToast()

const fileInput = ref<HTMLInputElement | null>(null)
const fileName = ref('')
const rawText = ref('')
const preview = ref<ImportPreview | null>(null)
const result = ref<ImportResult | null>(null)
const previewing = ref(false)
const importing = ref(false)
const dragging = ref(false)

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : t.common.status.error
}

function fail(detail: string): void {
  toast.add({ severity: 'error', summary: t.common.status.error, detail, life: 3200 })
}

function openPicker(): void {
  fileInput.value?.click()
}

function onDragOver(): void {
  dragging.value = true
}

function onDragLeave(): void {
  dragging.value = false
}

function onDrop(event: DragEvent): void {
  dragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) void handleFile(file)
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await handleFile(file)
}

async function handleFile(file: File): Promise<void> {
  const name = file.name.toLowerCase()
  if (!name.endsWith('.csv') && !name.endsWith('.json')) {
    fail(t.admin.dropHint)
    return
  }

  previewing.value = true
  preview.value = null
  result.value = null
  try {
    const raw = await file.text()
    const parsed = await importApi.preview(raw, file.name)
    rawText.value = raw
    fileName.value = file.name
    preview.value = parsed
  } catch (error) {
    rawText.value = ''
    fileName.value = ''
    fail(messageOf(error))
  } finally {
    previewing.value = false
  }
}

async function confirmImport(): Promise<void> {
  if (!rawText.value || !fileName.value) return
  importing.value = true
  try {
    result.value = await importApi.commit(rawText.value, fileName.value)
    toast.add({ severity: 'success', summary: t.admin.importDone, life: 2600 })
  } catch (error) {
    fail(messageOf(error))
  } finally {
    importing.value = false
  }
}

function reselect(): void {
  result.value = null
  preview.value = null
  rawText.value = ''
  fileName.value = ''
  openPicker()
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function downloadTemplate(): void {
  const blob = new Blob(['\ufeff' + t.admin.templateContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = t.admin.templateFileName
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.import-grid {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.panel {
  padding: 14px 20px;
}

.field-list {
  margin: 10px 0 12px;
  padding-left: 16px;
  font-size: 12.5px;
  line-height: 1.9;
  color: var(--ink-soft);
}

.field-list li {
  margin-bottom: 2px;
  word-break: break-word;
}

.full {
  width: 100%;
}

.small {
  font-size: 12px;
}

.file-name {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drop-zone {
  margin-top: 10px;
  padding: 20px 18px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius);
  background: var(--bg-sunken);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.1s ease, background 0.1s ease;
}

.drop-zone:hover,
.drop-zone.dragging {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.drop-zone > i {
  font-size: 28px;
  color: var(--ink-faint);
}

.drop-title {
  margin: 8px 0 2px;
  font-family: var(--font-display);
  font-size: 15px;
  color: var(--ink);
}

.drop-zone p {
  margin: 4px 0 8px;
}

.file-input {
  display: none;
}

.loading {
  padding: 32px 12px;
  text-align: center;
  font-size: 13px;
}

.preview {
  margin-top: 16px;
}

.preview-head {
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
}

.preview-section {
  margin-top: 12px;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.preview-scroll {
  margin-top: 12px;
  max-height: 260px;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}

.preview-table {
  width: 100%;
  min-width: 560px;
  border-collapse: collapse;
  font-size: 12.5px;
}

.preview-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 10px;
  text-align: left;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ink-faint);
  background: var(--bg-raised);
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}

.preview-table td {
  max-width: 220px;
  padding: 8px 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-bottom: 1px solid var(--line);
}

.preview-table tr:last-child td {
  border-bottom: none;
}

.preview-empty {
  margin-top: 18px;
  padding: 18px;
  text-align: center;
  border-radius: var(--radius);
  line-height: 1.7;
}

.result-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.result-tile {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: var(--radius);
  background: var(--bg-sunken);
  font-size: 12.5px;
  color: var(--ink-soft);
}

.result-tile strong {
  font-size: 24px;
  color: var(--accent);
}

.result-errors {
  margin-top: 16px;
}

.all-clear {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0 0;
  font-size: 12.5px;
  color: var(--success);
}

.error-list {
  margin: 8px 0 0;
  padding-left: 18px;
  max-height: 180px;
  overflow: auto;
  font-size: 12.5px;
  line-height: 1.75;
  color: var(--danger);
}

.actions {
  margin-top: 20px;
}

@media (max-width: 1000px) {
  .import-grid {
    grid-template-columns: 1fr;
  }
}
</style>
