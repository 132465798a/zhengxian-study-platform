<template>
  <div class="page english-page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">ENGLISH LISTENING</p>
        <h1 class="page-title">{{ t.english.title }}</h1>
        <p class="page-desc">{{ t.english.desc }}</p>
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
          :model-value="grade"
          :options="gradeOptions"
          option-label="label"
          option-value="value"
          size="small"
          @update:model-value="onGradeChange"
        />
      </div>
    </header>

    <div class="listen-grid">
      <section class="paper-card word-panel">
        <div class="spread word-head">
          <h2 class="section-title">{{ t.english.wordList }}</h2>
          <span class="muted small">{{ t.english.wordCount(words.length) }}</span>
        </div>

        <div v-if="loadingWords" class="empty-state compact">
          <i class="pi pi-spin pi-spinner" />
        </div>
        <div v-else-if="words.length === 0" class="empty-state compact">
          <i class="pi pi-volume-off" />
          <div class="title">{{ t.english.empty }}</div>
        </div>
        <div v-else class="word-list">
          <button
            v-for="item in words"
            :key="item.id"
            type="button"
            class="word-row"
            :class="{ active: current?.word.id === item.id }"
            @click="playWord(item)"
          >
            <span class="word-main">
              <strong>{{ item.word }}</strong>
              <small v-if="item.phonetic && item.phonetic !== '-'">{{ item.phonetic }}</small>
            </span>
            <span class="word-meaning">{{ item.meaning }}</span>
            <i class="pi pi-volume-up" />
          </button>
        </div>
      </section>

      <section class="paper-card quiz-panel">
        <div class="quiz-head">
          <SelectButton
            :model-value="mode"
            :options="modeOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            size="small"
            @update:model-value="onModeChange"
          />
        </div>

        <template v-if="!finished && current">
          <div class="quiz-meta">
            <span class="quiz-step num">{{ t.english.progress(index + 1, quiz.length) }}</span>
            <span class="quiz-left">{{ t.english.remaining(pool.length) }}</span>
            <span class="quiz-score">{{ t.english.score(score, quiz.length) }}</span>
          </div>

          <button type="button" class="play-btn" :class="{ playing: speaking || loading }" @click="playCurrent">
            <i v-if="loading" class="pi pi-spin pi-spinner" />
            <i v-else class="pi pi-volume-up" />
            <span>{{ loading ? t.english.synthesizing : t.english.listen }}</span>
          </button>

          <p class="engine-tag" :class="{ warn: lastError }">
            {{ engineLabel }}
          </p>
          <p v-if="voicesLoaded && provider === 'system' && !systemHasEnglish" class="engine-tag warn">
            {{ t.english.systemNoEnglish }}
          </p>

          <p class="quiz-prompt">{{ promptText }}</p>

          <div v-if="isChoiceMode" class="option-grid">
            <button
              v-for="(option, optionIndex) in current.options"
              :key="option.label"
              type="button"
              class="listen-option"
              :class="[optionClass(optionIndex), { 'is-long': mode === 'sentence' }]"
              :disabled="picked !== null"
              @click="selectOption(optionIndex)"
            >
              <span class="option-letter">{{ LETTERS[optionIndex] }}</span>
              <span class="option-label">{{ option.label }}</span>
              <i v-if="picked !== null && option.correct" class="pi pi-check" />
              <i v-else-if="picked === optionIndex" class="pi pi-times" />
            </button>
          </div>

          <div v-else-if="mode === 'dictation'" class="dictation">
            <input
              ref="dictationInput"
              v-model="dictation"
              type="text"
              class="dictation-input"
              :placeholder="t.english.dictationPlaceholder"
              :disabled="dictationChecked"
              @keydown.enter="onDictationEnter"
            />
            <Button
              v-if="!dictationChecked"
              size="small"
              :label="t.english.submit"
              @click="checkDictation"
            />
            <div v-else class="dictation-result" :class="dictationCorrect ? 'ok' : 'bad'">
              <span>{{ dictationCorrect ? t.english.correct : `${t.english.wrong} · ${t.english.answer} ${current.word.word}` }}</span>
              <Button size="small" :label="isLast ? t.english.finish : t.english.next" @click="next" />
            </div>
          </div>

          <div v-else class="speaking">
            <p class="speaking-target">{{ speakTarget }}</p>
            <div class="speaking-actions">
              <Button
                icon="pi pi-volume-up"
                size="small"
                outlined
                :label="t.english.listenOriginal"
                @click="playCurrent"
              />
              <Button
                v-if="recordState !== 'recording'"
                icon="pi pi-microphone"
                size="small"
                :disabled="starting || asrBusy || !asrChecked"
                :label="starting ? t.english.starting : recordState === 'ready' ? t.english.retryRecord : t.english.startRecord"
                @click="startRecording"
              />
              <Button
                v-else
                icon="pi pi-stop-circle"
                size="small"
                severity="danger"
                :label="t.english.stopRecord"
                @click="stopRecording"
              />
              <Button
                v-if="recordUrl"
                icon="pi pi-play"
                size="small"
                text
                :label="t.english.playRecord"
                @click="playRecording"
              />
            </div>

            <div v-if="recordState === 'recording'" class="speaking-note">{{ t.english.recordingWithTime(recordSeconds) }}</div>
            <div v-else-if="asrBusy" class="speaking-note">{{ t.english.asrAnalyzing }}</div>
            <div v-else-if="recordError" class="speaking-note bad">{{ recordError }}</div>
            <div v-else-if="transcript" class="speaking-note">
              {{ t.english.recognized(transcript) }}
            </div>
            <div v-else-if="recognitionNote" class="speaking-note">{{ recognitionNote }}</div>

            <div v-if="similarityScore !== null" class="speaking-score" :class="similarityScore >= 70 ? 'ok' : 'bad'">
              {{ t.english.similarity(similarityScore) }}
            </div>

            <Button
              v-if="recordState !== 'recording'"
              size="small"
              :disabled="asrBusy"
              :label="isLast ? t.english.finish : t.english.next"
              @click="next"
            />
          </div>

          <div v-if="mode !== 'dictation' && mode !== 'speaking' && picked !== null" class="feedback" :class="isCorrect ? 'ok' : 'bad'">
            <span class="feedback-text">
              {{ isCorrect ? t.english.correct : `${t.english.wrong} · ${t.english.answer} ${correctLabel}` }}
            </span>
            <Button size="small" :label="isLast ? t.english.finish : t.english.next" @click="next" />
          </div>

          <p class="quiz-hint">{{ t.english.hint }}</p>
        </template>

        <div v-else-if="finished && quiz.length > 0" class="quiz-done">
          <i class="pi pi-check-circle" />
          <strong>{{ t.english.roundDone(score, quiz.length) }}</strong>
          <p v-if="pool.length > 0" class="muted small">
            {{ t.english.remaining(pool.length) }}
          </p>
          <template v-else>
            <p class="muted small">{{ t.english.allDone }}</p>
          </template>
          <Button
            v-if="pool.length > 0"
            size="small"
            :label="t.english.nextRound"
            @click="startRound"
          />
          <Button v-else size="small" :label="t.english.restartAll" @click="restartAll" />
        </div>

        <div v-else-if="!loadingWords" class="empty-state compact">
          <i class="pi pi-volume-off" />
          <div class="title">{{ t.english.empty }}</div>
        </div>

        <div v-else class="empty-state compact">
          <i class="pi pi-spin pi-spinner" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { englishApi, asrApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { useSpeech, type SpeechProvider } from '@/speech/useSpeech'
import { t } from '@/i18n'
import { GRADE_LABEL } from '@shared/constants'
import type { EnglishWord } from '@shared/types'

type QuizMode = 'word' | 'meaning' | 'dictation' | 'sentence' | 'speaking'
type RecordState = 'idle' | 'recording' | 'ready'
interface QuizOption {
  label: string
  correct: boolean
}
interface RoundItem {
  word: EnglishWord
  options: QuizOption[]
}
interface SpeechRecognitionResultLike {
  0: { transcript: string }
  length: number
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

const LETTERS = ['A', 'B', 'C', 'D']
const ROUND_SIZE = 10

const auth = useAuthStore()
const { provider, speaking, loading, lastEngine, lastError, systemVoices, voicesLoaded, setProvider, speak, stop } =
  useSpeech()

const grade = ref(auth.currentUser?.grade ?? 1)
const words = ref<EnglishWord[]>([])
const loadingWords = ref(true)
const mode = ref<QuizMode>('word')
const quiz = ref<RoundItem[]>([])
const pool = ref<EnglishWord[]>([])
const index = ref(0)
const picked = ref<number | null>(null)
const score = ref(0)
const finished = ref(false)

const dictation = ref('')
const dictationChecked = ref(false)
const dictationCorrect = ref(false)
const dictationInput = ref<HTMLInputElement | null>(null)

const recordState = ref<RecordState>('idle')
const starting = ref(false)
const recordUrl = ref('')
const recordError = ref('')
const recognitionNote = ref('')
const transcript = ref('')
const similarityScore = ref<number | null>(null)
const speakingScored = ref(false)
const asrAvailable = ref(false)
const asrChecked = ref(false)
const asrBusy = ref(false)
const recordSeconds = ref(0)

let recorder: MediaRecorder | null = null
let mediaStream: MediaStream | null = null
let recognition: SpeechRecognitionLike | null = null
let recordPlayer: HTMLAudioElement | null = null
let disposed = false
let loadRequest = 0
let recordingToken = 0
let recordTimer: number | null = null

const MAX_RECORD_SECONDS = 30

const gradeOptions = [1, 2, 3, 4, 5, 6].map((value) => ({
  label: GRADE_LABEL(value),
  value
}))

const voiceOptions = [
  { label: t.common.speech.system, value: 'system' },
  { label: t.common.speech.edge, value: 'edge' }
]

const hasSentences = computed(() => words.value.some((word) => word.sentence && word.sentenceZh))
const systemHasEnglish = computed(() =>
  systemVoices.value.some((voice) => voice.lang.replace('_', '-').startsWith('en'))
)
const modeOptions = computed(() => {
  const options = [
    { label: t.english.modeWord, value: 'word' },
    { label: t.english.modeMeaning, value: 'meaning' },
    { label: t.english.modeDictation, value: 'dictation' }
  ]
  if (hasSentences.value) options.push({ label: t.english.modeSentence, value: 'sentence' })
  options.push({ label: t.english.modeSpeaking, value: 'speaking' })
  return options
})

const current = computed<RoundItem | null>(() => quiz.value[index.value] ?? null)
const isLast = computed<boolean>(() => index.value >= quiz.value.length - 1)
const isChoiceMode = computed<boolean>(
  () => mode.value === 'word' || mode.value === 'meaning' || mode.value === 'sentence'
)
const isCorrect = computed<boolean>(() => {
  if (picked.value === null || !current.value) return false
  return current.value.options[picked.value]?.correct === true
})
const correctLabel = computed<string>(() => {
  if (!current.value) return ''
  return current.value.options.find((option) => option.correct)?.label ?? ''
})

const promptText = computed<string>(() => {
  const map: Record<QuizMode, string> = {
    word: t.english.promptWord,
    meaning: t.english.promptMeaning,
    dictation: t.english.promptDictation,
    sentence: t.english.promptSentence,
    speaking: t.english.promptSpeaking
  }
  return map[mode.value]
})

const speakTarget = computed<string>(() => {
  if (!current.value) return ''
  return current.value.word.sentence || current.value.word.word
})

const engineLabel = computed<string>(() => {
  if (lastError.value) return t.english.engineFallback
  if (loading.value) return t.english.synthesizing
  if (lastEngine.value === 'edge') return t.english.engineEdge
  if (lastEngine.value === 'bundled') return t.english.engineBuiltin
  if (lastEngine.value === 'system') return t.english.engineSystem
  return provider.value === 'edge' ? t.english.engineEdge : t.english.engineSystem
})

function shuffle<T>(input: T[]): T[] {
  const list = [...input]
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = list[i]
    list[i] = list[j]
    list[j] = temp
  }
  return list
}

function optionLabel(word: EnglishWord, target: QuizMode): string {
  if (target === 'sentence') return word.sentenceZh ?? ''
  return target === 'word' ? word.word : word.meaning
}

function buildOptions(word: EnglishWord, source: EnglishWord[], target: QuizMode): QuizOption[] {
  const correct = optionLabel(word, target)
  const seen = new Set<string>([correct])
  const options: QuizOption[] = [{ label: correct, correct: true }]
  for (const candidate of shuffle(source)) {
    if (options.length >= 4) break
    const label = optionLabel(candidate, target)
    if (!label || seen.has(label)) continue
    seen.add(label)
    options.push({ label, correct: false })
  }
  return shuffle(options)
}

function eligibleWords(): EnglishWord[] {
  if (mode.value === 'sentence') {
    return words.value.filter((word) => Boolean(word.sentence && word.sentenceZh))
  }
  return words.value
}

function buildRound(): void {
  const source = eligibleWords()
  quiz.value = pool.value.splice(0, ROUND_SIZE).map((word) => ({
    word,
    options: isChoiceMode.value ? buildOptions(word, source, mode.value) : []
  }))
  index.value = 0
  picked.value = null
  score.value = 0
  finished.value = quiz.value.length === 0
  resetAnswerState()
}

function resetAnswerState(): void {
  dictation.value = ''
  dictationChecked.value = false
  dictationCorrect.value = false
  speakingScored.value = false
  cleanupRecording()
  if (mode.value === 'dictation') {
    void nextTick(() => dictationInput.value?.focus())
  }
}

function resetQueue(): void {
  pool.value = shuffle(eligibleWords())
  buildRound()
}

function startRound(): void {
  buildRound()
}

function restartAll(): void {
  resetQueue()
}

async function loadWords(): Promise<void> {
  const requestId = ++loadRequest
  loadingWords.value = true
  quiz.value = []
  pool.value = []
  index.value = 0
  picked.value = null
  score.value = 0
  finished.value = false
  try {
    const result = await englishApi.words(grade.value)
    if (requestId !== loadRequest) return
    words.value = result
  } catch {
    if (requestId !== loadRequest) return
    words.value = []
  }
  if (requestId !== loadRequest) return
  loadingWords.value = false
  if (mode.value === 'sentence' && !hasSentences.value) mode.value = 'word'
  resetQueue()
}

function onGradeChange(value: number): void {
  if (value === grade.value) return
  grade.value = value
  void loadWords()
}

function onProviderChange(value: SpeechProvider): void {
  setProvider(value)
}

function onModeChange(value: QuizMode): void {
  if (value === mode.value) return
  stop()
  mode.value = value
  resetQueue()
}

function playWord(word: EnglishWord): void {
  void speak(word.word, 'en-US')
}

function playCurrent(): void {
  if (!current.value) return
  if (mode.value === 'sentence' || mode.value === 'speaking') {
    if (speakTarget.value) void speak(speakTarget.value, 'en-US')
    return
  }
  void speak(current.value.word.word, 'en-US')
}

function selectOption(optionIndex: number): void {
  if (picked.value !== null) return
  picked.value = optionIndex
  if (current.value?.options[optionIndex]?.correct) score.value += 1
}

function checkDictation(): void {
  if (!current.value || dictationChecked.value) return
  const input = normalize(dictation.value)
  if (!input) return
  dictationChecked.value = true
  dictationCorrect.value = input === normalize(current.value.word.word)
  if (dictationCorrect.value) score.value += 1
}

function onDictationEnter(): void {
  if (dictationChecked.value) next()
  else checkDictation()
}

function next(): void {
  if (isLast.value) {
    finished.value = true
    cleanupRecording()
    return
  }
  index.value += 1
  picked.value = null
  resetAnswerState()
}

function optionClass(optionIndex: number): Record<string, boolean> {
  const option = current.value?.options[optionIndex]
  return {
    correct: picked.value !== null && option?.correct === true,
    wrong: picked.value === optionIndex && option?.correct !== true
  }
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function similarity(target: string, heard: string): number {
  const a = normalize(target)
  const b = normalize(heard)
  if (!a) return 0
  if (!b) return 0
  const rows = a.length + 1
  const cols = b.length + 1
  const matrix: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  const distance = matrix[a.length][b.length]
  return Math.round(Math.max(0, 1 - distance / Math.max(a.length, b.length)) * 100)
}

function recognitionCtor(): SpeechRecognitionCtor | null {
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null
}

function startRecognition(): void {
  const Ctor = recognitionCtor()
  if (!Ctor) {
    recognitionNote.value = t.english.noRecognition
    return
  }
  try {
    const instance = new Ctor()
    recognition = instance
    instance.lang = 'en-US'
    instance.continuous = true
    instance.interimResults = false
    instance.onresult = (event) => {
      if (recognition !== instance) return
      if (!current.value) return
      let text = ''
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0]?.transcript ?? ''
      }
      transcript.value = text.trim()
      if (!transcript.value) return
      applyTranscript(transcript.value)
    }
    instance.onerror = () => {
      if (recognition !== instance) return
      recognitionNote.value = t.english.recognizeFailed
    }
    instance.onend = () => {
      if (recognition === instance) recognition = null
    }
    instance.start()
  } catch {
    recognitionNote.value = t.english.recognizeFailed
    recognition = null
  }
}

