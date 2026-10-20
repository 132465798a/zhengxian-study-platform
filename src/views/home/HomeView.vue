<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">STUDY DESK</p>
        <h1 class="page-title">{{ greeting }}</h1>
        <p class="page-desc">{{ t.home.subtitle }}</p>
      </div>
      <div class="head-actions">
        <Button
          :label="t.home.quickPractice"
          icon="pi pi-pencil"
          size="small"
          @click="router.push('/practice/setup')"
        />
        <Button
          :label="t.home.quickExam"
          icon="pi pi-clock"
          size="small"
          outlined
          @click="router.push('/exam')"
        />
      </div>
    </header>

    <section class="stat-grid">
      <div class="stat-tile">
        <div class="label">{{ t.home.todayPractice }}</div>
        <div class="value">{{ overview?.practiceCount ?? 0 }}</div>
        <div class="foot">{{ t.common.units.times }}</div>
      </div>
      <div class="stat-tile">
        <div class="label">{{ t.home.todayAnswered }}</div>
        <div class="value">{{ overview?.answeredCount ?? 0 }}</div>
        <div class="foot">{{ t.home.tagPractice }} + {{ t.home.tagExam }}</div>
      </div>
      <div class="stat-tile">
        <div class="label">{{ t.home.todayAccuracy }}</div>
        <div class="value">{{ overview?.accuracy ?? 0 }}<span class="percent">%</span></div>
        <div class="foot">{{ t.common.correctCountText(overview?.correctCount ?? 0) }}</div>
      </div>
      <div class="stat-tile">
        <div class="label">{{ t.home.todayMinutes }}</div>
        <div class="value">{{ overview?.studyMinutes ?? 0 }}</div>
        <div class="foot">{{ t.common.units.minute }}</div>
      </div>
    </section>

    <section class="block">
      <div class="spread">
        <h2 class="section-title">{{ t.home.subjectTitle }}</h2>
        <span class="muted small">{{ t.home.subjectHint }}</span>
      </div>
      <div class="subject-grid">
        <button
          v-for="subject in subjects"
          :key="subject.id"
          class="subject-card"
          :style="{ '--subject-color': styleOf(subject.name).color, '--subject-soft': styleOf(subject.name).soft }"
          @click="startPractice(subject.id)"
        >
          <span class="subject-icon">
            <i :class="styleOf(subject.name).icon" />
          </span>
          <span class="subject-info">
            <strong>{{ subject.name }}</strong>
            <small>
              {{
                subjectCounts[subject.id]
                  ? t.home.questionsAvailable(subjectCounts[subject.id])
                  : t.home.noQuestionData
              }}
            </small>
          </span>
          <i class="pi pi-arrow-up-right subject-arrow" />
        </button>

        <button
          v-if="hasChinese"
          class="subject-card character-card"
          :style="{
            '--subject-color': styleOf('语文').color,
            '--subject-soft': styleOf('语文').soft
          }"
          @click="router.push('/character')"
        >
          <span class="subject-icon">
            <i class="pi pi-book" />
          </span>
          <span class="subject-info">
            <strong>{{ t.character.entry }}</strong>
            <small>{{ t.character.entryHint }}</small>
          </span>
          <i class="pi pi-arrow-up-right subject-arrow" />
        </button>

        <button
          v-if="hasEnglish"
          class="subject-card"
          :style="{
            '--subject-color': styleOf('英语').color,
            '--subject-soft': styleOf('英语').soft
          }"
          @click="router.push('/english/listening')"
        >
          <span class="subject-icon">
            <i class="pi pi-headphones" />
          </span>
          <span class="subject-info">
            <strong>{{ t.english.entry }}</strong>
            <small>{{ t.english.entryHint }}</small>
          </span>
          <i class="pi pi-arrow-up-right subject-arrow" />
        </button>
      </div>
    </section>

    <div class="lower-grid">
      <section class="paper-card panel">
        <div class="spread">
          <h2 class="section-title">{{ t.home.recentTitle }}</h2>
          <Button
            :label="t.home.viewAll"
            text
            size="small"
            @click="router.push('/stats')"
          />
        </div>

        <div v-if="recent.length === 0" class="empty-state compact">
          <i class="pi pi-history" />
          <div class="title">{{ t.home.recentEmpty }}</div>
          <div class="hint">{{ t.home.recentEmptyHint }}</div>
        </div>

        <ul v-else class="recent-list">
          <li v-for="item in recent" :key="`${item.type}-${item.id}`" class="recent-item">
            <span class="tag" :class="item.type">{{ item.type === 'exam' ? t.home.tagExam : t.home.tagPractice }}</span>
            <div class="recent-main">
              <strong>{{ item.title }}</strong>
              <small class="muted">
                {{ item.questionCount }} {{ t.common.units.question }} ·
                {{ t.home.accuracyTag(item.accuracy) }} ·
                {{ item.durationSec ? t.home.minutesShort(Math.max(1, Math.round(item.durationSec / 60))) : '—' }}
              </small>
            </div>
            <span class="recent-time num">{{ shortTime(item.finishedAt) }}</span>
          </li>
        </ul>
      </section>

      <div class="side-stack">
        <section class="paper-card panel wrong-panel">
          <h2 class="section-title">{{ t.home.wrongTitle }}</h2>
          <template v-if="wrongSummary && wrongSummary.unmastered > 0">
            <p class="wrong-count">
              <span class="num">{{ wrongSummary.unmastered }}</span>
              <span>{{ t.common.units.question }}</span>
            </p>
            <p class="muted small">{{ t.home.wrongHint(wrongSummary.unmastered) }}</p>
            <Button
              :label="t.home.quickWrong"
              icon="pi pi-bookmark"
              size="small"
              severity="danger"
              outlined
              class="full"
              @click="router.push('/wrongbook')"
            />
          </template>
          <p v-else class="muted small all-clear">
            <i class="pi pi-check-circle" /> {{ t.home.wrongAllClear }}
          </p>
        </section>

        <section class="paper-card panel">
          <h2 class="section-title">{{ t.home.tipsTitle }}</h2>
          <ol class="tips">
            <li>{{ t.home.tip1 }}</li>
            <li>{{ t.home.tip2 }}</li>
            <li>{{ t.home.tip3 }}</li>
          </ol>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import { contentApi, examApi, practiceApi, questionApi, statsApi, wrongApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { t } from '@/i18n'
import { SUBJECT_STYLE } from '@shared/constants'
import type { HistoryItem, StatsOverview, Subject } from '@shared/types'

const router = useRouter()
const auth = useAuthStore()

const overview = ref<StatsOverview | null>(null)
const subjects = ref<Subject[]>([])
const hasChinese = computed(() => subjects.value.some((item) => item.name === '语文'))
const hasEnglish = computed(() => subjects.value.some((item) => item.name === '英语'))
const subjectCounts = ref<Record<number, number>>({})
const wrongSummary = ref<{ unmastered: number } | null>(null)
const recent = ref<HistoryItem[]>([])

const greeting = computed(() =>
  t.home.greeting(auth.currentUser?.name ?? t.common.studentFallback)
)

function styleOf(name: string): { icon: string; color: string; soft: string } {
  return SUBJECT_STYLE[name] ?? { icon: 'pi pi-circle', color: '#1f6f5c', soft: '#dfeee9' }
}

function shortTime(value: string | null): string {
  if (!value) return '—'
  return value.slice(5, 16)
}

function startPractice(subjectId: number): void {
  router.push({ path: '/practice/setup', query: { subject: String(subjectId) } })
}

async function load(): Promise<void> {
  if (!auth.currentUser) return
  const userId = auth.currentUser.id
  const grade = auth.currentUser.grade

  const [overviewData, subjectList, wrong, practices, exams] = await Promise.allSettled([
    statsApi.overview(userId),
    contentApi.subjects(grade),
    wrongApi.summary(userId),
    practiceApi.list(userId, 5),
    examApi.records(userId, 5)
  ])

  if (overviewData.status === 'fulfilled') overview.value = overviewData.value
  if (subjectList.status === 'fulfilled') subjects.value = subjectList.value
  if (wrong.status === 'fulfilled') wrongSummary.value = wrong.value

  const merged: HistoryItem[] = []
  if (practices.status === 'fulfilled') merged.push(...practices.value)
  if (exams.status === 'fulfilled') merged.push(...exams.value)
  recent.value = merged
    .filter((item) => item.finishedAt)
    .sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)))
    .slice(0, 5)

  const counts: Record<number, number> = {}
  await Promise.all(
    subjects.value.map(async (subject) => {
      try {
        const stats = await questionApi.typeStats({ subjectId: subject.id, grade })
        counts[subject.id] = stats.reduce((sum, item) => sum + item.count, 0)
      } catch {
        counts[subject.id] = 0
      }
    })
  )
  subjectCounts.value = counts
}

