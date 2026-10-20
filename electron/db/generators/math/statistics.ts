import type { GeneratorContext } from '../types'

const SOURCE = 'generator:math-statistics'
const TOPIC = '统计与概率'
const SEED = 20261106
const LIMIT = 40
const MAX_ATTEMPTS = 12000
const SHAPES = ['○', '△', '□']
const CLASSES = ['一班', '二班', '三班', '四班']
const NAMES = ['小明', '小红', '小刚', '小丽', '小华', '小强', '小芳', '小军', '小杰', '小敏']

interface StatisticsItem {
  type: 'single' | 'judge' | 'fill'
  stem: string
  options?: string[]
  answer: number | string[]
  solution: string
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

function int(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1))
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
  if (grade <= 2) return 1
  if (grade <= 4) return 2
  return 3
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)))
}

function makeSymbols(rand: () => number): string[] {
  const length = int(rand, 4, 12)
  const items = [...SHAPES]
  while (items.length < length) {
    items.push(SHAPES[int(rand, 0, SHAPES.length - 1)])
  }
  return shuffle(items, rand)
}

function countOf(items: string[], shape: string): number {
  return items.filter((item) => item === shape).length
}

function numberOptions(correct: number, max: number, rand: () => number): string[] {
  const wanted = 4
  const values = new Set<number>([correct])
  let guard = 0
  while (values.size < wanted && guard < 40) {
    guard += 1
    const delta = int(rand, 1, 3) * (rand() < 0.5 ? -1 : 1)
    const candidate = correct + delta
    if (candidate >= 0 && candidate <= max) values.add(candidate)
  }
  for (let value = 0; values.size < wanted && value <= max; value += 1) {
    values.add(value)
  }
  return shuffle([...values], rand).map(String)
}

function buildItem(rand: () => number, kind: number, wantTrue: boolean): StatisticsItem {
  const items = makeSymbols(rand)
  const symbols = items.join('')

  if (kind === 0) {
    const target = '○'
    const count = countOf(items, target)
    const options = numberOptions(count, items.length, rand)
    return {
      type: 'single',
      stem: `数一数：${symbols}，其中 ${target} 有几个？`,
      options,
      answer: options.indexOf(String(count)),
      solution: `${target} 有 ${count} 个。`
    }
  }

  if (kind === 1) {
    const target = '△'
    const count = countOf(items, target)
    const shown = wantTrue ? count : count + (rand() < 0.5 ? 1 : -1)
    const correct = shown === count
    return {
      type: 'judge',
      stem: `数一数：${symbols}，${target} 有 ${shown} 个。`,
      options: ['正确', '错误'],
      answer: correct ? 0 : 1,
      solution: `${target} 有 ${count} 个，这个说法${correct ? '正确' : '错误'}。`
    }
  }

  const target = '□'
  const count = countOf(items, target)
  return {
    type: 'fill',
    stem: `数一数：${symbols}，${target} 有 ____ 个。`,
    answer: [String(count)],
    solution: `${target} 有 ${count} 个。`
  }
}

function distinctCounts(rand: () => number, count: number, min: number, max: number): number[] {
  const values = new Set<number>()
  let guard = 0
  while (values.size < count && guard < 200) {
    guard += 1
    values.add(int(rand, min, max))
  }
  return [...values]
}

function buildTableItem(grade: number, kind: number, wantTrue: boolean, rand: () => number): StatisticsItem {
  const classCount = 4
  const classes = CLASSES.slice(0, classCount)
  const min = grade === 2 ? 5 : 10
  const max = grade === 2 ? 25 : 45
  const counts = distinctCounts(rand, classCount, min, max)
  const text = classes.map((name, index) => `${name}有 ${counts[index]} 人`).join('，')
  const maxIndex = counts.indexOf(Math.max(...counts))

  if (kind === 0) {
    const options = shuffle(classes, rand)
    return {
      type: 'single',
      stem: `${text}。人数最多的班级是？`,
      options,
      answer: options.indexOf(classes[maxIndex]),
      solution: `${classes[maxIndex]}人数最多，有 ${counts[maxIndex]} 人。`
    }
  }

  if (kind === 1) {
    const total = counts.reduce((sum, value) => sum + value, 0)
    return {
      type: 'fill',
      stem: `${text}。一共有 ____ 人。`,
      answer: [String(total)],
      solution: `${counts.join(' + ')} = ${total}（人）`
    }
  }

  const claimTrue = wantTrue
  const claimedIndex = claimTrue
    ? maxIndex
    : (maxIndex + 1 + int(rand, 0, classCount - 2)) % classCount
  return {
    type: 'judge',
    stem: `${text}。${classes[claimedIndex]}的人数最多。`,
    options: ['正确', '错误'],
    answer: claimTrue ? 0 : 1,
    solution: `${classes[maxIndex]}人数最多，有 ${counts[maxIndex]} 人，这个说法${claimTrue ? '正确' : '错误'}。`
  }
}

