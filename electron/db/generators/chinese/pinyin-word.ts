import cnchar from 'cnchar'
import { accepts } from '../types'
import type { GeneratorContext } from '../types'

const SOURCE = 'generator:pinyin-word'
const TOPIC = '看拼音写词语'
const SEED = 20261022
const LIMIT = 120

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
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function pinyinOf(char: string): string {
  const result = cnchar.spell(char, 'array', 'tone')
  if (!Array.isArray(result) || result.length === 0) return ''
  return String(result[0]).trim().toLowerCase()
}

export function generatePinyinWord(ctx: GeneratorContext): number {
  const rand = mulberry32(SEED + (ctx.options?.seed ?? 0))
  const seen = new Set<string>()
  let count = 0

  for (const grade of [1, 2, 3, 4, 5, 6]) {
    if (!accepts(ctx.options, 'pinyin_word', grade)) continue
    // ref_word 由构建期的试卷/成语语料筛出，避免出现「色情」「本厂」这类随机组词
    const rows = ctx.db
      .prepare('SELECT word FROM ref_word WHERE grade = ? ORDER BY word')
      .all(grade) as Array<{ word: string }>
    const pool = shuffle(
      rows.map((row) => row.word),
      rand
    )
    let generated = 0

    for (const word of pool) {
      if (generated >= LIMIT) break
      if (seen.has(word)) continue
      const chars = word.split('')
      const pinyin = chars.map(pinyinOf)
      if (pinyin.some((item) => !item)) continue

      const inserted = ctx.insert({
        subject: '语文',
        grade,
        topic: TOPIC,
        type: 'pinyin_word',
        difficulty: grade <= 2 ? 1 : grade <= 4 ? 2 : 3,
        stem: '看拼音写词语',
        options: { words: [{ pinyin, chars }] },
        answer: [word],
        solution: `${pinyin.join(' ')} → ${word}`,
        score: 2,
        source: SOURCE
      })
      if (inserted) {
        seen.add(word)
        generated += 1
        count += 1
      }
    }
  }

  return count
}
