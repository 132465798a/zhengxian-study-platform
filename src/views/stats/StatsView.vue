<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">{{ t.nav.statsDesc }}</p>
        <h1 class="page-title">{{ t.stats.title }}</h1>
        <p class="page-desc">{{ t.stats.desc }}</p>
      </div>
    </header>

    <section class="stat-grid">
      <div class="stat-tile">
        <div class="label">{{ t.stats.answered }}</div>
        <div class="value">{{ overview?.answeredCount ?? 0 }}</div>
        <div class="foot">
          {{ t.stats.correct }} {{ overview?.correctCount ?? 0 }} {{ t.common.units.question }}
        </div>
      </div>
      <div class="stat-tile">
        <div class="label">{{ t.stats.accuracy }}</div>
        <div class="value">{{ overview?.accuracy ?? 0 }}<span class="percent">%</span></div>
        <div class="foot">
          {{ t.stats.practiceCount }} {{ overview?.practiceCount ?? 0 }} {{ t.common.units.times }} ·
          {{ t.stats.examCount }} {{ overview?.examCount ?? 0 }} {{ t.common.units.times }}
        </div>
      </div>
      <div class="stat-tile">
        <div class="label">{{ t.stats.studyTime }}</div>
        <div class="value">{{ overview?.studyMinutes ?? 0 }}</div>
        <div class="foot">{{ t.common.units.minute }}</div>
      </div>
      <div class="stat-tile">
        <div class="label">{{ t.stats.wrongOpen }}</div>
        <div class="value">{{ overview?.wrongCount ?? 0 }}</div>
        <div class="foot">
          {{ t.stats.mastered }} {{ overview?.masteredCount ?? 0 }} {{ t.common.units.question }}
        </div>
      </div>
    </section>

    <div class="two-col">
      <section class="paper-card panel">
        <h2 class="section-title">{{ t.stats.subjectTitle }}</h2>
        <div v-if="subjectStats.length === 0" class="empty-state compact">
          <i class="pi pi-chart-bar" />
          <div class="title">{{ t.stats.subjectEmpty }}</div>
        </div>
        <div v-else class="subject-list">
          <div v-for="row in subjectStats" :key="row.subjectId" class="subject-row">
            <span class="subject-name">{{ row.name }}</span>
            <div class="progress">
              <div class="progress-fill" :style="{ width: `${clamp(row.accuracy)}%` }" />
            </div>
            <span class="subject-value num">{{ row.accuracy }}%</span>
            <span class="subject-count muted">{{ row.answered }} {{ t.common.units.question }}</span>
          </div>
        </div>
      </section>

      <section class="paper-card panel">
        <div class="spread">
          <h2 class="section-title">{{ t.stats.trendTitle }}</h2>
          <div class="legend">
            <span class="legend-item">
              <i class="legend-line" />
              {{ t.stats.trendAccuracy }}
            </span>
            <span class="legend-item">
              <i class="legend-bar" />
              {{ t.stats.trendAnswered }}
            </span>
          </div>
        </div>

        <div v-if="!hasTrendData" class="empty-state compact">
          <i class="pi pi-chart-line" />
          <div class="title">{{ t.stats.subjectEmpty }}</div>
        </div>
        <template v-else>
          <svg
            class="trend-svg"
            viewBox="0 0 1000 160"
            preserveAspectRatio="none"
            role="img"
            :aria-label="t.stats.trendTitle"
          >
            <line
              v-for="line in gridLines"
              :key="line"
              x1="16"
              :y1="line"
              x2="984"
              :y2="line"
              class="grid-line"
              vector-effect="non-scaling-stroke"
            />
            <line
              x1="16"
              y1="150"
              x2="984"
              y2="150"
              class="axis-line"
              vector-effect="non-scaling-stroke"
            />
            <rect
              v-for="(point, index) in chartPoints"
              :key="`bar-${index}`"
              :x="point.x - 7"
              :y="150 - point.barHeight"
              width="14"
              :height="point.barHeight"
              rx="2"
              class="trend-bar"
            />
            <polyline
              :points="accuracyLine"
              class="trend-line"
              vector-effect="non-scaling-stroke"
            />
            <circle
              v-for="(point, index) in chartPoints"
              :key="`dot-${index}`"
              :cx="point.x"
              :cy="point.y"
              r="2.6"
              class="trend-dot"
            />
          </svg>
          <div class="trend-axis">
            <span v-for="(label, index) in dateLabels" :key="`${label}-${index}`">{{ label }}</span>
          </div>
        </template>
      </section>
    </div>

    <div class="two-col">
      <section class="paper-card panel">
        <h2 class="section-title">{{ t.incentive.growthTitle }}</h2>
        <p class="muted small">{{ t.incentive.growthDesc }}</p>
        <GrowthChart :user-id="currentUserId" />
      </section>
      <section class="paper-card panel">
        <h2 class="section-title">{{ t.incentive.calendarTitle }}</h2>
        <p class="muted small">{{ t.incentive.calendarDesc }}</p>
        <StudyCalendar :user-id="currentUserId" />
      </section>
    </div>

    <section v-if="doings.length > 0" class="paper-card panel doing-panel">
      <div class="spread">
        <h2 class="section-title">{{ t.stats.doingTitle }}</h2>
        <Button
          :label="t.stats.doingDiscard"
          size="small"
          text
          severity="danger"
          :loading="discarding"
          @click="discardDoing"
        />
      </div>
      <p class="muted small">{{ t.stats.doingHint }}</p>
      <div class="doing-list">
        <div v-for="item in doings" :key="item.id" class="doing-row">
          <div class="doing-main">
            <strong>{{ item.title }}</strong>
            <small class="muted">
              {{ item.subjectName }} · {{ item.questionCount }} {{ t.common.units.question }} ·
              {{ shortTime(item.startedAt) }}
            </small>
          </div>
          <Button
            v-if="item.resumable"
            :label="t.stats.doingContinue"
            size="small"
            outlined
            @click="router.push(`/practice/${item.id}`)"
          />
          <span v-else class="muted small">{{ t.stats.doingExpired }}</span>
        </div>
      </div>
      <p v-if="discardMessage" class="muted small">{{ discardMessage }}</p>
    </section>

    <section class="paper-card panel history-panel">
      <h2 class="section-title">{{ t.stats.historyTitle }}</h2>

      <Tabs v-model:value="activeTab" class="history-tabs">
        <TabList>
          <Tab value="practice">{{ t.stats.practiceTab }}</Tab>
          <Tab value="exam">{{ t.stats.examTab }}</Tab>
        </TabList>
      </Tabs>

      <div v-if="!loaded" class="empty-state compact">
        <i class="pi pi-spin pi-spinner" />
        <div class="title">{{ t.common.status.loading }}</div>
      </div>
      <div v-else-if="activeHistory.length === 0" class="empty-state compact">
        <i class="pi pi-history" />
        <div class="title">{{ t.stats.noHistory }}</div>
        <div class="hint">{{ t.stats.noHistoryHint }}</div>
      </div>
      <div v-else class="history-table">
        <div class="history-row head">
          <span>{{ t.stats.columnTitle }}</span>
          <span>{{ t.stats.columnSubject }}</span>
          <span>{{ t.stats.columnCount }}</span>
          <span>{{ activeTab === 'exam' ? t.stats.columnScore : t.stats.columnAccuracy }}</span>
          <span>{{ t.stats.columnDuration }}</span>
          <span>{{ t.stats.columnTime }}</span>
        </div>
        <div v-for="item in activeHistory" :key="`${activeTab}-${item.id}`" class="history-row">
          <span class="history-title">{{ item.title }}</span>
          <span>{{ item.subjectName }}</span>
          <span>{{ item.questionCount }} {{ t.common.units.question }}</span>
          <span class="num">
            {{ activeTab === 'exam' ? `${item.score} / ${item.totalScore}` : `${item.accuracy}%` }}
          </span>
          <span>{{ durationMinutes(item.durationSec) }} {{ t.common.units.minute }}</span>
          <span class="num muted">{{ shortTime(item.finishedAt) }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import Button from 'primevue/button'
import { examApi, practiceApi, statsApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { t } from '@/i18n'
import GrowthChart from '@/components/incentive/GrowthChart.vue'
import StudyCalendar from '@/components/incentive/StudyCalendar.vue'
import type {
  DoingPracticeItem,
  HistoryItem,
  StatsOverview,
  SubjectStat,
  TrendPoint
} from '@shared/types'

interface ChartPoint {
  x: number
  y: number
  barHeight: number
}

const CHART_LEFT = 16
const CHART_RIGHT = 984
const CHART_TOP = 10
const CHART_BOTTOM = 150
const BAR_MAX_HEIGHT = 100

const auth = useAuthStore()
const currentUserId = computed(() => auth.currentUser?.id ?? 0)
const router = useRouter()

const overview = ref<StatsOverview | null>(null)
const subjectStats = ref<SubjectStat[]>([])
const trend = ref<TrendPoint[]>([])
const practiceHistory = ref<HistoryItem[]>([])
const examHistory = ref<HistoryItem[]>([])
const doings = ref<DoingPracticeItem[]>([])
const discarding = ref(false)
const discardMessage = ref('')
const activeTab = ref<'practice' | 'exam'>('practice')
const loaded = ref(false)

const activeHistory = computed<HistoryItem[]>(() =>
  activeTab.value === 'exam' ? examHistory.value : practiceHistory.value
)

const hasTrendData = computed(() => trend.value.some((point) => point.answered > 0))

const chartPoints = computed<ChartPoint[]>(() => {
  const points = trend.value
  if (points.length === 0) return []
  const maxAnswered = Math.max(1, ...points.map((point) => point.answered))
  const step = points.length > 1 ? (CHART_RIGHT - CHART_LEFT) / (points.length - 1) : 0
  return points.map((point, index) => ({
    x: CHART_LEFT + index * step,
    y: CHART_BOTTOM - (clamp(point.accuracy) / 100) * (CHART_BOTTOM - CHART_TOP),
    barHeight: (point.answered / maxAnswered) * BAR_MAX_HEIGHT
  }))
})

const accuracyLine = computed(() =>
  chartPoints.value.map((point) => `${point.x},${point.y}`).join(' ')
)

const gridLines = computed(() => [CHART_TOP, (CHART_TOP + CHART_BOTTOM) / 2])

const dateLabels = computed(() => {
  const points = trend.value
  if (points.length === 0) return []
  const indexes =
    points.length === 1 ? [0] : [0, Math.floor((points.length - 1) / 2), points.length - 1]
  return indexes.map((index) => points[index].date.slice(5))
})

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function durationMinutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60))
}

