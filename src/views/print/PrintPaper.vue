<template>
  <article
    class="paper"
    :class="{ 'has-seal': options.sealLine }"
    :style="{ fontSize: `${(10.5 * options.fontScale).toFixed(2)}pt` }"
  >
    <div v-if="options.sealLine" class="seal-line" aria-hidden="true">密封线内不要答题</div>
    <header
      v-if="showStudent || document.practice"
      class="paper-head"
      :class="{ 'is-info-left': options.header.infoLine && options.header.infoLayout === 'left' }"
    >
      <div
        v-if="options.header.infoLine && options.header.infoLayout === 'left'"
        class="paper-info is-side"
      >
        <span v-for="item in infoItems" :key="item">{{ item }}</span>
      </div>
      <div class="paper-head-main">
        <div v-if="options.header.school" class="paper-school">{{ options.header.school }}</div>
        <div v-if="options.header.infoLine && options.header.infoLayout !== 'left'" class="paper-info">
          <span v-for="item in infoItems" :key="item">{{ item }}</span>
        </div>
        <h1 class="paper-title">{{ document.title }}</h1>
        <p class="paper-meta">{{ metaLine }}</p>
      </div>
    </header>

    <table v-if="options.showScoreTable && document.sections.length > 0" class="score-table">
      <thead>
        <tr>
          <th class="score-label">题号</th>
          <th v-for="(section, index) in document.sections" :key="index">
            {{ section.label ?? '' }}
          </th>
          <th v-if="document.handwritingScore">卷面</th>
          <th>总分</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="score-label">得分</td>
          <td v-for="(section, index) in document.sections" :key="index" />
          <td v-if="document.handwritingScore" />
          <td />
        </tr>
        <tr v-if="options.scoreTableReviewer">
          <td class="score-label">阅卷人</td>
          <td v-for="(section, index) in document.sections" :key="index" />
          <td v-if="document.handwritingScore" />
          <td />
        </tr>
      </tbody>
    </table>

    <p v-if="options.header.notice.trim()" class="paper-notice">{{ options.header.notice }}</p>

    <template v-if="showStudent">
      <div
        class="paper-body"
        :class="{ 'is-columns': options.columns === 2 && (!document.practice || practiceFitsColumns) }"
      >
        <section
          v-for="(section, sectionIndex) in document.sections"
          :key="sectionIndex"
          class="print-section"
        >
          <div class="section-head" :class="{ 'has-score-box': options.sectionScoreBox }">
            <table v-if="options.sectionScoreBox" class="section-score-box">
              <tbody>
                <tr><td>得分</td><td /></tr>
                <tr v-if="options.scoreTableReviewer"><td>阅卷人</td><td /></tr>
              </tbody>
            </table>
            <div class="section-head-text">
              <h2 class="section-title">{{ section.title }}</h2>
              <p v-if="section.instruction" class="section-instruction">{{ section.instruction }}</p>
            </div>
          </div>

          <div
            v-if="isVertical(section)"
            class="vertical-grid"
            :style="{ '--vertical-cols': String(verticalColumnCount) }"
          >
            <div
              v-for="question in section.questions"
              :key="question.no"
              class="vertical-cell"
            >
              <span class="vertical-no">{{ question.no }}</span>
              <VerticalCalc
                v-if="question.kind === 'vertical'"
                :operands="question.operands"
                :operators="question.operators"
                :division="question.division"
                :scratch="options.scratch === 'below'"
              />
            </div>
          </div>

          <div
            v-if="isOral(section)"
            class="oral-grid"
            :style="{ '--oral-cols': String(oralColumnCount) }"
          >
            <div v-for="question in section.questions" :key="question.no" class="oral-cell">
              <LatexText :text="oralExpression(question)" /> =
              <span class="calc-line" />
            </div>
          </div>

          <div
            v-if="isPinyinWord(section)"
            class="pinyin-word-grid"
          >
            <QuestionPrint
              v-for="question in section.questions"
              :key="question.no"
              :question="question"
              :options="options"
              flat
            />
          </div>

          <QuestionPrint
            v-for="question in isVertical(section) || isOral(section) || isPinyinWord(section) ? [] : section.questions"
            :key="question.no"
            :question="question"
            :options="options"
          />
        </section>

        <PracticeSheetView
          v-if="document.practice"
          :sheet="document.practice"
          :font-scale="options.fontScale"
        />

        <div v-if="options.graphPaper !== 'none'" class="graph-block">
          <h2 class="section-title">作图区</h2>
          <div
            class="graph-area"
            :class="`is-${options.graphPaper}`"
            :style="{ height: `${options.graphPaperHeight}mm` }"
          />
        </div>

        <div v-if="document.bonusScore" class="bonus-block">
          <h2 class="section-title">附加题（{{ document.bonusScore }} 分）</h2>
          <div class="answer-lines">
            <div v-for="index in 6" :key="index" class="p-answer-line" />
          </div>
        </div>

        <div v-if="options.printRuler" class="print-ruler">
          <svg class="ruler-svg" width="50mm" height="4mm" viewBox="0 0 50 4" aria-hidden="true">
            <line x1="0" y1="0.2" x2="50" y2="0.2" stroke="#5a6674" stroke-width="0.2" />
            <line
              v-for="n in 11"
              :key="n"
              :x1="(n - 1) * 5"
              y1="0.2"
              :x2="(n - 1) * 5"
              :y2="n % 2 === 1 ? 2.6 : 1.6"
              stroke="#5a6674"
              stroke-width="0.2"
            />
          </svg>
          <p class="ruler-text">打印请选 100%（实际大小），此尺为 50mm</p>
        </div>
      </div>
    </template>

    <section v-if="showAnswer" class="answer-page">
      <h2 class="answer-title">参考答案</h2>
      <div class="answer-grid" :class="{ 'is-wide': answerColumns === 2 }">
        <div v-for="item in document.answers" :key="item.no" class="answer-item">
          <span class="answer-no">{{ item.no }}.</span>
          <LatexText :text="item.answer" />
          <span v-if="item.note" class="answer-note">{{ item.note }}</span>
        </div>
      </div>
      <div v-if="options.showSolution && solutions.length > 0" class="solution-list">
        <div v-for="item in solutions" :key="item.no" class="solution-item">
          <strong>{{ item.no }}.</strong>
          <LatexText :text="item.solution ?? ''" />
        </div>
      </div>
    </section>

    <AnswerSheet v-if="showSheet" :document="document" />

    <section v-if="options.scratch === 'page'" class="scratch-page">
      <h2 class="answer-title">草稿区</h2>
    </section>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PAPER_SIZES, type PrintDocument, type PrintQuestion, type PrintSection } from '@shared/print'
