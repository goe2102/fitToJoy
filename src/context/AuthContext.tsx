import React, { createContext, useState, useEffect, useContext } from 'react'
import { auth } from '../services/firebaseConfig'
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth'

interface AuthContextType {
  userToken: string | null
  isLoading: boolean
  sendPhoneCode: (phoneNumber: string) => Promise<void>
  verifyCode: (code: string) => Promise<void>
  logOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userToken, setUserToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // This is the magic listener. It talks to Firebase in the background.
  // If the user force-closes the app and reopens it, Firebase remembers them
  // and automatically skips the login screen!
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserToken(user.uid) // User is logged in, grab their unique Firebase ID
      } else {
        setUserToken(null) // No user found
      }
      setIsLoading(false) // Stop showing the loading screen
    })

    return () => unsubscribe()
  }, [])

  const sendPhoneCode = async (phoneNumber: string) => {
    console.log('Preparing to send SMS to:', phoneNumber)
    // NOTE: Real SMS requires @react-native-firebase/auth and a Dev Client build.
    // For now, we simulate the network request succeeding.
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  const verifyCode = async (code: string) => {
    console.log('Verifying 6-digit code:', code)
    // For testing the UI flow in Expo Go today, we manually set the token
    // so the Router pushes you into the (tabs) screen.
    setUserToken('temporary-expo-go-token')
  }

  const logOut = async () => {
    try {
      await firebaseSignOut(auth)
      setUserToken(null)
    } catch (error) {
      console.error('Error signing out: ', error)
    }
  }

  return (
    <AuthContext.Provider
      value={{ userToken, isLoading, sendPhoneCode, verifyCode, logOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
