<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">PRACTICE</p>
        <h1 class="page-title">{{ t.practice.title }}</h1>
        <p class="page-desc">{{ t.practice.desc }}</p>
      </div>
    </header>

    <div class="setup-grid">
      <section class="paper-card form-card">
        <div class="field-grid">
          <label class="field">
            <span class="field-label">{{ t.practice.subject }}</span>
            <Select
              v-model="subjectId"
              :options="subjects"
              option-label="name"
              option-value="id"
              :placeholder="t.practice.choosePlaceholder"
            />
          </label>

          <label class="field">
            <span class="field-label">{{ t.practice.grade }}</span>
            <Select v-model="grade" :options="gradeOptions" option-label="label" option-value="value" />
          </label>
        </div>

        <label class="field">
          <span class="field-label">
            {{ t.practice.knowledge }}
            <em class="optional">{{ t.practice.knowledgeHint }}</em>
          </span>
          <MultiSelect
            v-model="knowledgeIds"
            :options="knowledgeOptions"
            option-label="label"
            option-value="value"
            :placeholder="t.practice.choosePlaceholder"
            :max-selected-labels="3"
            :selection-limit="99"
            filter
          />
        </label>

        <div class="field">
          <span class="field-label">{{ t.practice.types }}</span>
          <div class="type-grid">
            <button
              v-for="type in visibleTypes"
              :key="type"
              type="button"
              class="type-chip"
              :class="{ on: customConfig === null && types.includes(type) }"
              :disabled="customConfig !== null"
              @click="toggleType(type)"
            >
              <i
                :class="
                  customConfig === null && types.includes(type)
                    ? 'pi pi-check-circle'
                    : 'pi pi-circle'
                "
              />
              {{ t.common.questionTypes[type] }}
            </button>
            <button
              type="button"
              class="type-chip custom-chip"
              :class="{ on: customConfig !== null }"
              @click="openCustomDialog"
            >
              <i class="pi pi-sliders-h" />
              {{ t.practice.custom.label }}
              <span
                v-if="customConfig"
                class="param-badge"
                :title="t.practice.custom.paramCount(customParamCount)"
              >
                {{ customParamCount }}
              </span>
            </button>
          </div>
          <em class="field-hint">{{ typeHint }}</em>
        </div>

        <div class="field-grid">
          <div class="field">
            <span class="field-label">{{ t.practice.difficulties }}</span>
            <SelectButton
              v-model="difficulty"
              :options="difficultyOptions"
              option-label="label"
              option-value="value"
              :allow-empty="false"
            />
          </div>

          <div class="field">
            <span class="field-label">{{ t.practice.count }}</span>
            <SelectButton v-model="count" :options="countOptions" />
          </div>
        </div>

        <div class="field">
          <span class="field-label">{{ t.practice.mode }}</span>
          <div class="mode-grid">
            <button
              v-for="mode in modes"
              :key="mode.value"
              type="button"
              class="mode-card"
              :class="{ on: practiceMode === mode.value }"
              @click="practiceMode = mode.value"
            >
              <i :class="mode.icon" />
              <strong>{{ mode.label }}</strong>
              <small>{{ mode.hint }}</small>
            </button>
          </div>
        </div>
      </section>

      <aside class="summary">
        <PracticeSummaryCard
          :subject-name="summarySubject"
          :grade="grade"
          :type-count="customConfig ? 1 : types.length"
          :count="count"
          :mode-label="modeLabel"
          :availability="availability"
          :custom-summary="customSummary"
          :can-start="canStart"
          :starting="starting"
          @start="startPractice"
        />

        <div class="paper-card tips-card">
          <h3>{{ t.home.tipsTitle }}</h3>
          <ol>
            <li>{{ t.home.tip1 }}</li>
            <li>{{ t.home.tip2 }}</li>
          </ol>
        </div>
      </aside>
    </div>

    <QuestionParamsDialog
      v-model:visible="customDialogVisible"
      :subject-name="summarySubject"
      :grade="grade"
      :model-value="customConfig"
      :allowed-types="subjectTypes"
      @apply="applyCustom"
    />

    <Toast position="bottom-right" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import PracticeSummaryCard from '@/components/practice/PracticeSummaryCard.vue'
