/**
 * 开发启动前确保题库库存在；不存在则构建一次。
 */
const { existsSync } = require('node:fs')
const { spawnSync } = require('node:child_process')
const { join } = require('node:path')

const root = join(__dirname, '..')
const bankFile = join(root, 'build', 'bank.db')

if (existsSync(bankFile)) process.exit(0)

console.log('[bank] 未发现 build/bank.db，开始构建…')
const build = spawnSync('npm', ['run', 'seed:build'], {
  cwd: root,
  stdio: 'inherit',
  shell: true
})
process.exit(build.status ?? 1)
