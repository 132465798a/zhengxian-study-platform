import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type {
  OfflineRecognizer as OfflineRecognizerType,
  OfflineRecognizerConfig
} from 'sherpa-onnx-node'

const MODEL_DIR = 'sherpa-onnx-nemo-ctc-en-conformer-small'

type SherpaModule = typeof import('sherpa-onnx-node')

let recognizer: OfflineRecognizerType | null = null
let recognizerPromise: Promise<OfflineRecognizerType> | null = null
let initFailed = false
let sherpa: SherpaModule | null = null

/** 按需加载原生模块，缺少对应平台二进制时不影响应用启动 */
function loadSherpa(): SherpaModule {
  if (sherpa) return sherpa
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- 原生模块按平台懒加载，缺失时不影响启动
  sherpa = require('sherpa-onnx-node') as SherpaModule
  return sherpa
}

function modelDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'asr', MODEL_DIR)
    : join(app.getAppPath(), 'build', 'asr', MODEL_DIR)
}

function modelFile(dir: string): string | null {
  const int8 = join(dir, 'model.int8.onnx')
  if (existsSync(int8)) return int8
  const full = join(dir, 'model.onnx')
  return existsSync(full) ? full : null
}

export function isAsrAvailable(): boolean {
  const dir = modelDir()
  if (!modelFile(dir) || !existsSync(join(dir, 'tokens.txt'))) return false
  try {
    loadSherpa()
    return true
  } catch {
    return false
  }
}

async function getRecognizer(): Promise<OfflineRecognizerType> {
  if (recognizer) return recognizer
  if (initFailed) throw new Error('本地语音识别初始化失败')
  if (recognizerPromise) return recognizerPromise

  const dir = modelDir()
  const model = modelFile(dir)
  if (!model || !existsSync(join(dir, 'tokens.txt'))) throw new Error('本地语音识别模型未安装')

  const { OfflineRecognizer } = loadSherpa()
  const config: OfflineRecognizerConfig = {
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      nemoCtc: { model },
      tokens: join(dir, 'tokens.txt'),
      numThreads: 2,
      provider: 'cpu',
      debug: 0
    }
  }

  recognizerPromise = OfflineRecognizer.createAsync(config)
    .then((instance) => {
      recognizer = instance
      return instance
    })
    .catch((error) => {
      initFailed = true
      recognizerPromise = null
      throw error
    })
  return recognizerPromise
}

/** PCM16 采样转 Float32，再交给本地识别器（异步解码，避免阻塞主进程） */
export async function transcribePcm(base64: string, sampleRate = 16000): Promise<{ text: string }> {
  const buffer = Buffer.from(base64, 'base64')
  const count = Math.floor(buffer.length / 2)
  const samples = new Float32Array(count)
  for (let i = 0; i < count; i += 1) samples[i] = buffer.readInt16LE(i * 2) / 32768

  const instance = await getRecognizer()
  const stream = instance.createStream()
  stream.acceptWaveform({ samples, sampleRate })
  const result = await instance.decodeAsync(stream)
  return { text: (result.text ?? '').trim() }
}