function applyTranscript(text: string): void {
  const content = text.trim()
  if (!content) {
    recognitionNote.value = t.english.asrEmpty
    return
  }
  transcript.value = content
  recognitionNote.value = ''
  const result = similarity(speakTarget.value, content)
  similarityScore.value = result
  if (result >= 70 && !speakingScored.value) {
    speakingScored.value = true
    score.value += 1
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** 录音是 webm/opus，本地识别需要 16k 单声道 PCM16 */
async function blobToPcm16(blob: Blob): Promise<string> {
  const data = await blob.arrayBuffer()
  const context = new AudioContext()
  try {
    const decoded = await context.decodeAudioData(data)
    const rate = 16000
    const frames = Math.max(1, Math.ceil(decoded.duration * rate))
    const offline = new OfflineAudioContext(1, frames, rate)
    const source = offline.createBufferSource()
    source.buffer = decoded
    source.connect(offline.destination)
    source.start()
    const rendered = await offline.startRendering()
    const channel = rendered.getChannelData(0)
    const pcm = new Int16Array(channel.length)
    for (let i = 0; i < channel.length; i += 1) {
      const value = Math.max(-1, Math.min(1, channel[i]))
      pcm[i] = value < 0 ? value * 0x8000 : value * 0x7fff
    }
    return arrayBufferToBase64(pcm.buffer)
  } finally {
    void context.close()
  }
}

async function scoreRecording(blob: Blob, token: number): Promise<void> {
  if (!asrAvailable.value) return
  asrBusy.value = true
  recognitionNote.value = ''
  try {
    const audio = await blobToPcm16(blob)
    const result = await asrApi.transcribe(audio, 16000)
    if (token !== recordingToken || disposed) return
    applyTranscript(result.text)
  } catch (error) {
    if (token !== recordingToken || disposed) return
    const message = error instanceof Error ? error.message : ''
    recognitionNote.value = message.includes('录音') ? message : t.english.asrFailed
  } finally {
    if (token === recordingToken) asrBusy.value = false
  }
}

function startRecordTimer(): void {
  clearRecordTimer()
  recordSeconds.value = 0
  recordTimer = window.setInterval(() => {
    recordSeconds.value += 1
    if (recordSeconds.value >= MAX_RECORD_SECONDS) stopRecording()
  }, 1000)
}

function clearRecordTimer(): void {
  if (recordTimer !== null) {
    window.clearInterval(recordTimer)
    recordTimer = null
  }
}

async function startRecording(): Promise<void> {
  if (recordState.value === 'recording' || starting.value) return
  stop()
  cleanupRecording()
  recordError.value = ''
  starting.value = true
  const token = ++recordingToken
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    if (disposed || token !== recordingToken) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }
    mediaStream = stream
    const chunks: Blob[] = []
    const instance = new MediaRecorder(stream)
    recorder = instance
    instance.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    instance.onstop = () => {
      if (recorder !== instance) return
      clearRecordTimer()
      if (chunks.length > 0) {
        if (recordUrl.value) URL.revokeObjectURL(recordUrl.value)
        const blob = new Blob(chunks, { type: instance.mimeType || 'audio/webm' })
        recordUrl.value = URL.createObjectURL(blob)
        void scoreRecording(blob, token)
      }
      recordState.value = 'ready'
      mediaStream?.getTracks().forEach((track) => track.stop())
      mediaStream = null
    }
    instance.start()
    recordState.value = 'recording'
    startRecordTimer()
    if (!asrAvailable.value) startRecognition()
  } catch {
    mediaStream?.getTracks().forEach((track) => track.stop())
    mediaStream = null
    recorder = null
    clearRecordTimer()
    recordError.value = t.english.micDenied
    recordState.value = 'idle'
  } finally {
    starting.value = false
  }
}

