<template>
  <div class="editor-root">
    <header class="editor-bar">
      <Button icon="pi pi-arrow-left" text size="small" aria-label="返回" @click="goBack" />
      <strong>手动组卷</strong>
      <InputText
        v-model="options.header.title"
        size="small"
        class="title-input"
        :placeholder="defaultTitle"
      />
      <span class="count">{{ questions.length }} 题</span>
      <Button label="模板" size="small" text @click="openTemplates" />
      <Button label="多套" size="small" text @click="batchOpen = true" />
      <Button label="预览" size="small" outlined :loading="busy" @click="run('preview')" />
      <Button label="保存 PDF" size="small" :loading="busy" @click="run('save')" />
      <Button label="直接打印" size="small" outlined :loading="busy" @click="run('print')" />
    </header>

    <p v-if="message" class="editor-message" :class="{ 'is-error': isError }">{{ message }}</p>

    <div class="editor-body">
      <main ref="previewPane" class="preview-pane">
        <p v-if="doc && doc.sections.length === 0" class="empty-hint">
          当前是空白卷，在右侧从题库挑题或调用生成器
        </p>
        <div class="paper-shell" :style="shellStyle">
          <PrintPaper v-if="doc" :document="doc" />
          <div v-else class="paper-placeholder">正在生成空白卷…</div>
        </div>
      </main>

      <aside class="side-pane">
        <div class="side-tabs">
          <SelectButton
            v-model="panel"
            :options="PANELS"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            size="small"
          />
        </div>

        <div class="side-head">
          <button type="button" class="picked-toggle" @click="pickedOpen = !pickedOpen">
            已选 {{ questions.length }} 题 {{ pickedOpen ? '收起' : '查看' }}
          </button>
          <div class="side-head-actions">
            <button
              v-if="questions.length > 0"
              type="button"
              class="text-link"
              :disabled="swapping"
              @click="shufflePaper"
            >
              整套换题
            </button>
            <button v-if="questions.length > 0" type="button" class="text-link" @click="clearQuestions">
              清空
            </button>
          </div>
        </div>
        <div v-if="pickedOpen" class="picked-list">
          <div v-for="(item, index) in questions" :key="item.id" class="picked-item">
            <span class="picked-no">{{ index + 1 }}</span>
            <span class="picked-stem">{{ item.stem }}</span>
            <button
              type="button"
              class="picked-swap"
              :disabled="swapping"
              @click="swapQuestion(index)"
            >
              换
            </button>
            <button type="button" class="picked-remove" @click="removeQuestion(index)">×</button>
          </div>
          <p v-if="questions.length === 0" class="hint">还没有题目。</p>
        </div>

        <div class="side-body">
          <template v-if="panel === 'bank'">
            <div class="filter-grid">
              <label class="field">
                <span>学科</span>
                <Select
                  v-model="bankSubjectId"
                  :options="subjects"
                  option-label="name"
                  option-value="id"
                  size="small"
                  @update:model-value="onBankScopeChange"
                />
              </label>
              <label class="field">
                <span>年级</span>
                <Select
                  v-model="bankGrade"
                  :options="GRADE_OPTIONS"
                  option-label="label"
                  option-value="value"
                  size="small"
                  @update:model-value="onBankScopeChange"
                />
              </label>
              <label class="field">
                <span>难度</span>
                <Select
                  v-model="bankDifficulty"
                  :options="DIFFICULTY_OPTIONS"
                  option-label="label"
                  option-value="value"
                  size="small"
                  @update:model-value="onBankScopeChange"
                />
              </label>
              <label class="field">
                <span>知识点</span>
                <MultiSelect
                  v-model="bankKnowledgeIds"
                  :options="knowledgeOptions"
                  option-label="label"
                  option-value="value"
                  :placeholder="knowledgeLoading ? '加载中' : '不限'"
                  :max-selected-labels="2"
                  :selection-limit="99"
                  size="small"
                  filter
                />
              </label>
            </div>

            <div class="field-block">
              <div class="block-head">
                <span>题型</span>
                <button type="button" class="text-link" @click="bankTypes = bankTypes.length ? [] : [...bankTypeOptions]">
                  {{ bankTypes.length ? '不限' : '全选' }}
                </button>
              </div>
              <div class="type-grid">
                <label v-for="type in bankTypeOptions" :key="type" class="check">
                  <Checkbox v-model="bankTypes" :value="type" />
                  {{ QUESTION_TYPE_LABELS[type] }}
                </label>
              </div>
            </div>

            <div class="search-row">
              <InputText
                v-model="bankKeyword"
                size="small"
                placeholder="按题干搜索"
                class="grow"
                @keyup.enter="searchBank(1)"
              />
              <Button label="搜索" size="small" :loading="bankLoading" @click="searchBank(1)" />
            </div>

            <p class="hint">共 {{ bankTotal }} 题{{ bankSearched ? '' : '，点搜索查看结果' }}</p>
            <div class="bank-list">
              <div v-for="item in bankItems" :key="item.id" class="bank-item">
                <div class="bank-stem">{{ item.stem }}</div>
                <div class="bank-meta">
                  <span>{{ QUESTION_TYPE_LABELS[item.type] }}</span>
                  <span>{{ DIFFICULTY_LABELS[item.difficulty] ?? '' }}</span>
                  <span>{{ item.knowledgeName ?? '未归类' }}</span>
                  <Button
                    label="加入"
                    size="small"
                    text
                    :disabled="hasQuestion(item.id)"
                    @click="addFromBank(item)"
                  />
                </div>
              </div>
              <p v-if="bankSearched && bankItems.length === 0" class="hint">没有符合条件的题目。</p>
            </div>
            <div v-if="bankTotal > BANK_PAGE_SIZE" class="pager">
              <Button
                icon="pi pi-chevron-left"
                size="small"
                text
                :disabled="bankPage <= 1"
                @click="searchBank(bankPage - 1)"
              />
              <span>{{ bankPage }} / {{ bankPageCount }}</span>
              <Button
                icon="pi pi-chevron-right"
                size="small"
                text
                :disabled="bankPage >= bankPageCount"
                @click="searchBank(bankPage + 1)"
              />
            </div>
          </template>

          <template v-else-if="panel === 'generate'">
            <div class="field-block">
              <div class="block-head">
                <span>生成题型</span>
                <button type="button" class="text-link" @click="toggleGenTypes">
                  {{ genAllSelected ? '清空' : '全选' }}
                </button>
              </div>
              <div class="type-grid">
                <label v-for="type in subjectTypes" :key="type" class="check">
                  <Checkbox v-model="genTypes" :value="type" />
                  {{ QUESTION_TYPE_LABELS[type] }}
                </label>
              </div>
            </div>

            <div v-for="type in genTypes" :key="type" class="param-block">
              <div class="block-head"><span>{{ QUESTION_TYPE_LABELS[type] }}</span></div>
              <div v-if="(QUESTION_PARAMS[type] ?? []).length > 0" class="param-grid">
                <label v-for="field in QUESTION_PARAMS[type]" :key="field.key" class="field">
                  <span>{{ field.label }}</span>
                  <Select
                    v-if="field.type === 'select'"
                    :model-value="genParamValue(type, field)"
                    :options="field.options ?? []"
                    option-label="label"
                    option-value="value"
                    size="small"
                    @update:model-value="(value: string | number | boolean) => setGenParam(type, field.key, value)"
                  />
                  <InputNumber
                    v-else-if="field.type === 'number'"
                    :model-value="Number(genParams[type]?.[field.key] ?? 0)"
                    size="small"
                    :min="field.min"
                    :max="field.max"
                    :step="field.step ?? 1"
                    @update:model-value="(value: number | null) => setGenParam(type, field.key, value ?? 0)"
                  />
                  <Checkbox
                    v-else
                    :model-value="Boolean(genParams[type]?.[field.key])"
                    binary
                    @update:model-value="(value: boolean) => setGenParam(type, field.key, value)"
                  />
                </label>
              </div>
              <p v-else class="hint">该题型无需额外参数。</p>
            </div>

            <div class="filter-grid">
              <label class="field">
                <span>数量</span>
                <InputNumber v-model="genCount" size="small" :min="1" :max="100" show-buttons />
              </label>
              <label class="field">
                <span>难度</span>
                <Select
                  v-model="genDifficulty"
                  :options="DIFFICULTY_OPTIONS"
                  option-label="label"
                  option-value="value"
                  size="small"
                />
              </label>
            </div>

            <div class="actions">
              <Button
                label="生成并加入"
                icon="pi pi-sparkles"
                size="small"
                :loading="generating"
                :disabled="genTypes.length === 0"
                @click="generateQuestions"
              />
            </div>
            <p class="hint">按当前学科与年级调用对应的生成器，生成的题目直接追加到卷末。</p>
          </template>

          <template v-else>
            <PrintOptionsForm v-model:options="options" :subject="subjectName" :grade="grade" :show-title="false" />
          </template>
        </div>
      </aside>
    </div>

    <Dialog
      v-model:visible="templateOpen"
      header="试卷模板"
      :style="{ width: '520px' }"
      modal
      :draggable="false"
    >
      <div class="template-save">
        <InputText v-model="templateName" size="small" placeholder="模板名称，如：三年级语文周测" />
        <Button
          label="保存当前卷"
          size="small"
          :disabled="!templateName.trim() || questions.length === 0"
          @click="saveTemplate"
        />
      </div>
      <div class="template-list">
        <div v-for="item in templates" :key="item.id" class="template-item">
          <div class="template-info">
            <strong>{{ item.name }}</strong>
            <small>{{ item.createdAt }}</small>
          </div>
          <Button label="载入" size="small" text @click="loadTemplate(item.id)" />
          <Button label="删除" size="small" text severity="danger" @click="removeTemplate(item.id)" />
        </div>
        <p v-if="templates.length === 0" class="hint">还没有保存过模板。</p>
      </div>
    </Dialog>

    <Dialog
      v-model:visible="batchOpen"
      header="批量导出平行卷"
      :style="{ width: '400px' }"
      modal
      :draggable="false"
    >
      <p class="hint">按当前卷结构生成多套题目不同的平行卷，打包保存到同一文件夹。</p>
      <label class="field">
        <span>套数</span>
        <Select
          v-model.number="batchCount"
          :options="BATCH_OPTIONS"
          option-label="label"
          option-value="value"
          size="small"
        />
      </label>
      <template #footer>
        <Button label="取消" text size="small" @click="batchOpen = false" />
        <Button
          label="选择文件夹并导出"
          size="small"
          :loading="busy"
          :disabled="questions.length === 0"
          @click="exportBatch"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import SelectButton from 'primevue/selectbutton'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Checkbox from 'primevue/checkbox'
