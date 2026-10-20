<template>
  <div class="print-root" :class="{ 'is-plain': !preview }">
    <div v-if="preview" class="preview-toolbar">
      <strong>打印预览</strong>
      <span class="grow">{{ doc ? `${doc.title} · ${doc.meta.questionCount} 题` : '' }}</span>
      <Button label="保存 PDF" size="small" :loading="busy" @click="save" />
      <Button label="关闭" size="small" text @click="close" />
    </div>
    <p v-if="preview && message" class="preview-message" :class="{ 'is-error': isError }">
      {{ message }}
    </p>
    <p v-if="preview && pdfLoading" class="pdf-loading">正在生成分页预览…</p>

    <div v-if="loading" class="print-loading">正在生成打印页面…</div>
    <div v-else-if="error" class="print-error">{{ error }}</div>
    <template v-else-if="doc">
      <div v-if="preview && pdfPages.length > 0" class="pdf-pages" :style="{ zoom: scale }">
        <figure v-for="page in pdfPages" :key="page.no" class="pdf-page">
          <img :src="page.url" :alt="`第 ${page.no} 页`" :style="{ width: `${page.widthMm}mm` }">
          <figcaption>第 {{ page.no }} 页 / 共 {{ pdfPages.length }} 页</figcaption>
        </figure>
      </div>
      <div v-show="!preview || pdfPages.length === 0" class="paper-shell" :style="shellStyle">
        <PrintPaper :document="doc" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { printApi } from '@/api'
import { PAPER_SIZES, type PrintDocument } from '@shared/print'
import PrintPaper from './PrintPaper.vue'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const route = useRoute()
const token = typeof route.query.token === 'string' ? route.query.token : ''
const preview = route.query.preview === '1'

const doc = ref<PrintDocument | null>(null)
const loading = ref(true)
const error = ref('')
const message = ref('')
const isError = ref(false)
const busy = ref(false)
const scale = ref(1)
const pdfLoading = ref(false)
const pdfPages = ref<Array<{ no: number; url: string; widthMm: number }>>([])

let pdfDocument: pdfjsLib.PDFDocumentProxy | null = null

const pageSize = computed(() => {
  const size = PAPER_SIZES[doc.value?.options.size ?? 'A4'] ?? PAPER_SIZES.A4
  return doc.value?.options.orientation === 'landscape'
    ? { width: size.height, height: size.width }
    : size
})

const bottomMarginMm = computed<number>(() => (doc.value?.options.pageNumber ? 18 : 12))

const shellStyle = computed(() => ({
  width: `${pageSize.value.width}mm`,
  minHeight: `${pageSize.value.height}mm`,
  padding: `16mm 14mm ${bottomMarginMm.value}mm`,
  zoom: preview ? scale.value : 1
}))

function applyPageStyle(): void {
  const style = document.createElement('style')
  style.id = 'print-page-style'
  style.textContent = `@page { size: ${pageSize.value.width}mm ${pageSize.value.height}mm; margin: 16mm 14mm ${bottomMarginMm.value}mm; }`
  document.head.appendChild(style)
}

function updateScale(): void {
  if (!preview) return
  const widthPx = (pageSize.value.width * 96) / 25.4
  scale.value = Math.min(1, Math.max(0.4, (window.innerWidth - 48) / widthPx))
}

function notifyError(cause: unknown): void {
  isError.value = true
  message.value = cause instanceof Error ? cause.message : '打印失败，请重试'
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function loadPdfPreview(): Promise<void> {
  if (!preview) return
  pdfLoading.value = true
  try {
    const payload = await printApi.previewPdf(token)
    const task = pdfjsLib.getDocument({ data: base64ToBytes(payload.pdf), isEvalSupported: false })
    pdfDocument = await task.promise
    const pages: typeof pdfPages.value = []
    for (let index = 1; index <= pdfDocument.numPages; index += 1) {
      const page = await pdfDocument.getPage(index)
      const viewport = page.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('无法创建预览画布')
      await page.render({ canvasContext: context, viewport }).promise
      pages.push({
        no: index,
        url: canvas.toDataURL('image/png'),
        widthMm: (viewport.width / 2 / 72) * 25.4
      })
    }
    pdfPages.value = pages
  } catch (cause) {
    isError.value = true
    message.value = cause instanceof Error ? cause.message : '分页预览生成失败'
  } finally {
    pdfLoading.value = false
  }
}

async function save(): Promise<void> {
  if (busy.value) return
  busy.value = true
  isError.value = false
  message.value = ''
  try {
    const result = await printApi.saveJob(token)
    if (!result.canceled) message.value = `已保存：${result.path ?? ''}`
  } catch (cause) {
    notifyError(cause)
  } finally {
    busy.value = false
  }
}

function close(): void {
  window.close()
}

onMounted(async () => {
  // 打印窗口固定使用浅色，避免深色主题把纸张页边距染黑
  document.documentElement.setAttribute('data-theme', 'light')
  document.documentElement.style.colorScheme = 'light'
  if (!token) {
    loading.value = false
    error.value = '打印任务无效'
    return
  }
  try {
    doc.value = await printApi.payload(token)
    document.title = doc.value.title
    applyPageStyle()
    await document.fonts.ready
    loading.value = false
    updateScale()
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    await printApi.ready(token)
    void loadPdfPreview()
  } catch (cause) {
    loading.value = false
    error.value = cause instanceof Error ? cause.message : '打印页面加载失败'
  }
})

onMounted(() => window.addEventListener('resize', updateScale))
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateScale)
  void pdfDocument?.destroy()
  pdfDocument = null
})
</script>