function shortTime(value: string | null): string {
  return value ? value.slice(0, 16) : '—'
}

async function discardDoing(): Promise<void> {
  if (!auth.currentUser || discarding.value) return
  discarding.value = true
  discardMessage.value = ''
  try {
    const result = await practiceApi.discardDoing(auth.currentUser.id)
    doings.value = []
    discardMessage.value = t.stats.doingCleared(result.deleted)
  } catch (cause) {
    discardMessage.value = cause instanceof Error ? cause.message : '清理失败'
  } finally {
    discarding.value = false
  }
}

async function load(): Promise<void> {
  if (!auth.currentUser) {
    loaded.value = true
    return
  }
  const userId = auth.currentUser.id
  const results = await Promise.allSettled([
    statsApi.overview(userId),
    statsApi.subjects(userId),
    statsApi.trend(userId, 14),
    practiceApi.list(userId, 10),
    examApi.records(userId, 10),
    practiceApi.doing(userId, 5)
  ])

  const [overviewResult, subjectResult, trendResult, practiceResult, examResult, doingResult] =
    results
  if (overviewResult.status === 'fulfilled') overview.value = overviewResult.value
  if (subjectResult.status === 'fulfilled') subjectStats.value = subjectResult.value
  if (trendResult.status === 'fulfilled') trend.value = trendResult.value
  if (practiceResult.status === 'fulfilled') practiceHistory.value = practiceResult.value
  if (examResult.status === 'fulfilled') examHistory.value = examResult.value
  if (doingResult.status === 'fulfilled') doings.value = doingResult.value

  loaded.value = true
}

