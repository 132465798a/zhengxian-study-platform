<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="form.id ? t.admin.editQuestion : t.admin.newQuestion"
    :style="{ width: '640px' }"
    :dismissable-mask="false"
    :draggable="false"
  >
    <div class="form-grid">
      <label class="field">
        <span>{{ t.admin.formSubject }}</span>
        <Select
          v-model="form.subjectId"
          :options="subjects"
          option-label="name"
          option-value="id"
          :placeholder="t.admin.formSubject"
          @change="onSubjectGradeChange"
        />
      </label>
      <label class="field">
        <span>{{ t.admin.formGrade }}</span>
        <Select
          v-model="form.grade"
          :options="gradeOptions"
          option-label="label"
          option-value="value"
          :placeholder="t.admin.formGrade"
          @change="onSubjectGradeChange"
        />
      </label>
      <label class="field">
        <span>{{ t.admin.formType }}</span>
        <Select
          v-model="form.type"
          :options="typeOptions"
          option-label="label"
          option-value="value"
          :placeholder="t.admin.formType"
        />
      </label>
      <label class="field">
        <span>{{ t.admin.formDifficulty }}</span>
        <Select
          v-model="form.difficulty"
          :options="difficultyOptions"
          option-label="label"
          option-value="value"
          :placeholder="t.admin.formDifficulty"
        />
      </label>
      <label class="field field-full">
        <span>{{ t.admin.formKnowledge }}</span>
        <Select
          v-model="form.knowledgeId"
          :options="knowledgeOptions"
          option-label="label"
          option-value="id"
          :placeholder="t.practice.choosePlaceholder"
          :disabled="!form.subjectId"
          show-clear
        />
      </label>
      <label class="field field-full">
        <span>{{ t.admin.formStem }}</span>
        <Textarea v-model="form.stem" rows="4" />
        <small class="hint">{{ t.admin.formStemHint }}</small>
      </label>
      <label v-if="showOptions" class="field field-full">
        <span>{{ t.admin.formOptions }}</span>
        <Textarea v-model="form.optionsText" rows="4" :placeholder="t.admin.formOptionsHint" />
        <small class="hint">{{ t.admin.formOptionsHint }}</small>
      </label>
      <label class="field field-full">
        <span>{{ t.admin.formAnswer }}</span>
        <InputText v-model="form.answerText" />
        <small class="hint">{{ t.admin.formAnswerHint }}</small>
      </label>
      <label class="field field-full">
        <span>{{ t.admin.formSolution }}</span>
        <Textarea v-model="form.solution" rows="3" />
      </label>
      <label class="field">
        <span>{{ t.admin.formScore }}</span>
        <InputText v-model="form.score" inputmode="decimal" />
      </label>
    </div>
    <template #footer>
      <Button :label="t.common.actions.cancel" text @click="visible = false" />
      <Button :label="t.common.actions.save" :loading="saving" @click="save" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { contentApi, questionApi } from '@/api'
import { t } from '@/i18n'
import { ALL_TYPES, GRADE_LABEL } from '@shared/constants'
import type {
  KnowledgePoint,
  NewQuestion,
  Question,
  QuestionAnswer,
  QuestionType,
  Subject
} from '@shared/types'

interface KnowledgeOption {
  id: number
  label: string
}

interface QuestionForm {
  id: number | null
  subjectId: number | null
  grade: number
  type: QuestionType
  difficulty: number
  knowledgeId: number | null
  stem: string
  optionsText: string
  answerText: string
  solution: string
  score: string
}

const props = defineProps<{
  question: Question | null
  subjects: Subject[]
  defaultSubjectId?: number | null
  defaultGrade?: number | null
}>()

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{
  saved: []
}>()

const toast = useToast()

const saving = ref(false)
const knowledgeTree = ref<KnowledgePoint[]>([])
const form = reactive<QuestionForm>(createEmptyForm())

const gradeOptions = [1, 2, 3, 4, 5, 6].map((value) => ({ label: GRADE_LABEL(value), value }))
const typeOptions = ALL_TYPES.filter((value) => value !== 'pinyin_word').map((value) => ({
  label: t.common.questionTypes[value],
  value
}))
const difficultyOptions = [1, 2, 3].map((value) => ({ label: t.common.difficulty[value], value }))

const showOptions = computed(
  () => form.type === 'single' || form.type === 'multiple' || form.type === 'judge' || form.type === 'sorting'
)

const knowledgeOptions = computed(() => flattenKnowledge(knowledgeTree.value))

watch(visible, (value) => {
  if (!value) return
  Object.assign(form, props.question ? formFromQuestion(props.question) : createEmptyForm())
  void loadKnowledge()
})

function flattenKnowledge(list: KnowledgePoint[], depth = 0): KnowledgeOption[] {
  return list.flatMap((item) => [
    { id: item.id, label: `${'  '.repeat(depth)}${item.name}` },
    ...(item.children ? flattenKnowledge(item.children, depth + 1) : [])
  ])
}