onMounted(load)
</script>

<style scoped>
.head-actions {
  display: flex;
  gap: 10px;
}

.percent {
  font-size: 15px;
  margin-left: 2px;
  color: var(--ink-faint);
}

.small {
  font-size: 12px;
}

.block {
  margin-top: 18px;
}

.subject-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 10px;
}

.subject-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  background: var(--bg-raised);
  cursor: pointer;
  text-align: left;
  transition: background 0.1s ease, border-color 0.1s ease;
  position: relative;
  overflow: hidden;
}

.subject-card::after {
  content: '';
  position: absolute;
  right: -24px;
  top: -24px;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: var(--subject-color);
  opacity: 0.06;
}

.subject-card:hover {
  background: var(--accent-soft);
  border-color: var(--line);
}

.subject-icon {
  width: 42px;
  height: 42px;
  border-radius: var(--radius);
  background: var(--subject-color);
  color: #ffffff;
  display: grid;
  place-items: center;
  font-size: var(--icon-size);
  flex-shrink: 0;
}

.subject-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.subject-info strong {
  font-family: var(--font-display);
  font-size: 19px;
  letter-spacing: 0.06em;
}

.subject-info small {
  font-size: 12px;
  color: var(--ink-faint);
}

.subject-arrow {
  margin-left: auto;
  font-size: 12px;
  color: var(--ink-faint);
}

