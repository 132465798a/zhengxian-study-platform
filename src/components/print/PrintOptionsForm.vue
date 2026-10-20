<template>
  <div class="print-options">
    <section class="form-block">
      <h4>纸张与版式</h4>
      <div class="form-grid">
        <label class="field">
          <span>卷型预设</span>
          <Select
            v-model="options.paperKind"
            :options="PAPER_KIND_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
        <label class="field">
          <span>版式预设</span>
          <Select
            v-model="layoutPreset"
            :options="LAYOUT_PRESETS"
            option-label="label"
            option-value="value"
            size="small"
            placeholder="自定义"
          />
        </label>
        <label class="field">
          <span>纸张</span>
          <Select v-model="options.size" :options="SIZE_OPTIONS" option-label="label" option-value="value" size="small" />
        </label>
        <label class="field">
          <span>方向</span>
          <Select
            v-model="options.orientation"
            :options="ORIENTATION_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
        <label v-if="canColumns" class="field">
          <span>栏数</span>
          <Select
            v-model.number="options.columns"
            :options="COLUMN_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
        <label v-if="!practice" class="field">
          <span>模板</span>
          <Select
            v-model="options.template"
            :options="TEMPLATE_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
        <label class="field">
          <span>字号</span>
          <Select
            v-model.number="options.fontScale"
            :options="FONT_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
        <label v-if="sourceKind === 'hanzi'" class="field">
          <span>字格</span>
          <Select
            v-model="hanziGrid"
            :options="GRID_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
        <label v-if="sourceKind === 'english'" class="field">
          <span>内容</span>
          <Select
            v-model="englishMode"
            :options="ENGLISH_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
      </div>
    </section>

    <section v-if="!practice" class="form-block">
      <h4>打印内容</h4>
      <div class="check-row">
        <label class="check"><Checkbox v-model="options.parts" value="student" />学生卷</label>
        <label class="check"><Checkbox v-model="options.parts" value="answer" />答案页</label>
        <label class="check"><Checkbox v-model="options.parts" value="answerSheet" />答题卡</label>
      </div>
      <div class="check-row">
        <label class="check"><Checkbox v-model="options.showScore" binary />显示分值</label>
        <label class="check"><Checkbox v-model="options.showDifficulty" binary />显示难度</label>
        <label class="check"><Checkbox v-model="options.showSolution" binary />答案附解析</label>
        <label class="check"><Checkbox v-model="options.pageNumber" binary />页脚页码</label>
        <label class="check"><Checkbox v-model="options.showScoreTable" binary />得分统计表</label>
        <label v-if="options.showScoreTable" class="check">
          <Checkbox v-model="options.scoreTableReviewer" binary />阅卷人行
        </label>
        <label class="check"><Checkbox v-model="options.sectionScoreBox" binary />大题得分框</label>
        <label class="check"><Checkbox v-model="options.sealLine" binary />左侧密封线</label>
        <label class="check"><Checkbox v-model="options.answerStandard" binary />答案附评分标准</label>
        <label class="check"><Checkbox v-model="options.printRuler" binary />打印校准尺</label>
      </div>
      <div class="form-grid">
        <label class="field">
          <span>分值方案</span>
          <Select
            v-model="options.scoreScheme"
            :options="SCORE_SCHEME_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
        <label class="field">
          <span>大题命名</span>
          <Select
            v-model="options.sectionNaming"
            :options="SECTION_NAMING_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
        <label class="field">
          <span>卷面书写分（语文）</span>
          <Select
            v-model.number="options.handwritingScore"
            :options="HANDWRITING_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
        <label class="field">
          <span>附加题</span>
          <Select
            v-model.number="options.bonusScore"
            :options="BONUS_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
      </div>
    </section>

    <section v-if="!practice" class="form-block">
      <h4>答题区</h4>
      <div class="form-grid">
        <label class="field">
          <span>留白</span>
          <Select v-model="options.answerLines" :options="LINE_OPTIONS" option-label="label" option-value="value" size="small" />
        </label>
        <label class="field">
          <span>竖式草稿</span>
          <Select v-model="options.scratch" :options="SCRATCH_OPTIONS" option-label="label" option-value="value" size="small" />
        </label>
        <label class="field">
          <span>判断题</span>
          <Select v-model="options.judgeStyle" :options="JUDGE_OPTIONS" option-label="label" option-value="value" size="small" />
        </label>
        <label class="field">
          <span>选项排列</span>
          <Select
            v-model="options.choiceColumns"
            :options="CHOICE_COLUMN_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
        <label class="field">
          <span>填空宽度</span>
          <Select
            v-model.number="options.blankScale"
            :options="BLANK_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
        <label class="field">
          <span>口算每行</span>
          <Select
            v-model.number="options.oralColumns"
            :options="ORAL_COLUMN_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
        <label class="field">
          <span>竖式每行</span>
          <Select
            v-model.number="options.verticalColumns"
            :options="VERTICAL_COLUMN_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
        <label class="field">
          <span>卷末作图区</span>
          <Select
            v-model="options.graphPaper"
            :options="GRAPH_PAPER_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
        <label v-if="options.graphPaper !== 'none'" class="field">
          <span>作图区高度</span>
          <Select
            v-model.number="options.graphPaperHeight"
            :options="GRAPH_HEIGHT_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
        <label class="field">
          <span>作文格每行</span>
          <Select
            v-model.number="options.essayColumns"
            :options="ESSAY_COLUMN_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
        <label class="field">
          <span>作文格边长</span>
          <Select
            v-model.number="options.essayCellMm"
            :options="ESSAY_CELL_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
      </div>
      <div class="check-row">
        <label class="check"><Checkbox v-model="options.essayMark" binary />作文格每 100 字刻度</label>
      </div>
    </section>

    <section class="form-block">
      <h4>卷头</h4>
      <div class="form-grid">
        <label class="field">
          <span>学校</span>
          <InputText v-model="options.header.school" size="small" placeholder="可不填" />
        </label>
        <label v-if="showTitle" class="field">
          <span>标题</span>
          <InputText v-model="options.header.title" size="small" :placeholder="titlePlaceholder" />
        </label>
        <label class="field">
          <span>时间（分钟）</span>
          <InputNumber v-model="options.header.duration" size="small" :min="0" :max="300" placeholder="可不填" />
        </label>
        <label class="field">
          <span>满分</span>
          <InputNumber v-model="options.header.totalScore" size="small" :min="0" :max="300" placeholder="自动计算" />
        </label>
        <label class="field wide">
          <span>卷首说明 / 注意事项</span>
          <Textarea
            v-model="options.header.notice"
            size="small"
            rows="2"
            auto-resize
            placeholder="如：本试卷共 4 页，满分 100 分，时间 90 分钟。"
          />
        </label>
      </div>
      <div class="check-row">
        <label class="check"><Checkbox v-model="options.header.infoLine" binary />姓名 / 班级 / 学号栏</label>
        <label v-if="options.header.infoLine" class="check">
          位置
          <Select
            v-model="options.header.infoLayout"
            :options="HEADER_INFO_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Checkbox from 'primevue/checkbox'
