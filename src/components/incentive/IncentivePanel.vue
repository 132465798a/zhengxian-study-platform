<template>
  <section class="paper-card panel">
    <template v-if="overview">
      <div>
        <p class="eyebrow">{{ t.incentive.growth }}</p>
        <div class="growth">
          <span class="growth-value num">{{ overview.growth }}</span>
          <span class="level-name">{{ overview.level.name }}</span>
        </div>
      </div>

      <div>
        <div class="level-head">
          <span>{{ t.incentive.level }} {{ overview.level.index }}</span>
          <span v-if="overview.level.nextAt === null" class="remain">
            {{ t.incentive.maxLevel }}
          </span>
          <span v-else class="remain num">
            {{ t.incentive.nextLevel(remaining) }}{{ t.incentive.points }}
          </span>
        </div>
        <div class="progress">
          <div class="progress-fill" :style="{ width: `${progress}%` }" />
        </div>
      </div>

      <dl class="metrics">
        <div class="metric">
          <dt>{{ t.incentive.streak }}</dt>
          <dd class="num">
            {{ overview.streak }}<small>{{ t.incentive.days }}</small>
          </dd>
        </div>
        <div class="metric">
          <dt>{{ t.incentive.todayAnswered }}</dt>
          <dd class="num">
            {{ overview.today.answered }}<small>{{ t.common.units.question }}</small>
          </dd>
        </div>
        <div class="metric">
          <dt>{{ t.incentive.todayAccuracy }}</dt>
          <dd class="num">{{ overview.today.accuracy }}<small>%</small></dd>
        </div>
        <div class="metric">
          <dt>{{ t.incentive.weekGrowth }}</dt>
          <dd class="num">
            {{ overview.weekGrowth }}<small>{{ t.incentive.points }}</small>
          </dd>
        </div>
      </dl>

      <div class="actions">
        <Button
          class="action"
          :label="t.incentive.dailyTitle"
          icon="pi pi-bolt"
          size="small"
          outlined
          @click="router.push('/incentive/daily')"
        />
        <Button
          class="action"
          :label="t.incentive.achievementsTitle"
          icon="pi pi-trophy"
          size="small"
          text
          @click="router.push('/incentive/achievements')"
        />
      </div>
    </template>

    <p v-else-if="failed" class="state">{{ t.common.status.error }}</p>
    <p v-else class="state">{{ t.common.status.loading }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import { incentiveApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { t } from '@/i18n'
import type { IncentiveOverview } from '@shared/types'

const auth = useAuthStore()
const router = useRouter()

const overview = ref<IncentiveOverview | null>(null)
const failed = ref(false)

const remaining = computed(() => {
  const data = overview.value
  if (!data || data.level.nextAt === null) return 0
  return Math.max(0, data.level.nextAt - data.growth)
})

const progress = computed(() => {
  const data = overview.value
  if (!data) return 0
  const { min, nextAt } = data.level
  if (nextAt === null) return 100
  const span = nextAt - min
  if (span <= 0) return 100
  return Math.min(100, Math.max(0, Math.round(((data.growth - min) / span) * 100)))
})

async function load(): Promise<void> {
  const userId = auth.currentUser?.id
  if (!userId) return
  failed.value = false
  try {
    overview.value = await incentiveApi.overview(userId)
  } catch {
    overview.value = null
    failed.value = true
  }
}

onMounted(load)

watch(
  () => auth.currentUser?.id,
  () => {
    void load()
  }
)
</script>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.eyebrow {
  margin: 0 0 4px;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--ink-faint);
}

.growth {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.growth-value {
  font-size: 38px;
  line-height: 1.05;
  color: var(--ink);
}

.level-name {
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--accent);
}

.level-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: 11.5px;
  color: var(--ink-faint);
}

.remain {
  color: var(--ink-soft);
}

.progress {
  height: 6px;
  margin-top: 7px;
  border-radius: 999px;
  background: var(--bg-sunken);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--accent);
  transition: width 0.3s ease;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 14px;
  margin: 0;
  padding-top: 14px;
  border-top: 1px dashed var(--line);
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.metric dt {
  font-size: 11px;
  color: var(--ink-faint);
}

.metric dd {
  margin: 0;
  font-size: 18px;
  color: var(--ink);
}

.metric dd small {
  margin-left: 3px;
  font-size: 10.5px;
  color: var(--ink-faint);
}

.actions {
  display: flex;
  gap: 8px;
}

.action {
  flex: 1;
  justify-content: center;
}

.state {
  margin: 0;
  padding: 20px 0;
  font-size: 12px;
  color: var(--ink-faint);
}
</style>
