import { join } from 'node:path'
import { runtimeConfig } from '../../config'

/**
 * 数据集目录解析。
 * 运行时不再读取 datasets，只有构建题库库（scripts/build-bank.ts）时使用，
 * 通过 STUDY_DATASETS_DIR 指定根目录。
 */
export function datasetPath(...segments: string[]): string {
  return join(runtimeConfig.datasetsDir, ...segments)
}
