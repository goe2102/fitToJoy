import React, { createContext, useState, useEffect, useContext } from 'react'
import { auth } from '../services/firebaseConfig'
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
} from 'firebase/auth'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface AuthContextType {
  userToken: string | null
  isLoading: boolean
  hasOnboarded: boolean
  completeOnboarding: () => Promise<void>
  signUp: (email: string, pass: string) => Promise<void>
  signIn: (email: string, pass: string) => Promise<void>
  logOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userToken, setUserToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasOnboarded, setHasOnboarded] = useState(false)

  useEffect(() => {
    const checkState = async () => {
      // Check if user previously finished onboarding
      const onboardStatus = await AsyncStorage.getItem('@has_onboarded')
      if (onboardStatus === 'true') setHasOnboarded(true)

      const unsubscribe = onAuthStateChanged(auth, (user) => {
        // Only log them in if they exist AND verified their email
        if (user && user.emailVerified) {
          setUserToken(user.uid)
        } else {
          setUserToken(null)
        }
        setIsLoading(false)
      })
      return unsubscribe
    }

    checkState()
  }, [])

  const signUp = async (email: string, pass: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass)
    await sendEmailVerification(cred.user)
    // We sign them out immediately so they are forced to go verify their email
    await firebaseSignOut(auth)
  }

  const signIn = async (email: string, pass: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, pass)
    if (!cred.user.emailVerified) {
      await firebaseSignOut(auth)
      throw new Error('Please verify your email before logging in.')
    }
  }

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('@has_onboarded', 'true')
    setHasOnboarded(true)
  }

  const logOut = async () => {
    await firebaseSignOut(auth)
    setUserToken(null)
  }

  return (
    <AuthContext.Provider
      value={{
        userToken,
        isLoading,
        hasOnboarded,
        completeOnboarding,
        signUp,
        signIn,
        logOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
