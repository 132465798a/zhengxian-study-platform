import type { SeedContext } from '../seed/types'
import { importAishizhi } from './aishizhi'
import { importTalScq5k } from './talscq5k'
import { importCmath } from './cmath'

export interface ImportAllResult {
  aishizhi: number
  talScq5k: number
  cmath: number
  total: number
}

/**
 * 只导入外部题库。
 * 拼音/笔顺/部首/组词/成语/古诗等由 generators 从 ref_* 表生成，不在此重复导入。
 */
export function importAll(seed: SeedContext): ImportAllResult {
  console.log('=== 开始导入外部题库 ===')

  const aishizhi = importAishizhi(seed)
  const talScq5k = importTalScq5k(seed)
  const cmath = importCmath(seed)

  const total = aishizhi + talScq5k + cmath
  console.log(`=== 外部题库导入完成, 共 ${total} 题 ===`)

  return { aishizhi, talScq5k, cmath, total }
}

export { importAishizhi, importTalScq5k, importCmath }
