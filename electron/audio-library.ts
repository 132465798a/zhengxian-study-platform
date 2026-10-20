import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

/** 词表发音库目录：开发时在 build/audio，打包后在 resources/audio */
function libraryDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'audio', 'en')
    : join(app.getAppPath(), 'build', 'audio', 'en')
}

export interface BundledAudio {
  audio: string
  mime: string
}

/** 查找预生成发音，找不到时返回 null，由调用方走在线合成 */
export function findBundledAudio(text: string): BundledAudio | null {
  const content = text.trim()
  if (!content) return null
  const key = createHash('sha1').update(content).digest('hex')
  const file = join(libraryDir(), `${key}.mp3`)
  if (!existsSync(file)) return null
  return { audio: readFileSync(file).toString('base64'), mime: 'audio/mpeg' }
}
