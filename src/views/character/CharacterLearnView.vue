<template>
  <div class="page character-page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">CHARACTER LAB</p>
        <h1 class="page-title">{{ t.character.title }}</h1>
        <p class="page-desc">{{ t.character.desc }}</p>
      </div>
      <div class="head-actions">
        <Select
          :model-value="provider"
          :options="voiceOptions"
          option-label="label"
          option-value="value"
          size="small"
          @update:model-value="onProviderChange"
        />
        <Select
          v-model="grade"
          :options="gradeOptions"
          option-label="label"
          option-value="value"
          size="small"
          @change="loadList"
        />
      </div>
    </header>

    <div class="learn-grid">
      <section class="paper-card list-panel">
        <div class="spread list-head">
          <h2 class="section-title">{{ t.character.grade }}</h2>
          <span class="muted small">{{ t.character.total(characters.length) }}</span>
        </div>

        <div v-if="loadingList" class="empty-state compact">
          <i class="pi pi-spin pi-spinner" />
        </div>
        <div v-else-if="characters.length === 0" class="empty-state compact">
          <i class="pi pi-book" />
          <div class="title">{{ t.character.empty }}</div>
        </div>
        <div v-else class="char-grid">
          <button
            v-for="item in characters"
            :key="item.char"
            type="button"
            class="char-cell"
            :class="{ active: item.char === selected }"
            @click="selectChar(item.char)"
          >
            {{ item.char }}
          </button>
        </div>
      </section>

      <section ref="detailPanel" class="paper-card detail-panel">
        <div v-if="loadingDetail" class="empty-state">
          <i class="pi pi-spin pi-spinner" />
          <div class="title">{{ t.common.status.loading }}</div>
        </div>

        <template v-else-if="detail">
          <div class="detail-head">
            <div class="hero">
              <div class="big-char">{{ detail.char }}</div>
              <button type="button" class="speak-btn" @click="speak(detail.char)">
                <i class="pi pi-volume-up" />
                <span>{{ t.character.speak }}</span>
              </button>
            </div>

            <div class="head-main">
              <div class="pinyin">{{ detail.pinyin }}</div>
              <div v-if="detail.isPolyphonic" class="poly-line">
                <span class="poly-label">{{ t.character.polyphonic }}</span>
                <button
                  v-for="item in detail.polyphonic"
                  :key="item"
                  type="button"
                  class="poly-chip"
                  @click="speak(item)"
                >
                  {{ item }}
                </button>
              </div>
              <div class="info-row">
                <span class="info-chip">
                  {{ t.character.radical }} · {{ detail.radical ?? '—' }}
                </span>
                <span class="info-chip">
                  {{ t.character.radicalCount }} · {{ detail.radicalCount ?? '—' }}
                </span>
                <span class="info-chip">
                  {{ t.character.strokeCount }} · {{ t.character.strokeUnit(detail.strokeCount) }}
                </span>
                <span class="info-chip">
                  {{ t.character.structure }} · {{ detail.structure ?? '—' }}
                </span>
              </div>
            </div>

            <div class="stroke-player">
              <div class="stroke-player-head">{{ t.character.animation }}</div>
              <div ref="strokeCanvas" class="stroke-canvas" />
              <div v-if="animationError" class="animation-missing">
                {{ t.character.animationMissing }}
              </div>
              <div class="stroke-actions">
                <Button
                  icon="pi pi-play"
                  size="small"
                  text
                  :label="t.character.play"
                  :disabled="!animationReady || animationError"
                  @click="playAnimation"
                />
                <Button
                  :icon="paused ? 'pi pi-play' : 'pi pi-pause'"
                  size="small"
                  text
                  :label="paused ? t.character.resume : t.character.pause"
                  :disabled="!playing"
                  @click="togglePause"
                />
                <Button
                  icon="pi pi-step-forward"
                  size="small"
                  text
                  :label="t.character.stepStroke"
                  :disabled="!animationReady || animationError"
                  @click="stepStroke"
                />
              </div>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-label">{{ t.character.strokeOrder }}</div>
            <div class="stroke-list">
              <div v-for="(stroke, index) in detail.strokes" :key="index" class="stroke-item">
                <span class="stroke-index">{{ index + 1 }}</span>
                <span class="stroke-glyph">{{ stroke.glyph || stroke.name }}</span>
                <span class="stroke-name">{{ stroke.name }}</span>
                <span v-if="stroke.type" class="stroke-type">
                  {{ stroke.type }}<template v-if="stroke.foldCount"> · {{ stroke.foldCount }} 折</template>
                </span>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-label">{{ t.character.words }}</div>
            <div v-if="detail.words.length > 0" class="word-list">
              <button
                v-for="word in detail.words"
                :key="word"
                type="button"
                class="word-chip"
                :class="{ active: explainedWord === word }"
                @click="showExplanation(word)"
              >
                {{ word }}
              </button>
            </div>
            <p v-else class="muted">{{ t.character.noWords }}</p>
          </div>

          <div v-if="detail.idioms.length > 0" class="detail-section">
            <div class="detail-label">{{ t.character.idioms }}</div>
            <div class="word-list">
              <button
                v-for="item in detail.idioms"
                :key="item"
                type="button"
                class="word-chip"
                :class="{ active: explainedWord === item }"
                @click="showExplanation(item)"
              >
                {{ item }}
              </button>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-label">{{ t.character.meaning }}</div>
            <p v-if="!explainedWord" class="muted small">{{ t.character.meaningHint }}</p>
            <div v-else-if="explaining" class="meaning-body muted">
              <i class="pi pi-spin pi-spinner" />
              <span>{{ t.character.explaining }}</span>
            </div>
            <div v-else class="meaning-body">
              <strong class="meaning-word">{{ explainedWord }}</strong>
              <p class="meaning-text">{{ explanation ?? t.character.noExplanation }}</p>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-label">{{ t.character.pinyinDetail }}</div>
            <div class="meta-grid">
              <div class="meta-item">
                <span>{{ t.character.initial }}</span>
                <strong>{{ detail.initial || '—' }}</strong>
              </div>
              <div class="meta-item">
                <span>{{ t.character.final }}</span>
                <strong>{{ detail.final || '—' }}</strong>
              </div>
              <div class="meta-item">
                <span>{{ t.character.tone }}</span>
                <strong>{{ t.character.toneValue(detail.tone) }}</strong>
              </div>
              <div class="meta-item">
                <span>{{ t.character.traditional }}</span>
                <strong>{{ detail.traditional ?? '—' }}</strong>
              </div>
              <div class="meta-item">
                <span>{{ t.character.fiveElement }}</span>
                <strong>{{ detail.fiveElement ?? '—' }}</strong>
              </div>
              <div class="meta-item">
                <span>{{ t.character.method }}</span>
                <strong>{{ detail.method ?? '—' }}</strong>
              </div>
              <div class="meta-item">
                <span>{{ t.character.markSpell }}</span>
                <strong>{{ detail.markSpell ?? '—' }}</strong>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-label">{{ t.character.codes }}</div>
            <div class="meta-grid">
              <div class="meta-item">
                <span>{{ t.character.codeUnicode }}</span>
                <strong>{{ detail.codes.unicode || '—' }}</strong>
              </div>
              <div class="meta-item">
                <span>{{ t.character.codeGbk }}</span>
                <strong>{{ detail.codes.gbk || '—' }}</strong>
              </div>
              <div class="meta-item">
                <span>{{ t.character.codeSijiao }}</span>
                <strong>{{ detail.codes.sijiao || '—' }}</strong>
              </div>
              <div class="meta-item">
                <span>{{ t.character.codeCangjie }}</span>
                <strong>{{ detail.codes.cangjie || '—' }}</strong>
              </div>
              <div class="meta-item">
                <span>{{ t.character.codeFiveStroke }}</span>
                <strong>{{ detail.codes.fiveStroke || '—' }}</strong>
              </div>
              <div class="meta-item">
                <span>{{ t.character.codeUniform }}</span>
                <strong>{{ detail.codes.uniform || '—' }}</strong>
              </div>
            </div>
          </div>

          <div class="nav-row">
            <Button
              :label="t.character.previous"
              icon="pi pi-arrow-left"
              size="small"
              text
              :disabled="currentIndex <= 0"
              @click="step(-1)"
            />
            <Button
              :label="t.character.next"
              icon="pi pi-arrow-right"
              icon-pos="right"
              size="small"
              text
              :disabled="currentIndex < 0 || currentIndex >= characters.length - 1"
              @click="step(1)"
            />
          </div>
        </template>

        <div v-else class="empty-state">
          <i class="pi pi-sparkles" />
          <div class="title">{{ t.character.pick }}</div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import Select from 'primevue/select'
