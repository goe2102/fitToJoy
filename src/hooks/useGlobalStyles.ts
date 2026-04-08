import { StyleSheet } from 'react-native'
import { Spacing, Radius } from '../constants/theme'
import { useColors } from './useColors'

export function useGlobalStyles() {
  const colors = useColors()

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: Spacing.md,
    },
    safeContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderColor: colors.border,
      borderWidth: 1,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    body: {
      fontSize: 16,
      color: colors.text,
      lineHeight: 24,
    },
    subtext: {
      fontSize: 14,
      color: colors.textSecondary,
    },
  })
}