import QuestionParamsDialog from '@/components/practice/QuestionParamsDialog.vue'
import { contentApi, questionApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { usePracticeStore } from '@/stores/practice.store'
import { t } from '@/i18n'
import { ALL_TYPES, STAGE_CONFIG } from '@shared/constants'
import { QUESTION_PARAMS } from '@shared/question-params'
import type { CustomPracticeConfig, QuestionType, Subject } from '@shared/types'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const auth = useAuthStore()
const practiceStore = usePracticeStore()

const TYPES_BY_SUBJECT: Record<string, QuestionType[]> = {
  语文: ['single', 'multiple', 'judge', 'fill', 'cloze', 'matching', 'sorting', 'short_answer'],
  数学: ['single', 'multiple', 'judge', 'fill', 'calculation', 'matching', 'sorting'],
  英语: ['single', 'multiple', 'judge', 'fill', 'cloze', 'matching', 'sorting', 'short_answer']
}

const initialSubjectName = computed(() => {
  const allowed = STAGE_CONFIG.primary.subjectsByGrade[auth.currentUser?.grade ?? 1] ?? []
  return allowed[0] ?? '语文'
})

const subjects = ref<Subject[]>([])
const subjectId = ref<number | null>(null)
const grade = ref<number>(auth.currentUser?.grade ?? 1)
const knowledgeOptions = ref<{ label: string; value: number }[]>([])
const knowledgeIds = ref<number[]>([])
const types = ref<QuestionType[]>([...(TYPES_BY_SUBJECT[initialSubjectName.value] ?? ALL_TYPES)])
const difficulty = ref<number>(0)
const count = ref(10)
const practiceMode = ref<'random' | 'wrong' | 'knowledge'>('random')
const availability = ref(0)
const typeCounts = ref<Partial<Record<QuestionType, number>>>({})
const statsLoaded = ref(false)
const starting = ref(false)
const customConfig = ref<CustomPracticeConfig | null>(null)
const customDialogVisible = ref(false)

const countOptions = [10, 20, 30, 50]
const gradeOptions = STAGE_CONFIG.primary.grades.map((item) => ({
  label: t.common.gradeText(item),
  value: item
}))
const difficultyOptions = [
  { label: t.practice.unlimited, value: 0 },
  { label: t.common.difficulty[1], value: 1 },
  { label: t.common.difficulty[2], value: 2 },
  { label: t.common.difficulty[3], value: 3 }
]
const modes = computed(() => [
  {
    value: 'random' as const,
    label: t.practice.modes.random,
    hint: t.practice.modeHints.random,
    icon: 'pi pi-shuffle'
  },
  {
    value: 'wrong' as const,
    label: t.practice.modes.wrong,
    hint: t.practice.modeHints.wrong,
    icon: 'pi pi-bookmark'
  },
  {
    value: 'knowledge' as const,
    label: t.practice.modes.knowledge,
    hint: t.practice.modeHints.knowledge,
    icon: 'pi pi-sitemap'
  }
])

type StoredSetup = {
  userId?: number
  subjectId: number | null
  grade: number
  difficulty: number
  count: number
  mode: 'random' | 'wrong' | 'knowledge'
  types: QuestionType[]
  knowledgeIds: number[]
  custom?: CustomPracticeConfig
}

const STORAGE_KEY = 'study.practiceSetup'
const querySubjectId = Number(route.query.subject)
let querySubjectPending = Boolean(querySubjectId)

function isParamValue(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function isStoredCustom(value: unknown): value is CustomPracticeConfig {
  if (!value || typeof value !== 'object') return false
  const custom = value as Partial<CustomPracticeConfig>
  if (typeof custom.type !== 'string' || !(custom.type in QUESTION_PARAMS)) return false
  if (!custom.params || typeof custom.params !== 'object' || Array.isArray(custom.params)) {
    return false
  }
  return Object.values(custom.params).every(isParamValue)
}

function readStoredSetup(): Partial<StoredSetup> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const stored = readStoredSetup()
const activeUserId = auth.currentUser?.id
const storedSetup: Partial<StoredSetup> =
  stored.userId === activeUserId ? stored : {}
let pendingCustom: CustomPracticeConfig | null =
  storedSetup.custom && isStoredCustom(storedSetup.custom) ? storedSetup.custom : null
if (typeof storedSetup.subjectId === 'number' && Number.isInteger(storedSetup.subjectId)) {
  subjectId.value = storedSetup.subjectId
}
if (
  typeof storedSetup.grade === 'number' &&
  gradeOptions.some((item) => item.value === storedSetup.grade)
) {
  grade.value = storedSetup.grade
}
if (
  typeof storedSetup.difficulty === 'number' &&
  difficultyOptions.some((item) => item.value === storedSetup.difficulty)
) {
  difficulty.value = storedSetup.difficulty
}
if (typeof storedSetup.count === 'number' && countOptions.includes(storedSetup.count)) {
  count.value = storedSetup.count
}
if (
  storedSetup.mode === 'random' ||
  storedSetup.mode === 'wrong' ||
  storedSetup.mode === 'knowledge'
) {
  practiceMode.value = storedSetup.mode
}
if (Array.isArray(storedSetup.types)) {
  const subjectName = subjects.value.find((s) => s.id === subjectId.value)?.name ?? initialSubjectName.value
  const allowed = TYPES_BY_SUBJECT[subjectName] ?? ALL_TYPES
  const restoredTypes = storedSetup.types.filter((item) => allowed.includes(item))
  if (restoredTypes.length > 0) types.value = restoredTypes
  else types.value = [...allowed]
}
if (Array.isArray(storedSetup.knowledgeIds)) {
  knowledgeIds.value = storedSetup.knowledgeIds.filter((item) => Number.isInteger(item))
}

const subjectName = computed(
  () => subjects.value.find((item) => item.id === subjectId.value)?.name ?? ''
)
const subjectTypes = computed<QuestionType[]>(
  () => TYPES_BY_SUBJECT[subjectName.value] ?? ALL_TYPES
)
const visibleTypes = computed<QuestionType[]>(() =>
  subjectTypes.value.filter((type) => (typeCounts.value[type] ?? 0) > 0)
)
const summarySubject = computed(
  () => subjects.value.find((item) => item.id === subjectId.value)?.name ?? '—'
)
const modeLabel = computed(() =>
  customConfig.value
    ? t.practice.modes.random
    : (modes.value.find((item) => item.value === practiceMode.value)?.label ?? '')
)
const typeHint = computed(() => {
  if (customConfig.value) return t.practice.custom.switched
  if (statsLoaded.value && visibleTypes.value.length === 0) return t.practice.emptySubject
  return t.practice.typesHint
})
const customParamCount = computed(() =>
  customConfig.value ? Object.keys(customConfig.value.params).length : 0
)
const customSummary = computed(() => {
  if (!customConfig.value) return null
  const typeLabel = t.common.questionTypes[customConfig.value.type]
  return `${t.practice.custom.label} · ${typeLabel} · ${count.value} ${t.practice.countUnit}`
})
const canStart = computed(
  () =>
    Boolean(subjectId.value) &&
    (customConfig.value !== null || types.value.length > 0) &&
    Boolean(count.value)
)

function openCustomDialog(): void {
  customDialogVisible.value = true
}

function applyCustom(config: CustomPracticeConfig): void {
  customConfig.value = config
}

function toggleType(type: QuestionType): void {
  if (types.value.includes(type)) {
    if (types.value.length === 1) return
    types.value = types.value.filter((item) => item !== type)
  } else {
    types.value = [...types.value, type]
  }
}

async function loadSubjects(): Promise<void> {
  const fromQuery = querySubjectPending ? querySubjectId : NaN
  querySubjectPending = false
  subjects.value = await contentApi.subjects(grade.value)
  if (fromQuery && subjects.value.some((item) => item.id === fromQuery)) {
    subjectId.value = fromQuery
  } else if (!subjects.value.some((item) => item.id === subjectId.value)) {
    subjectId.value = subjects.value[0]?.id ?? null
  }
  const allowed = subjectTypes.value
  const next = types.value.filter((t) => allowed.includes(t))
  if (next.length === 0) {
    types.value = [...allowed]
  } else if (next.length !== types.value.length) {
    types.value = next
  }
  if (pendingCustom) {
    const custom = pendingCustom
    pendingCustom = null
    if (allowed.includes(custom.type)) customConfig.value = custom
  }
  if (customConfig.value && !allowed.includes(customConfig.value.type)) {
    customConfig.value = null
  }
}

async function loadKnowledge(): Promise<void> {
  knowledgeOptions.value = []
  if (!subjectId.value) {
    knowledgeIds.value = []
    return
  }
  const tree = await contentApi.knowledge(subjectId.value, grade.value)
  const flat: { label: string; value: number }[] = []
  const walk = (nodes: typeof tree): void => {
    for (const node of nodes) {
      flat.push({ label: node.name, value: node.id })
      if (node.children?.length) walk(node.children)
    }
  }
  walk(tree)
  knowledgeOptions.value = flat
  const validIds = new Set(flat.map((item) => item.value))
  knowledgeIds.value = knowledgeIds.value.filter((id) => validIds.has(id))
}

let availabilityTimer: number | null = null

async function refreshAvailability(): Promise<void> {
  if (!subjectId.value) {
    availability.value = 0
    typeCounts.value = {}
    statsLoaded.value = false
    return
  }
  try {
    const stats = await questionApi.typeStats({
      subjectId: subjectId.value,
      grade: grade.value,
      types: subjectTypes.value,
      difficulties: difficulty.value ? [difficulty.value] : []
    })
    const counts: Partial<Record<QuestionType, number>> = {}
    for (const item of stats) counts[item.type] = item.count
    typeCounts.value = counts
    const nextTypes = types.value.filter((type) => visibleTypes.value.includes(type))
    if (nextTypes.length !== types.value.length) types.value = nextTypes
    availability.value = types.value.reduce((sum, type) => sum + (counts[type] ?? 0), 0)
  } catch {
    typeCounts.value = {}
    availability.value = 0
  } finally {
    statsLoaded.value = true
  }
}

function scheduleAvailability(): void {
  if (availabilityTimer !== null) window.clearTimeout(availabilityTimer)
  availabilityTimer = window.setTimeout(refreshAvailability, 200)
}

function notify(message: string): void {
  toast.add({ severity: 'error', summary: t.common.status.error, detail: message, life: 3200 })
}

async function startPractice(): Promise<void> {
  if (!auth.currentUser || !subjectId.value) return
  if (!canStart.value) {
    notify(t.practice.requirement)
    return
  }
  starting.value = true
  try {
    const session = await practiceStore.start({
      userId: auth.currentUser.id,
      subjectId: subjectId.value,
      grade: grade.value,
      types: customConfig.value ? [customConfig.value.type] : types.value,
      difficulties: difficulty.value ? [difficulty.value] : [],
      count: count.value,
      knowledgeIds:
        !customConfig.value && practiceMode.value === 'knowledge' ? knowledgeIds.value : undefined,
      mode: customConfig.value ? 'random' : practiceMode.value,
      custom: customConfig.value ?? undefined
    })
    router.push(`/practice/${session.record.id}`)
  } catch (error) {
    notify(error instanceof Error ? error.message : t.common.status.error)
  } finally {
    starting.value = false
  }
}

watch(grade, async () => {
  await loadSubjects()
  await loadKnowledge()
  await refreshAvailability()
})

watch(subjectId, async () => {
  if (subjectId.value && Number(route.query.subject) !== subjectId.value) {
    void router.replace({ query: { ...route.query, subject: String(subjectId.value) } })
  }
  const allowed = subjectTypes.value
  const nextTypes = types.value.filter((type) => allowed.includes(type))
  if (nextTypes.length === 0) types.value = [...allowed]
  else if (nextTypes.length !== types.value.length) types.value = nextTypes
  if (customConfig.value && !allowed.includes(customConfig.value.type)) {
    customConfig.value = null
  }
  await loadKnowledge()
  await refreshAvailability()
})

watch([types, difficulty], scheduleAvailability, { deep: true })

watch(
  [subjectId, grade, difficulty, count, practiceMode, types, knowledgeIds, customConfig],
  () => {
    const setup: StoredSetup = {
      userId: auth.currentUser?.id,
      subjectId: subjectId.value,
      grade: grade.value,
      difficulty: difficulty.value,
      count: count.value,
      mode: practiceMode.value,
      types: types.value,
      knowledgeIds: knowledgeIds.value,
      custom: customConfig.value ?? undefined
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(setup))
  },
  { deep: true }
)

onMounted(async () => {
  await loadSubjects()
  await loadKnowledge()
  await refreshAvailability()
})
</script>

<style scoped>
.setup-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 18px;
  align-items: start;
}

.form-card {
  padding: 18px 26px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.field-label {
  font-size: 12.5px;
  color: var(--ink-soft);
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.optional {
  font-style: normal;
  font-size: 11px;
  color: var(--ink-faint);
}

.field-hint {
  font-style: normal;
  font-size: 11.5px;
  color: var(--ink-faint);
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.type-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 11px;
  border-radius: var(--radius);
  border: none;
  background: var(--bg-sunken);
  color: var(--ink-soft);
  font-size: 12.5px;
  cursor: pointer;
  transition: background 0.1s ease, color 0.1s ease;
  text-align: left;
}

.type-chip i {
  font-size: var(--icon-size);
  color: var(--ink-faint);
}

.type-chip.on {
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.type-chip.on i {
  color: var(--accent);
}

.type-chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.param-badge {
  margin-left: auto;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-contrast);
  font-size: 10.5px;
  font-family: var(--font-num);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.mode-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.mode-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 14px;
  border-radius: var(--radius);
  border: none;
  background: var(--bg-sunken);
  text-align: left;
  cursor: pointer;
  transition: background 0.1s ease;
}

.mode-card i {
  font-size: var(--icon-size);
  color: var(--ink-faint);
  margin-bottom: 2px;
}

.mode-card strong {
  font-size: 13px;
  color: var(--ink);
}

.mode-card small {
  font-size: 11.5px;
  color: var(--ink-faint);
  line-height: 1.6;
}

.mode-card.on {
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.mode-card.on i {
  color: var(--accent);
}

.summary {
  position: sticky;
  top: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tips-card {
  padding: 18px 20px;
}

.tips-card h3 {
  font-size: 14px;
  margin-bottom: 8px;
}

.tips-card ol {
  margin: 0 0 0 16px;
  padding: 0;
  font-size: 12px;
  color: var(--ink-soft);
  line-height: 1.8;
}

@media (max-width: 1180px) {
  .setup-grid {
    grid-template-columns: 1fr;
  }
  .summary {
    position: static;
  }
  .type-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