import Button from 'primevue/button'
import HanziWriter from 'hanzi-writer'
import { characterApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { useSpeech, type SpeechProvider } from '@/speech/useSpeech'
import { t } from '@/i18n'
import { GRADE_LABEL } from '@shared/constants'
import type { CharacterDetail, CharacterSummary } from '@shared/types'

const auth = useAuthStore()
const { provider, setProvider, speak, stop } = useSpeech()
const grade = ref(auth.currentUser?.grade ?? 1)
const characters = ref<CharacterSummary[]>([])
const selected = ref('')
const detail = ref<CharacterDetail | null>(null)
const loadingList = ref(false)
const loadingDetail = ref(false)

const strokeCanvas = ref<HTMLDivElement | null>(null)
const detailPanel = ref<HTMLElement | null>(null)
const animationReady = ref(false)
const animationError = ref(false)
const playing = ref(false)
const paused = ref(false)
const stepIndex = ref(0)
let writer: HanziWriter | null = null

const explainedWord = ref('')
const explanation = ref<string | null>(null)
const explaining = ref(false)

const gradeOptions = [1, 2, 3, 4, 5, 6].map((value) => ({
  label: GRADE_LABEL(value),
  value
}))

const voiceOptions = [
  { label: t.common.speech.system, value: 'system' },
  { label: t.common.speech.edge, value: 'edge' }
]

function onProviderChange(value: SpeechProvider): void {
  setProvider(value)
}

const currentIndex = computed(() => characters.value.findIndex((item) => item.char === selected.value))

function mountWriter(char: string): void {
  if (!strokeCanvas.value) return
  void writer?.pauseAnimation()
  strokeCanvas.value.innerHTML = ''
  animationReady.value = false
  animationError.value = false
  playing.value = false
  paused.value = false
  stepIndex.value = 0

  writer = HanziWriter.create(strokeCanvas.value, char, {
    width: 170,
    height: 170,
    padding: 8,
    showOutline: true,
    showCharacter: false,
    strokeColor: getComputedStyle(document.body).color || '#18181b',
    outlineColor: 'rgba(128, 128, 128, 0.35)',
    radicalColor: null,
    strokeAnimationSpeed: 1,
    delayBetweenStrokes: 260,
    charDataLoader: (target, onLoad, onError) => {
      characterApi
        .strokeData(target)
        .then((result) => {
          animationReady.value = true
          onLoad(JSON.parse(result.data))
        })
        .catch((error: unknown) => {
          animationError.value = true
          onError(error)
        })
    }
  })
}

async function selectChar(char: string): Promise<void> {
  stop()
  selected.value = char
  explainedWord.value = ''
  explanation.value = null
  explaining.value = false
  loadingDetail.value = true
  try {
    detail.value = await characterApi.detail(char)
  } catch {
    detail.value = null
  } finally {
    loadingDetail.value = false
  }
  await nextTick()
  if (detail.value) {
    if (detailPanel.value) detailPanel.value.scrollTop = 0
    mountWriter(detail.value.char)
  }
}

async function loadList(): Promise<void> {
  loadingList.value = true
  try {
    characters.value = await characterApi.list(grade.value)
    const first = characters.value[0]?.char
    if (first) await selectChar(first)
    else {
      selected.value = ''
      detail.value = null
    }
  } catch {
    characters.value = []
    detail.value = null
    selected.value = ''
  } finally {
    loadingList.value = false
  }
}

function step(offset: number): void {
  const next = characters.value[currentIndex.value + offset]
  if (next) void selectChar(next.char)
}

function playAnimation(): void {
  if (!writer) return
  playing.value = true
  paused.value = false
  stepIndex.value = 0
  void writer.animateCharacter({
    onComplete: () => {
      playing.value = false
      paused.value = false
    }
  })
}

function togglePause(): void {
  if (!writer || !playing.value) return
  if (paused.value) {
    void writer.resumeAnimation()
    paused.value = false
  } else {
    void writer.pauseAnimation()
    paused.value = true
  }
}

async function stepStroke(): Promise<void> {
  if (!writer || !detail.value || animationError.value) return
  if (stepIndex.value >= detail.value.strokeCount) {
    await writer.hideCharacter({ duration: 0 })
    stepIndex.value = 0
    return
  }
  if (stepIndex.value === 0) await writer.hideCharacter({ duration: 0 })
  const index = stepIndex.value
  await writer.animateStroke(index)
  stepIndex.value = index + 1
}

async function showExplanation(word: string): Promise<void> {
  if (explainedWord.value === word) {
    explainedWord.value = ''
    explanation.value = null
    return
  }
  explainedWord.value = word
  explanation.value = null
  explaining.value = true
  try {
    const result = await characterApi.explain(word)
    if (explainedWord.value === word) explanation.value = result.text
  } catch {
    if (explainedWord.value === word) explanation.value = null
  } finally {
    if (explainedWord.value === word) explaining.value = false
  }
}

onMounted(loadList)
onBeforeUnmount(() => {
  stop()
  void writer?.pauseAnimation()
  writer = null
})
</script>

<style scoped>
.character-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.learn-grid {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 16px;
  flex: 1;
  min-height: 0;
  align-items: stretch;
}

.list-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 14px 14px 16px;
  overflow: hidden;
}

