import { useColorScheme } from './use-color-scheme'
import { lightColors, darkColors, type AppColors } from '@/constants/theme'

/**
 * Returns the correct color palette for the current system theme.
 * Use this in all new components instead of importing `colors` directly.
 *
 * @example
 * const colors = useColors()
 * <View style={{ backgroundColor: colors.background }} />
 */
export function useColors(): AppColors {
  const scheme = useColorScheme() ?? 'dark'
  return (scheme === 'light' ? lightColors : darkColors) as AppColors
}
