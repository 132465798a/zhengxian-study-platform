/**
 * 笔画名称 → Unicode 笔画字符（CJK Strokes）。
 * cnchar 返回的是「横折」这类名称，练习里直接显示名称不够直观，
 * 这里统一转换成真实笔画形状；无对应字符的笔画返回 null，生成器会跳过该字。
 */
const STROKE_GLYPHS: Record<string, string> = {
  横: '㇐',
  竖: '㇑',
  撇: '㇒',
  捺: '㇏',
  点: '㇔',
  提: '㇀',
  横折: '㇕',
  横钩: '㇖',
  竖折: '㇗',
  竖弯: '㇄',
  弯钩: '㇁',
  斜钩: '㇂',
  卧钩: '㇃',
  横撇: '㇇',
  横折钩: '㇆',
  横折提: '㇊',
  横折折: '㇅',
  横折折撇: '㇋',
  横折折折钩: '㇡',
  竖折折钩: '㇉',
  竖提: '㇙',
  竖钩: '㇚',
  撇点: '㇛',
  撇折: '㇜',
  竖弯钩: '㇟',
  横斜钩: '㇠'
}

export function strokeGlyphOf(name: string): string | null {
  return STROKE_GLYPHS[name] ?? null
}

export function toStrokeGlyphs(names: string[]): string[] | null {
  const glyphs: string[] = []
  for (const name of names) {
    const glyph = strokeGlyphOf(name)
    if (!glyph) return null
    glyphs.push(glyph)
  }
  return glyphs
}
