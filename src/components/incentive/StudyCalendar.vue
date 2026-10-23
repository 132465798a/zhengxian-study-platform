<template>
  <section class="study-calendar">
    <header class="cal-head">
      <p class="cal-title">{{ t.incentive.calendarTitle }}</p>
      <div class="cal-tools">
        <span class="cal-month num">{{ monthLabel }}</span>
        <Button
          icon="pi pi-chevron-left"
          size="small"
          text
          rounded
          aria-label="上一月"
          @click="shiftMonth(-1)"
        />
        <Button
          icon="pi pi-chevron-right"
          size="small"
          text
          rounded
          aria-label="下一月"
          @click="shiftMonth(1)"
        />
      </div>
    </header>

    <div class="cal-weekdays">
      <span v-for="day in weekdays" :key="day">{{ day }}</span>
    </div>

    <div class="cal-grid">
      <span v-for="index in leading" :key="`blank-${index}`" class="cal-day blank" />
      <div
        v-for="cell in cells"
        :key="cell.date"
        class="cal-day"
        :class="{ 'has-record': Boolean(cell.record), 'is-active': isActive(cell) }"
        :data-level="cell.level"
        @mouseenter="hover(cell)"
        @mouseleave="hoverDate = null"
        @click="pick(cell)"
      >
        {{ cell.day }}
      </div>
    </div>

    <p class="cal-foot">
      <template v-if="loading">{{ t.common.status.loading }}</template>
      <template v-else-if="activeRecord">
        {{ t.incentive.calendarDay(activeRecord.answered, activeRecord.correct) }}
      </template>
      <template v-else-if="days.length === 0">{{ t.incentive.calendarEmpty }}</template>
      <template v-else>{{ t.incentive.calendarDesc }}</template>
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import { incentiveApi } from '@/api'
import { t } from '@/i18n'
import type { StudyCalendarDay } from '@shared/types'

interface CalendarCell {
  date: string
  day: number
  record: StudyCalendarDay | null
  level: number
}

const props = defineProps<{ userId: number }>()

const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const month = ref(currentMonth())
const days = ref<StudyCalendarDay[]>([])
const loading = ref(true)
const hoverDate = ref<string | null>(null)
const pickedDate = ref<string | null>(null)

let requestToken = 0

const monthLabel = computed(() => {
  const [year, monthNumber] = month.value.split('-').map(Number)
  return `${year} 年 ${monthNumber} 月`
})

const records = computed(() => new Map(days.value.map((day) => [day.date, day])))

const maxAnswered = computed(() => days.value.reduce((max, day) => Math.max(max, day.answered), 0))

const leading = computed(() => {
  const [year, monthNumber] = month.value.split('-').map(Number)
  return (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7
})

const cells = computed<CalendarCell[]>(() => {
  const [year, monthNumber] = month.value.split('-').map(Number)
  const total = new Date(year, monthNumber, 0).getDate()
  return Array.from({ length: total }, (_, index) => {
    const day = index + 1
    const date = `${month.value}-${String(day).padStart(2, '0')}`
    const record = records.value.get(date) ?? null
    return { date, day, record, level: levelOf(record) }
  })
})

const activeRecord = computed(() => {
  const date = hoverDate.value ?? pickedDate.value
  return date ? (records.value.get(date) ?? null) : null
})

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function levelOf(record: StudyCalendarDay | null): number {
  if (!record || record.answered <= 0 || maxAnswered.value <= 0) return 0
  return Math.min(4, Math.max(1, Math.ceil((record.answered / maxAnswered.value) * 4)))
}

function isActive(cell: CalendarCell): boolean {
  const date = hoverDate.value ?? pickedDate.value
  return Boolean(cell.record) && cell.date === date
}

function hover(cell: CalendarCell): void {
  if (cell.record) hoverDate.value = cell.date
}

function pick(cell: CalendarCell): void {
  if (!cell.record) return
  pickedDate.value = pickedDate.value === cell.date ? null : cell.date
}

function shiftMonth(delta: number): void {
  const [year, monthNumber] = month.value.split('-').map(Number)
  const target = new Date(year, monthNumber - 1 + delta, 1)
  month.value = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`
}

async function load(): Promise<void> {
  const token = ++requestToken
  loading.value = true
  try {
    const list = await incentiveApi.calendar(props.userId, month.value)
    if (token !== requestToken) return
    days.value = list
  } catch {
    if (token === requestToken) days.value = []
  } finally {
    if (token === requestToken) loading.value = false
  }
}

watch(
  [() => props.userId, month],
  () => {
    hoverDate.value = null
    pickedDate.value = null
    void load()
  },
  { immediate: true }
)
</script>

<style scoped>
.study-calendar {
  font-size: 13px;
}

.cal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.cal-title {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--ink-faint);
}

.cal-tools {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cal-month {
  margin-right: 4px;
  font-size: 13px;
  color: var(--ink);
}

.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
  margin-top: 12px;
}

.cal-weekdays span {
  text-align: center;
  font-size: 10.5px;
  color: var(--ink-faint);
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
  margin-top: 6px;
}

.cal-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: 5px;
  font-family: var(--font-num);
  font-size: 11.5px;
  color: var(--ink-soft);
}

.cal-day.blank {
  border-color: transparent;
}

.cal-day.has-record {
  color: var(--ink);
  cursor: pointer;
}

.cal-day[data-level='1'] {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.cal-day[data-level='2'] {
  background: color-mix(in srgb, var(--accent) 17%, transparent);
}

.cal-day[data-level='3'] {
  background: color-mix(in srgb, var(--accent) 30%, transparent);
}

.cal-day[data-level='4'] {
  background: color-mix(in srgb, var(--accent) 46%, transparent);
  color: var(--accent-contrast);
}

.cal-day.has-record:hover,
.cal-day.is-active {
  border-color: var(--accent);
}

.cal-foot {
  margin: 10px 0 0;
  min-height: 18px;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--ink-faint);
}
</style>
