/**
 * constants/theme.ts
 * Single source of truth for all design tokens.
 * Supports both Colors[theme].xxx (existing pattern) and useColors() hook (new pattern).
 */

// ─── Dark palette ─────────────────────────────────────────────────────────────

export const darkColors = {
  primary: '#FF5A35',
  primaryLight: '#FF7E60',
  primaryDark: '#CC3A1C',
  secondary: '#FF2D78',
  accent: '#0ECFAD',
  background: '#0E0E12',
  surface: '#17171C',
  surfaceElevated: '#212128',
  border: '#2A2A34',
  text: '#F2F2F8',
  textSecondary: '#90909E',
  textMuted: '#4E4E5C',
  error: '#FF453A',
  success: '#30D158',
  warning: '#FFB340',
  white: '#FFFFFF',
  black: '#000000',
} as const

// ─── Light palette ────────────────────────────────────────────────────────────

export const lightColors = {
  primary: '#FF5A35',
  primaryLight: '#FF7E60',
  primaryDark: '#CC3A1C',
  secondary: '#FF2D78',
  accent: '#0BB898',
  background: '#F4F4F8',
  surface: '#FFFFFF',
  surfaceElevated: '#EAEAEF',
  border: '#DCDCE4',
  text: '#0E0E12',
  textSecondary: '#56566A',
  textMuted: '#96969E',
  error: '#FF3B30',
  success: '#30C457',
  warning: '#F09500',
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
