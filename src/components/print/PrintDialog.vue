<template>
  <Dialog
    :visible="store.visible"
    modal
    header="打印设置"
    :style="{ width: '760px' }"
    :draggable="false"
    @update:visible="(value: boolean) => !value && store.close()"
  >
    <div v-if="store.source" class="print-form">
      <PrintOptionsForm
        v-model:options="options"
        v-model:hanzi-grid="hanziGrid"
        v-model:english-mode="englishMode"
        :practice="isPractice"
        :source-kind="sourceKind"
        :subject="store.meta.subject ?? ''"
        :grade="store.meta.grade ?? 1"
        :title-placeholder="store.meta.title ?? '默认使用来源标题'"
      />
      <p v-if="message" class="dialog-message" :class="{ 'is-error': isError }">{{ message }}</p>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button label="取消" text size="small" @click="store.close()" />
        <span class="grow" />
        <Button label="预览" severity="secondary" outlined size="small" :loading="busy" @click="preview" />
        <Button label="保存 PDF" size="small" :loading="busy" @click="save" />
        <Button label="直接打印" size="small" outlined :loading="busy" @click="print" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { printApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { usePrintStore } from '@/stores/print.store'
import { defaultPrintOptions, type PrintOptions, type PrintRequest } from '@shared/print'
import PrintOptionsForm from './PrintOptionsForm.vue'

type HanziGrid = 'tian' | 'mi' | 'huigong' | 'pinyin-tian'
type EnglishMode = 'word' | 'sentence' | 'dictation'

const store = usePrintStore()
const auth = useAuthStore()

const options = ref<PrintOptions>(defaultPrintOptions())
const hanziGrid = ref<HanziGrid>('tian')
const englishMode = ref<EnglishMode>('word')
const busy = ref(false)
const message = ref('')
const isError = ref(false)

const sourceKind = computed<string>(() => store.source?.kind ?? '')

const isPractice = computed<boolean>(
  () =>
    store.source?.kind === 'hanzi' ||
    store.source?.kind === 'english' ||
    store.source?.kind === 'pinyin-word'
)

watch(
  () => store.visible,
  (visible) => {
    if (!visible) return
    const base = defaultPrintOptions()
    base.header.title = store.meta.title ?? ''
    base.header.duration = store.meta.duration ?? null
    base.header.totalScore = store.meta.totalScore ?? null
    base.template = store.meta.template ?? (isPractice.value ? 'copybook' : 'exam')
    if (isPractice.value) base.parts = ['student']
    if (store.source?.kind === 'hanzi') hanziGrid.value = store.source.grid
    if (store.source?.kind === 'english') englishMode.value = store.source.mode
    options.value = base
    message.value = ''
    isError.value = false
  }
)

function buildRequest(): PrintRequest | null {
  if (!store.source || !auth.currentUser) {
    message.value = '请先选择用户'
    isError.value = true
    return null
  }
  return {
    userId: auth.currentUser.id,
    source:
      store.source.kind === 'hanzi'
        ? { ...store.source, grid: hanziGrid.value }
        : store.source.kind === 'english'
          ? { ...store.source, mode: englishMode.value }
          : store.source,
    options: {
      ...options.value,
      parts: isPractice.value ? ['student'] : [...options.value.parts]
    }
  }
}

async function run(action: 'preview' | 'save' | 'print'): Promise<void> {
  if (busy.value) return
  const request = buildRequest()
  if (!request) return
  busy.value = true
  message.value = ''
  isError.value = false
  try {
    if (action === 'preview') {
      await printApi.preview(request)
      store.close()
      return
    }
    if (action === 'save') {
      const result = await printApi.save(request)
      if (!result.canceled) message.value = `已保存：${result.path ?? ''}`
      return
    }
    await printApi.print(request)
    store.close()
  } catch (cause) {
    isError.value = true
    message.value = cause instanceof Error ? cause.message : '打印失败，请重试'
  } finally {
    busy.value = false
  }
}

function preview(): void {
  void run('preview')
}

function save(): void {
  void run('save')
}

function print(): void {
  void run('print')
}
</script>

<style scoped>
.print-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 72vh;
  overflow-y: auto;
  padding-right: 4px;
}

.dialog-message {
  margin: 0;
  font-size: 12px;
  color: var(--success);
}

.dialog-message.is-error {
  color: var(--danger);
}

.dialog-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.dialog-footer .grow {
  flex: 1;
}
</style>
