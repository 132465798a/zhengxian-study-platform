<template>
  <svg
    class="hanzi-grid"
    :width="`${sizeMm}mm`"
    :height="`${sizeMm}mm`"
    viewBox="0 0 1024 1024"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="8"
      y="8"
      width="1008"
      height="1008"
      fill="none"
      stroke="#5b6b7f"
      stroke-width="8"
    />
    <line
      v-if="grid !== 'square'"
      x1="512"
      y1="8"
      x2="512"
      y2="1016"
      stroke="#9aa8b8"
      stroke-width="5"
      stroke-dasharray="16 14"
    />
    <line
      v-if="grid !== 'square'"
      x1="8"
      y1="512"
      x2="1016"
      y2="512"
      stroke="#9aa8b8"
      stroke-width="5"
      stroke-dasharray="16 14"
    />
    <template v-if="grid === 'mi'">
      <line x1="8" y1="8" x2="1016" y2="1016" stroke="#c2cbd6" stroke-width="4" stroke-dasharray="14 14" />
      <line x1="1016" y1="8" x2="8" y2="1016" stroke="#c2cbd6" stroke-width="4" stroke-dasharray="14 14" />
    </template>
    <rect
      v-if="grid === 'huigong'"
      x="260"
      y="260"
      width="504"
      height="504"
      fill="none"
      stroke="#c2cbd6"
      stroke-width="4"
      stroke-dasharray="12 12"
    />

    <template v-if="mode !== 'blank'">
      <g v-if="paths.length > 0" transform="translate(0, 900) scale(1, -1)">
        <path v-for="(path, index) in paths" :key="index" :d="path" :fill="fillColor" />
      </g>
      <text
        v-else
        x="512"
        y="770"
        text-anchor="middle"
        font-family="KaiTi, STKaiti, 'Kaiti SC', serif"
        font-size="700"
        :fill="fillColor"
      >
        {{ char }}
      </text>
    </template>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PrintGrid } from '@shared/print'

const props = defineProps<{
  char: string
  mode: 'model' | 'trace' | 'blank'
  sizeMm: number
  grid: PrintGrid
  paths: string[]
}>()

const fillColor = computed<string>(() => (props.mode === 'trace' ? '#c7d0dc' : '#1b2430'))
</script>

<style scoped>
.hanzi-grid {
  display: block;
  /* 底边描边贴近 viewBox 边缘，默认 hidden 会把它裁掉 */
  overflow: visible;
}
</style>
