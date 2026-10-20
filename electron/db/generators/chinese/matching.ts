import { accepts, paramInt } from '../types'
import type { GeneratedQuestion, GeneratorContext } from '../types'
import {
  difficultyOf,
  gradeOf,
  groupBy,
  mulberry32,
  parseWords,
  shorten,
  shuffle
} from './common'

const SOURCE = 'generator:chinese-matching'
const SEED = 20261018
const LIMIT = 350
const TOPIC = '近义反义'

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

interface Pair {
  left: string
  right: string
}

function buildQuestion(
  pairs: Pair[],
  prefix: string,
  grade: number,
  pairCount: number,
  seen: Set<string>,
  rand: () => number
): GeneratedQuestion | null {
  if (pairs.length !== pairCount) return null
  const left = pairs.map((pair) => pair.left)
  const right = pairs.map((pair) => pair.right)
  const values = new Set([...left, ...right])
  if (values.size !== pairCount * 2) return null

  const stem = `${prefix}${left.join('、')}`
  if (seen.has(stem)) return null
  seen.add(stem)

  const answer: Record<string, string> = {}
  pairs.forEach((pair, index) => {
    answer[String(index)] = pair.right
  })

  let shuffledRight = shuffle(right, rand)
  if (shuffledRight.join('|') === right.join('|')) {
    shuffledRight = [...right.slice(1), right[0]]
  }

  return {
    subject: '语文',
    grade,
    topic: TOPIC,
    type: 'matching',
    difficulty: difficultyOf(grade),
    stem,
    options: { left, right: shuffledRight },
    answer,
    solution: pairs.map((pair) => `${pair.left}：${pair.right}`).join('；'),
    score: 3,
    source: SOURCE
  }
}

function buildIdiomMatching(
  rows: IdiomRow[],
  cursor: { value: number },
  grade: number,
  pairCount: number,
  seen: Set<string>,
  rand: () => number
): GeneratedQuestion | null {
  const pairs: Pair[] = []
  const limit = rows.length * 2
  for (let attempt = 0; attempt < limit && pairs.length < pairCount; attempt += 1) {
    const row = rows[cursor.value % rows.length]
    cursor.value += 1
    const word = row.word.trim()
    const meaning = shorten(row.explanation, 20)
    if (!word || !meaning) continue
    if (pairs.some((pair) => pair.left === word || pair.right === meaning)) continue
    pairs.push({ left: word, right: meaning })
  }
  return buildQuestion(pairs, '将下列成语与释义连线：', grade, pairCount, seen, rand)
}

function buildSynonymMatching(
  groups: SynonymGroup[],
  cursor: { value: number },
  grade: number,
  pairCount: number,
  seen: Set<string>,
  rand: () => number
): GeneratedQuestion | null {
  const pairs: Pair[] = []
  const limit = groups.length * 2
  for (let attempt = 0; attempt < limit && pairs.length < pairCount; attempt += 1) {
    const group = groups[cursor.value % groups.length]
    cursor.value += 1
    const left = group.list[0]
    const right = group.list[1]
    if (!left || !right || left === right) continue
    if (pairs.some((pair) => pair.left === left || pair.right === right)) continue
    pairs.push({ left, right })
  }
  return buildQuestion(pairs, '将下列近义词连线：', grade, pairCount, seen, rand)
}

function buildAntonymMatching(
  rows: AntonymRow[],
  cursor: { value: number },
  grade: number,
  pairCount: number,
  seen: Set<string>,
  rand: () => number
): GeneratedQuestion | null {
  const pairs: Pair[] = []
  const limit = rows.length * 2
  for (let attempt = 0; attempt < limit && pairs.length < pairCount; attempt += 1) {
    const row = rows[cursor.value % rows.length]
    cursor.value += 1
    const left = row.left.trim()
    const right = row.right.trim()
    if (!left || !right || left === right) continue
    if (pairs.some((pair) => pair.left === left || pair.right === right)) continue
    pairs.push({ left, right })
  }
  return buildQuestion(pairs, '将下列反义词连线：', grade, pairCount, seen, rand)
}

