import { StyleSheet } from 'react-native'
import { Colors, Spacing, Radius } from '../constants/theme'
import { useColorScheme } from './use-color-scheme'

export function useGlobalStyles() {
  // 1. Get the current active theme ('light' or 'dark')
  const theme = useColorScheme() ?? 'light'

  // 2. Grab the specific color palette for that theme
  const colors = Colors[theme]

  // 3. Return the StyleSheet
  return StyleSheet.create({
    // --- LAYOUTS ---
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: Spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    // --- THE GLOBAL CARD YOU ASKED FOR ---
    card: {
      backgroundColor: colors.card,
      borderRadius: Radius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderColor: colors.border,
      borderWidth: 1,
      // Subtle shadow for iOS
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme === 'light' ? 0.1 : 0.3,
      shadowRadius: 4,
      // Elevation for Android
      elevation: 3,
    },

    // --- TYPOGRAPHY ---
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
      color: colors.icon,
    },
  })
}