.lower-grid {
  display: grid;
  grid-template-columns: 1.55fr 1fr;
  gap: 16px;
  margin-top: 18px;
}

.panel {
  padding: 16px 22px;
}

.panel .spread {
  margin-bottom: 10px;
}

.recent-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 2px;
}

.recent-item + .recent-item {
  border-top: 1px solid var(--line);
}

.tag {
  font-size: 10.5px;
  letter-spacing: 0.08em;
  padding: 3px 7px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.tag.practice {
  background: var(--accent-soft);
  color: var(--accent);
}

.tag.exam {
  background: var(--accent-soft);
  color: var(--accent);
}

.recent-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.recent-main strong {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-time {
  margin-left: auto;
  font-size: 11.5px;
  color: var(--ink-faint);
  flex-shrink: 0;
}

.side-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.wrong-panel .wrong-count {
  margin: 6px 0 2px;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.wrong-count .num {
  font-size: 40px;
  line-height: 1;
  color: var(--accent);
}

.wrong-count span {
  font-size: 12px;
  color: var(--ink-faint);
}

.full {
  width: 100%;
  margin-top: 12px;
}

.all-clear {
  margin: 8px 0 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--success);
}

.tips {
  margin: 10px 0 0 18px;
  padding: 0;
  font-size: 12.5px;
  color: var(--ink-soft);
  line-height: 1.85;
}

.tips li {
  margin-bottom: 4px;
}

.empty-state.compact {
  padding: 28px 12px;
}

@media (max-width: 1180px) {
  .subject-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .lower-grid {
    grid-template-columns: 1fr;
  }
}
</style>
