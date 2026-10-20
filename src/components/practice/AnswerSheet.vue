<template>
  <aside class="paper-card sheet">
    <div class="sheet-head">
      <h2 class="section-title">{{ t.practice.questionNav }}</h2>
      <span class="num muted">{{ answeredCount }}/{{ questionIds.length }}</span>
    </div>

    <div class="sheet-grid">
      <button
        v-for="(questionId, index) in questionIds"
        :key="questionId"
        type="button"
        class="sheet-cell"
        :class="cellClass(questionId, index)"
        :title="String(index + 1)"
        @click="emit('go', index)"
      >
        {{ index + 1 }}
      </button>
    </div>

    <div class="legend">
      <span><i class="dot answered" />{{ t.practice.answered }}</span>
      <span><i class="dot correct" />{{ t.practice.correct }}</span>
      <span><i class="dot wrong" />{{ t.practice.wrong }}</span>
    </div>

    <Button :label="t.practice.finish" icon="pi pi-flag" class="finish-btn" @click="emit('finish')" />
    <p class="sheet-hint">{{ t.practice.shortcutHint }}</p>
  </aside>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { t } from '@/i18n'

interface Outcome {
  isCorrect: boolean | null
}

const props = defineProps<{
  questionIds: number[]
  currentIndex: number
  answeredCount: number
  outcomes: Record<number, Outcome>
}>()

const emit = defineEmits<{
  go: [index: number]
  finish: []
}>()

function cellClass(questionId: number, index: number): Record<string, boolean> {
  const result = props.outcomes[questionId]
  return {
    current: props.currentIndex === index,
    answered: Boolean(result),
    correct: result?.isCorrect === true,
    wrong: result?.isCorrect === false,
    pending: result?.isCorrect === null
  }
}
</script>

<style scoped>
.sheet {
  padding: 18px 18px 16px;
  position: sticky;
  top: 18px;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.sheet-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
}

.sheet-cell {
  aspect-ratio: 1;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--bg-raised);
  color: var(--ink-soft);
  font-family: var(--font-num);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sheet-cell:hover {
  border-color: var(--accent);
}

.sheet-cell.answered {
  background: var(--accent-soft);
  border-color: var(--line-strong);
  color: var(--ink);
}

.sheet-cell.correct {
  background: var(--success);
  border-color: var(--success);
  color: var(--accent-contrast);
}

.sheet-cell.wrong {
  background: var(--danger-soft);
  border-color: var(--danger);
  color: var(--danger);
}

.sheet-cell.pending {
  background: var(--bg-sunken);
  color: var(--ink-soft);
}

.sheet-cell.current {
  box-shadow: 0 0 0 2px var(--accent);
}

.legend {
  display: flex;
  gap: 12px;
  margin: 14px 0;
  font-size: 11px;
  color: var(--ink-faint);
}

.legend span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  display: inline-block;
}

.dot.answered {
  background: var(--accent-soft);
  border: 1px solid var(--line-strong);
}

.dot.correct {
  background: var(--success);
}

.dot.wrong {
  background: var(--danger-soft);
  border: 1px solid var(--danger);
}

.finish-btn {
  width: 100%;
}

.sheet-hint {
  margin: 10px 0 0;
  font-size: 10.5px;
  line-height: 1.7;
  color: var(--ink-faint);
}
</style>