function stopRecording(): void {
  if (recordState.value !== 'recording') return
  clearRecordTimer()
  recognition?.stop()
  recorder?.stop()
  recordState.value = 'ready'
}

function playRecording(): void {
  if (!recordUrl.value) return
  stop()
  if (!recordPlayer) recordPlayer = new Audio()
  recordPlayer.src = recordUrl.value
  recordPlayer.currentTime = 0
  void recordPlayer.play()
}

function recordingNoteReset(): void {
  transcript.value = ''
  similarityScore.value = null
  recognitionNote.value = ''
}

function cleanupRecording(): void {
  recordingToken += 1
  asrBusy.value = false
  clearRecordTimer()
  recordSeconds.value = 0
  if (recorder) {
    recorder.onstop = null
    recorder.ondataavailable = null
    if (recorder.state !== 'inactive') recorder.stop()
  }
  recorder = null
  recognition?.abort()
  recognition = null
  mediaStream?.getTracks().forEach((track) => track.stop())
  mediaStream = null
  recordPlayer?.pause()
  recordPlayer = null
  if (recordUrl.value) URL.revokeObjectURL(recordUrl.value)
  recordUrl.value = ''
  recordState.value = 'idle'
  recordError.value = ''
  starting.value = false
  recordingNoteReset()
}

