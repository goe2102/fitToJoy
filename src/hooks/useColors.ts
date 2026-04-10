import { useTheme } from '@/context/ThemeContext'
import { lightColors, darkColors, type AppColors } from '@/constants/theme'

export function useColors(): AppColors {
  const { resolved } = useTheme()
  return (resolved === 'light' ? lightColors : darkColors) as AppColors
}
