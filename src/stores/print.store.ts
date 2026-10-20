import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PrintSource, PrintTemplate } from '@shared/print'

export interface PrintEntryMeta {
  title?: string
  subject?: string
  grade?: number
  duration?: number | null
  totalScore?: number | null
  template?: PrintTemplate
}

export const usePrintStore = defineStore('print', () => {
  const visible = ref(false)
  const source = ref<PrintSource | null>(null)
  const meta = ref<PrintEntryMeta>({})

  function open(next: PrintSource, info: PrintEntryMeta = {}): void {
    source.value = next
    meta.value = info
    visible.value = true
  }

  function close(): void {
    visible.value = false
  }

  return { visible, source, meta, open, close }
})
