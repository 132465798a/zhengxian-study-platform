<template>
  <div class="growth-chart">
    <div v-if="loading" class="empty">{{ t.common.status.loading }}</div>
    <div v-else-if="points.length === 0" class="empty">{{ t.incentive.growthEmpty }}</div>
    <div v-else class="chart">
      <div
        v-for="(point, index) in points"
        :key="point.date"
        class="slot"
        :title="`${point.date} +${point.delta}`"
      >
        <div class="track">
          <div
            v-if="point.delta > 0"
            class="bar"
            :style="{ height: `${barHeight(point.delta)}px` }"
          />
        </div>
        <span class="label num">{{ showLabel(index) ? point.date.slice(5) : '' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { incentiveApi } from '@/api'
import { t } from '@/i18n'
import type { GrowthPoint } from '@shared/types'

const BAR_MAX_HEIGHT = 104

const props = withDefaults(defineProps<{ userId: number; days?: number }>(), { days: 14 })

const raw = ref<GrowthPoint[]>([])
const loading = ref(true)

const points = computed<GrowthPoint[]>(() => {
  if (raw.value.length === 0) return []
  const deltas = new Map(raw.value.map((point) => [point.date, point.delta]))
  const span = Math.max(1, Math.round(props.days))
  const today = new Date()
  const list: GrowthPoint[] = []
  for (let offset = span - 1; offset >= 0; offset -= 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
    const key = dateKey(day)
    list.push({ date: key, delta: deltas.get(key) ?? 0 })
  }
  return list
})

const maxDelta = computed(() => points.value.reduce((max, point) => Math.max(max, point.delta), 0))

const step = computed(() => Math.max(1, Math.ceil(points.value.length / 5)))

function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function showLabel(index: number): boolean {
  return index % step.value === 0
}

function barHeight(delta: number): number {
  if (maxDelta.value <= 0) return 0
  return Math.max(3, Math.round((delta / maxDelta.value) * BAR_MAX_HEIGHT))
}

async function load(): Promise<void> {
  loading.value = true
  try {
    raw.value = await incentiveApi.growth(props.userId, props.days)
  } catch {
    raw.value = []
  } finally {
    loading.value = false
  }
}

watch([() => props.userId, () => props.days], () => void load(), { immediate: true })
</script>

<style scoped>
.growth-chart {
  width: 100%;
}

.chart {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 140px;
  padding-top: 4px;
}

.slot {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
}

.track {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
}

.bar {
  width: 100%;
  border-radius: 2px 2px 0 0;
  background: var(--accent);
  opacity: 0.65;
  transition: opacity 0.15s ease;
}

.slot:hover .bar {
  opacity: 1;
}

.label {
  height: 13px;
  margin-top: 4px;
  font-size: 10px;
  line-height: 13px;
  color: var(--ink-faint);
  white-space: nowrap;
}

.empty {
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--ink-faint);
}
</style>
