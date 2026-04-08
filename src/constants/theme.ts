/**
 * constants/theme.ts
 * Single source of truth for all design tokens.
 * Supports both Colors[theme].xxx (existing pattern) and flat colors.xxx (new files).
 */

// ─── Light / Dark token maps (used by existing components: Colors[theme].tint etc.) ─

const light = {
  text: '#F0F0FF',
  background: '#0F0F14',
  tint: '#6C63FF',
  icon: '#8888AA',
  tabIconDefault: '#55556A',
  tabIconSelected: '#6C63FF',
  border: '#2E2E3D',
  surface: '#1A1A24',
  error: '#FF4C6A',
  success: '#43E97B',
} as const

const dark = {
  text: '#F0F0FF',
  background: '#0F0F14',
  tint: '#6C63FF',
  icon: '#8888AA',
  tabIconDefault: '#55556A',
  tabIconSelected: '#6C63FF',
  border: '#2E2E3D',
  surface: '#1A1A24',
  error: '#FF4C6A',
  success: '#43E97B',
} as const

/** Used as Colors[theme].tint — keeps existing components working */
export const Colors = { light, dark } as const

// ─── Flat tokens (used by new auth / onboarding screens) ─────────────────────

export const colors = {
  primary: '#6C63FF',
  primaryLight: '#8B85FF',
  primaryDark: '#4E47CC',
  secondary: '#FF6584',
  accent: '#43E97B',
  background: '#0F0F14',
  surface: '#1A1A24',
  surfaceElevated: '#22222F',
  border: '#2E2E3D',
  text: '#F0F0FF',
  textSecondary: '#8888AA',
  textMuted: '#55556A',
  error: '#FF4C6A',
  success: '#43E97B',
  warning: '#FFC947',
  white: '#FFFFFF',
  black: '#000000',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const

export const typography = {
  h1: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 20, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const },
  label: { fontSize: 14, fontWeight: '600' as const },
  button: { fontSize: 16, fontWeight: '700' as const, letterSpacing: 0.3 },
} as const

// Uppercase aliases so any file using Spacing / Radius still compiles
export const Spacing = spacing
export const Radius = radius
export const Typography = typography

export const theme = { colors, spacing, radius, typography }
export type Theme = typeof theme