import { contentApi, printApi, printTemplateApi, questionApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { GRADE_LABEL, QUESTION_TYPE_LABELS, TYPES_BY_SUBJECT, ALL_TYPES } from '@shared/constants'
import { QUESTION_PARAMS, defaultParams, type ParamField } from '@shared/question-params'
import {
  defaultPrintOptions,
  PAPER_SIZES,
  type PrintDocument,
  type PrintOptions,
  type PrintRequest,
  type PrintSource,
  type PrintSourceQuestion
} from '@shared/print'
import type { KnowledgePoint, Question, QuestionType, Subject } from '@shared/types'
import PrintPaper from './PrintPaper.vue'
import PrintOptionsForm from '@/components/print/PrintOptionsForm.vue'

type PanelKey = 'bank' | 'generate' | 'setting'

const PANELS: Array<{ label: string; value: PanelKey }> = [
  { label: '题库', value: 'bank' },
  { label: '生成器', value: 'generate' },
  { label: '设置', value: 'setting' }
]
const GRADE_OPTIONS = [1, 2, 3, 4, 5, 6].map((value) => ({ label: GRADE_LABEL(value), value }))
const DIFFICULTY_OPTIONS = [
  { label: '不限', value: 0 },
  { label: '简单', value: 1 },
  { label: '中等', value: 2 },
  { label: '困难', value: 3 }
]
const DIFFICULTY_LABELS: Record<number, string> = { 1: '简单', 2: '中等', 3: '困难' }
const BANK_PAGE_SIZE = 20

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const subjectId = ref(Number(route.query.subjectId) || 0)
const grade = ref(Number(route.query.grade) || auth.currentGrade)
const subjects = ref<Subject[]>([])
const questions = ref<PrintSourceQuestion[]>([])
const doc = ref<PrintDocument | null>(null)
const options = ref<PrintOptions>(defaultPrintOptions())
const panel = ref<PanelKey>('bank')
const pickedOpen = ref(false)
const busy = ref(false)
const message = ref('')
const isError = ref(false)
const previewPane = ref<HTMLElement | null>(null)
const zoom = ref(0.7)

const subjectName = computed<string>(
  () => subjects.value.find((item) => item.id === subjectId.value)?.name ?? ''
)
const defaultTitle = computed<string>(
  () => `${subjectName.value} · ${grade.value} 年级 · 手动组卷`
)
const subjectTypes = computed<QuestionType[]>(
  () => TYPES_BY_SUBJECT[subjectName.value] ?? ALL_TYPES
)

const paperSize = computed(() => {
  const size = PAPER_SIZES[options.value.size] ?? PAPER_SIZES.A4
  return options.value.orientation === 'landscape'
    ? { width: size.height, height: size.width }
    : size
})
const shellStyle = computed(() => ({
  width: `${paperSize.value.width}mm`,
  minHeight: `${paperSize.value.height}mm`,
  padding: '16mm 14mm 12mm',
  zoom: zoom.value
}))

// 题库筛选
const bankSubjectId = ref(subjectId.value)
const bankGrade = ref(grade.value)
const bankTypes = ref<QuestionType[]>([])
const bankDifficulty = ref(0)
const bankKnowledgeIds = ref<number[]>([])
const bankKeyword = ref('')
const bankItems = ref<Question[]>([])
const bankTotal = ref(0)
const bankPage = ref(1)
const bankLoading = ref(false)
const bankSearched = ref(false)
const bankTypeOptions = ref<QuestionType[]>([])
const knowledge = ref<KnowledgePoint[]>([])
const knowledgeLoading = ref(false)
const bankPageCount = computed<number>(() => Math.max(1, Math.ceil(bankTotal.value / BANK_PAGE_SIZE)))
const knowledgeOptions = computed(() => flattenKnowledge(knowledge.value))

// 生成器
const genTypes = ref<QuestionType[]>(['single'])
const genParams = reactive<Record<string, Record<string, string | number | boolean>>>({
  single: { ...defaultParams('single') }
})
const genCount = ref(10)
const genDifficulty = ref(0)
const generating = ref(false)
const swapping = ref(false)
const templateOpen = ref(false)
const templateName = ref('')
const templates = ref<Array<{ id: number; name: string; createdAt: string }>>([])
const batchOpen = ref(false)
const batchCount = ref(3)
const BATCH_OPTIONS = [2, 3, 4, 5].map((value) => ({ label: `${value} 套`, value }))
const genAllSelected = computed<boolean>(
  () =>
    subjectTypes.value.length > 0 &&
    subjectTypes.value.every((type) => genTypes.value.includes(type))
)

let buildTimer: ReturnType<typeof setTimeout> | null = null
let bankTimer: ReturnType<typeof setTimeout> | null = null
let tempId = -1

function flattenKnowledge(
  nodes: KnowledgePoint[],
  depth = 0
): Array<{ label: string; value: number }> {
  return nodes.flatMap((node) => [
    { label: `${'　'.repeat(depth)}${node.name}`, value: node.id },
    ...flattenKnowledge(node.children ?? [], depth + 1)
  ])
}

function manualSource(): PrintSource | null {
  if (!subjectId.value) return null
  return {
    kind: 'manual',
    subjectId: subjectId.value,
    grade: grade.value,
    questions: questions.value
  }
}

function addQuestions(list: PrintSourceQuestion[]): number {
  let added = 0
  for (const item of list) {
    const key = JSON.stringify([item.type, item.stem, item.answer, item.options])
    if (questions.value.some((exist) => JSON.stringify([exist.type, exist.stem, exist.answer, exist.options]) === key)) continue
    questions.value.push({ ...item, id: tempId-- })
    added += 1
  }
  if (added > 0) scheduleBuild()
  return added
}

function hasQuestion(id: number): boolean {
  return questions.value.some((item) => item.id === id)
}

function addFromBank(question: Question): void {
  const added = addQuestions([fromQuestion(question)])
  if (added === 0) message.value = '这道题已在卷中'
}

function fromQuestion(question: Question): PrintSourceQuestion {
  return {
    id: question.id,
    subjectId: question.subjectId,
    subjectName: subjects.value.find((item) => item.id === question.subjectId)?.name ?? '',
    grade: question.grade,
    type: question.type,
    stem: question.stem,
    options: question.options,
    answer: question.answer,
    solution: question.solution,
    score: question.score,
    difficulty: question.difficulty,
    knowledgeName: question.knowledgeName ?? null,
    source: question.source
  }
}

function removeQuestion(index: number): void {
  questions.value.splice(index, 1)
  scheduleBuild()
}

function clearQuestions(): void {
  questions.value = []
  scheduleBuild()
}

function scheduleBuild(): void {
  if (buildTimer) clearTimeout(buildTimer)
  buildTimer = setTimeout(() => {
    buildTimer = null
    void rebuild()
  }, 200)
}

async function rebuild(): Promise<void> {
  const source = manualSource()
  if (!source || !auth.currentUser) return
  try {
    doc.value = await printApi.build({
      userId: auth.currentUser.id,
      source,
      options: options.value
    })
    updateZoom()
  } catch (cause) {
    isError.value = true
    message.value = cause instanceof Error ? cause.message : '预览生成失败'
  }
}

function updateZoom(): void {
  const el = previewPane.value
  if (!el) return
  const widthPx = (paperSize.value.width * 96) / 25.4
  zoom.value = Math.min(1, Math.max(0.3, (el.clientWidth - 56) / widthPx))
}

async function loadSubjects(): Promise<void> {
  try {
    subjects.value = await contentApi.subjects(grade.value)
  } catch {
    subjects.value = []
  }
  if (!subjects.value.some((item) => item.id === subjectId.value)) {
    subjectId.value = subjects.value[0]?.id ?? 0
  }
  if (!subjects.value.some((item) => item.id === bankSubjectId.value)) {
    bankSubjectId.value = subjectId.value
  }
}

async function loadKnowledge(): Promise<void> {
  bankKnowledgeIds.value = []
  if (!bankSubjectId.value) {
    knowledge.value = []
    return
  }
  knowledgeLoading.value = true
  try {
    knowledge.value = await contentApi.knowledge(bankSubjectId.value, bankGrade.value)
  } catch {
    knowledge.value = []
  } finally {
    knowledgeLoading.value = false
  }
}

async function refreshBankTypes(): Promise<void> {
  const types = TYPES_BY_SUBJECT[subjects.value.find((item) => item.id === bankSubjectId.value)?.name ?? ''] ?? ALL_TYPES
  bankTypeOptions.value = types
  if (!bankSubjectId.value) return
  try {
    const stats = await questionApi.typeStats({
      subjectId: bankSubjectId.value,
      grade: bankGrade.value,
      types,
      difficulties: bankDifficulty.value ? [bankDifficulty.value] : []
    })
    const available = new Set(stats.filter((item) => item.count > 0).map((item) => item.type))
    const filtered = types.filter((type) => available.has(type))
    if (filtered.length > 0) bankTypeOptions.value = filtered
    bankTypes.value = bankTypes.value.filter((type) => bankTypeOptions.value.includes(type))
  } catch {
    // 统计失败时保留全部题型
  }
}

async function searchBank(page = 1): Promise<void> {
  if (bankLoading.value) return
  bankLoading.value = true
  isError.value = false
  try {
    const result = await questionApi.page({
      subjectId: bankSubjectId.value || undefined,
      grade: bankGrade.value || undefined,
      types: bankTypes.value.length > 0 ? [...bankTypes.value] : undefined,
      difficulties: bankDifficulty.value ? [bankDifficulty.value] : undefined,
      knowledgeIds: bankKnowledgeIds.value.length > 0 ? [...bankKnowledgeIds.value] : undefined,
      keyword: bankKeyword.value.trim() || undefined,
      page,
      pageSize: BANK_PAGE_SIZE
    })
    bankItems.value = result.items
    bankTotal.value = result.total
    bankPage.value = result.page
    bankSearched.value = true
  } catch (cause) {
    isError.value = true
    message.value = cause instanceof Error ? cause.message : '题库查询失败'
  } finally {
    bankLoading.value = false
  }
}

async function onBankScopeChange(): Promise<void> {
  if (bankSubjectId.value && bankSubjectId.value !== subjectId.value) {
    subjectId.value = bankSubjectId.value
    scheduleBuild()
  }
  if (bankGrade.value && bankGrade.value !== grade.value) {
    grade.value = bankGrade.value
    scheduleBuild()
  }
  await loadKnowledge()
  await refreshBankTypes()
  await searchBank(1)
}

/** 题型、难度、知识点变化后自动重查，不必再点搜索 */
function scheduleSearch(): void {
  if (bankTimer) clearTimeout(bankTimer)
  bankTimer = setTimeout(() => {
    bankTimer = null
    void searchBank(1)
  }, 250)
}

function ensureGenParams(type: QuestionType): void {
  if (!genParams[type]) genParams[type] = { ...defaultParams(type) }
}

function genParamValue(type: QuestionType, field: ParamField): string | number | boolean {
  const raw = genParams[type]?.[field.key]
  if (raw !== undefined) return raw
  const fallback =
    field.type === 'select'
      ? (field.options?.[0]?.value ?? '')
      : field.type === 'number'
        ? field.default
        : false
  return fallback as string | number | boolean
}

function setGenParam(type: QuestionType, key: string, value: string | number | boolean): void {
  ensureGenParams(type)
  genParams[type][key] = value
}

function toggleGenTypes(): void {
  genTypes.value = genAllSelected.value ? [] : [...subjectTypes.value]
}

async function generateQuestions(): Promise<void> {
  if (generating.value || genTypes.value.length === 0 || !subjectId.value) return
  generating.value = true
  isError.value = false
  message.value = ''
  try {
    const params: Record<string, Record<string, string | number | boolean>> = {}
    for (const type of genTypes.value) {
      ensureGenParams(type)
      params[type] = { ...genParams[type] }
    }
    const list = await printApi.generate({
      subjectId: subjectId.value,
      grade: grade.value,
      types: [...genTypes.value],
      params,
      count: genCount.value,
      difficulties: genDifficulty.value ? [genDifficulty.value] : undefined
    })
    const added = addQuestions(list)
    message.value = added > 0 ? `已加入 ${added} 道题` : '没有生成新的题目，试试调整参数'
    if (added === 0) isError.value = true
  } catch (cause) {
    isError.value = true
    message.value = cause instanceof Error ? cause.message : '生成失败'
  } finally {
    generating.value = false
  }
}

async function swapQuestion(index: number): Promise<void> {
  const current = questions.value[index]
  if (!current || swapping.value) return
  swapping.value = true
  isError.value = false
  try {
    const result = await questionApi.page({
      subjectId: current.subjectId || subjectId.value,
      grade: current.grade || grade.value,
      types: [current.type as QuestionType],
      difficulties: [current.difficulty],
      pageSize: 60
    })
    const used = new Set(questions.value.map((item) => item.stem))
    const candidates = result.items.filter((item) => !used.has(item.stem))
    if (candidates.length === 0) {
      isError.value = true
      message.value = '没有找到可替换的同难度题目'
      return
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    questions.value[index] = { ...fromQuestion(pick), id: tempId-- }
    message.value = '已换一题'
    scheduleBuild()
  } catch (cause) {
    isError.value = true
    message.value = cause instanceof Error ? cause.message : '换题失败'
  } finally {
    swapping.value = false
  }
}

async function parallelQuestions(base: PrintSourceQuestion[]): Promise<PrintSourceQuestion[]> {
  const used = new Set(base.map((item) => item.stem))
  const next: PrintSourceQuestion[] = []
  for (const current of base) {
    const result = await questionApi.page({
      subjectId: current.subjectId || subjectId.value,
      grade: current.grade || grade.value,
      types: [current.type as QuestionType],
      difficulties: [current.difficulty],
      pageSize: 60
    })
    const candidates = result.items.filter((item) => !used.has(item.stem))
    if (candidates.length === 0) {
      next.push(current)
      continue
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    used.add(pick.stem)
    next.push({ ...fromQuestion(pick), id: tempId-- })
  }
  return next
}

async function shufflePaper(): Promise<void> {
  if (questions.value.length === 0 || swapping.value) return
  swapping.value = true
  isError.value = false
  try {
    questions.value = await parallelQuestions(questions.value)
    message.value = '已生成平行卷'
    scheduleBuild()
  } catch (cause) {
    isError.value = true
    message.value = cause instanceof Error ? cause.message : '生成平行卷失败'
  } finally {
    swapping.value = false
  }
}

async function exportBatch(): Promise<void> {
  if (!auth.currentUser || questions.value.length === 0 || busy.value) return
  busy.value = true
  isError.value = false
  message.value = ''
  try {
    const requests: Array<{ source: PrintSource; options: PrintOptions }> = []
    let current = [...questions.value]
    for (let index = 0; index < batchCount.value; index += 1) {
      if (index > 0) current = await parallelQuestions(current)
      requests.push({
        source: {
          kind: 'manual',
          subjectId: subjectId.value,
          grade: grade.value,
          questions: current
        },
        options: options.value
      })
    }
    const result = await printApi.batch({ userId: auth.currentUser.id, requests })
    if (!result.canceled) {
      batchOpen.value = false
      message.value = `已导出 ${result.count ?? 0} 套到：${result.dir ?? ''}`
    }
  } catch (cause) {
    isError.value = true
    message.value = cause instanceof Error ? cause.message : '批量导出失败'
  } finally {
    busy.value = false
  }
}

async function openTemplates(): Promise<void> {
  templateOpen.value = true
  await refreshTemplates()
}

async function refreshTemplates(): Promise<void> {
  if (!auth.currentUser) {
    templates.value = []
    return
  }
  try {
    templates.value = await printTemplateApi.list(auth.currentUser.id)
  } catch {
    templates.value = []
  }
}

async function saveTemplate(): Promise<void> {
  const name = templateName.value.trim()
  if (!name || !subjectId.value || questions.value.length === 0 || !auth.currentUser) return
  try {
    const payload = JSON.stringify({
      subjectId: subjectId.value,
      grade: grade.value,
      questions: questions.value,
      options: options.value
    })
    await printTemplateApi.save({
      userId: auth.currentUser.id,
      name,
      subjectId: subjectId.value,
      grade: grade.value,
      payload
    })
    templateName.value = ''
    message.value = '模板已保存'
    await refreshTemplates()
  } catch (cause) {
    isError.value = true
    message.value = cause instanceof Error ? cause.message : '保存模板失败'
  }
}

async function loadTemplate(id: number): Promise<void> {
  if (!auth.currentUser) return
  try {
    const detail = await printTemplateApi.get(auth.currentUser.id, id)
    if (!detail) return
    const payload = JSON.parse(detail.payload) as {
      subjectId?: number
      grade?: number
      questions?: PrintSourceQuestion[]
      options?: Partial<PrintOptions>
    }
    const base = defaultPrintOptions()
    if (payload.subjectId) subjectId.value = payload.subjectId
    if (payload.grade) grade.value = payload.grade
    bankSubjectId.value = subjectId.value
    bankGrade.value = grade.value
    questions.value = Array.isArray(payload.questions)
      ? payload.questions.map((item) => ({ ...item }))
      : []
    options.value = {
      ...base,
      ...payload.options,
      header: { ...base.header, ...(payload.options?.header ?? {}) }
    }
    templateOpen.value = false
    message.value = `已载入模板：${detail.name}`
    await loadKnowledge()
    await refreshBankTypes()
    await searchBank(1)
    scheduleBuild()
  } catch (cause) {
    isError.value = true
    message.value = cause instanceof Error ? cause.message : '载入模板失败'
  }
}

async function removeTemplate(id: number): Promise<void> {
  if (!auth.currentUser) return
  try {
    await printTemplateApi.remove(auth.currentUser.id, id)
    await refreshTemplates()
  } catch {
    // 删除失败时保留列表
  }
}

async function run(action: 'preview' | 'save' | 'print'): Promise<void> {
  if (busy.value) return
  const source = manualSource()
  if (!source || !auth.currentUser) {
    isError.value = true
    message.value = '请先选择用户'
    return
  }
  busy.value = true
  isError.value = false
  message.value = ''
  const request: PrintRequest = {
    userId: auth.currentUser.id,
    source,
    options: options.value
  }
  try {
    if (action === 'preview') {
      await printApi.preview(request)
      return
    }
    if (action === 'save') {
      const result = await printApi.save(request)
      if (!result.canceled) message.value = `已保存：${result.path ?? ''}`
      return
    }
    await printApi.print(request)
  } catch (cause) {
    isError.value = true
    message.value = cause instanceof Error ? cause.message : '打印失败，请重试'
  } finally {
    busy.value = false
  }
}

function goBack(): void {
  router.push('/offline')
}

watch(
  () => options.value,
  () => {
    scheduleBuild()
    updateZoom()
  },
  { deep: true }
)

watch(genTypes, (value) => {
  for (const type of value) ensureGenParams(type)
})

watch(
  [() => bankTypes.value.join(','), bankDifficulty, () => bankKnowledgeIds.value.join(',')],
  () => scheduleSearch()
)

watch(
  () => grade.value,
  () => {
    void loadSubjects()
  }
)

onMounted(async () => {
  restoreDraft()
  await loadSubjects()
  await loadKnowledge()
  await refreshBankTypes()
  await searchBank(1)
  await rebuild()
  window.addEventListener('resize', updateZoom)
})

let draftTimer: ReturnType<typeof setTimeout> | null = null

function draftKey(): string {
  return auth.currentUser ? `study.paperDraft.${auth.currentUser.id}` : ''
}

function restoreDraft(): void {
  const key = draftKey()
  if (!key) return
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return
    const draft = JSON.parse(raw) as {
      subjectId?: number
      grade?: number
      questions?: PrintSourceQuestion[]
      options?: Partial<PrintOptions>
    }
    if (!Array.isArray(draft.questions) || draft.questions.length === 0) return
    const base = defaultPrintOptions()
    if (draft.subjectId) subjectId.value = draft.subjectId
    if (draft.grade) grade.value = draft.grade
    questions.value = draft.questions.map((item) => ({ ...item }))
    options.value = {
      ...base,
      ...draft.options,
      header: { ...base.header, ...(draft.options?.header ?? {}) }
    }
    message.value = '已恢复上次未保存的组卷'
  } catch {
    // 草稿损坏时从空白卷开始
  }
}

watch(
  [questions, options, subjectId, grade],
  () => {
    const key = draftKey()
    if (!key) return
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(() => {
      if (questions.value.length === 0) {
        localStorage.removeItem(key)
        return
      }
      localStorage.setItem(
        key,
        JSON.stringify({
          subjectId: subjectId.value,
          grade: grade.value,
          questions: questions.value,
          options: options.value
        })
      )
    }, 400)
  },
  { deep: true }
)

onBeforeUnmount(() => {
  if (buildTimer) clearTimeout(buildTimer)
  if (bankTimer) clearTimeout(bankTimer)
  if (draftTimer) clearTimeout(draftTimer)
  window.removeEventListener('resize', updateZoom)
})
</script>

<style scoped>
.editor-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #e9edf2;
  color: #1b2430;
}

.editor-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: #fff;
  border-bottom: 1px solid #d8dfe8;
}

