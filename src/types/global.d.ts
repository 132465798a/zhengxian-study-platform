import type { IpcResponse, StudyWindowApi } from '@shared/types'

declare global {
  interface Window {
    studyAPI?: {
      invoke: (channel: string, payload?: unknown) => Promise<IpcResponse<unknown>>
      window: StudyWindowApi
    }
  }
}

export {}
