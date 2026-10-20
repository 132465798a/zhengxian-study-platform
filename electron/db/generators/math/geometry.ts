import type { GeneratorContext } from '../types'
import { accepts } from '../types'

const SOURCE = 'generator:geometry'
const TOPIC = '图形与几何'
const SEED = 20261105
const LIMIT = 200
const MAX_ATTEMPTS = 15000

interface GeometryItem {
  stem: string
  answer: number
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

function fmt(value: number): string {
  return String(Number(value.toFixed(2)))
}

function difficultyOf(grade: number): number {
  if (grade <= 2) return 1
  if (grade <= 4) return 2
  return 3
}

function rectangleItem(rand: () => number, withArea: boolean): GeometryItem {
  const long = int(rand, 4, 30)
  const short = int(rand, 2, long - 1)
  if (!withArea || rand() < 0.5) {
    const answer = 2 * (long + short)
    return {
      stem: `一个长方形的长是 ${long} 厘米，宽是 ${short} 厘米，它的周长是多少厘米？`,
      answer,
      solution: `(长 + 宽) × 2 = (${long} + ${short}) × 2 = ${answer}（厘米）`
    }
  }
  const answer = long * short
  return {
    stem: `一个长方形的长是 ${long} 厘米，宽是 ${short} 厘米，它的面积是多少平方厘米？`,
    answer,
    solution: `长 × 宽 = ${long} × ${short} = ${answer}（平方厘米）`
  }
}

function squareItem(rand: () => number, withArea: boolean): GeometryItem {
  const side = int(rand, 2, 20)
  if (!withArea || rand() < 0.5) {
    const answer = 4 * side
    return {
      stem: `一个正方形的边长是 ${side} 分米，它的周长是多少分米？`,
      answer,
      solution: `边长 × 4 = ${side} × 4 = ${answer}（分米）`
    }
  }
  const answer = side * side
  return {
    stem: `一个正方形的边长是 ${side} 分米，它的面积是多少平方分米？`,
    answer,
    solution: `边长 × 边长 = ${side} × ${side} = ${answer}（平方分米）`
  }
}

function triangleItem(rand: () => number): GeometryItem {
  const base = int(rand, 2, 20)
  const height = int(rand, 2, 15)
  const answer = Number(((base * height) / 2).toFixed(2))
  return {
    stem: `一个三角形的底是 ${base} 厘米，高是 ${height} 厘米，它的面积是多少平方厘米？`,
    answer,
    solution: `底 × 高 ÷ 2 = ${base} × ${height} ÷ 2 = ${fmt(answer)}（平方厘米）`
  }
}

function parallelogramItem(rand: () => number): GeometryItem {
  const base = int(rand, 2, 20)
  const height = int(rand, 2, 15)
  const answer = base * height
  return {
    stem: `一个平行四边形的底是 ${base} 厘米，高是 ${height} 厘米，它的面积是多少平方厘米？`,
    answer,
    solution: `底 × 高 = ${base} × ${height} = ${answer}（平方厘米）`
  }
}

function cuboidItem(rand: () => number): GeometryItem {
  const length = int(rand, 3, 12)
  const width = int(rand, 2, 10)
  const height = int(rand, 2, 8)
  const answer = length * width * height
  return {
    stem: `一个长方体的长是 ${length} 厘米，宽是 ${width} 厘米，高是 ${height} 厘米，它的体积是多少立方厘米？`,
    answer,
    solution: `长 × 宽 × 高 = ${length} × ${width} × ${height} = ${answer}（立方厘米）`
  }
}

function cubeItem(rand: () => number): GeometryItem {
  const edge = int(rand, 2, 12)
  const answer = edge * edge * edge
  return {
    stem: `一个正方体的棱长是 ${edge} 厘米，它的体积是多少立方厘米？`,
    answer,
    solution: `棱长 × 棱长 × 棱长 = ${edge} × ${edge} × ${edge} = ${answer}（立方厘米）`
  }
}

function circleItem(rand: () => number): GeometryItem {
  const radius = int(rand, 1, 20)
  if (rand() < 0.5) {
    const answer = Number((2 * 3.14 * radius).toFixed(2))
    return {
      stem: `一个圆的半径是 ${radius} 厘米，它的周长是多少厘米？（π 取 3.14）`,
      answer,
      solution: `2 × 3.14 × ${radius} = ${fmt(answer)}（厘米）`
    }
  }
  const answer = Number((3.14 * radius * radius).toFixed(2))
  return {
    stem: `一个圆的半径是 ${radius} 厘米，它的面积是多少平方厘米？（π 取 3.14）`,
    answer,
    solution: `3.14 × ${radius} × ${radius} = ${fmt(answer)}（平方厘米）`
  }
}

function buildItem(grade: number, rand: () => number): GeometryItem {
  const builders: Array<() => GeometryItem> = [
    () => rectangleItem(rand, grade >= 3),
    () => squareItem(rand, grade >= 3)
  ]
  if (grade >= 4) {
    builders.push(() => triangleItem(rand), () => parallelogramItem(rand))
  }
  if (grade >= 5) {
    builders.push(() => cuboidItem(rand), () => cubeItem(rand))
  }
  if (grade >= 6) {
    builders.push(() => circleItem(rand))
  }
  return builders[int(rand, 0, builders.length - 1)]()
}

export function generateGeometry(ctx: GeneratorContext): number {
  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  let count = 0

  for (let grade = 1; grade <= 6; grade += 1) {
    if (!accepts(ctx.options, 'calculation', grade)) continue
    const seen = new Set<string>()
    let generated = 0
    let attempts = 0
    while (generated < LIMIT && attempts < MAX_ATTEMPTS) {
      attempts += 1
      const item = buildItem(grade, rand)
      if (seen.has(item.stem)) continue
      seen.add(item.stem)
      const inserted = ctx.insert({
        subject: '数学',
        grade,
        topic: TOPIC,
        type: 'calculation',
        difficulty: difficultyOf(grade),
        stem: item.stem,
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
