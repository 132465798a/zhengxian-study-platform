<template>
  <section class="paper-card score-card">
    <div v-if="showScore" class="score-main">
      <span class="score-label">{{ t.exam.score }}</span>
      <div class="score-value num">
        <strong>{{ result.userScore }}</strong>
        <span>/ {{ result.totalScore }}</span>
      </div>
      <span class="muted score-unit">{{ t.common.units.score }}</span>
    </div>

    <div class="stat-grid score-stats">
      <div class="stat-tile">
        <div class="label">{{ t.exam.accuracy }}</div>
        <div class="value small num">{{ result.accuracy }}<small>%</small></div>
      </div>
      <div class="stat-tile">
        <div class="label">{{ t.exam.durationUsed }}</div>
        <div class="value small time">{{ t.common.formatDuration(result.durationSec) }}</div>
      </div>
      <div class="stat-tile">
        <div class="label">{{ t.practice.correct }}</div>
        <div class="value small num">
          {{ result.correctCount }}<small>/ {{ result.questionCount }}</small>
        </div>
      </div>
      <div v-if="result.wrongCount > 0" class="stat-tile">
        <div class="label">{{ t.practice.wrong }}</div>
        <div class="value small num wrong">{{ result.wrongCount }}</div>
      </div>
      <div v-if="result.pendingCount > 0" class="stat-tile">
        <div class="label">{{ t.practice.pending }}</div>
        <div class="value small num">{{ result.pendingCount }}</div>
      </div>
      <div v-if="result.growthGained !== undefined" class="stat-tile">
        <div class="label">{{ t.incentive.growth }}</div>
        <div class="value small num growth">+{{ result.growthGained }}</div>
      </div>
    </div>

    <p v-if="unlockedTitles.length" class="unlock-line">
      <i class="pi pi-trophy" />
      {{ t.incentive.achievementsUnlocked }}：{{ unlockedTitles.join('、') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n'
import { achievementTitle } from '@shared/constants'
import type { SessionResult } from '@shared/types'

const props = defineProps<{ result: SessionResult; showScore?: boolean }>()

const unlockedTitles = computed<string[]>(() =>
  (props.result.unlockedAchievements ?? []).map((code) => achievementTitle(code))
)
</script>

<style scoped>
.score-card {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 28px;
  padding: 24px 28px;
}

.score-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-right: 28px;
  border-right: 1px solid var(--line);
  flex-shrink: 0;
}

.score-label {
  font-size: 11.5px;
  letter-spacing: 0.12em;
  color: var(--ink-faint);
}

.score-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--ink);
}

.score-value strong {
  font-family: var(--font-num);
  font-size: 48px;
  line-height: 1;
  font-weight: 700;
}

.score-value span {
  font-size: 16px;
  color: var(--ink-faint);
}

.score-unit {
  font-size: 11.5px;
}

.score-stats {
  flex: 1;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
}

.score-stats .stat-tile {
  box-shadow: none;
  background: var(--bg);
}

.score-stats .value small {
  font-size: 12px;
  color: var(--ink-faint);
  margin-left: 3px;
}

.score-stats .value.time {
  font-family: var(--font-body);
  font-size: 17px;
}

.score-stats .value.wrong {
  color: var(--accent);
}

.score-stats .value.growth {
  color: var(--accent);
}

.unlock-line {
  flex-basis: 100%;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--accent);
}

@media (max-width: 900px) {
  .score-card {
    flex-direction: column;
    align-items: stretch;
    gap: 18px;
  }
  .score-main {
    border-right: none;
    border-bottom: 1px solid var(--line);
    padding-right: 0;
    padding-bottom: 14px;
  }
}
</style>
