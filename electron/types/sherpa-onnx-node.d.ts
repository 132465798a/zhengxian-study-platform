declare module 'sherpa-onnx-node' {
  export interface Waveform {
    samples: Float32Array
    sampleRate: number
  }

  export interface OfflineStream {
    acceptWaveform(obj: Waveform): void
  }

  export interface OfflineRecognizerConfig {
    featConfig?: { sampleRate?: number; featureDim?: number }
    modelConfig?: {
      nemoCtc?: { model?: string }
      whisper?: {
        encoder?: string
        decoder?: string
        language?: string
        task?: string
      }
      tokens?: string
      numThreads?: number
      provider?: string
      debug?: boolean | number
    }
  }

  export interface OfflineRecognizerResult {
    text: string
  }

  export class OfflineRecognizer {
    constructor(config: OfflineRecognizerConfig)
    static createAsync(config: OfflineRecognizerConfig): Promise<OfflineRecognizer>
    createStream(): OfflineStream
    decode(stream: OfflineStream): void
    decodeAsync(stream: OfflineStream): Promise<OfflineRecognizerResult>
    getResult(stream: OfflineStream): OfflineRecognizerResult
  }
}
