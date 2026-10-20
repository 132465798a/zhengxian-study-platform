import type { IpcResponse } from '@shared/types'

/**
 * 所有数据访问都经过主进程 IPC，渲染层不直接接触数据库。
 * 统一响应结构：{ code, message, data }，非 200 一律抛出中文错误。
 */
export async function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  if (!window.studyAPI) {
    throw new Error('当前不在桌面环境中运行，无法访问本地数据')
  }
  // contextBridge 只接受可结构化克隆的数据，Vue 的响应式代理需要先转为普通对象
  const plain = payload === undefined ? undefined : (JSON.parse(JSON.stringify(payload)) as unknown)
  const response = (await window.studyAPI.invoke(channel, plain)) as IpcResponse<T>
  if (!response || response.code !== 200) {
    throw new Error(response?.message || '操作失败，请稍后重试')
  }
  return response.data as T
}
