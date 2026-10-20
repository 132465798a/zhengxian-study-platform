<template>
  <article class="paper-card wrong-item">
    <div class="item-head">
      <div class="row tags">
        <Tag :value="t.common.questionTypes[item.question.type]" severity="secondary" />
        <Tag
          :value="t.common.difficulty[item.question.difficulty]"
          :severity="difficultySeverity(item.question.difficulty)"
        />
        <Tag v-if="isCustomQuestionId(item.question.id)" :value="t.common.generated" severity="info" />
        <span class="subject-name">{{ subjectName }}</span>
        <Tag v-if="item.mastered" :value="t.wrongbook.statusMastered" severity="success" />
      </div>
      <div class="item-meta muted">
        <span>{{ t.wrongbook.wrongCount }} · {{ item.wrongCount }} {{ t.common.units.times }}</span>
        <span>{{ t.wrongbook.lastWrong }} · {{ shortTime(item.lastWrongAt) }}</span>
      </div>
    </div>

    <div class="stem">
      <LatexText :text="item.question.stem" />
    </div>

    <div class="item-actions">
      <Button
        :label="t.practice.showSolution"
        icon="pi pi-search"
        size="small"
        text
        @click="emit('detail', item)"
      />
      <Button
        :label="item.mastered ? t.wrongbook.unmarkMastered : t.wrongbook.markMastered"
        :icon="item.mastered ? 'pi pi-undo' : 'pi pi-check'"
        size="small"
        text
        @click="emit('master', item)"
      />
      <Button
        :label="t.wrongbook.remove"
        icon="pi pi-trash"
        size="small"
        text
        severity="danger"
        @click="emit('remove', item)"
      />
    </div>
  </article>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { t } from '@/i18n'
import { isCustomQuestionId } from '@shared/constants'
import type { WrongBookItem } from '@shared/types'
import LatexText from '@/components/text/LatexText.vue'

defineProps<{
  item: WrongBookItem
  subjectName: string
}>()

const emit = defineEmits<{
  master: [item: WrongBookItem]
  remove: [item: WrongBookItem]
  detail: [item: WrongBookItem]
}>()

function difficultySeverity(value: number): 'success' | 'warn' | 'danger' {
  if (value >= 3) return 'danger'
  if (value === 2) return 'warn'
  return 'success'
}

function shortTime(value: string | null): string {
  return value ? value.slice(0, 16) : '—'
}
</script>

<style scoped>
.wrong-item {
  padding: 16px 18px;
}

.item-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.tags {
  flex-wrap: wrap;
}

.subject-name {
  font-size: 12.5px;
  color: var(--ink-soft);
  letter-spacing: 0.04em;
}

.item-meta {
  display: flex;
  gap: 14px;
  font-size: 12px;
  white-space: nowrap;
}

.stem {
  margin-top: 10px;
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--ink);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed var(--line);
}
</style>