.list-head {
  margin-bottom: 10px;
}

.char-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  flex: 1;
  min-height: 0;
  align-content: start;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 4px;
}

.char-cell {
  aspect-ratio: 1;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--bg-sunken);
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 20px;
  cursor: pointer;
  transition:
    background 0.12s ease,
    border-color 0.12s ease,
    color 0.12s ease;
}

.char-cell:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.char-cell.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-contrast);
}

.detail-panel {
  padding: 26px 28px;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.detail-head {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr) 210px;
  gap: 24px;
  align-items: center;
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.big-char {
  width: 132px;
  height: 132px;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: var(--bg-sunken);
  font-family: var(--font-display);
  font-size: 84px;
  line-height: 1;
}

.speak-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--ink-soft);
  font-size: 12px;
  cursor: pointer;
}

.speak-btn:hover {
  background: var(--accent-soft);
  color: var(--accent);
}

.head-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pinyin {
  font-family: var(--font-display);
  font-size: 26px;
  letter-spacing: 0.04em;
  color: var(--accent);
}

.poly-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.poly-label {
  font-size: 11.5px;
  letter-spacing: 0.08em;
  color: var(--ink-faint);
}

.poly-chip {
  padding: 2px 8px;
  border: none;
  border-radius: 999px;
  background: var(--bg-sunken);
  color: var(--ink-soft);
  font-size: 12.5px;
  cursor: pointer;
}

