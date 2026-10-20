<template>
  <div class="page offline-page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">OFFLINE LEARNING</p>
        <h1 class="page-title">{{ t.nav.offline }}</h1>
        <p class="page-desc">{{ t.nav.offlineDesc }}</p>
      </div>
    </header>

    <div class="offline-tabs">
      <SelectButton
        v-model="tab"
        :options="TABS"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        size="small"
      />
    </div>

    <section v-if="tab === 'paper'" class="paper-card offline-card">
      <div class="offline-grid">
        <div class="form-col">
          <h2 class="section-title">组卷条件</h2>

          <div class="form-grid">
            <label class="field">
              <span>学科</span>
              <Select
                v-model="subjectId"
                :options="subjects"
                option-label="name"
                option-value="id"
                size="small"
                placeholder="选择学科"
              />
            </label>
            <label class="field">
              <span>年级</span>
              <Select v-model="grade" :options="GRADE_OPTIONS" option-label="label" option-value="value" size="small" />
            </label>
            <label class="field">
              <span>组卷方式</span>
              <Select v-model="mode" :options="MODE_OPTIONS" option-label="label" option-value="value" size="small" />
            </label>
            <label v-if="mode !== 'manual'" class="field">
              <span>题量</span>
              <InputNumber v-model="count" size="small" :min="1" :max="100" show-buttons />
            </label>
          </div>

          <template v-if="mode === 'random'">
            <div class="field-block">
              <div class="block-head">
                <span>题型</span>
                <button type="button" class="text-link" @click="toggleAllTypes">
                  {{ allSelected ? '清空' : '全选' }}
                </button>
              </div>
              <div class="type-grid">
                <label v-for="type in visibleTypes" :key="type" class="check">
                  <Checkbox v-model="types" :value="type" />
                  {{ QUESTION_TYPE_LABELS[type] }}
                </label>
              </div>
            </div>
            <div class="form-grid">
              <label class="field">
                <span>难度</span>
                <Select v-model="difficulty" :options="DIFFICULTY_OPTIONS" option-label="label" option-value="value" size="small" />
              </label>
              <label class="field">
                <span>知识点</span>
                <MultiSelect
                  v-model="knowledgeIds"
                  :options="knowledgeOptions"
                  option-label="label"
                  option-value="value"
                  :placeholder="knowledgeLoading ? '加载中' : '不限'"
                  :max-selected-labels="3"
                  :selection-limit="99"
                  size="small"
                  filter
                />
              </label>
            </div>
          </template>

          <template v-else-if="mode === 'custom'">
            <div class="field-block">
              <div class="block-head">
                <span>生成题型</span>
                <button type="button" class="text-link" @click="toggleCustomTypes">
                  {{ allCustomSelected ? '清空' : '全选' }}
                </button>
              </div>
              <div class="type-grid">
                <label v-for="type in subjectTypes" :key="type" class="check">
                  <Checkbox v-model="customTypes" :value="type" />
                  {{ QUESTION_TYPE_LABELS[type] }}
                </label>
              </div>
            </div>
            <div class="form-grid">
              <label class="field">
                <span>知识点</span>
                <MultiSelect
                  v-model="knowledgeIds"
                  :options="knowledgeOptions"
                  option-label="label"
                  option-value="value"
                  :placeholder="knowledgeLoading ? '加载中' : '不限'"
                  :max-selected-labels="3"
                  :selection-limit="99"
                  size="small"
                  filter
                />
              </label>
            </div>
            <div v-for="type in customTypes" :key="type" class="param-block">
              <div class="block-head">
                <span>{{ QUESTION_TYPE_LABELS[type] }}</span>
              </div>
              <div v-if="(QUESTION_PARAMS[type] ?? []).length > 0" class="param-grid">
                <label v-for="field in QUESTION_PARAMS[type]" :key="field.key" class="field">
                  <span>{{ field.label }}</span>
                  <Select
                    v-if="field.type === 'select'"
                    :model-value="paramValue(type, field.key, field)"
                    :options="field.options ?? []"
                    option-label="label"
                    option-value="value"
                    size="small"
                    @update:model-value="(value: string | number | boolean) => setCustomParam(type, field.key, value)"
                  />
                  <InputNumber
                    v-else-if="field.type === 'number'"
                    :model-value="Number(customParamsMap[type]?.[field.key] ?? 0)"
                    size="small"
                    :min="field.min"
                    :max="field.max"
                    :step="field.step ?? 1"
                    @update:model-value="(value: number | null) => setCustomParam(type, field.key, value ?? 0)"
                  />
                  <Checkbox
                    v-else
                    :model-value="Boolean(customParamsMap[type]?.[field.key])"
                    binary
                    @update:model-value="(value: boolean) => setCustomParam(type, field.key, value)"
                  />
                </label>
              </div>
              <p v-else class="hint">该题型无需额外参数。</p>
            </div>
          </template>

          <template v-else>
            <p class="hint">
              生成一张空白卷并进入编辑器，在右侧从题库挑题，或调用生成器批量加题；打印设置与正常组卷一致。
            </p>
          </template>

          <div class="actions">
            <Button
              :label="mode === 'manual' ? '打开组卷编辑器' : '生成打印卷'"
              :icon="mode === 'manual' ? 'pi pi-pencil' : 'pi pi-print'"
              size="small"
              :disabled="!canGenerate"
              @click="openPaper"
            />
          </div>
        </div>

        <aside class="summary-col">
          <h2 class="section-title">本次将生成</h2>
          <dl class="summary">
            <div><dt>学科</dt><dd>{{ subjectName || '未选择' }}</dd></div>
            <div><dt>年级</dt><dd>{{ grade }} 年级</dd></div>
            <div><dt>方式</dt><dd>{{ modeLabel }}</dd></div>
            <div v-if="mode !== 'manual'">
              <dt>题型</dt>
              <dd>{{ selectedTypeLabel }}</dd>
            </div>
            <div v-if="mode !== 'manual'"><dt>题量</dt><dd>{{ count }} 题</dd></div>
            <div v-if="mode !== 'manual'"><dt>预计页数</dt><dd>{{ estimatedPages }} 页左右</dd></div>
          </dl>
          <p class="hint">{{ mode === 'manual' ? '先打开空白卷，再在编辑器右侧选题或调生成器。' : '生成后可在打印设置中选择纸张、双栏、答案页、答题卡、竖式草稿区等。' }}</p>
        </aside>
      </div>
    </section>

    <section v-else-if="tab === 'wrong'" class="paper-card offline-card">
      <h2 class="section-title">错题卷</h2>
      <div class="form-grid narrow">
        <label class="field">
          <span>学科</span>
          <Select v-model="wrongSubjectId" :options="wrongSubjectOptions" option-label="label" option-value="value" size="small" />
        </label>
        <label class="field">
          <span>年级</span>
          <Select v-model="wrongGrade" :options="WRONG_GRADE_OPTIONS" option-label="label" option-value="value" size="small" />
        </label>
        <label class="field">
          <span>掌握状态</span>
          <Select v-model="wrongStatus" :options="WRONG_STATUS_OPTIONS" option-label="label" option-value="value" size="small" />
        </label>
      </div>
      <div class="actions">
        <Button label="生成错题卷" icon="pi pi-print" size="small" @click="openWrong" />
      </div>
      <p class="hint">按当前筛选条件导出，未掌握的错题默认排在前面。</p>
    </section>

    <section v-else-if="tab === 'copybook'" class="paper-card offline-card">
      <h2 class="section-title">语文字帖</h2>
      <div class="form-grid narrow">
        <label class="field">
          <span>年级</span>
          <Select v-model="copyGrade" :options="GRADE_OPTIONS" option-label="label" option-value="value" size="small" />
        </label>
        <label class="field">
          <span>内容</span>
          <Select v-model="copyMode" :options="COPY_MODES" option-label="label" option-value="value" size="small" />
        </label>
        <template v-if="copyMode === 'hanzi'">
          <label class="field">
            <span>字格</span>
            <Select v-model="copyGrid" :options="GRID_OPTIONS" option-label="label" option-value="value" size="small" />
          </label>
          <label class="field">
            <span>字数</span>
            <Select v-model="copyCount" :options="COPY_COUNTS" option-label="label" option-value="value" size="small" />
          </label>
          <label class="field">
            <span>每行字数</span>
            <Select v-model="copyCharsPerRow" :options="COPY_CHARS_PER_ROW" option-label="label" option-value="value" size="small" />
          </label>
          <label class="field">
            <span>每字格数</span>
            <Select v-model="copyCellsPerChar" :options="COPY_CELLS_PER_CHAR" option-label="label" option-value="value" size="small" />
          </label>
        </template>
        <label v-else class="field">
          <span>词语数量</span>
          <Select v-model="copyWordCount" :options="COPY_WORD_COUNTS" option-label="label" option-value="value" size="small" />
        </label>
      </div>
      <div class="actions">
        <Button label="生成字帖" icon="pi pi-print" size="small" @click="openCopybook" />
      </div>
      <p class="hint">
        {{
          copyMode === 'hanzi'
            ? '默认每行两个字、每字 4 格（范字 + 描红 + 两格空练）；双栏时自动判断是否放得下。'
            : '每行 2 个词，拼音在上、田字格在下，学生根据拼音写词语。'
        }}
      </p>
    </section>

    <section v-else-if="tab === 'oral'" class="paper-card offline-card">
      <h2 class="section-title">口算题卡</h2>
      <div class="form-grid narrow">
        <label class="field">
          <span>年级</span>
          <Select v-model="oralGrade" :options="GRADE_OPTIONS" option-label="label" option-value="value" size="small" />
        </label>
        <label class="field">
          <span>题量</span>
          <Select v-model="oralCount" :options="ORAL_COUNTS" option-label="label" option-value="value" size="small" />
        </label>
        <label class="field">
          <span>数值范围</span>
          <Select v-model="oralMax" :options="ORAL_MAX_OPTIONS" option-label="label" option-value="value" size="small" />
        </label>
        <label class="field">
          <span>运算</span>
          <Select v-model="oralOps" :options="ORAL_OPS_OPTIONS" option-label="label" option-value="value" size="small" />
        </label>
      </div>
      <div class="actions">
        <Button label="生成口算题卡" icon="pi pi-print" size="small" @click="openOralCard" />
      </div>
      <p class="hint">整页口算，每行题数、页脚页码、答案页在打印设置里调整。</p>
    </section>

    <section v-else class="paper-card offline-card">
      <h2 class="section-title">英语书写纸</h2>
      <div class="form-grid narrow">
        <label class="field">
          <span>年级</span>
          <Select v-model="englishGrade" :options="GRADE_OPTIONS" option-label="label" option-value="value" size="small" />
        </label>
        <label class="field">
          <span>内容</span>
          <Select v-model="englishMode" :options="ENGLISH_MODES" option-label="label" option-value="value" size="small" />
        </label>
        <label class="field">
          <span>数量</span>
          <Select v-model="englishCount" :options="ENGLISH_COUNTS" option-label="label" option-value="value" size="small" />
        </label>
      </div>
      <div class="actions">
        <Button label="生成书写纸" icon="pi pi-print" size="small" @click="openEnglish" />
      </div>
      <p class="hint">单词：范写 + 两行空练；句子：整句范写 + 两行空练；听写：编号 + 四线三格。</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import SelectButton from 'primevue/selectbutton'
