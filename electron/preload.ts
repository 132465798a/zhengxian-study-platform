import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc'

const WINDOW_EVENTS = ['window:minimize', 'window:toggle-maximize', 'window:close'] as const
const MAXIMIZE_CHANGE_EVENT = 'window:maximize-change'

contextBridge.exposeInMainWorld('studyAPI', {
  invoke: (channel: string, payload?: unknown) => {
    if (!IPC_CHANNELS.includes(channel)) {
      return Promise.resolve({ code: 403, message: '非法的调用通道' })
    }
    return ipcRenderer.invoke(channel, payload)
  },
  window: {
    minimize: () => ipcRenderer.send(WINDOW_EVENTS[0]),
    toggleMaximize: () => ipcRenderer.send(WINDOW_EVENTS[1]),
    close: () => ipcRenderer.send(WINDOW_EVENTS[2]),
    onMaximizeChange: (callback: (maximized: boolean) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, maximized: boolean): void => {
        callback(maximized)
      }
      ipcRenderer.on(MAXIMIZE_CHANGE_EVENT, listener)
      return () => ipcRenderer.removeListener(MAXIMIZE_CHANGE_EVENT, listener)
    }
  }
})
