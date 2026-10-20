import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import { findBundledAudio } from './audio-library'

/** Edge 朗读音色，按语言固定，避免前端传入任意 voice 名 */
const VOICE_BY_LANG: Record<string, string> = {
  'zh-CN': 'zh-CN-XiaoxiaoNeural',
  'en-US': 'en-US-AriaNeural'
}

const MAX_TEXT_LENGTH = 400

export interface SpeechAudio {
  audio: string
  mime: string
  source: 'bundled' | 'edge'
}

function resolveVoice(lang: string): string {
  return VOICE_BY_LANG[lang] ?? VOICE_BY_LANG['zh-CN']
}

async function synthesize(text: string, voice: string, rate: string): Promise<Buffer> {
  const client = new MsEdgeTTS({ connectionTimeoutMs: 8000, synthesisTimeoutMs: 20000 })
  try {
    await client.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    const { audioStream } = client.toStream(text, { rate })
    const chunks: Buffer[] = []
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('语音合成超时')), 15000)
      const finish = (): void => {
        clearTimeout(timer)
        resolve()
      }
      audioStream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
      audioStream.on('end', finish)
      audioStream.on('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
    })
    return Buffer.concat(chunks)
  } finally {
    client.close()
  }
}

async function synthesizeWithRetry(text: string, voice: string, rate: string): Promise<Buffer> {
  let lastError: unknown = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await synthesize(text, voice, rate)
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      if (!/429|too many/i.test(message) || attempt === 2) break
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('语音合成失败')
}

export async function synthesizeSpeech(input: {
  text: string
  lang: string
}): Promise<SpeechAudio> {
  const text = input.text.trim()
  if (!text) throw new Error('朗读内容不能为空')
  if (text.length > MAX_TEXT_LENGTH) throw new Error('朗读内容过长')

  if (input.lang === 'en-US') {
    const bundled = findBundledAudio(text)
    if (bundled) return { ...bundled, source: 'bundled' }
  }

  const audio = await synthesizeWithRetry(text, resolveVoice(input.lang), '-10%')
  if (audio.length === 0) throw new Error('语音合成失败')
  return { audio: audio.toString('base64'), mime: 'audio/mpeg', source: 'edge' }
}
