import type { ColorTheme } from '../types/settings.ts'

export interface ThemeDefinition {
  accent: string
  glow:   string
  name:   string
}

export const COLOR_THEMES: Record<ColorTheme, ThemeDefinition> = {
  midnight: { accent: '#7c4dff', glow: 'rgba(124,77,255,0.3)',  name: 'Midnight' },
  ocean:    { accent: '#0091ea', glow: 'rgba(0,145,234,0.3)',   name: 'Ocean'    },
  forest:   { accent: '#00c853', glow: 'rgba(0,200,83,0.3)',    name: 'Forest'   },
  sunset:   { accent: '#ff6d00', glow: 'rgba(255,109,0,0.3)',   name: 'Sunset'   },
  rose:     { accent: '#f50057', glow: 'rgba(245,0,87,0.3)',    name: 'Rose'     },
  amber:    { accent: '#ffc400', glow: 'rgba(255,196,0,0.3)',   name: 'Amber'    },
}
