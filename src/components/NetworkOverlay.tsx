import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { useGlobalStyles } from '../hooks/useGlobalStyles'
import { Colors } from '../constants/theme'
import { useColorScheme } from '../hooks/use-color-scheme'
import { IconSymbol } from './ui/icon-symbol'

export function NetworkOverlay() {
  // We assume true initially so it doesn't flash offline on boot
  const [isConnected, setIsConnected] = useState<boolean | null>(true)
  const globalStyles = useGlobalStyles()
  const theme = useColorScheme() ?? 'light'

  useEffect(() => {
    // This sets up a global listener to the phone's wifi/cellular chip
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isConnected can be null on first check, so we strictly check for false
      setIsConnected(state.isConnected === false ? false : true)
    })

    return () => unsubscribe()
  }, [])

  // If online, render absolutely nothing
  if (isConnected) return null

  // If offline, render a full screen overlay
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        globalStyles.container,
        {
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999, // Forces it above EVERYTHING else in the app
        },
      ]}
    >
      {/* You can replace this Icon with your actual App Logo Image */}
      <IconSymbol
        name='wifi.exclamationmark'
        size={80}
        color={Colors[theme].icon}
      />

      <Text
        style={[globalStyles.title, { marginTop: 24, textAlign: 'center' }]}
      >
        Connection Lost
      </Text>

      <Text style={[globalStyles.body, { textAlign: 'center', marginTop: 8 }]}>
        Please check your internet connection. We will automatically reconnect
        when you are back online.
      </Text>
    </View>
  )
}
