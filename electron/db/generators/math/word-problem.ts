import type { GeneratorContext } from '../types'

const SOURCE = 'generator:math-word-problem'
const TOPIC = '应用题'
const SEED = 20261108
const LIMIT = 200
const MAX_ATTEMPTS = 20000
const NAMES = ['小明', '小红', '小刚', '小丽', '小华', '小强', '小芳', '小军', '小杰', '小敏']

interface Thing {
  name: string
  unit: string
}

interface Good {
  name: string
  unit: string
  each: string
}

const THINGS: Thing[] = [
  { name: '苹果', unit: '个' },
  { name: '铅笔', unit: '支' },
  { name: '本子', unit: '本' },
  { name: '糖果', unit: '颗' },
  { name: '气球', unit: '个' },
  { name: '贴纸', unit: '张' },
  { name: '橘子', unit: '个' },
  { name: '饼干', unit: '块' },
  { name: '鸡蛋', unit: '个' },
  { name: '小汽车', unit: '辆' }
]

const GOODS: Good[] = [
  { name: '书', unit: '本', each: '每本书' },
  { name: '铅笔', unit: '支', each: '每支铅笔' },
  { name: '练习本', unit: '本', each: '每本练习本' },
  { name: '面包', unit: '个', each: '每个面包' },
  { name: '牛奶', unit: '盒', each: '每盒牛奶' },
  { name: '笔记本', unit: '本', each: '每本笔记本' }
]

interface WordProblemItem {
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

function integerOptions(correct: number, rand: () => number): string[] {
  const wanted = 4
  const values = new Set<number>([correct])
  const deltas = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 10, -10]
  let guard = 0
  while (values.size < wanted && guard < 80) {
    guard += 1
    const candidate = correct + deltas[int(rand, 0, deltas.length - 1)]
    if (candidate >= 0) values.add(candidate)
  }
  for (let value = 0; values.size < wanted && value <= correct + 20; value += 1) {
    values.add(value)
  }
  return shuffle([...values], rand).map(String)
}

function pickTwoNames(rand: () => number): [string, string] {
  const first = int(rand, 0, NAMES.length - 1)
  let second = int(rand, 0, NAMES.length - 2)
  if (second >= first) second += 1
  return [NAMES[first], NAMES[second]]
}

function buildPrimaryItem(kind: number, rand: () => number): WordProblemItem {
  const thing = THINGS[int(rand, 0, THINGS.length - 1)]
  const [first, second] = pickTwoNames(rand)
  const unit = thing.unit

  if (kind === 0) {
    const a = int(rand, 1, 25)
    const b = int(rand, 1, 30 - a)
    const total = a + b
    return {
      type: 'fill',
      stem: `${first}有 ${a} ${unit}${thing.name}，${second}又给了他 ${b} ${unit}，现在一共有 ____ ${unit}。`,
      answer: [String(total)],
      solution: `${a} + ${b} = ${total}（${unit}）`,
      score: 2
    }
  }

  if (kind === 1) {
    const a = int(rand, 2, 30)
    const b = int(rand, 1, a)
    const left = a - b
    return {
      type: 'fill',
      stem: `${first}有 ${a} ${unit}${thing.name}，送给${second} ${b} ${unit}，还剩 ____ ${unit}。`,
      answer: [String(left)],
      solution: `${a} - ${b} = ${left}（${unit}）`,
      score: 2
    }
  }

  if (kind === 2) {
    const a = int(rand, 1, 15)
    const b = int(rand, 1, 15)
    const total = a + b
    return {
      type: 'fill',
      stem: `${first}有 ${a} ${unit}${thing.name}，${second}有 ${b} ${unit}，两人一共有 ____ ${unit}。`,
      answer: [String(total)],
      solution: `${a} + ${b} = ${total}（${unit}）`,
      score: 2
    }
  }

  const a = int(rand, 2, 30)
  const b = int(rand, 1, a - 1)
  const diff = a - b
  return {
    type: 'fill',
    stem: `${first}有 ${a} ${unit}${thing.name}，${second}有 ${b} ${unit}，${first}比${second}多 ____ ${unit}。`,
    answer: [String(diff)],
    solution: `${a} - ${b} = ${diff}（${unit}）`,
    score: 2
  }
}

