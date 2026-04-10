import { useEffect } from 'react'
import { Stack, router, useSegments } from 'expo-router'
import { usePushNotifications } from '../src/hooks/usePushNotifications'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
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
  const { session, loading: authLoading, isPasswordRecovery } = useAuth()
  const { isOnboardingComplete, checkOnboarding } = useOnboarding()
  const segments = useSegments()
  usePushNotifications(session?.user?.id)

  useEffect(() => {
    if (session?.user) checkOnboarding()
  }, [session])

  useEffect(() => {
    if (authLoading || (session && isOnboardingComplete === null)) return

    // While the user is changing their password, don't redirect — let the
    // modal finish its flow unmolested.
    if (isPasswordRecovery) return

    const seg0 = segments[0] as string | undefined
    const inAuthGroup  = seg0 === '(auth)'
    const inOnboarding = seg0 === '(onboarding)'
    const inApp = seg0 === '(tabs)' || seg0 === 'activity' || seg0 === 'chat' || seg0 === 'profile' || seg0 === 'settings' || seg0 === 'group-chat' || seg0 === 'notifications'

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login' as any)
    } else if (!isOnboardingComplete) {
      if (!inOnboarding) router.replace('/(onboarding)' as any)
    } else {
      if (!inApp) router.replace('/(tabs)' as any)
    }
  }, [session, authLoading, isOnboardingComplete, isPasswordRecovery, segments])

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
        <Stack.Screen name='activity/create' />
        <Stack.Screen name='activity/[id]' />
        <Stack.Screen name='chat/[id]' />
        <Stack.Screen name='chat/new' options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name='profile/[id]' />
        <Stack.Screen name='group-chat/[id]' />
        <Stack.Screen name='settings' />
        <Stack.Screen name='notifications' />
      </Stack>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </>
  )
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <OnboardingProvider>
          <ProfileProvider>
            <UnreadProvider>
              <AppLayout />
            </UnreadProvider>
          </ProfileProvider>
        </OnboardingProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  )
}
