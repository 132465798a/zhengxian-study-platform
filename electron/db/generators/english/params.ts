import type { GeneratorOptions } from '../types'

export function numberParam(
  options: GeneratorOptions | undefined,
  key: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = options?.params?.[key]
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}