import InputNumber from 'primevue/inputnumber'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import { contentApi, questionApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { usePrintStore } from '@/stores/print.store'
import { t } from '@/i18n'
import { ALL_TYPES, GRADE_LABEL, QUESTION_TYPE_LABELS, TYPES_BY_SUBJECT } from '@shared/constants'
import { QUESTION_PARAMS, defaultParams, type ParamField } from '@shared/question-params'
import type { KnowledgePoint, QuestionType, Subject } from '@shared/types'
import type { PrintSource } from '@shared/print'

type TabKey = 'paper' | 'wrong' | 'copybook' | 'oral' | 'english'
type PaperMode = 'random' | 'custom' | 'manual'
type HanziGrid = 'tian' | 'mi' | 'huigong' | 'pinyin-tian'
type EnglishMode = 'word' | 'sentence' | 'dictation'

const TABS: Array<{ label: string; value: TabKey }> = [
  { label: '自由组卷', value: 'paper' },
  { label: '错题卷', value: 'wrong' },
  { label: '文字练习', value: 'copybook' },
  { label: '口算题卡', value: 'oral' },
  { label: '英语书写', value: 'english' }
]
const MODE_OPTIONS: Array<{ label: string; value: PaperMode }> = [
  { label: '题库抽题', value: 'random' },
  { label: '实时生成', value: 'custom' },
  { label: '手动组卷（空白卷）', value: 'manual' }
]
const DIFFICULTY_OPTIONS = [
  { label: '不限', value: 0 },
  { label: '简单', value: 1 },
  { label: '中等', value: 2 },
  { label: '困难', value: 3 }
]
const GRADE_OPTIONS = [1, 2, 3, 4, 5, 6].map((value) => ({ label: GRADE_LABEL(value), value }))
const GRID_OPTIONS: Array<{ label: string; value: HanziGrid }> = [
  { label: '田字格', value: 'tian' },
  { label: '米字格', value: 'mi' },
  { label: '回宫格', value: 'huigong' },
  { label: '拼音田字格', value: 'pinyin-tian' }
]
const COPY_COUNTS = [
  { label: '10 字', value: 10 },
  { label: '20 字', value: 20 },
  { label: '30 字', value: 30 },
  { label: '40 字', value: 40 }
]
const COPY_CHARS_PER_ROW = [
  { label: '每行 1 个字', value: 1 },
  { label: '每行 2 个字', value: 2 }
]
const COPY_CELLS_PER_CHAR = [
  { label: '每字 3 格', value: 3 },
  { label: '每字 4 格', value: 4 },
  { label: '每字 5 格', value: 5 },
  { label: '每字 6 格', value: 6 }
]
const ENGLISH_MODES: Array<{ label: string; value: EnglishMode }> = [
  { label: '单词书写', value: 'word' },
  { label: '句子书写', value: 'sentence' },
  { label: '听写纸', value: 'dictation' }
]
const ENGLISH_COUNTS = [
  { label: '6 个', value: 6 },
  { label: '12 个', value: 12 },
  { label: '20 个', value: 20 }
]
const COPY_MODES: Array<{ label: string; value: 'hanzi' | 'pinyin-word' }> = [
  { label: '汉字字帖', value: 'hanzi' },
  { label: '看拼音写词语', value: 'pinyin-word' }
]
const COPY_WORD_COUNTS = [
  { label: '10 个词', value: 10 },
  { label: '20 个词', value: 20 },
  { label: '30 个词', value: 30 }
]
const ORAL_COUNTS = [
  { label: '20 题', value: 20 },
  { label: '50 题', value: 50 },
  { label: '100 题', value: 100 }
]
const ORAL_MAX_OPTIONS = [
  { label: '10 以内', value: 10 },
  { label: '20 以内', value: 20 },
  { label: '50 以内', value: 50 },
  { label: '100 以内', value: 100 }
]
const ORAL_OPS_OPTIONS: Array<{
  label: string
  value: 'add' | 'sub' | 'mul' | 'div' | 'mixed' | 'all'
}> = [
  { label: '加法', value: 'add' },
  { label: '减法', value: 'sub' },
  { label: '乘法', value: 'mul' },
  { label: '除法', value: 'div' },
  { label: '加减混合', value: 'mixed' },
  { label: '加减乘除', value: 'all' }
]
const WRONG_STATUS_OPTIONS = [
  { label: '未掌握', value: 0 },
  { label: '已掌握', value: 1 },
  { label: '全部', value: 2 }
]

const auth = useAuthStore()
const printStore = usePrintStore()
const router = useRouter()

const tab = ref<TabKey>('paper')
const subjects = ref<Subject[]>([])
const subjectId = ref<number | null>(null)
const grade = ref(auth.currentGrade)
const mode = ref<PaperMode>('random')
const count = ref(10)
const types = ref<QuestionType[]>(['single', 'fill', 'judge', 'calculation'])
const difficulty = ref(0)
const knowledgeIds = ref<number[]>([])
const knowledge = ref<KnowledgePoint[]>([])
const knowledgeLoading = ref(false)
const typeCounts = ref<Partial<Record<QuestionType, number>>>({})
const statsReady = ref(false)
const statsFailed = ref(false)
const customTypes = ref<QuestionType[]>(['calculation'])
const customParamsMap = reactive<Record<string, Record<string, string | number | boolean>>>({
  calculation: { ...defaultParams('calculation') }
})

const wrongSubjectId = ref(0)
const wrongGrade = ref(0)
const wrongStatus = ref(0)

const copyGrade = ref(auth.currentGrade)
const copyMode = ref<'hanzi' | 'pinyin-word'>('hanzi')
const copyGrid = ref<HanziGrid>(auth.currentGrade <= 2 ? 'pinyin-tian' : 'tian')
const copyCount = ref(20)
const copyCharsPerRow = ref(2)
const copyCellsPerChar = ref(4)
const copyWordCount = ref(10)

const oralGrade = ref(auth.currentGrade)
const oralCount = ref(50)
const oralMax = ref(20)
const oralOps = ref<'add' | 'sub' | 'mul' | 'div' | 'mixed' | 'all'>('mixed')

const englishGrade = ref(auth.currentGrade)
const englishMode = ref<EnglishMode>('word')
const englishCount = ref(12)

const subjectName = computed<string>(
  () => subjects.value.find((item) => item.id === subjectId.value)?.name ?? ''
)
const subjectTypes = computed<QuestionType[]>(
  () => TYPES_BY_SUBJECT[subjectName.value] ?? ALL_TYPES
)
const visibleTypes = computed<QuestionType[]>(() => {
  if (!statsReady.value || statsFailed.value) return subjectTypes.value
  return subjectTypes.value.filter((type) => (typeCounts.value[type] ?? 0) > 0)
})
const allSelected = computed<boolean>(
  () =>
    visibleTypes.value.length > 0 &&
    visibleTypes.value.every((type) => types.value.includes(type))
)
const allCustomSelected = computed<boolean>(
  () =>
    subjectTypes.value.length > 0 &&
    subjectTypes.value.every((type) => customTypes.value.includes(type))
)
const modeLabel = computed<string>(
  () => MODE_OPTIONS.find((item) => item.value === mode.value)?.label ?? ''
)
const selectedTypeLabel = computed<string>(() => {
  if (mode.value === 'custom') {
    if (customTypes.value.length === 0) return '未选择'
    if (allCustomSelected.value) return '全部题型'
    return customTypes.value.map((type) => QUESTION_TYPE_LABELS[type]).join('、')
  }
  if (types.value.length === 0) return '未选择'
  if (allSelected.value) return '全部题型'
  return types.value.map((type) => QUESTION_TYPE_LABELS[type]).join('、')
})
const knowledgeOptions = computed(() => flattenKnowledge(knowledge.value))
const wrongSubjectOptions = computed(() => [
  { label: '全部学科', value: 0 },
  ...subjects.value.map((item) => ({ label: item.name, value: item.id }))
])
const WRONG_GRADE_OPTIONS = computed(() => [
  { label: '全部年级', value: 0 },
  ...GRADE_OPTIONS
])
const estimatedPages = computed<number>(() => {
  const perPage = mode.value === 'custom' ? 8 : 10
  return Math.max(1, Math.ceil(count.value / perPage))
})
const canGenerate = computed<boolean>(() => {
  if (!subjectId.value) return false
  if (mode.value === 'manual') return true
  if (mode.value === 'custom') return customTypes.value.length > 0 && count.value > 0
  return types.value.length > 0 && count.value > 0
})

function flattenKnowledge(
  nodes: KnowledgePoint[],
  depth = 0
): Array<{ label: string; value: number }> {
  return nodes.flatMap((node) => [
    { label: `${'　'.repeat(depth)}${node.name}`, value: node.id },
    ...flattenKnowledge(node.children ?? [], depth + 1)
  ])
}

function toggleAllTypes(): void {
  types.value = allSelected.value ? [] : [...visibleTypes.value]
}

function toggleCustomTypes(): void {
  customTypes.value = allCustomSelected.value ? [] : [...subjectTypes.value]
}

function ensureParams(type: QuestionType): void {
  if (!customParamsMap[type]) customParamsMap[type] = { ...defaultParams(type) }
}

function paramValue(
  type: QuestionType,
  key: string,
  field: ParamField
): string | number | boolean {
  const params = customParamsMap[type] ?? {}
  const raw = params[key]
  if (raw !== undefined) return raw
  const fallback =
    field.type === 'select'
      ? (field.options?.[0]?.value ?? '')
      : field.type === 'number'
        ? field.default
        : false
  return fallback as string | number | boolean
}

function setCustomParam(
  type: QuestionType,
  key: string,
  value: string | number | boolean
): void {
  ensureParams(type)
  customParamsMap[type][key] = value
}

function syncSubjectTypes(): void {
  const allowed = subjectTypes.value
  const next = types.value.filter((type) => allowed.includes(type))
  types.value = next.length > 0 ? next : [...allowed]
  const customNext = customTypes.value.filter((type) => allowed.includes(type))
  customTypes.value = customNext.length > 0 ? customNext : allowed.includes('calculation') ? ['calculation'] : [allowed[0]]
}

async function loadSubjects(): Promise<void> {
  try {
    subjects.value = await contentApi.subjects(grade.value)
  } catch {
    subjects.value = []
  }
  if (!subjects.value.some((item) => item.id === subjectId.value)) {
    subjectId.value = subjects.value[0]?.id ?? null
  }
  syncSubjectTypes()
}

async function loadKnowledge(): Promise<void> {
  knowledgeIds.value = []
  if (!subjectId.value) {
    knowledge.value = []
    return
  }
  knowledgeLoading.value = true
  try {
    knowledge.value = await contentApi.knowledge(subjectId.value, grade.value)
  } catch {
    knowledge.value = []
  } finally {
    knowledgeLoading.value = false
  }
}

async function refreshTypeStats(): Promise<void> {
  if (!subjectId.value) {
    typeCounts.value = {}
    statsReady.value = false
    statsFailed.value = false
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
    statsFailed.value = false
    const visible = visibleTypes.value
    const next = types.value.filter((type) => visible.includes(type))
    if (next.length > 0) types.value = next
    else if (visible.length > 0) types.value = [...visible]
  } catch {
    typeCounts.value = {}
    statsFailed.value = true
  } finally {
    statsReady.value = true
  }
}

function openPaper(): void {
  if (!subjectId.value) return
  if (mode.value === 'manual') {
    router.push({
      path: '/paper-editor',
      query: { subjectId: String(subjectId.value), grade: String(grade.value) }
    })
    return
  }
  let source: PrintSource
  if (mode.value === 'custom') {
    const params: Record<string, Record<string, string | number | boolean>> = {}
    for (const type of customTypes.value) {
      ensureParams(type)
      params[type] = { ...customParamsMap[type] }
    }
    source = {
      kind: 'custom',
      subjectId: subjectId.value,
      grade: grade.value,
      types: [...customTypes.value],
      params,
      count: count.value,
      knowledgeIds: knowledgeIds.value.length > 0 ? [...knowledgeIds.value] : undefined,
      difficulties: difficulty.value > 0 ? [difficulty.value] : undefined
    }
  } else {
    source = {
      kind: 'bank',
      limit: count.value,
      filter: {
        subjectId: subjectId.value,
        grade: grade.value,
        types: [...types.value],
        difficulties: difficulty.value > 0 ? [difficulty.value] : undefined,
        knowledgeIds: knowledgeIds.value.length > 0 ? [...knowledgeIds.value] : undefined
      }
    }
  }
  printStore.open(source, {
    title: `${subjectName.value} · ${grade.value} 年级 · ${mode.value === 'custom' ? '专项练习' : '线下练习'}`,
    subject: subjectName.value,
    grade: grade.value,
    template: 'worksheet'
  })
}

function openWrong(): void {
  printStore.open(
    {
      kind: 'wrongbook',
      subjectId: wrongSubjectId.value || undefined,
      grade: wrongGrade.value || undefined,
      mastered: wrongStatus.value === 2 ? undefined : wrongStatus.value === 1
    },
    { title: '错题卷', template: 'worksheet' }
  )
}

function openCopybook(): void {
  if (copyMode.value === 'pinyin-word') {
    printStore.open(
      { kind: 'pinyin-word', grade: copyGrade.value, count: copyWordCount.value },
      {
        title: `${copyGrade.value} 年级看拼音写词语`,
        subject: '语文',
        grade: copyGrade.value,
        template: 'copybook'
      }
    )
    return
  }
  printStore.open(
    {
      kind: 'hanzi',
      grade: copyGrade.value,
      grid: copyGrid.value,
      limit: copyCount.value,
      charsPerRow: copyCharsPerRow.value,
      cellsPerChar: copyCellsPerChar.value
    },
    { title: `${copyGrade.value} 年级生字练习`, template: 'copybook' }
  )
}

function openOralCard(): void {
  printStore.open(
    {
      kind: 'oral-card',
      grade: oralGrade.value,
      count: oralCount.value,
      maxValue: oralMax.value,
      operations: oralOps.value
    },
    {
      title: `${oralGrade.value} 年级口算题卡`,
      subject: '数学',
      grade: oralGrade.value,
      template: 'worksheet'
    }
  )
}

function openEnglish(): void {
  printStore.open(
    {
      kind: 'english',
      grade: englishGrade.value,
      mode: englishMode.value,
      limit: englishCount.value
    },
    {
      title: `${englishGrade.value} 年级${ENGLISH_MODES.find((item) => item.value === englishMode.value)?.label ?? '书写'}`,
      template: 'copybook'
    }
  )
}

watch(grade, async () => {
  await loadSubjects()
  await loadKnowledge()
  await refreshTypeStats()
})

watch(subjectId, async () => {
  syncSubjectTypes()
  await loadKnowledge()
  await refreshTypeStats()
})

watch(difficulty, () => {
  void refreshTypeStats()
})

watch(customTypes, (value) => {
  for (const type of value) ensureParams(type)
})

watch(
  () => auth.currentGrade,
  (value) => {
    grade.value = value
    copyGrade.value = value
    englishGrade.value = value
    copyGrid.value = value <= 2 ? 'pinyin-tian' : 'tian'
  }
)

onMounted(async () => {
  await loadSubjects()
  await loadKnowledge()
  await refreshTypeStats()
})
</script>

<style scoped>
.offline-tabs {
  margin-bottom: 14px;
}

.offline-card {
  padding: 18px 22px 20px;
}

.offline-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 24px;
}

.form-col {
  min-width: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
  margin-bottom: 12px;
}

.form-grid.narrow {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  max-width: 640px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--ink-soft);
}

.field-block {
  margin: 4px 0 12px;
}

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--ink-soft);
}

.text-link {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--accent);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 12px;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--ink);
}

.param-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
  margin-bottom: 12px;
}

.actions {
  margin-top: 14px;
}

.summary-col {
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--bg-sunken);
}

.summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 10px 0 14px;
}

.summary div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12.5px;
}

.summary dt {
  color: var(--ink-faint);
}

.summary dd {
  margin: 0;
  color: var(--ink);
  text-align: right;
}

.hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-faint);
}

.param-block {
  margin: 4px 0 12px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.param-block .block-head {
  margin-bottom: 8px;
}

@media (max-width: 1100px) {
  .offline-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .summary-col {
    order: -1;
  }
}
</style>