function createEmptyForm(): QuestionForm {
  return {
    id: null,
    subjectId: props.defaultSubjectId ?? props.subjects[0]?.id ?? null,
    grade: props.defaultGrade ?? 1,
    type: 'single',
    difficulty: 2,
    knowledgeId: null,
    stem: '',
    optionsText: '',
    answerText: '',
    solution: '',
    score: '2'
  }
}

function formFromQuestion(question: Question): QuestionForm {
  return {
    id: question.id,
    subjectId: question.subjectId,
    grade: question.grade,
    type: question.type,
    difficulty: question.difficulty,
    knowledgeId: question.knowledgeId,
    stem: question.stem,
    optionsText: optionsToText(question.options),
    answerText: answerToText(question),
    solution: question.solution ?? '',
    score: String(question.score)
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : t.common.status.error
}

function fail(detail: string): void {
  toast.add({ severity: 'error', summary: t.common.status.error, detail, life: 3200 })
}

async function loadKnowledge(): Promise<void> {
  if (!form.subjectId) {
    knowledgeTree.value = []
    return
  }
  try {
    knowledgeTree.value = await contentApi.knowledge(form.subjectId, form.grade)
  } catch {
    knowledgeTree.value = []
  }
}

function onSubjectGradeChange(): void {
  form.knowledgeId = null
  void loadKnowledge()
}

function optionsToText(options: unknown): string {
  return Array.isArray(options) ? options.map((item) => String(item)).join('\n') : ''
}

function answerToText(question: Question): string {
  const answer = question.answer
  if (question.type === 'single' || question.type === 'judge' || question.type === 'calculation') {
    return String(answer)
  }
  if (question.type === 'multiple') {
    return Array.isArray(answer) ? answer.map((item) => String(item)).join(',') : String(answer)
  }
  if (question.type === 'fill' || question.type === 'cloze' || question.type === 'sorting') {
    return Array.isArray(answer) ? answer.map((item) => String(item)).join('|') : String(answer)
  }
  if (question.type === 'matching') {
    if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
      return Object.entries(answer)
        .map(([key, value]) => `${key}:${String(value)}`)
        .join(',')
    }
    return ''
  }
  if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
    const reference = answer.reference
    return reference === undefined || reference === null ? '' : String(reference)
  }
  return String(answer)
}

function textToOptions(): unknown {
  const lines = form.optionsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return null
  if (form.type === 'single' || form.type === 'multiple' || form.type === 'judge' || form.type === 'sorting') {
    return lines
  }
  return null
}

function textToAnswer(): QuestionAnswer | null {
  const text = form.answerText.trim()
  if (!text) return null

  if (form.type === 'single' || form.type === 'judge') {
    const value = Number(text)
    return Number.isInteger(value) && value >= 0 ? value : null
  }
  if (form.type === 'multiple') {
    const values = text
      .split(/[,|，]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => Number(part))
    return values.length > 0 && values.every((value) => Number.isInteger(value) && value >= 0)
      ? values
      : null
  }
  if (form.type === 'fill' || form.type === 'cloze' || form.type === 'sorting') {
    const values = text
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean)
    return values.length > 0 ? values : null
  }
  if (form.type === 'matching') {
    const pairs = text
      .split(/[,，]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.split(/[:：]/))
    if (pairs.some((pair) => pair.length !== 2 || !pair[0].trim() || !pair[1].trim())) return null
    return Object.fromEntries(pairs.map(([key, value]) => [key.trim(), value.trim()]))
  }
  if (form.type === 'calculation') {
    const value = Number(text)
    return Number.isFinite(value) ? value : text
  }
  return { reference: text, keywords: [] }
}

async function save(): Promise<void> {
  const stem = form.stem.trim()
  if (!stem) {
    fail(t.admin.formStem)
    return
  }
  const answer = textToAnswer()
  if (answer === null) {
    fail(t.admin.formAnswer)
    return
  }
  if (!form.subjectId) {
    fail(t.admin.formSubject)
    return
  }

  const score = Number(form.score)
  const input: NewQuestion = {
    subjectId: form.subjectId,
    grade: form.grade,
    knowledgeId: form.knowledgeId,
    type: form.type,
    difficulty: form.difficulty,
    stem,
    options: textToOptions(),
    answer,
    solution: form.solution.trim() || null,
    score: Number.isFinite(score) && score > 0 ? score : 2
  }

  saving.value = true
  try {
    if (form.id) await questionApi.update(form.id, input)
    else await questionApi.create(input)
    visible.value = false
    toast.add({ severity: 'success', summary: t.admin.saveSuccess, life: 2500 })
    emit('saved')
  } catch (error) {
    fail(messageOf(error))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--ink-soft);
}

.field :deep(input),
.field :deep(textarea),
.field :deep(.p-select) {
  width: 100%;
}

.field-full {
  grid-column: 1 / -1;
}

.hint {
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--ink-faint);
}
</style>
