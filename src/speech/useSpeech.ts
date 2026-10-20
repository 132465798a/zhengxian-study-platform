import { ref } from 'vue'
import { speechApi } from '@/api'

export type SpeechProvider = 'system' | 'edge'
export type SpeechEngine = SpeechProvider | 'bundled'
export type SpeechLang = 'zh-CN' | 'en-US'

const PROVIDER_KEY = 'study.ttsProvider'

const provider = ref<SpeechProvider>(readProvider())
const speaking = ref(false)
const loading = ref(false)
const lastEngine = ref<SpeechEngine | null>(null)
const lastError = ref('')
const systemVoices = ref<SpeechSynthesisVoice[]>([])
const voicesLoaded = ref(false)

interface CachedAudio {
  url: string
  source: SpeechEngine
}

const audioCache = new Map<string, CachedAudio>()
const AUDIO_CACHE_LIMIT = 300

let player: HTMLAudioElement | null = null
let token = 0

/**
 * Chromium 会以 URL safety check 拒绝 data: 音频，必须转成 blob URL 才能播放。
 */
function toBlobUrl(base64: string, mime: string): string {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return URL.createObjectURL(new Blob([bytes], { type: mime }))
}

function cacheAudio(key: string, entry: CachedAudio): void {
  const existing = audioCache.get(key)
  if (existing) URL.revokeObjectURL(existing.url)
  if (audioCache.size >= AUDIO_CACHE_LIMIT && !existing) {
    const oldest = audioCache.keys().next().value
    if (oldest) {
      const stale = audioCache.get(oldest)
      if (stale) URL.revokeObjectURL(stale.url)
      audioCache.delete(oldest)
    }
  }
  audioCache.set(key, entry)
}

function loadSystemVoices(): void {
  if (!('speechSynthesis' in window)) return
  systemVoices.value = window.speechSynthesis.getVoices()
  if (systemVoices.value.length > 0) voicesLoaded.value = true
}

if ('speechSynthesis' in window) {
  loadSystemVoices()
  window.speechSynthesis.addEventListener('voiceschanged', loadSystemVoices)
}

function readProvider(): SpeechProvider {
  return localStorage.getItem(PROVIDER_KEY) === 'edge' ? 'edge' : 'system'
}

function setProvider(next: SpeechProvider): void {
  provider.value = next
  localStorage.setItem(PROVIDER_KEY, next)
}

function hasVoiceFor(lang: SpeechLang): boolean {
  return systemVoices.value.some((voice) => voice.lang.replace('_', '-').startsWith(lang))
}

function pickVoice(lang: SpeechLang): SpeechSynthesisVoice | null {
  const matched = systemVoices.value.filter((voice) =>
    voice.lang.replace('_', '-').startsWith(lang)
  )
  return matched.find((voice) => /natural|online/i.test(voice.name)) ?? matched[0] ?? null
}

function waitForVoices(): Promise<void> {
  if (!('speechSynthesis' in window)) return Promise.resolve()
  if (systemVoices.value.length > 0) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      window.speechSynthesis.onvoiceschanged = null
      loadSystemVoices()
      resolve()
    }, 1200)
    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timer)
      window.speechSynthesis.onvoiceschanged = null
      loadSystemVoices()
      resolve()
    }
  })
}

function stop(): void {
  token += 1
  if (player) {
    player.pause()
    player = null
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  speaking.value = false
  loading.value = false
}

async function speakSystem(text: string, lang: SpeechLang, current: number): Promise<void> {
  if (!('speechSynthesis' in window)) return
  speaking.value = true
  await waitForVoices()
  if (current !== token) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  utterance.rate = lang === 'zh-CN' ? 0.85 : 0.9
  const voice = pickVoice(lang)
  if (voice) utterance.voice = voice
  utterance.onend = () => {
    if (current === token) speaking.value = false
  }
  utterance.onerror = () => {
    if (current === token) speaking.value = false
  }
  lastEngine.value = 'system'
  window.speechSynthesis.speak(utterance)
}

/**
 * 统一朗读入口：按用户选择的引擎发声。
 * Edge 优先读取随包的内置音频，断网时也能播放；合成失败时回退到系统语音并记录原因。
 */
async function speak(text: string, lang: SpeechLang = 'zh-CN'): Promise<void> {
  const content = text.trim()
  if (!content) return
  stop()
  const current = token
  lastError.value = ''

  if (provider.value === 'system') await waitForVoices()
  if (current !== token) return

  // 系统缺少对应语言的音色时改走内置音频或 Edge，避免用中文音色硬读英文
  const needAudio = provider.value === 'edge' || !hasVoiceFor(lang)
  if (needAudio) {
    const cacheKey = `${lang}|${content}`
    try {
      loading.value = true
      let cached = audioCache.get(cacheKey)
      if (!cached) {
        const result = await speechApi.synthesize(content, lang)
        if (current !== token) return
        cached = { url: toBlobUrl(result.audio, result.mime), source: result.source }
        cacheAudio(cacheKey, cached)
      }
      if (current !== token) return
      loading.value = false
      const audio = new Audio(cached.url)
      player = audio
      speaking.value = true
      lastEngine.value = cached.source
      audio.onended = () => {
        speaking.value = false
        if (player === audio) player = null
      }
      audio.onerror = () => {
        speaking.value = false
      }
      await audio.play()
      return
    } catch (error) {
      if (current !== token) return
      loading.value = false
      lastError.value = error instanceof Error ? error.message : 'Edge 语音不可用'
      console.warn('[speech] Edge 语音不可用，回退系统语音', error)
    }
  }

  await speakSystem(content, lang, current)
}

export function useSpeech(): {
  provider: typeof provider
  speaking: typeof speaking
  loading: typeof loading
  lastEngine: typeof lastEngine
  lastError: typeof lastError
  systemVoices: typeof systemVoices
  voicesLoaded: typeof voicesLoaded
  hasVoiceFor: typeof hasVoiceFor
  setProvider: typeof setProvider
  speak: typeof speak
  stop: typeof stop
} {
  return {
    provider,
    speaking,
    loading,
    lastEngine,
    lastError,
    systemVoices,
    voicesLoaded,
    hasVoiceFor,
    setProvider,
    speak,
    stop
  }
}
