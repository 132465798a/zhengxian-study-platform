import { accepts, paramInt } from '../types'
import type { GeneratedQuestion, GeneratorContext } from '../types'
import { difficultyOf, gradeOf, groupBy, mulberry32, parseWords, shuffle } from './common'

const SOURCE = 'generator:chinese-multiple'
const SEED = 20261018
const LIMIT = 350

interface HanziRow {
  char: string
  grade: number
}

interface IdiomRow {
  word: string
  freq: number
}

interface SynonymRow {
  id: number
  words: string
}

interface SynonymGroup {
  id: number
  list: string[]
}

function buildIdiomQuestion(
  char: string,
  grade: number,
  containing: Map<string, string[]>,
  idioms: string[],
  optionCount: number,
  correctCount: number,
  rand: () => number
): GeneratedQuestion | null {
  const correct = shuffle(containing.get(char) ?? [], rand).slice(0, correctCount)
  if (correct.length < correctCount) return null

  const distractorCount = optionCount - correctCount
  const used = new Set(correct)
  const distractors: string[] = []
  const start = Math.floor(rand() * idioms.length)
  for (let step = 0; step < idioms.length && distractors.length < distractorCount; step += 1) {
    const word = idioms[(start + step) % idioms.length]
    if (word.includes(char) || used.has(word)) continue
    used.add(word)
    distractors.push(word)
  }
  if (distractors.length < distractorCount) return null

  const options = shuffle([...correct, ...distractors], rand)
  const answer: number[] = []
  options.forEach((option, index) => {
    if (correct.includes(option)) answer.push(index)
  })

  return {
    subject: '语文',
    grade,
    topic: '成语俗语',
    type: 'multiple',
    difficulty: difficultyOf(grade),
    stem: `下列成语中，含有"${char}"字的有（ ）。`,
    options,
    answer,
    solution: `含有"${char}"字的成语：${correct.join('、')}。`,
    score: 3,
    source: SOURCE
  }
}

function buildSynonymQuestion(
  group: SynonymGroup,
  pool: Array<{ id: number; word: string }>,
  grade: number,
  optionCount: number,
  correctCount: number,
  rand: () => number
): GeneratedQuestion | null {
  if (group.list.length < correctCount + 1) return null
  const anchor = group.list[Math.floor(rand() * group.list.length)]
  const correct = shuffle(
    group.list.filter((word) => word !== anchor),
    rand
  ).slice(0, correctCount)
  if (correct.length < correctCount) return null

  const distractorCount = optionCount - correctCount
  const used = new Set([anchor, ...correct])
  const distractors: string[] = []
  const start = Math.floor(rand() * pool.length)
  for (let step = 0; step < pool.length && distractors.length < distractorCount; step += 1) {
    const item = pool[(start + step) % pool.length]
    if (item.id === group.id || used.has(item.word)) continue
    used.add(item.word)
    distractors.push(item.word)
  }
  if (distractors.length < distractorCount) return null

  const options = shuffle([...correct, ...distractors], rand)
  const answer: number[] = []
  options.forEach((option, index) => {
    if (correct.includes(option)) answer.push(index)
  })

  return {
    subject: '语文',
    grade,
    topic: '近义反义',
    type: 'multiple',
    difficulty: difficultyOf(grade),
    stem: `下列词语中，与"${anchor}"意思相近的有（ ）。`,
    options,
    answer,
    solution: `"${anchor}"的近义词有：${correct.join('、')}。`,
    score: 3,
    source: SOURCE
  }
}

