import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { LoadingScreen } from '@/components/CustomLoadingScreen'
import { NetworkOverlay } from '@/components/NetworkOverlay'

function InitialLayout() {
  const { userToken, isLoading, hasOnboarded } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    const inAuthGroup = segments[0] === '(auth)'
    const inOnboardingGroup = (segments[0] as string) === '(onboarding)'

    if (!userToken && !inAuthGroup) {
      // 1. Not logged in -> Send to Login
      router.replace('/(auth)/login')
    } else if (userToken && !hasOnboarded && !inOnboardingGroup) {
      // 2. Logged in, but hasn't onboarded -> Send to Setup
      router.replace('/(onboarding)' as any)
    } else if (
      userToken &&
      hasOnboarded &&
      (inAuthGroup || inOnboardingGroup)
    ) {
      // 3. Logged in and onboarded -> Send to App
      router.replace('/(tabs)')
    }
  }, [userToken, isLoading, hasOnboarded, segments])

  if (isLoading) return <LoadingScreen />

  return <Slot />
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NetworkOverlay />
      <InitialLayout />
    </AuthProvider>
  )
}
