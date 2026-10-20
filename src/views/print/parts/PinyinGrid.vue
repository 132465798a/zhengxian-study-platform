<template>
  <div class="pinyin-grid" :style="{ width: `${widthMm}mm` }">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1="1" x2="100" y2="1" stroke="#5b6b7f" stroke-width="1.2" vector-effect="non-scaling-stroke" />
      <line x1="0" y1="34" x2="100" y2="34" stroke="#9aa8b8" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
      <line x1="0" y1="67" x2="100" y2="67" stroke="#9aa8b8" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
      <line x1="0" y1="99" x2="100" y2="99" stroke="#5b6b7f" stroke-width="1.2" vector-effect="non-scaling-stroke" />
    </svg>
    <span v-if="text" class="pinyin-text">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{ text: string; widthMm: number }>()
</script>

<style scoped>
.pinyin-grid {
  position: relative;
  height: 8mm;
}

.pinyin-grid svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.pinyin-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
  font-size: 8.5pt;
  line-height: 1;
  color: #1b2430;
  letter-spacing: 0.02em;
}
</style>
