import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from '../src/context/AuthContext'
import { LoadingScreen } from '../src/components/CustomLoadingScreen'
import { NetworkOverlay } from '../src/components/NetworkOverlay' // Import the overlay

function InitialLayout() {
  const { userToken, isLoading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!userToken && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (userToken && inAuthGroup) {
      router.replace('/(tabs)')
    }
  }, [userToken, isLoading, segments])

  if (isLoading) {
    return <LoadingScreen />
  }

  return <Slot />
}

export default function RootLayout() {
  return (
    <AuthProvider>
      {/* The overlay sits parallel to the app layout */}
      <NetworkOverlay />
      <InitialLayout />
    </AuthProvider>
  )
}
