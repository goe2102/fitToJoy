import { useEffect } from 'react'
import { Stack, router, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider, useAuth } from '../src/context/AuthContext'
import {
  OnboardingProvider,
  useOnboarding,
} from '../src/context/OnboardingContext'
import { ProfileProvider } from '../src/context/ProfileContext'
import { UnreadProvider } from '../src/context/UnreadContext'
import { View, ActivityIndicator } from 'react-native'
import { colors } from '../src/constants/theme'
import { useColorScheme } from '../src/hooks/use-color-scheme'

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

    const inAuthGroup  = seg0 === '(auth)'
    const inOnboarding = seg0 === '(onboarding)'
    // All valid authenticated routes: tabs + any modal screens outside tabs
    const inApp = seg0 === '(tabs)' || seg0 === 'activity' || seg0 === 'chat'

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login' as any)
    } else if (!isOnboardingComplete) {
      if (!inOnboarding) router.replace('/(onboarding)' as any)
    } else {
      if (!inApp) router.replace('/(tabs)' as any)
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
  const scheme = useColorScheme()
  return (
    <>
      <RouteGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name='(auth)' />
        <Stack.Screen name='(onboarding)' />
        <Stack.Screen name='(tabs)' />
        <Stack.Screen name='activity/create' options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name='chat/[id]' />
        <Stack.Screen name='chat/new' options={{ presentation: 'fullScreenModal' }} />
      </Stack>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <OnboardingProvider>
        <ProfileProvider>
          <UnreadProvider>
            <AppLayout />
          </UnreadProvider>
        </ProfileProvider>
      </OnboardingProvider>
    </AuthProvider>
  )
}
