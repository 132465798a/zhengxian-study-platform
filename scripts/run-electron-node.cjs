/**
 * 用 Electron 的 Node 运行时执行脚本，保证 better-sqlite3 的 ABI 匹配。
 * 用法：node scripts/run-electron-node.cjs .tmp/build-bank.cjs
 */
const { spawnSync } = require('node:child_process')
const { join } = require('node:path')

const electron = join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe')
const target = process.argv[2]

if (!target) {
  console.error('用法：node scripts/run-electron-node.cjs <script.cjs>')
  process.exit(1)
}

const result = spawnSync(electron, [target, ...process.argv.slice(3)], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})
process.exit(result.status ?? 1)