.editor-bar strong {
  font-size: 14px;
  white-space: nowrap;
}

.title-input {
  width: 320px;
}

.count {
  font-size: 12px;
  color: #5b6b7f;
  margin-left: auto;
}

.editor-message {
  margin: 0;
  padding: 6px 16px;
  font-size: 12px;
  color: #1f7a4d;
  background: #eef8f2;
}

.editor-message.is-error {
  color: #b23b3b;
  background: #fdefef;
}

.editor-body {
  display: flex;
  min-height: 0;
  flex: 1;
}

.preview-pane {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 20px;
}

.paper-placeholder {
  padding: 40mm 0;
  text-align: center;
  font-size: 13px;
  color: #8a97a8;
}

.empty-hint {
  margin: 0 0 12px;
  text-align: center;
  font-size: 12px;
  color: #5b6b7f;
}

.side-pane {
  display: flex;
  flex-direction: column;
  width: 400px;
  flex-shrink: 0;
  background: #fff;
  border-left: 1px solid #d8dfe8;
  min-height: 0;
}

.side-tabs {
  padding: 10px 12px 6px;
}

.side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 8px;
  font-size: 12px;
}

.side-head-actions {
  display: flex;
  gap: 10px;
}

.picked-toggle {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--accent);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
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

.picked-list {
  max-height: 200px;
  overflow-y: auto;
  padding: 0 12px 8px;
  border-bottom: 1px solid #e3e9f0;
}

