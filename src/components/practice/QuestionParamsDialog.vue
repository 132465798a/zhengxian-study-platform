<template>
  <Dialog
    :visible="visible"
    modal
    :header="t.practice.custom.dialogTitle"
    :style="{ width: 'min(560px, 92vw)' }"
    :dismissable-mask="false"
    :draggable="false"
    @update:visible="onVisibleChange"
  >
    <div class="params-dialog">
      <p class="dialog-sub">{{ subjectName }} · {{ t.common.gradeText(grade) }}</p>

      <template v-if="availableTypes.length > 0">
        <label class="field">
          <span class="field-label">{{ t.practice.custom.chooseType }}</span>
          <Select
            :model-value="draftType"
            :options="typeOptions"
            option-label="label"
            option-value="value"
            @update:model-value="chooseType"
          />
        </label>

        <div class="params-grid">
          <div
            v-for="field in fields"
            :key="field.key"
            class="param-field"
            :class="{ 'param-toggle': field.type === 'toggle' }"
          >
            <span class="field-label">{{ field.label }}</span>
            <Select
              v-if="field.type === 'select'"
              :model-value="draftParams[field.key]"
              :options="field.options ?? []"
              option-label="label"
              option-value="value"
              @update:model-value="setParam(field.key, $event)"
            />
            <InputNumber
              v-else-if="field.type === 'number'"
              :model-value="numberValue(field.key)"
              :min="field.min"
              :max="field.max"
              :step="field.step"
              @update:model-value="setNumber(field.key, $event)"
            />
            <ToggleSwitch
              v-else
              :model-value="Boolean(draftParams[field.key])"
              @update:model-value="setParam(field.key, $event)"
            />
          </div>
        </div>
      </template>

      <p v-else class="empty-hint">{{ t.practice.custom.emptySubject }}</p>
    </div>

    <template #footer>
      <Button
        :label="t.practice.custom.restoreDefaults"
        text
        :disabled="!draftType"
        @click="restoreDefaults"
      />
      <span class="footer-spacer" />
      <Button :label="t.common.actions.cancel" text @click="close" />
      <Button :label="t.practice.custom.apply" :disabled="!draftType" @click="apply" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { t } from '@/i18n'
import { QUESTION_PARAMS, defaultParams } from '@shared/question-params'
import type { ParamField, ParamValue } from '@shared/question-params'
import type { CustomPracticeConfig, QuestionType } from '@shared/types'

const props = defineProps<{
  visible: boolean
  subjectName: string
  grade: number
  modelValue: CustomPracticeConfig | null
  allowedTypes: QuestionType[]
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  apply: [config: CustomPracticeConfig]
}>()

const draftType = ref<QuestionType | null>(null)
const draftParams = ref<Record<string, ParamValue>>({})

const availableTypes = computed<QuestionType[]>(() =>
  props.allowedTypes.filter((type) => Array.isArray(QUESTION_PARAMS[type]))
)
const typeOptions = computed(() =>
  availableTypes.value.map((type) => ({
    label: t.common.questionTypes[type],
    value: type
  }))
)
const fields = computed<ParamField[]>(() =>
  draftType.value ? (QUESTION_PARAMS[draftType.value] ?? []) : []
)

function isParamValue(value: unknown): value is ParamValue {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function normalizeParams(
  type: QuestionType,
  source: Record<string, ParamValue>
): Record<string, ParamValue> {
  const next = defaultParams(type)
  for (const field of QUESTION_PARAMS[type] ?? []) {
    const value = source[field.key]
    if (isParamValue(value)) next[field.key] = value
  }
  return next
}

function initDraft(): void {
  const current = props.modelValue
  if (current && availableTypes.value.includes(current.type)) {
    draftType.value = current.type
    draftParams.value = normalizeParams(current.type, current.params)
    return
  }
  if (availableTypes.value.length > 0) {
    draftType.value = availableTypes.value[0]
    draftParams.value = defaultParams(availableTypes.value[0])
    return
  }
  draftType.value = null
  draftParams.value = {}
}

function chooseType(type: QuestionType): void {
  draftType.value = type
  draftParams.value = defaultParams(type)
}

function setParam(key: string, value: ParamValue | null | undefined): void {
  if (isParamValue(value)) draftParams.value[key] = value
}

function setNumber(key: string, value: number | null | undefined): void {
  if (typeof value === 'number') draftParams.value[key] = value
}

function numberValue(key: string): number | null {
  const value = draftParams.value[key]
  return typeof value === 'number' ? value : null
}

function restoreDefaults(): void {
  if (!draftType.value) return
  draftParams.value = defaultParams(draftType.value)
}

function apply(): void {
  if (!draftType.value) return
  emit('apply', { type: draftType.value, params: { ...draftParams.value } })
  emit('update:visible', false)
}

function close(): void {
  emit('update:visible', false)
}

function onVisibleChange(value: boolean): void {
  emit('update:visible', value)
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) initDraft()
  }
)
</script>

<style scoped>
.params-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-size: 13px;
}

.dialog-sub {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--ink-faint);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 12.5px;
  color: var(--ink-soft);
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.param-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.param-toggle {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: var(--radius);
  background: var(--bg-sunken);
}

.empty-hint {
  margin: 0;
  font-size: 12.5px;
  color: var(--ink-faint);
}

.footer-spacer {
  flex: 1;
}
</style>
