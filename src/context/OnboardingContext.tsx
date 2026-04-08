import React, { createContext, useContext, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { useAuth } from './AuthContext'
import { supabase } from '../../lib/supabase'

const ONBOARDING_KEY = 'fitToJoy_onboarding_complete'

interface OnboardingContextType {
  isOnboardingComplete: boolean | null
  checkOnboarding: () => Promise<void>
  completeOnboarding: (data: OnboardingData) => Promise<void>
}

export interface OnboardingData {
  name: string
  goal: string
  fitnessLevel: string
  weeklyWorkouts: number
  focusAreas: string[]
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(
  undefined
)

export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<
    boolean | null
  >(null)

  const checkOnboarding = async () => {
    try {
      const cached = await AsyncStorage.getItem(ONBOARDING_KEY)
      if (cached === 'true') {
        setIsOnboardingComplete(true)
        return
      }
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('onboarding_complete')
          .eq('id', user.id)
          .single()
        const complete = data?.onboarding_complete ?? false
        if (complete) await AsyncStorage.setItem(ONBOARDING_KEY, 'true')
        setIsOnboardingComplete(complete)
      } else {
        setIsOnboardingComplete(false)
      }
    } catch {
      setIsOnboardingComplete(false)
    }
  }

  const completeOnboarding = async (data: OnboardingData) => {
    if (user) {
      await supabase.from('profiles').upsert({
        id: user.id,
        name: data.name,
        goal: data.goal,
        fitness_level: data.fitnessLevel,
        weekly_workouts: data.weeklyWorkouts,
        focus_areas: data.focusAreas,
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      })
    }
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true')
    setIsOnboardingComplete(true)
  }

  return (
    <OnboardingContext.Provider
      value={{ isOnboardingComplete, checkOnboarding, completeOnboarding }}
    >
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context)
    throw new Error('useOnboarding must be used within OnboardingProvider')
  return context
}