function buildClassifierMatching(
  rows: ClassifierRow[],
  validFor: Map<string, Set<string>>,
  grade: number,
  pairCount: number,
  seen: Set<string>,
  rand: () => number
): GeneratedQuestion | null {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const selected: Pair[] = []
    for (const row of shuffle(rows, rand)) {
      const noun = row.noun.trim()
      const classifier = row.classifier.trim()
      if (!noun || !classifier) continue
      if (selected.some((pair) => pair.left === noun || pair.right === classifier)) continue
      if (
        selected.some(
          (pair) =>
            (validFor.get(pair.left)?.has(classifier) ?? false) ||
            (validFor.get(noun)?.has(pair.right) ?? false)
        )
      ) {
        continue
      }
      selected.push({ left: noun, right: classifier })
      if (selected.length === pairCount) break
    }
    const question = buildQuestion(selected, '将下列名词与量词连线：', grade, pairCount, seen, rand)
    if (question) return question
  }
  return null
}

export function generateMatching(ctx: GeneratorContext): number {
  const idiomRows = ctx.db
    .prepare(
      `SELECT rowid AS id, word, explanation, freq FROM ref_idiom
       WHERE explanation IS NOT NULL AND explanation <> ''
       ORDER BY rowid`
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
  const validFor = new Map<string, Set<string>>()
  for (const row of classifierRows) {
    const noun = row.noun.trim()
    const classifier = row.classifier.trim()
    if (!noun || !classifier) continue
    const set = validFor.get(noun)
    if (set) set.add(classifier)
    else validFor.set(noun, new Set([classifier]))
  }

  const idiomsByGrade = groupBy(idiomRows, (row) => gradeOf(row.id))
  const groupsByGrade = groupBy(groups, (group) => gradeOf(group.id))
  const antonymsByGrade = groupBy(antonymRows, (row) => gradeOf(row.id))
  const classifiersByGrade = groupBy(
    classifierRows.filter((row) => row.noun.trim() && row.classifier.trim()),
    (row) => gradeOf(row.id)
  )

  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  const pairCount = paramInt(ctx.options, 'pairCount', 4, 4, 6)
  const targets = [88, 88, 87, 87]
  let count = 0

  for (let grade = 1; grade <= 6; grade += 1) {
    if (grade <= 2) continue
    if (!accepts(ctx.options, 'matching', grade)) continue
    const buckets: GeneratedQuestion[][] = [[], [], [], []]
    const seen = new Set<string>()
    const cursors = [{ value: 0 }, { value: 0 }, { value: 0 }]

    const idiomPool = shuffle(
      (idiomsByGrade.get(grade) ?? []).filter(
        (item) => item.freq !== null && item.freq <= (grade <= 4 ? 5000 : 10000)
      ),
      rand
    )
    const groupPool = shuffle(groupsByGrade.get(grade) ?? [], rand)
    const antonymPool = shuffle(antonymsByGrade.get(grade) ?? [], rand)
    const classifierPool = shuffle(classifiersByGrade.get(grade) ?? [], rand)

    for (let kind = 0; kind < 4; kind += 1) {
      let misses = 0
      while (buckets[kind].length < targets[kind] && misses < 100) {
        let question: GeneratedQuestion | null = null
        if (kind === 0 && idiomPool.length > 0) {
          question = buildIdiomMatching(idiomPool, cursors[0], grade, pairCount, seen, rand)
        } else if (kind === 1 && groupPool.length > 0) {
          question = buildSynonymMatching(groupPool, cursors[1], grade, pairCount, seen, rand)
        } else if (kind === 2 && antonymPool.length > 0) {
          question = buildAntonymMatching(antonymPool, cursors[2], grade, pairCount, seen, rand)
        } else if (kind === 3 && classifierPool.length > 0) {
          question = buildClassifierMatching(classifierPool, validFor, grade, pairCount, seen, rand)
        }
        if (!question) {
          misses += 1
          continue
        }
        misses = 0
        buckets[kind].push(question)
      }
    }

    const total = Math.min(limit, buckets.reduce((sum, bucket) => sum + bucket.length, 0))
    const offsets = [0, 0, 0, 0]
    for (let index = 0; index < total; index += 1) {
      let question: GeneratedQuestion | undefined
      for (let step = 0; step < 4 && !question; step += 1) {
        const kind = (index + step) % 4
        if (offsets[kind] < buckets[kind].length) {
          question = buckets[kind][offsets[kind]]
          offsets[kind] += 1
        }
      }
      if (question && ctx.insert(question)) count += 1
    }
  }

  return count
}
