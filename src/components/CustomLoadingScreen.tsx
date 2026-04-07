import React from 'react'
import { View, ActivityIndicator, Text } from 'react-native'
import { useGlobalStyles } from '../hooks/useGlobalStyles'
import { Colors } from '../constants/theme'
import { useColorScheme } from '../hooks/use-color-scheme'

export function LoadingScreen() {
  const globalStyles = useGlobalStyles()
  const theme = useColorScheme() ?? 'light'

  return (
    <View
      style={[
        globalStyles.container,
        { justifyContent: 'center', alignItems: 'center' },
      ]}
    >
      <ActivityIndicator size='large' color={Colors[theme].tint} />
      <Text style={[globalStyles.title, { marginTop: 16 }]}>
        Fetching your data...
      </Text>
    </View>
  )
}
