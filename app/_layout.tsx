import { useEffect } from 'react'
import { Stack, router, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider, useAuth } from '../src/context/AuthContext'
import {
  OnboardingProvider,
  useOnboarding,
} from '../src/context/OnboardingContext'
import { View, ActivityIndicator } from 'react-native'
import { colors } from '../src/constants/theme'

function RouteGuard() {
  const { session, loading: authLoading } = useAuth()
  const { isOnboardingComplete, checkOnboarding } = useOnboarding()
  const segments = useSegments()

  useEffect(() => {
    if (session?.user) {
      checkOnboarding()
    }
  }, [session])

  useEffect(() => {
    if (authLoading || (session && isOnboardingComplete === null)) return

    // Cast segments[0] to string to avoid Expo Router's strict route-type
    // narrowing before the new route files are fully registered
    const seg0 = segments[0] as string | undefined

    const inAuthGroup = seg0 === '(auth)'
    const inOnboarding = seg0 === '(onboarding)'
    const inTabs = seg0 === '(tabs)'

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login' as any)
    } else if (!isOnboardingComplete) {
      if (!inOnboarding) router.replace('/(onboarding)' as any)
    } else {
      if (!inTabs) router.replace('/(tabs)' as any)
    }
  }, [session, authLoading, isOnboardingComplete, segments])

  if (authLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.primary} size='large' />
      </View>
    )
  }

  return null
}

function AppLayout() {
  return (
    <>
      <RouteGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name='(auth)' />
        <Stack.Screen name='(onboarding)' />
        <Stack.Screen name='(tabs)' />
      </Stack>
      <StatusBar style='light' />
    </>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <OnboardingProvider>
        <AppLayout />
      </OnboardingProvider>
    </AuthProvider>
  )
}
