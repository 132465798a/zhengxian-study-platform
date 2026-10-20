<template>
  <div class="question-body">
    <p class="hint">{{ t.practice.matchHint }}</p>

    <div
      v-if="leftItems.length > 0"
      ref="boardRef"
      class="match-board"
      :class="{ 'is-dragging': dragging !== null }"
    >
      <div class="match-columns">
        <div class="match-col">
          <div
            v-for="(item, index) in leftItems"
            :key="`left-${index}`"
            class="match-card left-card"
            :class="{ linked: isLeftLinked(index) }"
            :data-left="index"
          >
            <span class="match-index">{{ index + 1 }}</span>
            <div class="match-body">
              <span class="match-text"><LatexText :text="item" /></span>
              <span v-if="rowState(index) === 'wrong'" class="match-correct">
                {{ t.practice.correctAnswer }}
                <LatexText :text="correctMap[String(index)] ?? ''" />
              </span>
            </div>

            <button
              v-if="!readonly"
              type="button"
              class="match-anchor"
              :class="{ linked: isLeftLinked(index) }"
              :data-left="index"
              :aria-label="t.practice.matchHint"
              @click="onAnchorClick(index)"
            />
            <span v-else-if="isLeftLinked(index)" class="match-dot dot-right" />
          </div>
        </div>

        <div class="match-col">
          <div
            v-for="(item, index) in rightItems"
            :key="`right-${index}`"
            class="match-card right-card"
            :class="{ linked: linkedRight.has(item), 'drop-hover': hoverRight === index }"
            :data-right="index"
          >
            <span v-if="linkedRight.has(item)" class="match-dot dot-left" />
            <span class="match-text"><LatexText :text="item" /></span>
          </div>
        </div>
      </div>

      <svg class="match-lines" aria-hidden="true">
        <path
          v-for="line in lines"
          :key="line.key"
          class="match-line"
          :class="line.state"
          :d="line.d"
        />
        <path v-if="dragPath !== null" class="match-line drag-line" :d="dragPath" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import interact from 'interactjs'
import LatexText from '@/components/text/LatexText.vue'
import { t } from '@/i18n'
import type { Question } from '@shared/types'

interface MatchingOptions {
  left: string[]
  right: string[]
}

interface Point {
  x: number
  y: number
}

interface MatchLine {
  key: string
  d: string
  state: 'correct' | 'wrong' | ''
}

const props = defineProps<{
  question: Question
  modelValue: unknown
  readonly?: boolean
  showCorrect?: boolean
  correctAnswer?: unknown
}>()

const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return (value as unknown[]).filter((item): item is string => typeof item === 'string')
}

function toTextMap(value: unknown): Record<string, string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, string> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === 'string') result[key] = item
  }
  return result
}

const options = computed<MatchingOptions>(() => {
  const value = props.question.options
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { left: [], right: [] }
  }
  const record = value as Record<string, unknown>
  return { left: toStringList(record.left), right: toStringList(record.right) }
})

const leftItems = computed<string[]>(() => options.value.left)
const rightItems = computed<string[]>(() => options.value.right)
const answers = computed<Record<string, string>>(() => toTextMap(props.modelValue))
const correctMap = computed<Record<string, string>>(() =>
  toTextMap(props.correctAnswer ?? props.question.answer)
)

const linkedRight = computed<Set<string>>(() => new Set(Object.values(answers.value)))

const boardRef = ref<HTMLDivElement | null>(null)
const leftPoints = ref<Point[]>([])
const rightPoints = ref<Point[]>([])
const stacked = ref(false)
const dragging = ref<{ from: number; x: number; y: number } | null>(null)
const hoverRight = ref<number | null>(null)

let anchors: HTMLElement[] = []
let observer: ResizeObserver | null = null
let lastDragEnd = 0

function normalize(value: string | undefined): string {
  return (value ?? '').trim()
}

function isLeftLinked(index: number): boolean {
  return normalize(answers.value[String(index)]).length > 0
}

