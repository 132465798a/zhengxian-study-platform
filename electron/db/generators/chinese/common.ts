export function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function difficultyOf(grade: number): number {
  if (grade <= 2) return 1
  if (grade <= 4) return 2
  return 3
}

export function gradeOf(id: number): number {
  return ((id - 1) % 6) + 1
}

export function parseWords(raw: string): string[] {
  const text = raw.includes('=') ? raw.slice(raw.indexOf('=') + 1) : raw
  return [
    ...new Set(
      text
        .split(/\s+/)
        .map((item) => item.trim())
        .filter((item) => /^[\u4e00-\u9fa5]+$/.test(item))
    )
  ]
}

export function shorten(text: string, max: number): string {
  const clean = text.replace(/\s+/g, '').replace(/[。；;]+$/, '')
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

export function groupBy<T>(items: T[], keyOf: (item: T) => number): Map<number, T[]> {
  const groups = new Map<number, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const list = groups.get(key)
    if (list) list.push(item)
    else groups.set(key, [item])
  }
  return groups
}
