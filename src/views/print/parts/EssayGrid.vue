<template>
  <div class="essay-wrap">
    <div v-if="marks.length > 0" class="essay-marks" :style="{ height: `${rows * sizeMm}mm` }">
      <span
        v-for="item in marks"
        :key="item.value"
        class="essay-mark"
        :style="{ top: `${item.top}mm` }"
      >{{ item.value }}</span>
    </div>
    <div class="essay-grid" :style="gridStyle">
      <span
        v-for="index in rows * columns"
        :key="index"
        class="essay-cell"
        :style="cellStyle"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    rows: number
    columns?: number
    cellMm?: number
    mark?: boolean
  }>(),
  { columns: 20, cellMm: 8, mark: false }
)

const sizeMm = computed(() => props.cellMm)

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${props.columns}, ${props.cellMm}mm)`
}))

const cellStyle = computed(() => ({
  width: `${props.cellMm}mm`,
  height: `${props.cellMm}mm`
}))

/** 每 100 字打一个刻度，按整行取整 */
const marks = computed<Array<{ value: number; top: number }>>(() => {
  if (!props.mark) return []
  const rowsPer100 = Math.max(1, Math.round(100 / props.columns))
  const list: Array<{ value: number; top: number }> = []
  for (let row = rowsPer100; row <= props.rows; row += rowsPer100) {
    list.push({ value: row * props.columns, top: row * props.cellMm })
  }
  return list
})
</script>

<style scoped>
.essay-wrap {
  display: flex;
  align-items: flex-start;
  gap: 1.5mm;
  margin-left: 8.5mm;
}

.essay-marks {
  position: relative;
  width: 7mm;
  flex: none;
}

.essay-mark {
  position: absolute;
  right: 0;
  transform: translateY(-50%);
  font-size: 8pt;
  color: #8a97a8;
}

.essay-grid {
  display: grid;
  border-top: 0.18mm solid #8a97a8;
  border-left: 0.18mm solid #8a97a8;
  width: fit-content;
}

.essay-cell {
  border-right: 0.18mm solid #8a97a8;
  border-bottom: 0.18mm solid #8a97a8;
}
</style>
