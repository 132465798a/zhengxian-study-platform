import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { examApi } from '@/api'
import type { ExamSession, SessionResult } from '@shared/types'

export const useExamStore = defineStore('exam', () => {
  const session = ref<ExamSession | null>(null)
  const answers = ref<Record<number, unknown>>({})
  const currentIndex = ref(0)
  const startedAt = ref(Date.now())
  const remainingSec = ref(0)
  const result = ref<SessionResult | null>(null)
  let timer: number | null = null

  const questions = computed(() => session.value?.paper.questions ?? [])
  const currentQuestion = computed(() => questions.value[currentIndex.value]?.question ?? null)
  const total = computed(() => questions.value.length)
  const answeredCount = computed(
    () => Object.values(answers.value).filter((value) => value !== null && value !== undefined && value !== '').length
  )
  const progress = computed(() => (total.value === 0 ? 0 : (answeredCount.value / total.value) * 100))
  const durationMinutes = computed(() => session.value?.paper.duration ?? 0)

  function clearTimer(): void {
    if (timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
  }

  function reset(): void {
    clearTimer()
    session.value = null
    answers.value = {}
    currentIndex.value = 0
    remainingSec.value = 0
    result.value = null
  }

  async function start(userId: number, paperId: number): Promise<ExamSession> {
    reset()
    const created = await examApi.start(userId, paperId)
    session.value = created
    startedAt.value = Date.now()
    for (const answer of created.answers) {
      answers.value[answer.questionId] = answer.userAnswer
    }
    const duration = created.paper.duration ?? 0
    const elapsed = Math.floor((Date.now() - new Date(created.record.startedAt).getTime()) / 1000)
    remainingSec.value = Math.max(0, duration * 60 - Math.max(0, elapsed))
    return created
  }

  async function load(userId: number, recordId: number): Promise<ExamSession> {
    reset()
    const loaded = await examApi.get(userId, recordId)
    session.value = loaded
    startedAt.value = new Date(loaded.record.startedAt).getTime()
    for (const answer of loaded.answers) {
      answers.value[answer.questionId] = answer.userAnswer
    }
    const duration = loaded.paper.duration ?? 0
    const elapsed = Math.floor((Date.now() - startedAt.value) / 1000)
    remainingSec.value = Math.max(0, duration * 60 - Math.max(0, elapsed))
    return loaded
  }

  async function saveAnswer(questionId: number, value: unknown): Promise<void> {
    if (!session.value) return
    answers.value = { ...answers.value, [questionId]: value }
    await examApi.answer({
      userId: session.value.record.userId,
      recordId: session.value.record.id,
      questionId,
      answer: value
    })
  }

  function startTimer(onTimeUp: () => void): void {
    clearTimer()
    timer = window.setInterval(() => {
      if (remainingSec.value <= 1) {
        remainingSec.value = 0
        clearTimer()
        onTimeUp()
        return
      }
      remainingSec.value -= 1
    }, 1000)
  }

  async function submit(): Promise<SessionResult> {
    if (!session.value) throw new Error('考试尚未开始')
    clearTimer()
    const durationSec = Math.round((Date.now() - startedAt.value) / 1000)
    const finished = await examApi.submit(session.value.record.userId, session.value.record.id, durationSec)
    result.value = finished
    return finished
  }

  function goTo(index: number): void {
    if (index >= 0 && index < total.value) currentIndex.value = index
  }

  return {
    session,
    answers,
    currentIndex,
    remainingSec,
    result,
    questions,
    currentQuestion,
    total,
    answeredCount,
    progress,
    durationMinutes,
    reset,
    start,
    load,
    saveAnswer,
    startTimer,
    clearTimer,
    submit,
    goTo
  }
})
