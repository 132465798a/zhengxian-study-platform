import type { GeneratorContext } from '../types'

const SOURCE = 'generator:math-thinking'
const TOPIC = '拓展思维'
const SEED = 20261107
const LIMIT = 60
const MAX_ATTEMPTS = 20000
const SHAPES = ['○', '△', '□', '☆']
const NAME_POOLS: string[][] = [
  ['小明', '小红', '小刚', '小宇'],
  ['小丽', '小华', '小强', '小欣'],
  ['小芳', '小军', '小杰', '小然'],
  ['小敏', '小亮', '小宇', '小悦'],
  ['小云', '小虎', '小美', '小宁'],
  ['小雨', '小龙', '小欣', '小航'],
  ['小婷', '小磊', '小峰', '小智'],
  ['小楠', '小凯', '小悦', '小博'],
  ['小冉', '小宁', '小然', '小萱'],
  ['小博', '小萱', '小航', '小智']
]
const CYCLE_PATTERNS: string[][] = [
  ['○', '△', '□'],
  ['△', '□', '○'],
  ['○', '□', '△'],
  ['□', '○', '△'],
  ['○', '○', '△', '□'],
  ['△', '□', '□', '○'],
  ['□', '△', '○', '○']
]

interface ThinkingItem {
  type: 'single' | 'fill'
  stem: string
  options?: string[]
  answer: number | string[]
  solution: string
  score: number
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

function numberOptions(
  correct: number,
  min: number,
  max: number,
  count: number,
  rand: () => number
): string[] {
  const values = new Set<number>([correct])
  let guard = 0
  while (values.size < count && guard < 60) {
    guard += 1
    values.add(int(rand, min, max))
  }
  for (let value = min; values.size < count && value <= max; value += 1) {
    values.add(value)
  }
  return shuffle([...values], rand).map(String)
}

function fillItem(display: number[], next: number, solution: string): ThinkingItem {
  return {
    type: 'fill',
    stem: `找规律填数：${display.join('、')}、____`,
    answer: [String(next)],
    solution,
    score: 2
  }
}

function sequenceItem(grade: number, rand: () => number): ThinkingItem {
  const terms = grade <= 2 ? 4 : 5
  const maxStep = grade === 1 ? 2 : grade === 2 ? 5 : Math.min(grade * 2, 20)
  const modeMax = grade === 1 ? 2 : grade === 2 ? 3 : 4
  const mode = int(rand, 1, modeMax)

  if (mode === 1) {
    const step = int(rand, 1, maxStep)
    const start = int(rand, 0, 20 + grade * 10)
    const display = Array.from({ length: terms }, (_, index) => start + step * index)
    const next = start + step * terms
    return fillItem(
      display,
      next,
      `相邻两项相差 ${step}，${start + step * (terms - 1)} + ${step} = ${next}。`
    )
  }

  if (mode === 2) {
    const step = int(rand, 1, maxStep)
    const start = step * terms + int(rand, 1, 10 + grade * 5)
    const display = Array.from({ length: terms }, (_, index) => start - step * index)
    const next = start - step * terms
    return fillItem(
      display,
      next,
      `相邻两项相差 ${step}，${start - step * (terms - 1)} - ${step} = ${next}。`
    )
  }

  if (mode === 3) {
    const even = rand() < 0.5
    const start = even
      ? 2 * int(rand, 1, 5 + grade * 3)
      : 2 * int(rand, 0, 5 + grade * 3) + 1
    const display = Array.from({ length: terms }, (_, index) => start + 2 * index)
    const next = start + 2 * terms
    return fillItem(
      display,
      next,
      `这是一个${even ? '偶数' : '奇数'}数列，每次加 2，${start + 2 * (terms - 1)} + 2 = ${next}。`
    )
  }

  const base = int(rand, 2, Math.min(grade + 2, 9))
  const start = base * int(rand, 1, 5 + grade)
  const display = Array.from({ length: terms }, (_, index) => start + base * index)
  const next = start + base * terms
  return fillItem(
    display,
    next,
    `这是 ${base} 的倍数序列，${start + base * (terms - 1)} + ${base} = ${next}。`
  )
}

function reasoningItem(index: number, rand: () => number): ThinkingItem {
  const pool = NAME_POOLS[index % NAME_POOLS.length]
  const [first, second, third] = pool
  const aboutHeight = rand() < 0.5
  const askBest = rand() < 0.5

  if (aboutHeight) {
    const target = askBest ? first : third
    const options = shuffle(pool, rand)
    return {
      type: 'single',
      stem: `${first}比${second}高，${second}比${third}高，${askBest ? '谁最高？' : '谁最矮？'}`,
      options,
      answer: options.indexOf(target),
      solution: `${first} 比 ${second} 高，${second} 比 ${third} 高，所以 ${target} 最${askBest ? '高' : '矮'}。`,
      score: 3
    }
  }

  const target = askBest ? first : third
  const options = shuffle(pool, rand)
  return {
    type: 'single',
    stem: `${first}比${second}大，${second}比${third}大，${askBest ? '谁年龄最大？' : '谁年龄最小？'}`,
    options,
    answer: options.indexOf(target),
    solution: `${first} 比 ${second} 大，${second} 比 ${third} 大，所以 ${target} 年龄最${askBest ? '大' : '小'}。`,
    score: 3
  }
}

function shapeItem(rand: () => number): ThinkingItem {
  const length = int(rand, 5, 9)
  const items = Array.from({ length }, () => SHAPES[int(rand, 0, SHAPES.length - 1)])
  const options = numberOptions(length, 1, length + 1, 4, rand)
  return {
    type: 'single',
    stem: `数一数：${items.join('')}，一共有多少个图形？`,
    options,
    answer: options.indexOf(String(length)),
    solution: `一共有 ${length} 个图形。`,
    score: 2
  }
}

function queueItem(rand: () => number): ThinkingItem {
  const front = int(rand, 1, 8)
  const back = int(rand, 1, 8)
  const total = front + back + 1
  const options = numberOptions(total, 2, total + 2, 4, rand)
  return {
    type: 'single',
    stem: `小朋友们排队，小明前面有 ${front} 人，后面有 ${back} 人，这一队一共有几人？`,
    options,
    answer: options.indexOf(String(total)),
    solution: `${front} + ${back} + 1 = ${total}（人）`,
    score: 2
  }
}

function cycleItem(grade: number, rand: () => number): ThinkingItem {
  const pool = grade <= 4 ? CYCLE_PATTERNS.slice(0, 4) : CYCLE_PATTERNS
  const pattern = pool[int(rand, 0, pool.length - 1)]
  const position = int(rand, 8, 40)
  const index = (position - 1) % pattern.length
  const target = pattern[index]
  const distinct = [...new Set(pattern)]
  const optionPool = [...distinct, ...SHAPES.filter((shape) => !distinct.includes(shape))].slice(0, 4)
  const options = shuffle(optionPool, rand)
  return {
    type: 'single',
    stem: `按 ${pattern.join('')} 的顺序排列，第 ${position} 个是？`,
    options,
    answer: options.indexOf(target),
    solution: `每 ${pattern.length} 个图形为一组，(${position} - 1) ÷ ${pattern.length} = ${Math.floor((position - 1) / pattern.length)} 余 ${index}，所以第 ${position} 个是 ${target}。`,
    score: 3
  }
}

function buildItem(grade: number, index: number, rand: () => number): ThinkingItem {
  const mode = int(rand, 1, 4)
  if (mode === 1) return sequenceItem(grade, rand)
  if (mode === 2) return reasoningItem(index, rand)
  if (grade <= 2) return mode === 3 ? shapeItem(rand) : queueItem(rand)
  return cycleItem(grade, rand)
}

export function generateMathThinking(ctx: GeneratorContext): number {
  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const limit = ctx.options?.limit ?? LIMIT
  let count = 0

  for (let grade = 1; grade <= 6; grade += 1) {
    if (ctx.options?.grade && ctx.options.grade !== grade) continue
    const seen = new Set<string>()
    let generated = 0
    let attempts = 0
    while (generated < limit && attempts < MAX_ATTEMPTS) {
      attempts += 1
      const item = buildItem(grade, attempts, rand)
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
        score: item.score,
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
