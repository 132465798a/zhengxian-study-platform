import { definePreset } from '@primevue/themes'
import Aura from '@primevue/themes/aura'

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  const num = parseInt(value.length === 3 ? value.replace(/(.)/g, '$1$1') : value, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function mix(rgb: [number, number, number], white: number): string {
  const round = (n: number) => Math.round(n)
  const r = round(rgb[0] + (255 - rgb[0]) * white)
  const g = round(rgb[1] + (255 - rgb[1]) * white)
  const b = round(rgb[2] + (255 - rgb[2]) * white)
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

function darken(rgb: [number, number, number], ratio: number): string {
  const round = (n: number) => Math.round(n * (1 - ratio))
  return `#${[round(rgb[0]), round(rgb[1]), round(rgb[2])]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')}`
}

export function buildPrimaryScale(accent: string): Record<string, string> {
  const rgb = hexToRgb(accent)
  return {
    50: mix(rgb, 0.95),
    100: mix(rgb, 0.88),
    200: mix(rgb, 0.78),
    300: mix(rgb, 0.64),
    400: mix(rgb, 0.42),
    500: `#${rgb
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')}`,
    600: darken(rgb, 0.1),
    700: darken(rgb, 0.22),
    800: darken(rgb, 0.34),
    900: darken(rgb, 0.46),
    950: darken(rgb, 0.6)
  }
}

export const StudyPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{primary.50}',
      100: '{primary.100}',
      200: '{primary.200}',
      300: '{primary.300}',
      400: '{primary.400}',
      500: '{primary.500}',
      600: '{primary.600}',
      700: '{primary.700}',
      800: '{primary.800}',
      900: '{primary.900}',
      950: '{primary.950}'
    },
    colorScheme: {
      light: {
        primary: {
          color: '{primary.600}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.700}',
          activeColor: '{primary.800}'
        },
        highlight: {
          background: '{primary.50}',
          focusBackground: '{primary.100}',
          color: '{primary.700}',
          focusColor: '{primary.800}'
        },
        surface: {
          0: '#ffffff',
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b'
        },
        formField: {
          background: '#ffffff',
          borderColor: '{surface.200}',
          hoverBorderColor: '{surface.300}',
          focusBorderColor: '{primary.500}',
          shadow: 'none'
        },
        content: {
          background: '#ffffff',
          hoverBackground: '{surface.50}',
          borderColor: '{surface.200}'
        }
      },
      dark: {
        primary: {
          color: '{primary.500}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.400}',
          activeColor: '{primary.300}'
        },
        highlight: {
          background: 'rgba(255,255,255,0.08)',
          focusBackground: 'rgba(255,255,255,0.12)',
          color: '#ffffff',
          focusColor: '#ffffff'
        },
        surface: {
          0: '#ffffff',
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#0d0d0f'
        },
        formField: {
          background: '{surface.800}',
          borderColor: '{surface.700}',
          hoverBorderColor: '{surface.600}',
          focusBorderColor: '{primary.400}',
          shadow: 'none'
        },
        content: {
          background: '{surface.950}',
          hoverBackground: '{surface.900}',
          borderColor: '{surface.800}'
        }
      }
    }
  }
})
