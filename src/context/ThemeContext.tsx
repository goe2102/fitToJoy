import React, { createContext, useContext, useEffect, useState } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type ThemePreference = 'light' | 'dark' | 'automatic'

const STORAGE_KEY = 'theme_preference'

interface ThemeContextValue {
  preference: ThemePreference
  resolved: 'light' | 'dark'
  setPreference: (p: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'automatic',
  resolved: 'dark',
  setPreference: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme() ?? 'dark'
  const [preference, setPreferenceState] = useState<ThemePreference>('automatic')

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'light' || val === 'dark' || val === 'automatic') {
        setPreferenceState(val)
      }
    })
  }, [])

  const setPreference = (p: ThemePreference) => {
    setPreferenceState(p)
    AsyncStorage.setItem(STORAGE_KEY, p)
  }

  const resolved: 'light' | 'dark' = preference === 'automatic' ? system : preference

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