.picked-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  font-size: 12px;
  border-bottom: 1px dashed #edf1f6;
}

.picked-no {
  width: 18px;
  flex-shrink: 0;
  color: #8a97a8;
}

.picked-stem {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picked-remove {
  border: none;
  background: transparent;
  color: #b23b3b;
  font-size: 15px;
  cursor: pointer;
  line-height: 1;
}

.picked-swap {
  border: none;
  background: transparent;
  color: var(--accent);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  padding: 0 2px;
}

.picked-swap:disabled {
  opacity: 0.4;
  cursor: default;
}

.template-save {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.template-save :deep(.p-inputtext) {
  flex: 1;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}

.template-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid #e3e9f0;
  border-radius: 8px;
}

.template-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.template-info strong {
  font-size: 12.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-info small {
  font-size: 11px;
  color: #8a97a8;
}

.side-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 12px 20px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  margin-bottom: 10px;
}

.filter-grid .wide {
  grid-column: 1 / -1;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #5b6b7f;
}

.field-block {
  margin: 4px 0 10px;
}

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12px;
  color: #5b6b7f;
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px 10px;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: #1b2430;
}

.check-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin-bottom: 10px;
}

.check-row :deep(.p-select) {
  min-width: 120px;
}

.param-block {
  margin: 4px 0 10px;
  padding: 8px 10px;
  border: 1px solid #e3e9f0;
  border-radius: 8px;
}

.param-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}

.search-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.grow {
  flex: 1;
}

.bank-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bank-item {
  padding: 8px 10px;
  border: 1px solid #e3e9f0;
  border-radius: 8px;
}

.bank-stem {
  font-size: 12.5px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bank-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 6px;
  font-size: 11.5px;
  color: #8a97a8;
}

.bank-meta :deep(.p-button) {
  margin-left: auto;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding-top: 10px;
  font-size: 12px;
  color: #5b6b7f;
}

.actions {
  margin: 10px 0;
}

.hint {
  margin: 6px 0;
  font-size: 12px;
  line-height: 1.6;
  color: #8a97a8;
}
</style>
