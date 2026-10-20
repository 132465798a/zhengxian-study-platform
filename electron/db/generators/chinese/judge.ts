import { accepts, paramInt } from '../types'
import type { GeneratedQuestion, GeneratorContext } from '../types'
import { difficultyOf, gradeOf, groupBy, mulberry32, parseWords, shorten, shuffle } from './common'

const SOURCE = 'generator:chinese-judge'
const SEED = 20261018
const LIMIT = 500

interface IdiomRow {
  id: number
  word: string
  explanation: string
  freq: number
}

interface SynonymRow {
  id: number
  words: string
}

interface AntonymRow {
  id: number
  left: string
  right: string
}

interface ClassifierRow {
  id: number
  noun: string
  classifier: string
}

interface SynonymGroup {
  id: number
  list: string[]
}

function shouldBeTrue(trueRatio: number, rand: () => number): boolean {
  return rand() * 100 < trueRatio
}

function buildIdiomJudge(
  row: IdiomRow,
  explanations: string[],
  grade: number,
  trueRatio: number,
  rand: () => number
): GeneratedQuestion | null {
  const real = shorten(row.explanation, 40)
  if (!real) return null

  const fake = !shouldBeTrue(trueRatio, rand)
  let presented = real
  if (fake) {
    presented = ''
    for (let attempt = 0; attempt < 10 && !presented; attempt += 1) {
      const candidate = shorten(explanations[Math.floor(rand() * explanations.length)], 40)
      if (candidate && candidate !== real) presented = candidate
    }
    if (!presented) return null
  }

  return {
    subject: '语文',
    grade,
    topic: '成语俗语',
    type: 'judge',
    difficulty: difficultyOf(grade),
    stem: `判断："${row.word}"的意思是：${presented}。`,
    options: ['正确', '错误'],
    answer: fake ? 1 : 0,
    solution: `"${row.word}"的意思是：${real}。`,
    score: 3,
    source: SOURCE
  }
}

function pickMismatch(pool: string[], excluded: Set<string>, rand: () => number): string | null {
  if (pool.length === 0) return null
  const start = Math.floor(rand() * pool.length)
  for (let step = 0; step < pool.length; step += 1) {
    const word = pool[(start + step) % pool.length]
    if (!excluded.has(word)) return word
  }
  return null
}

function buildRelationJudge(
  source: 'synonym' | 'antonym',
  entry: SynonymGroup | AntonymRow,
  synonymWords: string[],
  antonymWords: string[],
  grade: number,
  trueRatio: number,
  rand: () => number
): GeneratedQuestion | null {
  let left: string
  let right: string
  let label: string
  let excluded: Set<string>
  let mismatchPool: string[]

  if (source === 'synonym') {
    const group = entry as SynonymGroup
    if (group.list.length < 2) return null
    left = group.list[0]
    right = group.list[1]
    label = '近义词'
    excluded = new Set(group.list)
    mismatchPool = antonymWords
  } else {
    const pair = entry as AntonymRow
    left = pair.left
    right = pair.right
    label = '反义词'
    excluded = new Set([left, right])
    mismatchPool = synonymWords
  }
  if (!left || !right || left === right) return null

  const wrong = !shouldBeTrue(trueRatio, rand)
  let presented = right
  if (wrong) {
    const mismatch = pickMismatch(mismatchPool, excluded, rand)
    if (!mismatch) return null
    presented = mismatch
  }

  return {
    subject: '语文',
    grade,
    topic: '近义反义',
    type: 'judge',
    difficulty: difficultyOf(grade),
    stem: `判断："${left}"和"${presented}"是${label}。`,
    options: ['正确', '错误'],
    answer: wrong ? 1 : 0,
    solution: wrong
      ? `"${left}"的${label}不是"${presented}"。`
      : `"${left}"的${label}是"${presented}"。`,
    score: 3,
    source: SOURCE
  }
}

function buildClassifierJudge(
  row: ClassifierRow,
  validFor: Map<string, Set<string>>,
  classifiers: string[],
  grade: number,
  trueRatio: number,
  rand: () => number
): GeneratedQuestion | null {
  const wrong = !shouldBeTrue(trueRatio, rand)
  let presented = row.classifier

  if (wrong) {
    const excluded = new Set(validFor.get(row.noun) ?? [])
    excluded.add(row.classifier)
    const start = Math.floor(rand() * classifiers.length)
    presented = ''
    for (let step = 0; step < classifiers.length && !presented; step += 1) {
      const value = classifiers[(start + step) % classifiers.length]
      if (!excluded.has(value)) presented = value
    }
    if (!presented) return null
  }

  return {
    subject: '语文',
    grade,
    topic: '量词搭配',
    type: 'judge',
    difficulty: difficultyOf(grade),
    stem: `判断："一（${presented}）${row.noun}"的量词使用正确。`,
    options: ['正确', '错误'],
    answer: wrong ? 1 : 0,
    solution: `"${row.noun}"应搭配量词"${row.classifier}"。`,
    score: 3,
    source: SOURCE
  }
}

