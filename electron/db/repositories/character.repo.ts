import { app } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import cnchar from 'cnchar'
import radical from 'cnchar-radical'
import order from 'cnchar-order'
import words from 'cnchar-words'
import poly from 'cnchar-poly'
import idiom from 'cnchar-idiom'
import trad from 'cnchar-trad'
import code from 'cnchar-code'
import info from 'cnchar-info'
import input from 'cnchar-input'
import explain from 'cnchar-explain'
import { getDb } from '../connection'
import { strokeGlyphOf } from '../generators/chinese/stroke-glyph'
import type {
  CharacterCode,
  CharacterDetail,
  CharacterSummary,
  CharacterStroke
} from '../../../shared/types'

cnchar.use(radical)
cnchar.use(order)
cnchar.use(words)
cnchar.use(poly)
cnchar.use(idiom)
cnchar.use(trad)
cnchar.use(input)
cnchar.use(code)
cnchar.use(info)
cnchar.use(explain)

// unpkg 的 latest 会 302，cnchar-explain 的 node 请求不跟随跳转，这里固定版本与镜像
cnchar.explain.setResourceBase('https://registry.npmmirror.com/cnchar-data/1.1.0/files/explanation/')

interface HanziRow {
  char: string
  grade: number
}

interface RawStroke {
  name?: string
  shape?: string
  type?: string
  foldCount?: string | number
}

interface RadicalInfo {
  radical: string
  radicalCount: number
  structure: string
}

// cnchar-radical 缺少这些字的部首数据，按汉典补齐
const RADICAL_FALLBACK: Record<string, RadicalInfo> = {
  仇: { radical: '亻', radicalCount: 2, structure: '左右结构' },
  刀: { radical: '刀', radicalCount: 2, structure: '独体结构' },
  刺: { radical: '刂', radicalCount: 2, structure: '左右结构' },
  剑: { radical: '刂', radicalCount: 2, structure: '左右结构' },
  叉: { radical: '又', radicalCount: 2, structure: '独体结构' },
  币: { radical: '巾', radicalCount: 3, structure: '上下结构' },
  弹: { radical: '弓', radicalCount: 3, structure: '左右结构' },
  杀: { radical: '木', radicalCount: 4, structure: '上下结构' },
  枪: { radical: '木', radicalCount: 4, structure: '左右结构' },
  棍: { radical: '木', radicalCount: 4, structure: '左右结构' },
  棒: { radical: '木', radicalCount: 4, structure: '左右结构' },
  死: { radical: '歹', radicalCount: 4, structure: '左右结构' },
  毒: { radical: '母', radicalCount: 5, structure: '上下结构' },
  炮: { radical: '火', radicalCount: 4, structure: '左右结构' },
  炸: { radical: '火', radicalCount: 4, structure: '左右结构' },
  爆: { radical: '火', radicalCount: 4, structure: '左右结构' },
  箭: { radical: '竹', radicalCount: 6, structure: '上下结构' }
}

function textOf(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '')
  return value == null ? '' : String(value)
}

function infoText(value: unknown): string | null {
  const text = textOf(value).trim()
  return text && text !== '-' ? text : null
}

function strokeDetails(char: string): CharacterStroke[] {
  const raw = cnchar.stroke(char, 'order', 'detail')
  if (!Array.isArray(raw) || raw.length === 0) return []
  const list = (Array.isArray(raw[0]) ? raw[0] : raw) as RawStroke[]
  return list.map((item) => {
    const name = String(item.name ?? '').trim()
    const shape = String(item.shape ?? '').trim()
    return {
      name,
      glyph: shape || strokeGlyphOf(name) || '',
      type: item.type ? String(item.type) : null,
      foldCount: item.foldCount == null ? null : Number(item.foldCount)
    }
  })
}

function polyphonicOf(char: string): string[] {
  const raw = cnchar.spell(char, 'tone', 'low', 'poly', 'array')
  const text = Array.isArray(raw) ? String(raw[0] ?? '') : String(raw ?? '')
  return text
    .replace(/[()]/g, '')
    .split('|')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function codesOf(char: string): CharacterCode {
  const raw = cnchar.code(char)
  const item = Array.isArray(raw) ? raw[0] : null
  return {
    unicode: item?.unicode ?? '',
    gbk: item?.gbk ?? '',
    sijiao: item?.sijiao ?? '',
    cangjie: item?.cangjie ?? '',
    fiveStroke: item?.fiveStroke ?? '',
    uniform: item?.uniform ?? ''
  }
}

export function listCharacters(grade: number): CharacterSummary[] {
  return getDb()
    .prepare('SELECT char, grade FROM bank.ref_hanzi WHERE grade = ? ORDER BY char')
    .all(grade) as HanziRow[]
}

export function getCharacterDetail(char: string): CharacterDetail | null {
  if (!char || [...char].length !== 1 || !cnchar.isCnChar(char)) return null

  const pinyin = textOf(cnchar.spell(char, 'tone', 'low'))
  const polyphonic = polyphonicOf(char)
  const spellInfo = cnchar.spellInfo(pinyin)
  const radicalInfo = cnchar.radical(char)
  const radicalItem = Array.isArray(radicalInfo) ? radicalInfo[0] : null
  const radicalFallback = RADICAL_FALLBACK[char] ?? null
  const strokes = strokeDetails(char)
  const wordList = cnchar.words(char)
  const idiomList = cnchar.idiom([char, '', '', ''])
  const traditional = cnchar.convert.simpleToTrad(char)
  const infoRaw = cnchar.info(char)
  const infoItem = Array.isArray(infoRaw) ? infoRaw[0] : null
  const fiveElement = infoText(infoItem?.fiveElement)
  const method = infoText(infoItem?.method)
  const markSpell = infoText(infoItem?.markSpell)

  return {
    char,
    pinyin,
    initial: spellInfo?.initial ?? '',
    final: spellInfo?.final ?? '',
    tone: spellInfo?.tone ?? 0,
    polyphonic: polyphonic.length > 0 ? polyphonic : [pinyin],
    isPolyphonic: cnchar.isPolyWord(char),
    radical: radicalItem?.radical || radicalFallback?.radical || null,
    radicalCount: radicalItem?.radicalCount || radicalFallback?.radicalCount || null,
    structure: radicalItem?.struct || radicalFallback?.structure || null,
    strokeCount: Number(cnchar.stroke(char)) || strokes.length,
    strokes,
    words: Array.isArray(wordList) ? wordList.slice(0, 12) : [],
    idioms: Array.isArray(idiomList) ? idiomList.slice(0, 8) : [],
    traditional: traditional && traditional !== char ? traditional : null,
    fiveElement,
    method,
    markSpell,
    codes: codesOf(char)
  }
}

export async function explainWord(word: string): Promise<string | null> {
  try {
    const text = await Promise.race([
      cnchar.explain(word),
      new Promise<string>((resolve) => setTimeout(() => resolve(''), 5000))
    ])
    const trimmed = String(text ?? '').trim()
    return trimmed.length > 0 ? trimmed : null
  } catch {
    return null
  }
}

export function readStrokeData(char: string): string | null {
  if (!char || [...char].length !== 1) return null
  const file = join(app.getAppPath(), 'node_modules', 'hanzi-writer-data', `${char}.json`)
  if (!existsSync(file)) return null
  return readFileSync(file, 'utf8')
}