async function checkAsr(): Promise<void> {
  try {
    const result = await asrApi.status()
    asrAvailable.value = result.available
  } catch {
    asrAvailable.value = false
  } finally {
    asrChecked.value = true
  }
}

onMounted(() => {
  void checkAsr()
  void loadWords()
})
onBeforeUnmount(() => {
  disposed = true
  stop()
  cleanupRecording()
})
</script>

<style scoped>
.english-page {
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

.listen-grid {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.word-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 16px 14px;
  overflow: hidden;
}

.word-head {
  margin-bottom: 10px;
  padding: 0 2px;
}

.word-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 4px;
}

.word-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s ease;
}

.word-row:hover,
.word-row.active {
  background: var(--accent-soft);
}

.word-main {
  display: flex;
  flex-direction: column;
  min-width: 88px;
  line-height: 1.35;
}

.word-main strong {
  font-size: 13.5px;
  font-weight: 500;
}

.word-main small {
  color: var(--ink-faint);
  font-size: 11px;
}

.word-meaning {
  flex: 1;
  min-width: 0;
  color: var(--ink-soft);
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.word-row i {
  color: var(--ink-soft);
  font-size: 13px;
}

.word-panel .empty-state i,
.quiz-panel .empty-state i {
  color: var(--ink-faint);
}

.quiz-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 0;
  padding: 18px 28px 22px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.quiz-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.quiz-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-top: 18px;
  font-size: 12px;
  color: var(--ink-faint);
}