onMounted(load)
</script>

<style scoped>
.page {
  font-size: 13.5px;
}

.percent {
  font-size: 15px;
  margin-left: 2px;
  color: var(--ink-faint);
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1.35fr;
  gap: 16px;
  margin-top: 14px;
}

.panel {
  padding: 14px 20px;
}

.subject-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}

.subject-row {
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr) 46px 62px;
  align-items: center;
  gap: 10px;
}

.subject-name {
  font-size: 13px;
  color: var(--ink-soft);
}

.progress {
  height: 8px;
  border-radius: 999px;
  background: var(--bg-sunken);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--accent);
}

.subject-value {
  font-size: 12.5px;
  text-align: right;
  color: var(--accent);
}

.subject-count {
  font-size: 11.5px;
  text-align: right;
}

.legend {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 11.5px;
  color: var(--ink-faint);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.legend-line {
  width: 14px;
  height: 2px;
  background: var(--accent);
}

.legend-bar {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: var(--accent-soft);
  border: 1px solid var(--line-strong);
}

.trend-svg {
  display: block;
  width: 100%;
  height: 160px;
  margin-top: 10px;
}

.grid-line {
  stroke: var(--line);
  stroke-width: 1;
  stroke-dasharray: 4 6;
}

.axis-line {
  stroke: var(--line-strong);
  stroke-width: 1;
}

.trend-bar {
  fill: var(--accent-soft);
}

.trend-line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.trend-dot {
  fill: var(--accent);
}

.trend-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 11px;
  color: var(--ink-faint);
  font-family: var(--font-num);
}

.history-panel {
  margin-top: 12px;
}

.doing-panel {
  margin-top: 12px;
}

.doing-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.doing-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.doing-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.doing-main strong {
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doing-main small {
  font-size: 11.5px;
}

.history-tabs {
  margin-top: 4px;
}

.history-table {
  margin-top: 6px;
}

.history-row {
  display: grid;
  grid-template-columns: 2.2fr 0.8fr 0.7fr 0.9fr 0.8fr 1.2fr;
  gap: 10px;
  align-items: center;
  padding: 9px 4px;
  font-size: 12.5px;
}

.history-row + .history-row {
  border-top: 1px solid var(--line);
}

.history-row.head {
  color: var(--ink-faint);
  font-size: 11.5px;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--line);
}

.history-title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state.compact {
  padding: 30px 12px;
}

@media (max-width: 1100px) {
  .two-col {
    grid-template-columns: 1fr;
  }

  .history-row {
    grid-template-columns: 1.8fr 0.7fr 0.6fr 0.8fr 1.1fr;
  }

  .history-row > span:nth-child(5) {
    display: none;
  }
}
</style>
