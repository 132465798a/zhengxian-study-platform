<template>
  <div class="question-body">
    <p class="hint">{{ t.practice.sortHint }}</p>

    <div ref="listRef" class="sort-list">
      <div
        v-for="(item, index) in items"
        :key="index"
        class="sort-row"
        :class="[rowState(index), { dragging: dragIndex === index, draggable: !readonly }]"
        :data-index="index"
        :style="rowStyle(index)"
      >
        <span class="sort-index">{{ index + 1 }}</span>
        <span v-if="isStrokeGlyph(item)" class="sort-text stroke-glyph">{{ item }}</span>
        <span v-else class="sort-text"><LatexText :text="item" /></span>
        <div class="sort-actions">
          <button
            type="button"
            class="move"
            :title="t.practice.moveUp"
            :aria-label="t.practice.moveUp"
            :disabled="readonly || index === 0"
            @click="move(index, -1)"
          >
            <i class="pi pi-arrow-up" />
          </button>
          <button
            type="button"
            class="move"
            :title="t.practice.moveDown"
            :aria-label="t.practice.moveDown"
            :disabled="readonly || index === items.length - 1"
            @click="move(index, 1)"
          >
            <i class="pi pi-arrow-down" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import interact from 'interactjs'
import LatexText from '@/components/text/LatexText.vue'
import { t } from '@/i18n'
import type { Question } from '@shared/types'

const props = defineProps<{
  question: Question
  modelValue: unknown
  readonly?: boolean
  showCorrect?: boolean
  correctAnswer?: unknown
}>()

const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const options = computed<string[]>(() => {
  if (!Array.isArray(props.question.options)) return []
  return (props.question.options as unknown[]).filter(
    (item): item is string => typeof item === 'string'
  )
})

const items = computed<string[]>(() => {
  if (!Array.isArray(props.modelValue)) return options.value
  const current = (props.modelValue as unknown[]).filter(
    (item): item is string => typeof item === 'string'
  )
  return current.length > 0 ? current : options.value
})

const correctOrder = computed<string[]>(() => {
  const value = props.correctAnswer ?? props.question.answer
  if (!Array.isArray(value)) return []
  return (value as unknown[]).filter((item): item is string => typeof item === 'string')
})

const listRef = ref<HTMLDivElement | null>(null)
const dragIndex = ref<number | null>(null)
const dragTarget = ref(0)
const dragOffset = ref(0)

let rowCenters: number[] = []
let dragCenter = 0
let shiftSize = 0
let rows: HTMLElement[] = []

function isStrokeGlyph(text: string): boolean {
  if (text.length !== 1) return false
  const code = text.codePointAt(0) ?? 0
  return code >= 0x31c0 && code <= 0x31e3
}

function rowState(index: number): 'correct' | 'wrong' | '' {
  if (props.showCorrect !== true) return ''
  const expected = correctOrder.value[index]
  if (expected === undefined) return ''
  const actual = items.value[index] ?? ''
  return actual.trim() === expected.trim() ? 'correct' : 'wrong'
}

function rowStyle(index: number): Record<string, string> | undefined {
  if (dragIndex.value === null) return undefined
  if (index === dragIndex.value) return { transform: `translateY(${dragOffset.value}px)` }
  if (dragIndex.value < index && index <= dragTarget.value) {
    return { transform: `translateY(-${shiftSize}px)` }
  }
  if (dragTarget.value <= index && index < dragIndex.value) {
    return { transform: `translateY(${shiftSize}px)` }
  }
  return undefined
}

function move(index: number, offset: number): void {
  if (props.readonly) return
  const target = index + offset
  const current = items.value
  if (target < 0 || target >= current.length) return
  const next = [...current]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  emit('update:modelValue', next)
}

function getRows(): HTMLElement[] {
  if (listRef.value === null) return []
  return Array.from(listRef.value.querySelectorAll<HTMLElement>('.sort-row'))
}

function startDrag(element: HTMLElement): void {
  if (props.readonly) return
  const currentRows = getRows()
  const index = Number(element.dataset.index)
  if (!Number.isInteger(index) || currentRows.length === 0) return

  const rect = element.getBoundingClientRect()
  rowCenters = currentRows.map((row) => {
    const rowRect = row.getBoundingClientRect()
    return rowRect.top + rowRect.height / 2
  })
  dragCenter = rect.top + rect.height / 2

  let gap = 8
  if (currentRows.length > 1) {
    gap = currentRows[1].getBoundingClientRect().top - currentRows[0].getBoundingClientRect().bottom
  }
  shiftSize = rect.height + gap

  dragIndex.value = index
  dragTarget.value = index
  dragOffset.value = 0
}

function moveDrag(dy: number): void {
  const index = dragIndex.value
  if (index === null) return

  // interact 的 dy 是本次移动的增量，需要累加才能得到相对起点的位移
  dragOffset.value += dy
  const center = dragCenter + dragOffset.value
  let target = 0
  for (let i = 0; i < rowCenters.length; i += 1) {
    if (i === index) continue
    if (rowCenters[i] < center) target += 1
  }
  dragTarget.value = target
}

function endDrag(): void {
  const from = dragIndex.value
  const to = dragTarget.value
  dragIndex.value = null
  dragOffset.value = 0
  if (from === null || from === to) return

  const next = [...items.value]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  emit('update:modelValue', next)
}

function teardownDrag(): void {
  for (const row of rows) interact(row).unset()
  rows = []
}

function setupDrag(): void {
  teardownDrag()
  if (props.readonly) return
  if (listRef.value === null) return

  rows = getRows()
  for (const row of rows) {
    interact(row).draggable({
      ignoreFrom: '.sort-actions',
      onstart: () => startDrag(row),
      onmove: (event) => moveDrag(event.dy),
      onend: () => endDrag()
    })
  }
}

onMounted(async () => {
  await nextTick()
  setupDrag()
})

onBeforeUnmount(() => {
  teardownDrag()
})

watch(
  [() => props.question, () => props.readonly, () => items.value.length],
  async () => {
    await nextTick()
    setupDrag()
  },
  { flush: 'post' }
)
</script>

<style scoped>
.question-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hint {
  margin: 0;
  color: var(--ink-faint);
  font-size: 12.5px;
  line-height: 1.6;
}

.sort-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sort-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--bg-sunken);
  font-size: 13.5px;
  line-height: 1.7;
  transition:
    transform 0.1s ease,
    background 0.15s ease;
}

.sort-row.draggable {
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.sort-row.dragging {
  z-index: 3;
  cursor: grabbing;
  background: var(--accent-soft);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  transition: none;
}

.sort-row.correct {
  background: var(--accent-soft);
}

.sort-row.correct .sort-index {
  background: var(--success);
  color: var(--accent-contrast);
}

.sort-row.wrong {
  background: var(--danger-soft);
}

.sort-row.wrong .sort-index {
  background: var(--danger);
  color: var(--accent-contrast);
}

.sort-index {
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--ink-soft);
  font-family: var(--font-num);
  font-size: 12.5px;
  line-height: 24px;
  text-align: center;
}

.sort-text {
  flex: 1;
  min-width: 0;
}

.sort-text.stroke-glyph {
  font-size: 30px;
  line-height: 1.1;
}

.sort-actions {
  display: flex;
  flex: none;
  gap: 4px;
}

.move {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg-raised);
  color: var(--ink-soft);
  font-size: 11px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease;
}

.move:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.move:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
