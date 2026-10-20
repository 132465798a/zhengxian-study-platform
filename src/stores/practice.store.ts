import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { practiceApi } from '@/api'
import type { PracticeConfig, PracticeSession, SessionResult } from '@shared/types'

interface AnswerOutcome {
  isCorrect: boolean | null
  score: number
  correctAnswer: unknown
  solution: string | null
}

export const usePracticeStore = defineStore('practice', () => {
  const session = ref<PracticeSession | null>(null)
  const answers = ref<Record<number, unknown>>({})
  const outcomes = ref<Record<number, AnswerOutcome>>({})
  const currentIndex = ref(0)
  const startedAt = ref(Date.now())
  const showSolution = ref(true)
  const saving = ref(false)
  const result = ref<SessionResult | null>(null)

  const questions = computed(() => session.value?.paper.questions ?? [])
  const currentQuestion = computed(() => questions.value[currentIndex.value]?.question ?? null)
  const answeredCount = computed(() => Object.keys(outcomes.value).length)
  const total = computed(() => questions.value.length)
  const progress = computed(() => (total.value === 0 ? 0 : (answeredCount.value / total.value) * 100))

  function reset(): void {
    session.value = null
    answers.value = {}
    outcomes.value = {}
    currentIndex.value = 0
    startedAt.value = Date.now()
    result.value = null
  }

  async function start(config: PracticeConfig): Promise<PracticeSession> {
    reset()
    const created = await practiceApi.create(config)
    session.value = created
    startedAt.value = Date.now()
    return created
  }

  async function load(userId: number, recordId: number): Promise<PracticeSession> {
    reset()
    const loaded = await practiceApi.get(userId, recordId)
    session.value = loaded
    for (const answer of loaded.answers) {
      answers.value[answer.questionId] = answer.userAnswer
      outcomes.value[answer.questionId] = {
        isCorrect: answer.isCorrect,
        score: answer.score,
        correctAnswer: null,
        solution: null
      }
    }
    return loaded
  }

  async function submit(questionId: number, value: unknown): Promise<void> {
    if (!session.value) return
    saving.value = true
    try {
      const response = await practiceApi.answer({
        userId: session.value.record.userId,
        recordId: session.value.record.id,
        questionId,
        answer: value
      })
      answers.value = { ...answers.value, [questionId]: value }
      outcomes.value = {
        ...outcomes.value,
        [questionId]: {
          isCorrect: response.isCorrect,
          score: response.score,
          correctAnswer: response.answer,
          solution: response.solution
        }
      }
    } finally {
      saving.value = false
    }
  }

  async function finish(): Promise<SessionResult> {
    if (!session.value) throw new Error('练习尚未开始')
    const durationSec = Math.round((Date.now() - startedAt.value) / 1000)
    const finished = await practiceApi.finish(session.value.record.userId, session.value.record.id, durationSec)
    result.value = finished
    return finished
  }

  function goTo(index: number): void {
    if (index >= 0 && index < total.value) currentIndex.value = index
  }

  function next(): void {
    goTo(currentIndex.value + 1)
  }

  function prev(): void {
    goTo(currentIndex.value - 1)
  }

  return {
    session,
    answers,
    outcomes,
    currentIndex,
    startedAt,
    showSolution,
    saving,
    result,
    questions,
    currentQuestion,
    answeredCount,
    total,
    progress,
    reset,
    start,
    load,
    submit,
    finish,
    goTo,
    next,
    prev
  }
})