.poly-chip:hover {
  color: var(--accent);
}

.info-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.info-chip {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--ink-soft);
  font-size: 12.5px;
}

.stroke-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.stroke-player-head {
  font-size: 11.5px;
  letter-spacing: 0.1em;
  color: var(--ink-faint);
}

.stroke-canvas {
  width: 170px;
  height: 170px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--bg-sunken);
}

.animation-missing {
  font-size: 11.5px;
  color: var(--ink-faint);
}

.stroke-actions {
  display: flex;
  gap: 2px;
}

.stroke-actions :deep(.p-button) {
  padding: 2px 5px;
  font-size: 11.5px;
}

.detail-section {
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px dashed var(--line);
}

.detail-label {
  font-size: 11.5px;
  letter-spacing: 0.1em;
  color: var(--ink-faint);
  margin-bottom: 12px;
}

.stroke-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.stroke-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 52px;
  padding: 8px 6px 6px;
  border-radius: var(--radius-sm);
  background: var(--bg-sunken);
}

.stroke-index {
  font-family: var(--font-num);
  font-size: 10.5px;
  color: var(--ink-faint);
}

.stroke-glyph {
  font-size: 30px;
  line-height: 1.1;
  color: var(--ink);
}

.stroke-name {
  font-size: 10.5px;
  color: var(--ink-faint);
}

.stroke-type {
  font-size: 9.5px;
  color: var(--ink-faint);
}

.word-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.word-chip {
  padding: 5px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--bg-raised);
  color: var(--ink-soft);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
}

.word-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.word-chip.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}

.meaning-body {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--bg-sunken);
  font-size: 13px;
  line-height: 1.65;
}

.meaning-word {
  flex: none;
  color: var(--accent);
}

.meaning-text {
  margin: 0;
  white-space: pre-wrap;
  color: var(--ink-soft);
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
}

.meta-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-sunken);
  font-size: 12.5px;
}

.meta-item span {
  color: var(--ink-faint);
}

.meta-item strong {
  font-weight: 500;
  color: var(--ink);
}

.nav-row {
  display: flex;
  justify-content: space-between;
  margin-top: 24px;
  padding-top: 14px;
  border-top: 1px dashed var(--line);
}

@media (max-width: 1200px) {
  .detail-head {
    grid-template-columns: 132px minmax(0, 1fr);
  }

  .stroke-player {
    grid-column: 1 / -1;
  }
}

@media (max-width: 1080px) {
  .character-page {
    height: auto;
  }

  .learn-grid {
    grid-template-columns: 1fr;
    flex: none;
  }

  .list-panel {
    overflow: visible;
  }

  .char-grid {
    grid-template-columns: repeat(8, 1fr);
    max-height: 240px;
  }

  .detail-panel {
    overflow: visible;
  }
}
</style>
