import { Platform } from 'react-native'

const tintColorLight = '#0a7ea4'
const tintColorDark = '#fff'

// 1. Expanded Color Palette (Light & Dark)
export const Colors = {
  light: {
    text: '#11181C',
    background: '#F2F2F7', // Standard iOS light gray background
    card: '#FFFFFF', // White cards
    border: '#E5E5EA',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#000000', // True black background
    card: '#1C1C1E', // Elevated dark gray cards
    border: '#38383A',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
}

// 2. Global Spacing Scale (Use these instead of random numbers)
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

// 3. Global Border Radii
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  round: 9999,
}

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
})