import LatexText from '@/components/text/LatexText.vue'
import QuestionPrint from './QuestionPrint.vue'
import AnswerSheet from './AnswerSheet.vue'
import PracticeSheetView from './PracticeSheetView.vue'
import VerticalCalc from './parts/VerticalCalc.vue'

const props = defineProps<{ document: PrintDocument }>()

const options = computed(() => props.document.options)
const showStudent = computed(() => options.value.parts.includes('student'))
const showAnswer = computed(() => options.value.parts.includes('answer'))
const showSheet = computed(() => options.value.parts.includes('answerSheet'))

const solutions = computed(() => props.document.answers.filter((item) => item.solution))
const metaLine = computed(() => {
  const { subtitle, meta } = props.document
  const parts: string[] = []
  if (subtitle) parts.push(subtitle)
  if (meta.duration) parts.push(`时间：${meta.duration} 分钟`)
  if (meta.totalScore) {
    parts.push(
      props.document.bonusScore
        ? `满分：${meta.totalScore} + ${props.document.bonusScore} 分`
        : `满分：${meta.totalScore} 分`
    )
  }
  if (meta.questionCount) parts.push(`共 ${meta.questionCount} 题`)
  return parts.join(' · ')
})
const isCopybook = computed<boolean>(
  () => options.value.template === 'copybook' || props.document.practice !== null
)
const infoItems = computed<string[]>(() => {
  const items = ['姓名：____________', '班级：____________']
  if (!isCopybook.value) items.push('学号：____________')
  items.push(isCopybook.value ? '日期：____________' : '得分：____________')
  return items
})
const answerColumns = computed<number>(() =>
  props.document.answers.some((item) => item.answer.length > 12) ? 2 : 4
)

/** 双栏时口算网格减半，避免算式被压得太窄 */
const oralColumnCount = computed<number>(() => {
  const columns = options.value.oralColumns
  return options.value.columns === 2 ? Math.max(2, Math.ceil(columns / 2)) : columns
})

/** 双栏时竖式最多两列 */
const verticalColumnCount = computed<number>(() => {
  const columns = options.value.verticalColumns
  return options.value.columns === 2 ? Math.min(columns, 2) : columns
})

/** 字帖一行放得进半栏时才启用双栏，避免格子跨栏遮挡 */
const practiceFitsColumns = computed<boolean>(() => {
  const sheet = props.document.practice
  if (!sheet) return false
  const cells = sheet.rows[0]?.cells.length ?? 0
  if (cells === 0) return false
  const perChar = sheet.cellsPerChar ?? 4
  const groups = Math.ceil(cells / perChar)
  const rowWidth = cells * sheet.cellMm + (cells - 1) * 1.5 + (groups - 1) * 5
  const size = PAPER_SIZES[options.value.size] ?? PAPER_SIZES.A4
  const pageWidth = options.value.orientation === 'landscape' ? size.height : size.width
  const columnWidth = (pageWidth - 28 - 10) / 2
  return rowWidth <= columnWidth
})

function isVertical(section: PrintSection): boolean {
  return section.questions.length > 0 && section.questions.every((item) => item.kind === 'vertical')
}

function isOral(section: PrintSection): boolean {
  return (
    section.questions.length > 0 &&
    section.questions.every((item) => item.kind === 'calc' && item.mode === 'oral')
  )
}

function isPinyinWord(section: PrintSection): boolean {
  return (
    section.questions.length > 0 &&
    section.questions.every((item) => item.kind === 'pinyin-word')
  )
}

function oralExpression(question: PrintQuestion): string {
  return question.kind === 'calc' ? question.expression : ''
}
</script>

<style scoped>
.answer-grid.is-wide {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.scratch-page {
  min-height: 180mm;
  background-image: radial-gradient(#c8d0da 0.35mm, transparent 0.35mm);
  background-size: 6mm 6mm;
  background-position: 2mm 2mm;
}
</style>