export function generateMultiple(ctx: GeneratorContext): number {
  const hanzi = ctx.db
    .prepare('SELECT char, grade FROM ref_hanzi ORDER BY grade, rowid')
    .all() as HanziRow[]
  const idiomRows = ctx.db
    .prepare(
      'SELECT word, freq FROM ref_idiom WHERE length(word) = 4 ORDER BY rowid'
    )
    .all() as IdiomRow[]
  const synonymRows = ctx.db
    .prepare('SELECT id, words FROM ref_synonym ORDER BY id')
    .all() as SynonymRow[]

  const idiomsAll = [
    ...new Set(
      idiomRows
        .map((row) => row.word.trim())
        .filter((word) => /^[\u4e00-\u9fa5]{4}$/.test(word))
    )
  ]
  const groups: SynonymGroup[] = []
  for (const row of synonymRows) {
    const list = parseWords(row.words)
    if (list.length >= 3) groups.push({ id: row.id, list })
  }

  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const idiomSetsByFreqLimit = new Map<number, { shuffled: string[]; containing: Map<string, string[]> }>()
  const idiomSetsFor = (freqLimit: number) => {
    const cached = idiomSetsByFreqLimit.get(freqLimit)
    if (cached) return cached
    const allowed = new Set(
      idiomRows
        .filter(
          (row) =>
            row.freq !== null &&
            row.freq <= freqLimit &&
            /^[\u4e00-\u9fa5]{4}$/.test(row.word.trim())
        )
        .map((row) => row.word.trim())
    )
    const list = idiomsAll.filter((word) => allowed.has(word))
    const shuffled = shuffle(list, rand)
    const containing = new Map<string, string[]>()
    for (const word of shuffled) {
      for (const char of new Set(word)) {
        const group = containing.get(char)
        if (group) group.push(word)
        else containing.set(char, [word])
      }
    }
    const sets = { shuffled, containing }
    idiomSetsByFreqLimit.set(freqLimit, sets)
    return sets
  }
  const wordPool = groups.flatMap((group) => group.list.map((word) => ({ id: group.id, word })))

  const hanziByGrade = groupBy(hanzi, (row) => row.grade)
  const groupsByGrade = groupBy(groups, (group) => gradeOf(group.id))

  const optionCount = paramInt(ctx.options, 'optionCount', 4, 4, 5)
  const correctCount = paramInt(ctx.options, 'correctCount', 2, 2, 3)
  const limit = ctx.options?.limit ?? LIMIT
  const half = Math.ceil(limit / 2)
  let count = 0

  for (const grade of [...hanziByGrade.keys()].sort((a, b) => a - b)) {
    if (grade <= 2) continue
    if (!accepts(ctx.options, 'multiple', grade)) continue
    const { shuffled: shuffledIdioms, containing } = idiomSetsFor(grade <= 4 ? 5000 : 10000)
    const idiomQuestions: GeneratedQuestion[] = []
    const synonymQuestions: GeneratedQuestion[] = []
    const seen = new Set<string>()

    for (const row of shuffle(hanziByGrade.get(grade) ?? [], rand)) {
      if (idiomQuestions.length >= half) break
      const question = buildIdiomQuestion(
        row.char,
        grade,
        containing,
        shuffledIdioms,
        optionCount,
        correctCount,
        rand
      )
      if (!question || seen.has(question.stem)) continue
      seen.add(question.stem)
      idiomQuestions.push(question)
    }

    for (const group of shuffle(groupsByGrade.get(grade) ?? [], rand)) {
      if (synonymQuestions.length >= limit - half) break
      const question = buildSynonymQuestion(
        group,
        wordPool,
        grade,
        optionCount,
        correctCount,
        rand
      )
      if (!question || seen.has(question.stem)) continue
      seen.add(question.stem)
      synonymQuestions.push(question)
    }

    const total = Math.min(limit, idiomQuestions.length + synonymQuestions.length)
    let idiomIndex = 0
    let synonymIndex = 0
    for (let index = 0; index < total; index += 1) {
      let question: GeneratedQuestion | undefined
      if (index % 2 === 0 && idiomIndex < idiomQuestions.length) {
        question = idiomQuestions[idiomIndex]
        idiomIndex += 1
      } else if (synonymIndex < synonymQuestions.length) {
        question = synonymQuestions[synonymIndex]
        synonymIndex += 1
      } else if (idiomIndex < idiomQuestions.length) {
        question = idiomQuestions[idiomIndex]
        idiomIndex += 1
      }
      if (question && ctx.insert(question)) count += 1
    }
  }

  return count
}