.quiz-score {
  margin-left: auto;
}

.quiz-left {
  letter-spacing: 0.04em;
}

.play-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  width: 132px;
  height: 132px;
  flex: none;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--bg-sunken);
  color: var(--ink);
  font-family: inherit;
  font-size: 12.5px;
  cursor: pointer;
  transition: border-color 0.12s ease, color 0.12s ease, transform 0.12s ease;
}

.play-btn i {
  font-size: 34px;
  line-height: 1;
}

.play-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.play-btn.playing {
  border-color: var(--accent);
  color: var(--accent);
  transform: scale(0.98);
}

.engine-tag {
  margin: 8px 0 0;
  color: var(--ink-faint);
  font-size: 11px;
  letter-spacing: 0.04em;
}

.engine-tag.warn {
  color: var(--warn);
}

.quiz-prompt {
  margin: 14px 0 14px;
  color: var(--ink-soft);
  font-size: 13px;
}

.option-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
  max-width: 680px;
}

.listen-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--bg-raised);
  color: var(--ink);
  font-family: inherit;
  font-size: 13.5px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.1s ease, background 0.1s ease;
}

.listen-option:hover:not(:disabled) {
  border-color: var(--accent);
}

.listen-option:disabled {
  cursor: default;
}

.listen-option.correct {
  border-color: var(--success);
  background: var(--success-soft);
  color: var(--success);
}