function rowState(index: number): 'correct' | 'wrong' | '' {
  if (props.showCorrect !== true) return ''
  const expected = correctMap.value[String(index)]
  if (expected === undefined) return ''
  return normalize(answers.value[String(index)]) === normalize(expected) ? 'correct' : 'wrong'
}

function curvePath(from: Point, to: Point): string {
  if (stacked.value) {
    const dy = Math.max(24, Math.abs(to.y - from.y) * 0.5)
    return `M ${from.x} ${from.y} C ${from.x} ${from.y + dy}, ${to.x} ${to.y - dy}, ${to.x} ${to.y}`
  }
  const dx = Math.max(36, Math.abs(to.x - from.x) * 0.5)
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`
}

const lines = computed<MatchLine[]>(() => {
  const result: MatchLine[] = []
  for (const [key, value] of Object.entries(answers.value)) {
    const from = Number(key)
    if (!Number.isInteger(from)) continue
    const start = leftPoints.value[from]
    const to = rightPoints.value[rightItems.value.indexOf(value)]
    if (start === undefined || to === undefined) continue
    result.push({ key, d: curvePath(start, to), state: rowState(from) })
  }
  return result
})

const dragPath = computed<string | null>(() => {
  const drag = dragging.value
  if (drag === null) return null
  const start = leftPoints.value[drag.from]
  if (start === undefined) return null
  return curvePath(start, { x: drag.x, y: drag.y })
})

function measure(): void {
  const board = boardRef.value
  if (board === null) return
  const boardRect = board.getBoundingClientRect()
  stacked.value = window.matchMedia('(max-width: 640px)').matches

  const leftCards = Array.from(board.querySelectorAll<HTMLElement>('.left-card'))
  leftPoints.value = leftCards.map((card) => {
    const anchor = card.querySelector<HTMLElement>('.match-anchor')
    const rect = anchor === null ? card.getBoundingClientRect() : anchor.getBoundingClientRect()
    if (anchor !== null) {
      return {
        x: rect.left - boardRect.left + rect.width / 2,
        y: rect.top - boardRect.top + rect.height / 2
      }
    }
    const cardRect = card.getBoundingClientRect()
    if (stacked.value) {
      return {
        x: cardRect.left - boardRect.left + cardRect.width / 2,
        y: cardRect.bottom - boardRect.top
      }
    }
    return {
      x: cardRect.right - boardRect.left,
      y: cardRect.top - boardRect.top + cardRect.height / 2
    }
  })

  const rightCards = Array.from(board.querySelectorAll<HTMLElement>('.right-card'))
  rightPoints.value = rightCards.map((card) => {
    const rect = card.getBoundingClientRect()
    if (stacked.value) {
      return {
        x: rect.left - boardRect.left + rect.width / 2,
        y: rect.top - boardRect.top
      }
    }
    return { x: rect.left - boardRect.left, y: rect.top - boardRect.top + rect.height / 2 }
  })
}

function rightAt(clientX: number, clientY: number): number | null {
  const element = document.elementFromPoint(clientX, clientY)
  const card = element?.closest<HTMLElement>('.right-card') ?? null
  if (card === null || card.dataset.right === undefined) return null
  const index = Number(card.dataset.right)
  return Number.isInteger(index) ? index : null
}

function startDrag(index: number): void {
  const start = leftPoints.value[index]
  dragging.value =
    start === undefined ? { from: index, x: 0, y: 0 } : { from: index, x: start.x, y: start.y }
  hoverRight.value = null
}

function moveDrag(event: { clientX: number; clientY: number }): void {
  const drag = dragging.value
  const board = boardRef.value
  if (drag === null || board === null) return
  const rect = board.getBoundingClientRect()
  dragging.value = {
    from: drag.from,
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
  hoverRight.value = rightAt(event.clientX, event.clientY)
}

function endDrag(index: number, event: { clientX: number; clientY: number }): void {
  const target = rightAt(event.clientX, event.clientY)
  dragging.value = null
  hoverRight.value = null
  lastDragEnd = Date.now()
  if (target === null) return

  const right = rightItems.value[target]
  if (right === undefined) return

  const next = { ...answers.value }
  for (const [key, value] of Object.entries(next)) {
    if (value === right) delete next[key]
  }
  next[String(index)] = right
  emit('update:modelValue', next)
}

function onAnchorClick(index: number): void {
  if (props.readonly) return
  if (Date.now() - lastDragEnd < 300) return
  const key = String(index)
  if (!isLeftLinked(index)) return
  const next = { ...answers.value }
  delete next[key]
  emit('update:modelValue', next)
}

function teardownDrag(): void {
  for (const anchor of anchors) interact(anchor).unset()
  anchors = []
}

function setupDrag(): void {
  teardownDrag()
  if (props.readonly) return
  const board = boardRef.value
  if (board === null) return

  for (const anchor of Array.from(board.querySelectorAll<HTMLElement>('.match-anchor'))) {
    const index = Number(anchor.dataset.left)
    if (!Number.isInteger(index)) continue
    anchors.push(anchor)
    interact(anchor).draggable({
      onstart: () => startDrag(index),
      onmove: (event) => moveDrag(event),
      onend: (event) => endDrag(index, event)
    })
  }
}

onMounted(async () => {
  await nextTick()
  measure()
  setupDrag()
  if (boardRef.value !== null) {
    observer = new ResizeObserver(() => measure())
    observer.observe(boardRef.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  teardownDrag()
})

watch(
  [() => props.question, () => props.readonly],
  async () => {
    await nextTick()
    measure()
    setupDrag()
  },
  { flush: 'post' }
)

watch(
  [answers, () => props.showCorrect],
  async () => {
    await nextTick()
    measure()
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

.match-board {
  position: relative;
}

.match-board.is-dragging {
  user-select: none;
  cursor: crosshair;
}

.match-columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0 120px;
}

.match-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.match-card {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--bg-sunken);
  font-size: 13.5px;
  line-height: 1.7;
  transition: background 0.15s ease;
}

.match-card:hover {
  background: var(--accent-soft);
}

.match-card.drop-hover {
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.left-card {
  padding-right: 22px;
}

.right-card {
  padding-left: 18px;
}

.match-index {
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

.match-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.match-text {
  min-width: 0;
}

.match-correct {
  color: var(--danger);
  font-size: 12.5px;
}

.match-anchor {
  position: absolute;
  top: 50%;
  right: -9px;
  z-index: 3;
  width: 18px;
  height: 18px;
  margin: 0;
  padding: 0;
  border: 2px solid var(--line-strong);
  border-radius: 50%;
  background: var(--bg);
  transform: translateY(-50%);
  cursor: crosshair;
  touch-action: none;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.match-anchor::after {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  background: transparent;
  transition: background 0.15s ease;
}

.match-anchor:hover,
.match-anchor.linked {
  border-color: var(--accent);
}

.match-anchor:hover::after,
.match-anchor.linked::after {
  background: var(--accent);
}

.match-dot {
  position: absolute;
  z-index: 1;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
}

.dot-right {
  top: 50%;
  right: -4px;
  transform: translateY(-50%);
}

.dot-left {
  top: 50%;
  left: -4px;
  transform: translateY(-50%);
}

.match-lines {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.match-line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-linecap: round;
}

.match-line.correct {
  stroke: var(--success);
}

.match-line.wrong {
  stroke: var(--danger);
}

.drag-line {
  stroke-dasharray: 5 5;
  opacity: 0.7;
}

@media (max-width: 640px) {
  .match-columns {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px 0;
  }

  .left-card {
    padding-right: 12px;
    padding-bottom: 24px;
  }

  .right-card {
    padding-top: 18px;
    padding-left: 12px;
  }

  .match-anchor {
    top: auto;
    right: auto;
    bottom: -9px;
    left: 50%;
    transform: translateX(-50%);
  }

  .dot-right {
    top: auto;
    right: auto;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
  }

  .dot-left {
    top: -4px;
    left: 50%;
    transform: translateX(-50%);
  }
}
</style>
