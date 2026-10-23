<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">{{ t.incentive.achievementsDesc }}</p>
        <h1 class="page-title">{{ t.incentive.achievementsTitle }}</h1>
      </div>
      <span v-if="achievements.length > 0" class="progress num">{{ progressText }}</span>
    </header>

    <div v-if="loading" class="paper-card panel">
      <div class="empty-state compact">
        <i class="pi pi-spin pi-spinner" />
        <div class="title">{{ t.common.status.loading }}</div>
      </div>
    </div>

    <div v-else-if="error" class="paper-card panel">
      <div class="empty-state compact">
        <i class="pi pi-exclamation-circle" />
        <div class="title">{{ t.common.status.error }}</div>
        <div class="hint">{{ error }}</div>
      </div>
    </div>

    <div v-else-if="achievements.length === 0" class="paper-card panel">
      <div class="empty-state compact">
        <i class="pi pi-trophy" />
        <div class="title">{{ t.common.status.empty }}</div>
      </div>
    </div>

    <section v-else class="achievement-grid">
      <article
        v-for="item in achievements"
        :key="item.code"
        class="achievement-card"
        :class="{ unlocked: item.unlocked }"
      >
        <div class="card-main">
          <h2 class="card-title">{{ item.title }}</h2>
          <p class="card-desc">{{ item.description }}</p>
        </div>
        <div class="card-foot">
          <span class="status" :class="item.unlocked ? 'on' : 'off'">
            {{ item.unlocked ? t.incentive.achievementsUnlocked : t.incentive.achievementsLocked }}
          </span>
          <span v-if="item.unlocked" class="date num">{{ formatDate(item.unlockedAt) }}</span>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { incentiveApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { t } from '@/i18n'
import type { AchievementItem } from '@shared/types'

const auth = useAuthStore()

const achievements = ref<AchievementItem[]>([])
const loading = ref(true)
const error = ref('')

const unlockedCount = computed<number>(
  () => achievements.value.filter((item) => item.unlocked).length
)

const progressText = computed<string>(() =>
  t.incentive.achievementsProgress
    .replace('{done}', String(unlockedCount.value))
    .replace('{total}', String(achievements.value.length))
)

function formatDate(value: string | null): string {
  return value ? value.slice(0, 10) : ''
}

async function load(): Promise<void> {
  if (!auth.currentUser) {
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    achievements.value = await incentiveApi.achievements(auth.currentUser.id)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : ''
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page {
  font-size: 13.5px;
}

.panel {
  padding: 14px 20px;
}

.progress {
  color: var(--ink-soft);
  font-size: 13px;
  letter-spacing: 0.04em;
}

.achievement-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.achievement-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  min-height: 132px;
  padding: 16px 18px;
  background: var(--bg-raised);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.achievement-card.unlocked {
  border-color: var(--line-strong);
  background: linear-gradient(180deg, var(--accent-soft), transparent 72%), var(--bg-raised);
}

.card-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-title {
  font-size: 14.5px;
  color: var(--ink);
}

.card-desc {
  margin: 0;
  color: var(--ink-soft);
  font-size: 12.5px;
  line-height: 1.7;
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--line);
}

.status {
  font-size: 12px;
  letter-spacing: 0.04em;
}

.status.on {
  color: var(--accent);
}

.status.off {
  color: var(--ink-faint);
}

.date {
  color: var(--ink-faint);
  font-size: 11.5px;
}

@media (max-width: 1000px) {
  .achievement-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
