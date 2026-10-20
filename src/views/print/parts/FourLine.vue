<template>
  <div class="four-line" :style="{ height: `${heightMm}mm` }">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1="1" x2="100" y2="1" stroke="#5b6b7f" stroke-width="1.2" vector-effect="non-scaling-stroke" />
      <line x1="0" y1="34" x2="100" y2="34" stroke="#9aa8b8" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
      <line x1="0" y1="67" x2="100" y2="67" stroke="#9aa8b8" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
      <line x1="0" y1="99" x2="100" y2="99" stroke="#5b6b7f" stroke-width="1.2" vector-effect="non-scaling-stroke" />
    </svg>
    <span
      v-if="text"
      class="four-line-text"
      :class="{ 'is-trace': mode === 'trace' }"
      :style="{ fontSize: `${(heightMm * 0.67 * fontScale).toFixed(2)}mm` }"
    >{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    text: string
    mode?: 'model' | 'trace' | 'blank'
    heightMm?: number
    fontScale?: number
  }>(),
  { mode: 'model', heightMm: 12, fontScale: 1 }
)
</script>

<style scoped>
.four-line {
  position: relative;
  width: 100%;
}

.four-line svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.four-line-text {
  position: absolute;
  left: 2mm;
  /* 基线略高于第三条线，视觉上更居中 */
  bottom: calc(33% - 0.05em);
  font-family: Andika, 'Segoe UI', Arial, sans-serif;
  line-height: 1;
  white-space: pre;
  color: #1b2430;
}

.four-line-text.is-trace {
  color: #c7d0dc;
}
</style>
