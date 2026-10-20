<template>
  <Dialog
    :visible="visible"
    modal
    :header="t.wrongbook.detailTitle"
    :style="{ width: 'min(680px, 92vw)' }"
    :dismissable-mask="false"
    :draggable="false"
    @update:visible="onVisibleChange"
  >
    <div v-if="item" class="detail">
      <div class="row detail-tags">
        <Tag :value="t.common.questionTypes[item.question.type]" severity="secondary" />
        <Tag
          :value="t.common.difficulty[item.question.difficulty]"
          :severity="difficultySeverity(item.question.difficulty)"
        />
        <Tag v-if="isCustomQuestionId(item.question.id)" :value="t.common.generated" severity="info" />
        <span class="subject-name">{{ subjectName }}</span>
      </div>

      <QuestionRenderer
        :question="item.question"
        :model-value="null"
        readonly
        show-correct
        :correct-answer="item.question.answer"
      />

      <section v-if="item.question.solution" class="detail-block">
        <div class="detail-label">{{ t.practice.solution }}</div>
        <div class="detail-solution">
          <LatexText :text="item.question.solution" />
        </div>
      </section>
    </div>

    <template #footer>
      <Button :label="t.common.actions.close" text @click="onVisibleChange(false)" />
      <Button
        v-if="item"
        :label="item.mastered ? t.wrongbook.unmarkMastered : t.wrongbook.markMastered"
        size="small"
        @click="emit('master', item)"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import { t } from '@/i18n'
import { isCustomQuestionId } from '@shared/constants'
import type { WrongBookItem } from '@shared/types'
import QuestionRenderer from '@/components/question/QuestionRenderer.vue'
import LatexText from '@/components/text/LatexText.vue'

defineProps<{
  visible: boolean
  item: WrongBookItem | null
  subjectName: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  master: [item: WrongBookItem]
}>()

function onVisibleChange(value: boolean): void {
  emit('update:visible', value)
}

function difficultySeverity(value: number): 'success' | 'warn' | 'danger' {
  if (value >= 3) return 'danger'
  if (value === 2) return 'warn'
  return 'success'
}
</script>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-size: 13.5px;
}

.detail-tags {
  flex-wrap: wrap;
}

.subject-name {
  font-size: 12.5px;
  color: var(--ink-soft);
  letter-spacing: 0.04em;
}

.detail-block {
  padding-top: 12px;
  border-top: 1px dashed var(--line);
}

.detail-label {
  font-size: 11.5px;
  letter-spacing: 0.08em;
  color: var(--ink-faint);
  margin-bottom: 6px;
}

.detail-answer {
  font-size: 15px;
  color: var(--ink-soft);
}

.detail-solution {
  line-height: 1.75;
  color: var(--ink-soft);
}
</style>
