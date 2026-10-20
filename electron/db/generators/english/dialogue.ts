import { accepts } from '../types'
import type { GeneratorContext } from '../types'
import { numberParam } from './params'

const SOURCE = 'generator:dialogue'
const TOPIC = '情景交际'
const SEED = 20261109
const LIMIT = 150
const LOW_GRADE_LIMIT = 30

interface GreetingFact {
  stem: string
  correct: string
  options: string[]
}

const GREETING_FACTS: GreetingFact[] = [
  {
    stem: '早上见到老师，应该说？',
    correct: 'Good morning',
    options: ['Good morning', 'Good night', 'Goodbye', 'Thank you']
  },
  {
    stem: '下午见到同学，应该说？',
    correct: 'Good afternoon',
    options: ['Good afternoon', 'Good morning', 'Good evening', 'Sorry']
  },
  {
    stem: '晚上见面打招呼，应该说？',
    correct: 'Good evening',
    options: ['Good evening', 'Good afternoon', 'Good morning', 'Thank you']
  },
  {
    stem: '睡前和爸爸妈妈道别，应该说？',
    correct: 'Good night',
    options: ['Good night', 'Good morning', 'Good afternoon', 'Hello']
  },
  {
    stem: '和朋友分别时，应该说？',
    correct: 'Goodbye',
    options: ['Goodbye', 'Good morning', 'Thank you', 'Sorry']
  },
  {
    stem: '别人帮助了你，你应该说？',
    correct: 'Thank you',
    options: ['Thank you', 'Goodbye', 'Hello', 'Good night']
  },
  {
    stem: '做错了事，应该说什么？',
    correct: 'Sorry',
    options: ['Sorry', 'Thank you', 'Good morning', 'Goodbye']
  },
  {
    stem: '第一次见面介绍自己，应该说？',
    correct: 'My name is Tom.',
    options: ['My name is Tom.', 'Good night.', 'Thank you.', 'Goodbye.']
  },
  {
    stem: '你想知道对方的名字，应该问？',
    correct: 'What is your name?',
    options: ['What is your name?', 'How old are you?', 'Good morning?', 'Thank you?']
  },
  {
    stem: '见到朋友主动问好，应该说？',
    correct: 'Hello!',
    options: ['Hello!', 'Goodbye!', 'Sorry!', 'Thank you!']
  }
]

interface DialogueRow {
  grade: number
  sentence: string | null
  sentence_zh: string | null
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function difficultyOf(grade: number): number {
  return grade <= 4 ? 2 : 3
}

function generateGreetings(
  ctx: GeneratorContext,
  grade: number,
  rand: () => number,
  optionCount: number,
  limit: number
): number {
  let count = 0
  const cap = Math.min(LOW_GRADE_LIMIT, limit)
  for (const fact of GREETING_FACTS) {
    if (count >= cap) break
    let options = shuffle(fact.options, rand)
    if (options.length > optionCount) {
      const wrongIndex = options.findIndex((item) => item !== fact.correct)
      if (wrongIndex >= 0) options = options.filter((_, index) => index !== wrongIndex)
    }
    const inserted = ctx.insert({
      subject: '英语',
      grade,
      topic: TOPIC,
      type: 'single',
      difficulty: difficultyOf(grade),
      stem: fact.stem,
      options,
      answer: options.indexOf(fact.correct),
      solution: `正确应答是 "${fact.correct}"。`,
      score: 2,
      source: SOURCE
    })
    if (inserted) count += 1
  }
  return count
}

export function generateDialogue(ctx: GeneratorContext): number {
  const rows = ctx.db
    .prepare(
      'SELECT grade, sentence, sentence_zh FROM ref_english_word ORDER BY grade, rowid'
    )
    .all() as DialogueRow[]

  const grades = new Set<number>()
  const groups = new Map<number, DialogueRow[]>()
  for (const row of rows) {
    grades.add(row.grade)
    if (!row.sentence || !row.sentence_zh) continue
    const group = groups.get(row.grade)
    if (group) group.push(row)
    else groups.set(row.grade, [row])
  }

  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  const optionCount = numberParam(ctx.options, 'optionCount', 4, 3, 4)
  let count = 0

  for (const grade of [...grades].sort((a, b) => a - b)) {
    if (!accepts(ctx.options, 'single', grade)) continue
    if (grade < 3) {
      count += generateGreetings(ctx, grade, rand, optionCount, limit)
      continue
    }
    const pool = groups.get(grade) ?? []
    const usedSentences = new Set<string>()
    let generated = 0

    for (const row of shuffle(pool, rand)) {
      if (generated >= limit) break
      if (!row.sentence || !row.sentence_zh) continue
      const sentence = row.sentence.trim()
      const meaning = row.sentence_zh.trim()
      if (!sentence || !meaning || usedSentences.has(sentence)) continue
      usedSentences.add(sentence)

      const used = new Set([meaning])
      const choices: string[] = []
      for (const other of shuffle(pool, rand)) {
        const value = other.sentence_zh?.trim()
        if (!value || used.has(value)) continue
        used.add(value)
        choices.push(value)
        if (choices.length === optionCount - 1) break
      }
      if (choices.length < optionCount - 1) continue

      const options = shuffle([meaning, ...choices], rand)
      const inserted = ctx.insert({
        subject: '英语',
        grade,
        topic: TOPIC,
        type: 'single',
        difficulty: difficultyOf(grade),
        stem: `— ${sentence} 这句话的意思是？`,
        options,
        answer: options.indexOf(meaning),
        solution: `${sentence} 的意思是"${meaning}"。`,
        score: 2,
        source: SOURCE
      })
      if (inserted) {
        generated += 1
        count += 1
      }
    }
  }

  return count
}