function makeScores(rand: () => number): { scores: number[]; average: number } {
  let guard = 0
  while (guard < 200) {
    guard += 1
    const base = int(rand, 60, 95)
    const half = rand() < 0.4
    const targetSum = base * 4 + (half ? 2 : 0)
    const scores: number[] = []
    let sum = 0
    for (let index = 0; index < 3; index += 1) {
      const score = int(rand, Math.max(0, base - 12), Math.min(100, base + 12))
      scores.push(score)
      sum += score
    }
    const fourth = targetSum - sum
    if (fourth < 0 || fourth > 100) continue
    scores.push(fourth)
    return { scores: shuffle(scores, rand), average: targetSum / 4 }
  }
  return { scores: [80, 90, 85, 95], average: 87.5 }
}

function averageOptions(correct: number, rand: () => number): string[] {
  const wanted = int(rand, 3, 4)
  const values = new Set<string>([formatNumber(correct)])
  const deltas = [0.5, 1, 1.5, 2, -0.5, -1, -1.5, -2]
  let guard = 0
  while (values.size < wanted && guard < 60) {
    guard += 1
    const candidate = Number((correct + deltas[int(rand, 0, deltas.length - 1)]).toFixed(1))
    if (candidate >= 0 && candidate <= 100) values.add(formatNumber(candidate))
  }
  return shuffle([...values], rand)
}

function buildAverageItem(kind: number, wantTrue: boolean, rand: () => number): StatisticsItem {
  const { scores, average } = makeScores(rand)
  const name = NAMES[int(rand, 0, NAMES.length - 1)]
  const averageText = formatNumber(average)
  const scoreText = scores.join('、')

  if (kind === 0) {
    return {
      type: 'fill',
      stem: `${name}四次数学测验的成绩是 ${scoreText}，平均分是 ____ 分。`,
      answer: [averageText],
      solution: `(${scores.join(' + ')}) ÷ 4 = ${averageText}（分）`
    }
  }

  if (kind === 1) {
    const given = scores.slice(0, 3)
    return {
      type: 'fill',
      stem: `四个数的平均数是 ${averageText}，其中三个是 ${given.join('、')}，第四个数是 ____。`,
      answer: [String(scores[3])],
      solution: `${averageText} × 4 - ${given.join(' - ')} = ${scores[3]}`
    }
  }

  if (kind === 2) {
    const options = averageOptions(average, rand)
    return {
      type: 'single',
      stem: `${name}四次数学测验的成绩是 ${scoreText}，平均分是多少？`,
      options,
      answer: options.indexOf(averageText),
      solution: `(${scores.join(' + ')}) ÷ 4 = ${averageText}（分）`
    }
  }

  const claimTrue = wantTrue
  const delta = Number.isInteger(average)
    ? (rand() < 0.5 ? 1 : -1)
    : (rand() < 0.5 ? 0.5 : -0.5)
  const shown = claimTrue ? average : average + delta
  return {
    type: 'judge',
    stem: `${name}四次数学测验的成绩是 ${scoreText}，平均分是 ${formatNumber(shown)} 分。`,
    options: ['正确', '错误'],
    answer: claimTrue ? 0 : 1,
    solution: `(${scores.join(' + ')}) ÷ 4 = ${averageText}（分），这个说法${claimTrue ? '正确' : '错误'}。`
  }
}

export function generateMathStatistics(ctx: GeneratorContext): number {
  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  const ratioRaw = Number(ctx.options?.params?.trueRatio)
  const useRatio = Number.isFinite(ratioRaw) && ratioRaw >= 0 && ratioRaw <= 100
  let count = 0

  for (let grade = 1; grade <= 6; grade += 1) {
    if (ctx.options?.grade && ctx.options.grade !== grade) continue
    const seen = new Set<string>()
    let generated = 0
    let attempts = 0
    while (generated < limit && attempts < MAX_ATTEMPTS) {
      attempts += 1
      const wantTrue = useRatio ? rand() * 100 < ratioRaw : attempts % 2 === 0
      const item =
        grade === 1
          ? buildItem(rand, attempts % 3, wantTrue)
          : grade <= 3
            ? buildTableItem(grade, attempts % 3, wantTrue, rand)
            : buildAverageItem(attempts % 4, wantTrue, rand)
      if (seen.has(item.stem)) continue
      seen.add(item.stem)

      const inserted = ctx.insert({
        subject: '数学',
        grade,
        topic: TOPIC,
        type: item.type,
        difficulty: difficultyOf(grade),
        stem: item.stem,
        options: item.options,
        answer: item.answer,
        solution: item.solution,
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