export function generateJudge(ctx: GeneratorContext): number {
  const idiomRows = ctx.db
    .prepare(
      `SELECT rowid AS id, word, explanation, freq FROM ref_idiom
       WHERE explanation IS NOT NULL AND explanation <> '' ORDER BY rowid`
    )
    .all() as IdiomRow[]
  const synonymRows = ctx.db
    .prepare('SELECT id, words FROM ref_synonym ORDER BY id')
    .all() as SynonymRow[]
  const antonymRows = ctx.db
    .prepare('SELECT id, left, right FROM ref_antonym ORDER BY id')
    .all() as AntonymRow[]
  const classifierRows = ctx.db
    .prepare('SELECT rowid AS id, noun, classifier FROM ref_classifier ORDER BY rowid')
    .all() as ClassifierRow[]

  const groups: SynonymGroup[] = []
  for (const row of synonymRows) {
    const list = parseWords(row.words)
    if (list.length >= 2) groups.push({ id: row.id, list })
  }
  const synonyms = groups.flatMap((group) => group.list)
  const antonyms = antonymRows
    .map((row) => ({ id: row.id, left: row.left.trim(), right: row.right.trim() }))
    .filter((row) => row.left && row.right && row.left !== row.right)
  const antonymWords = antonyms.flatMap((row) => [row.left, row.right])
  const classifiers = [...new Set(classifierRows.map((row) => row.classifier.trim()).filter((value) => value.length > 0))]
  const validFor = new Map<string, Set<string>>()
  for (const row of classifierRows) {
    const noun = row.noun.trim()
    const classifier = row.classifier.trim()
    if (!noun || !classifier) continue
    const set = validFor.get(noun)
    if (set) set.add(classifier)
    else validFor.set(noun, new Set([classifier]))
  }

  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const explanations = [...new Set(idiomRows.map((row) => row.explanation.trim()))]
  const idiomsByGrade = groupBy(idiomRows, (row) => gradeOf(row.id))
  const groupsByGrade = groupBy(groups, (group) => gradeOf(group.id))
  const antonymsByGrade = groupBy(antonyms, (row) => gradeOf(row.id))
  const classifiersByGrade = groupBy(
    classifierRows.filter((row) => row.noun.trim() && row.classifier.trim()),
    (row) => gradeOf(row.id)
  )

  const limit = ctx.options?.limit ?? LIMIT
  const trueRatio = paramInt(ctx.options, 'trueRatio', 50, 50, 70)
  const idiomTarget = Math.ceil(limit / 3)
  const relationTarget = Math.ceil(limit / 3)
  const classifierTarget = limit - idiomTarget - relationTarget
  let count = 0

  for (let grade = 1; grade <= 6; grade += 1) {
    if (grade <= 2) continue
    if (!accepts(ctx.options, 'judge', grade)) continue
    const seen = new Set<string>()
    const idiomQuestions: GeneratedQuestion[] = []
    const relationQuestions: GeneratedQuestion[] = []
    const classifierQuestions: GeneratedQuestion[] = []

    for (const row of shuffle(
      (idiomsByGrade.get(grade) ?? []).filter(
        (item) => item.freq !== null && item.freq <= (grade <= 4 ? 5000 : 10000)
      ),
      rand
    )) {
      if (idiomQuestions.length >= idiomTarget) break
      const question = buildIdiomJudge(row, explanations, grade, trueRatio, rand)
      if (!question || seen.has(question.stem)) continue
      seen.add(question.stem)
      idiomQuestions.push(question)
    }

    const synonymGroups = shuffle(groupsByGrade.get(grade) ?? [], rand)
    const antonymPairs = shuffle(antonymsByGrade.get(grade) ?? [], rand)
    let synonymIndex = 0
    let antonymIndex = 0
    while (
      relationQuestions.length < relationTarget &&
      (synonymIndex < synonymGroups.length || antonymIndex < antonymPairs.length)
    ) {
      const useSynonym =
        (relationQuestions.length % 2 === 0 && synonymIndex < synonymGroups.length) ||
        antonymIndex >= antonymPairs.length
      const question = useSynonym
        ? buildRelationJudge(
            'synonym',
            synonymGroups[synonymIndex++],
            synonyms,
            antonymWords,
            grade,
            trueRatio,
            rand
          )
        : buildRelationJudge(
            'antonym',
            antonymPairs[antonymIndex++],
            synonyms,
            antonymWords,
            grade,
            trueRatio,
            rand
          )
      if (!question || seen.has(question.stem)) continue
      seen.add(question.stem)
      relationQuestions.push(question)
    }

    for (const row of shuffle(classifiersByGrade.get(grade) ?? [], rand)) {
      if (classifierQuestions.length >= classifierTarget) break
      const question = buildClassifierJudge(row, validFor, classifiers, grade, trueRatio, rand)
      if (!question || seen.has(question.stem)) continue
      seen.add(question.stem)
      classifierQuestions.push(question)
    }

    const buckets = [idiomQuestions, relationQuestions, classifierQuestions]
    const total = Math.min(limit, buckets.reduce((sum, bucket) => sum + bucket.length, 0))
    const cursors = [0, 0, 0]
    for (let index = 0; index < total; index += 1) {
      let question: GeneratedQuestion | undefined
      for (let step = 0; step < 3 && !question; step += 1) {
        const kind = (index + step) % 3
        if (cursors[kind] < buckets[kind].length) {
          question = buckets[kind][cursors[kind]]
          cursors[kind] += 1
        }
      }
      if (question && ctx.insert(question)) count += 1
    }
  }

  return count
}
