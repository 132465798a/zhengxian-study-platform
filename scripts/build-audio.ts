/**
 * 生成英语离线发音库：词表内的单词与例句预合成 MP3，随安装包分发。
 * 断网或系统缺少英文音色时仍可正常播放。
 * 用法：npm run audio:build [-- --limit=20] [-- --force]
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

const VOICE = 'en-US-AriaNeural'
const RATE = '-10%'
const OUTPUT_DIR = join('build', 'audio', 'en')
const CONCURRENCY = 4
const MAX_ATTEMPTS = 4

const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))
const LIMIT = limitArg ? Number(limitArg.slice('--limit='.length)) : 0
const FORCE = process.argv.includes('--force')

interface WordRow {
  word: string
  sentence: string | null
}

function audioFile(text: string): string {
  const key = createHash('sha1').update(text).digest('hex')
  return join(OUTPUT_DIR, `${key}.mp3`)
}

function ready(file: string): boolean {
  return existsSync(file) && statSync(file).size > 0
}

function collectTexts(): string[] {
  const db = new Database(join('build', 'bank.db'), { readonly: true })
  try {
    const rows = db.prepare('SELECT word, sentence FROM ref_english_word').all() as WordRow[]
    const texts = new Set<string>()
    for (const row of rows) {
      const word = row.word?.trim()
      const sentence = row.sentence?.trim()
      if (word) texts.add(word)
      if (sentence) texts.add(sentence)
    }
    return [...texts]
  } finally {
    db.close()
  }
}

function synth(client: MsEdgeTTS, text: string): Promise<Buffer> {
  const { audioStream } = client.toStream(text, { rate: RATE })
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    const timer = setTimeout(() => reject(new Error('语音合成超时')), 30000)
    audioStream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
    audioStream.on('end', () => {
      clearTimeout(timer)
      const audio = Buffer.concat(chunks)
      if (audio.length === 0) reject(new Error('语音合成结果为空'))
      else resolve(audio)
    })
    audioStream.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

async function createClient(): Promise<MsEdgeTTS> {
  let lastError: unknown = null
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const client = new MsEdgeTTS({ connectionTimeoutMs: 10000, synthesisTimeoutMs: 30000 })
      await client.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
      return client
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 1200 * attempt))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Edge 连接失败')
}

async function main(): Promise<void> {
  if (!existsSync(join('build', 'bank.db'))) throw new Error('缺少 build/bank.db，请先执行 seed:build')
  mkdirSync(OUTPUT_DIR, { recursive: true })

  let queue = collectTexts().filter((text) => FORCE || !ready(audioFile(text)))
  if (LIMIT > 0) queue = queue.slice(0, LIMIT)
  if (queue.length === 0) {
    console.log('[audio] 发音库已完整')
    return
  }

  console.log(`[audio] 待生成 ${queue.length} 条发音`)
  let done = 0
  let failed = 0
  const lock = { index: 0 }

  async function worker(): Promise<void> {
    let client: MsEdgeTTS | null = null
    try {
      client = await createClient()
    } catch (error) {
      console.warn(`[audio] 连接失败：${error instanceof Error ? error.message : String(error)}`)
      return
    }
    try {
      for (;;) {
        const position = lock.index++
        if (position >= queue.length) return
        const text = queue[position]
        let saved = false
        for (let attempt = 1; attempt <= MAX_ATTEMPTS && !saved; attempt += 1) {
          try {
            if (!client) client = await createClient()
            const audio = await synth(client, text)
            writeFileSync(audioFile(text), audio)
            saved = true
          } catch (error) {
            client?.close()
            client = null
            const message = error instanceof Error ? error.message : String(error)
            if (attempt === MAX_ATTEMPTS) {
              failed += 1
              console.warn(`[audio] 失败：${text}（${message}）`)
            } else {
              await new Promise((resolve) => setTimeout(resolve, 800 * attempt))
            }
          }
        }
        done += 1
        if (done % 50 === 0) console.log(`[audio] 进度 ${done}/${queue.length}`)
      }
    } finally {
      client?.close()
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()))
  console.log(`[audio] 完成：成功 ${queue.length - failed}，失败 ${failed}`)
  if (failed > 0 || done < queue.length) throw new Error('部分发音生成失败，请重试')
}

main().catch((error) => {
  console.error(`[audio] 生成失败：${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
