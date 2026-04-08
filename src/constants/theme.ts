/**
 * constants/theme.ts
 * Single source of truth for all design tokens.
 * Supports both Colors[theme].xxx (existing pattern) and useColors() hook (new pattern).
 */

// ─── Dark palette ─────────────────────────────────────────────────────────────

export const darkColors = {
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

// ─── Light palette ────────────────────────────────────────────────────────────

export const lightColors = {
  primary: '#6C63FF',
  primaryLight: '#8B85FF',
  primaryDark: '#4E47CC',
  secondary: '#FF6584',
  accent: '#2DD871',
  background: '#F7F7FC',
  surface: '#FFFFFF',
  surfaceElevated: '#EEEEF7',
  border: '#DDDDF0',
  text: '#12121E',
  textSecondary: '#5A5A7A',
  textMuted: '#9090B0',
  error: '#E8365A',
  success: '#2DD871',
  warning: '#F0A500',
  white: '#FFFFFF',
  black: '#000000',
} as const

export type AppColors = { readonly [K in keyof typeof darkColors]: string }

// ─── Backward-compat: `colors` keeps pointing to dark (existing screens use it statically) ──

export const colors = darkColors

// ─── Legacy Colors map — now with proper light values (used by useThemeColor / useGlobalStyles) ─

export const Colors = {
  light: {
    text: lightColors.text,
    background: lightColors.background,
    tint: lightColors.primary,
    icon: lightColors.textSecondary,
    tabIconDefault: lightColors.textMuted,
    tabIconSelected: lightColors.primary,
    border: lightColors.border,
    surface: lightColors.surface,
    error: lightColors.error,
    success: lightColors.success,
  },
  dark: {
    text: darkColors.text,
    background: darkColors.background,
    tint: darkColors.primary,
    icon: darkColors.textSecondary,
    tabIconDefault: darkColors.textMuted,
    tabIconSelected: darkColors.primary,
    border: darkColors.border,
    surface: darkColors.surface,
    error: darkColors.error,
    success: darkColors.success,
  },
} as const

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const

// ─── Border radius ────────────────────────────────────────────────────────────

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const

// ─── Typography ───────────────────────────────────────────────────────────────

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

// Uppercase aliases for backward compat
export const Spacing = spacing
export const Radius = radius
export const Typography = typography

export const theme = { colors: darkColors, spacing, radius, typography }
export type Theme = typeof theme
