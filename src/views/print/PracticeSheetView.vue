<template>
  <section class="practice-sheet" :class="`is-${sheet.kind}`">
    <div v-for="(row, rowIndex) in sheet.rows" :key="rowIndex" class="practice-row">
      <span v-if="row.label" class="practice-label">{{ row.label }}</span>

      <template v-if="isEnglish">
        <div class="practice-line">
          <FourLine
            :text="row.cells[0]?.text ?? ''"
            :mode="row.cells[0]?.mode ?? 'blank'"
            :height-mm="sheet.cellMm"
            :font-scale="fontScale"
          />
          <div v-if="row.caption" class="practice-caption">{{ row.caption }}</div>
        </div>
      </template>

      <template v-else>
        <div class="practice-cells">
          <div
            v-for="(cell, cellIndex) in row.cells"
            :key="cellIndex"
            class="practice-cell"
            :class="{ 'is-group-start': cellIndex > 0 && cellIndex % (sheet.cellsPerChar ?? 4) === 0 }"
          >
            <PinyinGrid
              v-if="sheet.grid === 'pinyin-tian'"
              :text="cell.pinyin ?? ''"
              :width-mm="sheet.cellMm"
            />
            <HanziGrid
              :char="cell.text"
              :mode="cell.mode"
              :size-mm="sheet.cellMm"
              :grid="sheet.grid"
              :paths="cell.text ? sheet.glyphs[cell.text] ?? [] : []"
            />
          </div>
        </div>
        <div v-if="row.caption" class="practice-caption">{{ row.caption }}</div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PracticeSheet } from '@shared/print'
import FourLine from './parts/FourLine.vue'
import HanziGrid from './parts/HanziGrid.vue'
import PinyinGrid from './parts/PinyinGrid.vue'

const props = withDefaults(defineProps<{ sheet: PracticeSheet; fontScale?: number }>(), {
  fontScale: 1
})

const isEnglish = computed<boolean>(
  () =>
    props.sheet.kind === 'english-word' ||
    props.sheet.kind === 'english-sentence' ||
    props.sheet.kind === 'dictation'
)
</script>

<style scoped>
.practice-line {
  flex: 1;
  min-width: 0;
}

.practice-cell.is-group-start {
  margin-left: 5mm;
}
</style>
