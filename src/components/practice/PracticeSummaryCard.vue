<template>
  <div class="paper-card summary-card">
    <p class="summary-eyebrow">CURRENT SETUP</p>
    <h2>{{ subjectName }}</h2>
    <p v-if="customSummary" class="custom-summary">{{ customSummary }}</p>
    <ul class="summary-list">
      <li>
        <span>{{ t.practice.grade }}</span>
        <strong>{{ t.common.gradeText(grade) }}</strong>
      </li>
      <li>
        <span>{{ t.practice.types }}</span>
        <strong>{{ t.common.typeCountText(typeCount) }}</strong>
      </li>
      <li>
        <span>{{ t.practice.count }}</span>
        <strong>{{ count }} {{ t.practice.countUnit }}</strong>
      </li>
      <li>
        <span>{{ t.practice.mode }}</span>
        <strong>{{ modeLabel }}</strong>
      </li>
    </ul>

    <div v-if="!customSummary" class="availability">
      <span class="num">{{ availability }}</span>
      <span>{{ t.common.units.question }}{{ t.common.availableText }}</span>
    </div>

    <Button
      :label="starting ? t.practice.creating : t.practice.start"
      icon="pi pi-arrow-right"
      icon-pos="right"
      :loading="starting"
      :disabled="!canStart || (!customSummary && availability === 0)"
      class="start-btn"
      @click="emit('start')"
    />

    <p v-if="!customSummary && availability === 0" class="warn">
      {{ t.practice.emptyQuestions }}。{{ t.practice.emptyQuestionsHint }}
    </p>
    <p v-else class="hint">{{ t.practice.shortcutHint }}</p>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { t } from '@/i18n'

defineProps<{
  subjectName: string
  grade: number
  typeCount: number
  count: number
  modeLabel: string
  availability: number
  customSummary?: string | null
  canStart: boolean
  starting: boolean
}>()

const emit = defineEmits<{ start: [] }>()
</script>

<style scoped>
.summary-card {
  padding: 22px;
}

.summary-eyebrow {
  font-size: 10.5px;
  letter-spacing: 0.22em;
  color: var(--ink-faint);
  margin: 0 0 6px;
}

.summary-card h2 {
  font-size: 24px;
  letter-spacing: 0.05em;
  margin-bottom: 14px;
}

.custom-summary {
  margin: -6px 0 12px;
  font-size: 12.5px;
  color: var(--accent);
}

.summary-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
  border-top: 1px dashed var(--line);
  padding-top: 14px;
}

.summary-list li {
  display: flex;
  justify-content: space-between;
  font-size: 12.5px;
}

.summary-list span {
  color: var(--ink-faint);
}

.summary-list strong {
  font-family: var(--font-num);
  color: var(--ink);
}

.availability {
  margin: 16px 0 12px;
  padding: 12px 14px;
  border-radius: 9px;
  background: var(--bg-sunken);
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.availability .num {
  font-size: 26px;
  color: var(--ink);
}

.availability span:last-child {
  font-size: 11.5px;
  color: var(--ink-faint);
}

.start-btn {
  width: 100%;
}

.hint,
.warn {
  margin: 12px 0 0;
  font-size: 11.5px;
  line-height: 1.7;
  color: var(--ink-faint);
}

.warn {
  color: var(--accent);
}
</style>
