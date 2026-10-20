import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { buildPrimaryScale } from '@/theme/preset'

export type ThemeMode = 'light' | 'dark'

export interface AccentOption {
  key: string
  label: string
  color: string
}

export const ACCENT_OPTIONS: readonly AccentOption[] = [
  { key: 'ink', label: '墨黑', color: '#18181b' },
  { key: 'blue', label: '靛蓝', color: '#2563eb' },
  { key: 'green', label: '墨绿', color: '#059669' },
  { key: 'amber', label: '琥珀', color: '#d97706' },
  { key: 'rose', label: '朱砂', color: '#dc2626' },
  { key: 'violet', label: '紫', color: '#7c3aed' }
] as const

const MODE_KEY = 'study.themeMode'
const ACCENT_KEY = 'study.accentColor'

const LIGHT_INK = '#fafafa'
const DARK_INK = '#0d0d0f'

function readMode(): ThemeMode {
  const raw = localStorage.getItem(MODE_KEY)
  if (raw === 'light' || raw === 'dark') return raw
  return 'light'
}

function readAccent(): string {
  const raw = localStorage.getItem(ACCENT_KEY)
  if (raw && /^#[0-9a-fA-F]{6}$/.test(raw)) return raw
  return ACCENT_OPTIONS[0].color
}

function toRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  const num = parseInt(value, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

function isNeutral(hex: string): boolean {
  const [r, g, b] = toRgb(hex)
  return Math.max(r, g, b) - Math.min(r, g, b) <= 18
}

function shift(hex: string, whiteRatio: number): string {
  const [r, g, b] = toRgb(hex)
  return toHex([r + (255 - r) * whiteRatio, g + (255 - g) * whiteRatio, b + (255 - b) * whiteRatio])
}

/**
 * 墨黑这类中性色在深色模式下必须反转成亮色，否则和背景同色不可见；
 * 彩色则只在过暗/过亮时做补偿。
 */
function resolveAccent(accent: string, mode: ThemeMode): string {
  const light = luminance(accent)
  if (mode === 'dark') {
    if (isNeutral(accent)) return light < 0.5 ? LIGHT_INK : accent
    return light < 0.26 ? shift(accent, 0.4) : accent
  }
  if (isNeutral(accent)) return light > 0.5 ? DARK_INK : accent
  return light > 0.72 ? shift(accent, -0.45) : accent
}

function applyToDom(mode: ThemeMode, accent: string): void {
  const root = document.documentElement
  const effective = resolveAccent(accent, mode)
  root.setAttribute('data-theme', mode)
  root.style.setProperty('--accent-color', effective)
  root.style.setProperty('--accent-contrast', luminance(effective) > 0.6 ? DARK_INK : '#ffffff')
  root.style.setProperty('--p-primary-contrast-color', luminance(effective) > 0.6 ? DARK_INK : '#ffffff')

  const scale = buildPrimaryScale(effective)
  Object.entries(scale).forEach(([key, value]) => {
    root.style.setProperty(`--p-primary-${key}`, value)
  })
}

export const useThemeStore = defineStore('theme', () => {
  const themeMode = ref<ThemeMode>(readMode())
  const accentColor = ref<string>(readAccent())

  const isDark = computed(() => themeMode.value === 'dark')
  const accentKey = computed(
    () => ACCENT_OPTIONS.find((item) => item.color === accentColor.value)?.key ?? 'ink'
  )

  function setMode(mode: ThemeMode): void {
    themeMode.value = mode
  }

  function toggleMode(): void {
    themeMode.value = themeMode.value === 'light' ? 'dark' : 'light'
  }

  function setAccent(color: string): void {
    if (/^#[0-9a-fA-F]{6}$/.test(color)) accentColor.value = color
  }

  watch(
    [themeMode, accentColor],
    ([mode, color]) => {
      localStorage.setItem(MODE_KEY, mode)
      localStorage.setItem(ACCENT_KEY, color)
      applyToDom(mode, color)
    },
    { immediate: true }
  )

  return {
    themeMode,
    accentColor,
    isDark,
    accentKey,
    setMode,
    toggleMode,
    setAccent
  }
})
