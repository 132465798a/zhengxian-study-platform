<template>
  <section class="answer-sheet">
    <h2 class="sheet-title">答题卡</h2>
    <div class="sheet-info">
      <span>姓名：____________</span>
      <span>班级：____________</span>
      <span>学号：____________</span>
    </div>

    <div v-for="section in document.sections" :key="section.title" class="sheet-section">
      <h3 class="sheet-section-title">{{ section.title }}</h3>

      <div v-if="isObjective(section)" class="sheet-choice-grid">
        <div v-for="question in section.questions" :key="question.no" class="sheet-choice">
          <span>{{ question.no }}.</span>
          <template v-if="question.kind === 'choice'">
            <span
              v-for="(option, index) in question.options"
              :key="index"
              class="sheet-bubble"
            >
              {{ letter(index) }}
            </span>
          </template>
          <template v-else>
            <span class="sheet-bubble">√</span>
            <span class="sheet-bubble">×</span>
          </template>
        </div>
      </div>

      <div v-else>
        <div v-for="question in section.questions" :key="question.no" class="sheet-box">
          <div class="sheet-box-title">{{ question.no }}. 作答区（{{ question.score }} 分）</div>
          <template v-if="question.kind === 'short'">
            <div v-for="index in Math.min(question.lines, 4)" :key="index" class="p-answer-line" />
          </template>
          <template v-else>
            <div class="sheet-line">
              <span>答：</span>
              <span class="p-answer-line" />
            </div>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PrintDocument, PrintSection } from '@shared/print'

defineProps<{ document: PrintDocument }>()

function isObjective(section: PrintSection): boolean {
  return section.questions.every((item) => item.kind === 'choice' || item.kind === 'judge')
}

function letter(index: number): string {
  return String.fromCharCode(65 + index)
}
</script>