.listen-option.wrong {
  border-color: var(--danger);
  background: var(--danger-soft);
  color: var(--danger);
}

.option-letter {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--bg-sunken);
  color: var(--ink-faint);
  font-family: var(--font-num);
  font-size: 11.5px;
  line-height: 22px;
  text-align: center;
}

.listen-option.correct .option-letter {
  background: var(--success-soft);
  color: var(--success);
}

.listen-option.wrong .option-letter {
  background: var(--danger-soft);
  color: var(--danger);
}

.option-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listen-option.is-long .option-label {
  white-space: normal;
  line-height: 1.5;
}

.feedback {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.feedback.ok {
  background: var(--success-soft);
  color: var(--success);
}

.feedback.bad {
  background: var(--danger-soft);
  color: var(--danger);
}

.feedback-text {
  flex: 1;
}

.quiz-hint {
  margin: 16px 0 0;
  color: var(--ink-faint);
  font-size: 11.5px;
}

.dictation {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 420px;
}

.dictation-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--bg-raised);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 15px;
  text-align: center;
  outline: none;
}

.dictation-input:focus {
  border-color: var(--accent);
}

.dictation-result {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.dictation-result.ok {
  background: var(--success-soft);
  color: var(--success);
}

.dictation-result.bad {
  background: var(--danger-soft);
  color: var(--danger);
}

.dictation-result span {
  flex: 1;
}

.speaking {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 520px;
}

.speaking-target {
  margin: 0;
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  background: var(--bg-sunken);
  color: var(--ink);
  font-size: 15px;
  line-height: 1.6;
  text-align: center;
}

.speaking-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.speaking-note {
  color: var(--ink-soft);
  font-size: 12px;
  text-align: center;
}

.speaking-note.bad {
  color: var(--danger);
}

.speaking-score {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12.5px;
}

.speaking-score.ok {
  background: var(--success-soft);
  color: var(--success);
}

.speaking-score.bad {
  background: var(--danger-soft);
  color: var(--danger);
}

.quiz-done {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin: auto 0;
  color: var(--ink-soft);
}

.quiz-done i {
  font-size: 34px;
  color: var(--success);
}

.quiz-done strong {
  font-size: 15px;
  font-weight: 500;
}

.quiz-done p {
  margin: 0;
}

@media (max-width: 1200px) {
  .english-page {
    height: auto;
  }

  .listen-grid {
    grid-template-columns: 1fr;
  }

  .word-panel {
    max-height: 320px;
  }
}
</style>
