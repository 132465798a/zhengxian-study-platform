import { join } from 'node:path'

/** 运行期配置集中入口，避免各模块散读 process.env */
export const runtimeConfig = {
  /** 开发/测试时覆盖题库库路径 */
  bankPath: process.env.STUDY_BANK_PATH ?? '',
  /** 构建题库时使用的数据目录 */
  datasetsDir: process.env.STUDY_DATASETS_DIR ?? join(process.cwd(), 'datasets'),
  /** electron-vite 开发服务器地址 */
  rendererUrl: process.env.ELECTRON_RENDERER_URL ?? '',
  /** 打印压测时把 PDF 写到固定路径 */
  printTestOutput: process.env.PRINT_TEST_OUTPUT ?? ''
}