import type { PrintOptions } from '@shared/print'
import {
  BONUS_OPTIONS,
  BLANK_OPTIONS,
  CHOICE_COLUMN_OPTIONS,
  COLUMN_OPTIONS,
  ENGLISH_OPTIONS,
  ESSAY_CELL_OPTIONS,
  ESSAY_COLUMN_OPTIONS,
  FONT_OPTIONS,
  GRAPH_HEIGHT_OPTIONS,
  GRAPH_PAPER_OPTIONS,
  GRID_OPTIONS,
  HANDWRITING_OPTIONS,
  HEADER_INFO_OPTIONS,
  JUDGE_OPTIONS,
  LAYOUT_PRESETS,
  LINE_OPTIONS,
  ORAL_COLUMN_OPTIONS,
  ORIENTATION_OPTIONS,
  PAPER_KIND_OPTIONS,
  SCORE_SCHEME_OPTIONS,
  SECTION_NAMING_OPTIONS,
  SCRATCH_OPTIONS,
  SIZE_OPTIONS,
  TEMPLATE_OPTIONS,
  VERTICAL_COLUMN_OPTIONS,
  applyPaperKind
} from '@/views/print/print-option-fields'

type HanziGrid = 'tian' | 'mi' | 'huigong' | 'pinyin-tian'
type EnglishMode = 'word' | 'sentence' | 'dictation'

const props = withDefaults(
  defineProps<{
    practice?: boolean
    sourceKind?: string
    subject?: string
    grade?: number
    showTitle?: boolean
    titlePlaceholder?: string
  }>(),
  {
    practice: false,
    sourceKind: '',
    subject: '',
    grade: 1,
    showTitle: true,
    titlePlaceholder: '默认使用来源标题'
  }
)

const options = defineModel<PrintOptions>('options', { required: true })
const hanziGrid = defineModel<HanziGrid>('hanziGrid', { default: 'tian' })
const englishMode = defineModel<EnglishMode>('englishMode', { default: 'word' })

const canColumns = computed<boolean>(
  () =>
    options.value.orientation === 'landscape' ||
    options.value.size === 'A3' ||
    options.value.size === 'B4' ||
    options.value.size === '8K'
)

const layoutPreset = computed<string>({
  get: () =>
    LAYOUT_PRESETS.find(
      (preset) =>
        preset.size === options.value.size &&
        preset.orientation === options.value.orientation &&
        preset.columns === options.value.columns
    )?.value ?? '',
  set: (value) => {
    const preset = LAYOUT_PRESETS.find((item) => item.value === value)
    if (!preset) return
    options.value.size = preset.size
    options.value.orientation = preset.orientation
    options.value.columns = preset.columns
  }
})

watch(
  () => options.value.paperKind,
  (kind) => {
    if (kind === 'custom') return
    applyPaperKind(options.value, kind, { subject: props.subject, grade: props.grade })
  }
)
</script>

<style scoped>
.print-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-block {
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--bg-raised);
}

.form-block h4 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
}

.form-grid .wide {
  grid-column: 1 / -1;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--ink-soft);
}

.check-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin-top: 10px;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--ink);
}

.check :deep(.p-select) {
  min-width: 120px;
}
</style>