function buildMiddleItem(kind: number, rand: () => number): WordProblemItem {
  const thing = THINGS[int(rand, 0, THINGS.length - 1)]
  const unit = thing.unit

  if (kind === 0) {
    const perBox = int(rand, 2, 12)
    const boxes = int(rand, 2, 9)
    const total = perBox * boxes
    return {
      type: 'fill',
      stem: `每盒有 ${perBox} ${unit}${thing.name}，${boxes} 盒一共有 ____ ${unit}。`,
      answer: [String(total)],
      solution: `${perBox} × ${boxes} = ${total}（${unit}）`,
      score: 2
    }
  }

  if (kind === 1) {
    const kids = int(rand, 2, 9)
    const each = int(rand, 2, 12)
    const total = kids * each
    return {
      type: 'fill',
      stem: `把 ${total} ${unit}${thing.name}平均分给 ${kids} 个小朋友，每人分到 ____ ${unit}。`,
      answer: [String(each)],
      solution: `${total} ÷ ${kids} = ${each}（${unit}）`,
      score: 2
    }
  }

  if (kind === 2) {
    const perBox = int(rand, 2, 9)
    const boxes = int(rand, 2, 12)
    const total = perBox * boxes
    return {
      type: 'fill',
      stem: `${total} ${unit}${thing.name}，每 ${perBox} ${unit}装一盒，可以装 ____ 盒。`,
      answer: [String(boxes)],
      solution: `${total} ÷ ${perBox} = ${boxes}（盒）`,
      score: 2
    }
  }

  const perBox = int(rand, 2, 12)
  const boxes = int(rand, 2, 9)
  const total = perBox * boxes
  const options = integerOptions(total, rand)
  return {
    type: 'single',
    stem: `每盒有 ${perBox} ${unit}${thing.name}，${boxes} 盒一共有多少${unit}？`,
    options,
    answer: options.indexOf(String(total)),
    solution: `${perBox} × ${boxes} = ${total}（${unit}）`,
    score: 2
  }
}

function buildSeniorItem(kind: number, rand: () => number): WordProblemItem {
  if (kind === 0) {
    const good = GOODS[int(rand, 0, GOODS.length - 1)]
    const price = int(rand, 2, 20)
    const count = int(rand, 2, 9)
    const total = price * count
    return {
      type: 'fill',
      stem: `${good.each} ${price} 元，买 ${count} ${good.unit}需要 ____ 元。`,
      answer: [String(total)],
      solution: `${price} × ${count} = ${total}（元）`,
      score: 2
    }
  }

  if (kind === 1) {
    const good = GOODS[int(rand, 0, GOODS.length - 1)]
    const price = int(rand, 2, 20)
    const count = int(rand, 2, 9)
    const total = price * count
    const options = integerOptions(total, rand)
    return {
      type: 'single',
      stem: `${good.each} ${price} 元，买 ${count} ${good.unit}一共需要多少元？`,
      options,
      answer: options.indexOf(String(total)),
      solution: `${price} × ${count} = ${total}（元）`,
      score: 2
    }
  }

  if (kind === 2) {
    const speed = int(rand, 40, 80)
    const hours = int(rand, 2, 6)
    const distance = speed * hours
    return {
      type: 'fill',
      stem: `汽车每小时行 ${speed} 千米，${hours} 小时行 ____ 千米。`,
      answer: [String(distance)],
      solution: `${speed} × ${hours} = ${distance}（千米）`,
      score: 2
    }
  }

  if (kind === 3) {
    const buyer = NAMES[int(rand, 0, NAMES.length - 1)]
    const price = int(rand, 2, 15)
    const count = int(rand, 2, 6)
    const total = price * count
    const paid = Math.ceil((total + int(rand, 5, 40)) / 5) * 5
    const change = paid - total
    return {
      type: 'fill',
      stem: `${buyer}买了 ${count} 本练习本，每本 ${price} 元，付了 ${paid} 元，应找回 ____ 元。`,
      answer: [String(change)],
      solution: `${price} × ${count} = ${total}（元），${paid} - ${total} = ${change}（元）`,
      score: 3
    }
  }

  if (kind === 4) {
    const speed = int(rand, 40, 80)
    const hours = int(rand, 2, 6)
    const remain = int(rand, 10, 120)
    const distance = speed * hours + remain
    return {
      type: 'fill',
      stem: `汽车每小时行 ${speed} 千米，行了 ${hours} 小时，离目的地还有 ${remain} 千米，全程 ____ 千米。`,
      answer: [String(distance)],
      solution: `${speed} × ${hours} = ${speed * hours}（千米），${speed * hours} + ${remain} = ${distance}（千米）`,
      score: 3
    }
  }

  const good = GOODS[int(rand, 0, GOODS.length - 1)]
  const price = int(rand, 2, 20)
  const count = int(rand, 2, 9)
  const total = price * count
  return {
    type: 'fill',
    stem: `买 ${count} ${good.unit}${good.name}一共花了 ${total} 元，${good.each} ____ 元。`,
    answer: [String(price)],
    solution: `${total} ÷ ${count} = ${price}（元）`,
    score: 2
  }
}

export function generateMathWordProblem(ctx: GeneratorContext): number {
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
      const item =
        grade <= 2
          ? buildPrimaryItem(attempts % 4, rand)
          : grade <= 4
            ? buildMiddleItem(attempts % 4, rand)
            : buildSeniorItem(attempts % 6, rand)
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
