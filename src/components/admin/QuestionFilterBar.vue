<template>
  <section class="paper-card filter-bar">
    <Select
      v-model="subjectId"
      :options="subjects"
      option-label="name"
      option-value="id"
      :placeholder="t.admin.allSubjects"
      show-clear
      class="filter-select"
      @change="emit('change')"
    />
    <Select
      v-model="grade"
      :options="gradeOptions"
      option-label="label"
      option-value="value"
      :placeholder="t.admin.allGrades"
      show-clear
      class="filter-select"
      @change="emit('change')"
    />
    <Select
      v-model="questionType"
      :options="typeOptions"
      option-label="label"
      option-value="value"
      :placeholder="t.admin.allTypes"
      show-clear
      class="filter-select"
      @change="emit('change')"
    />
    <InputText
      v-model="keyword"
      :placeholder="t.admin.searchPlaceholder"
      class="filter-keyword"
      @keyup.enter="emit('change')"
    />
    <Button :label="t.common.actions.search" icon="pi pi-search" size="small" @click="emit('change')" />
    <Button :label="t.common.actions.reset" icon="pi pi-refresh" size="small" text @click="emit('reset')" />
  </section>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { t } from '@/i18n'
import { ALL_TYPES, GRADE_LABEL } from '@shared/constants'
import type { QuestionType, Subject } from '@shared/types'

defineProps<{ subjects: Subject[] }>()

const emit = defineEmits<{
  change: []
  reset: []
}>()

const subjectId = defineModel<number | null>('subjectId', { default: null })
const grade = defineModel<number | null>('grade', { default: null })
const questionType = defineModel<QuestionType | null>('questionType', { default: null })
const keyword = defineModel<string>('keyword', { default: '' })

const gradeOptions = [1, 2, 3, 4, 5, 6].map((value) => ({ label: GRADE_LABEL(value), value }))
const typeOptions = ALL_TYPES.map((value) => ({ label: t.common.questionTypes[value], value }))
</script>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
}

.filter-select {
  width: 142px;
}

.filter-keyword {
  width: 220px;
}
</style>
