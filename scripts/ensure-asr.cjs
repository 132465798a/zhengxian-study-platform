const { createWriteStream, existsSync, mkdirSync, renameSync, statSync, unlinkSync } = require('node:fs')
const { join } = require('node:path')
const https = require('node:https')

const DIR = join('build', 'asr', 'sherpa-onnx-nemo-ctc-en-conformer-small')
const BASE = 'https://hf-mirror.com/csukuangfj/sherpa-onnx-nemo-ctc-en-conformer-small/resolve/main'
const FILES = [
  ['model.int8.onnx', `${BASE}/model.int8.onnx`],
  ['tokens.txt', `${BASE}/tokens.txt`]
]
const REQUIRED = process.argv.includes('--required')

function ready(file) {
  if (!existsSync(file)) return false
  try {
    return statSync(file).size > 0
  } catch {
    return false
  }
}

function download(url, target, redirects = 5) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume()
        if (redirects <= 0) return reject(new Error('重定向次数过多'))
        return resolve(download(response.headers.location, target, redirects - 1))
      }
      if (response.statusCode !== 200) {
        response.resume()
        return reject(new Error(`下载失败：HTTP ${response.statusCode}`))
      }

      const expected = Number(response.headers['content-length'] ?? 0)
      const temp = `${target}.part`
      const out = createWriteStream(temp)
      let received = 0

      response.on('data', (chunk) => {
        received += chunk.length
      })
      response.on('aborted', () => fail(new Error('下载中断')))
      response.pipe(out)

      out.on('finish', () => {
        out.close(() => {
          if (expected > 0 && received !== expected) {
            return fail(new Error(`文件不完整：${received}/${expected}`))
          }
          renameSync(temp, target)
          resolve()
        })
      })
      out.on('error', fail)

      function fail(error) {
        try {
          unlinkSync(temp)
        } catch {
          // 忽略清理失败
        }
        reject(error)
      }
    })

    request.setTimeout(30000, () => {
      request.destroy(new Error('下载超时'))
    })
    request.on('error', reject)
  })
}

async function main() {
  const required = FILES.map(([name]) => join(DIR, name))
  if (required.every(ready)) return
  mkdirSync(DIR, { recursive: true })
  console.log('[asr] 首次运行，下载本地英语识别模型（约 45MB）')
  for (const [name, url] of FILES) {
    const target = join(DIR, name)
    if (ready(target)) continue
    console.log(`[asr] 下载 ${name}`)
    await download(url, target)
  }
  if (!required.every(ready)) throw new Error('模型文件校验失败')
  console.log('[asr] 模型准备完成')
}

main().catch((error) => {
  console.warn(`[asr] 模型准备失败：${error.message}`)
  if (REQUIRED) {
    console.error('[asr] 发布构建需要本地识别模型，已终止')
    process.exitCode = 1
    return
  }
  console.warn('[asr] 应用仍可启动，跟读将回退到系统识别或仅录音回放')
})
