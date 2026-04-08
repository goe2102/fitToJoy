import React, { createContext, useContext, useState } from 'react'

import { useAuth } from './AuthContext'
import { supabase } from '../../lib/supabase'
import { imageService } from '@/services/imageService'

interface OnboardingContextType {
  isOnboardingComplete: boolean | null
  checkOnboarding: () => Promise<void>
  completeOnboarding: (data: OnboardingData) => Promise<void>
}

export interface OnboardingData {
  id: string
  username: string
  birthday: string
  avatarBase64: string
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
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('onboarding_complete')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error fetching onboarding status:', error)
          setIsOnboardingComplete(false)
          return
        }

        const complete = data?.onboarding_complete ?? false
        setIsOnboardingComplete(complete)
      } else {
        setIsOnboardingComplete(false)
      }
    } catch (err) {
      console.error('Unexpected error checking onboarding:', err)
      setIsOnboardingComplete(false)
    }
  }

  const completeOnboarding = async (data: OnboardingData) => {
    if (!user) return

    let finalAvatarUrl = null

    if (data.avatarBase64) {
      const filePath = `${user.id}/profile.jpg`

      const { url, error: uploadError } = await imageService.uploadImage(
        'avatars',
        filePath,
        data.avatarBase64
      )

      if (uploadError) {
        console.error('Failed to upload image:', uploadError)
        alert(
          'Bild konnte nicht hochgeladen werden, aber wir speichern den Rest!'
        )
      } else {
        finalAvatarUrl = url
      }
    }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      username: data.username,
      birthday: data.birthday,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
      email: user.email,
      avatar_url: finalAvatarUrl,
    })

    if (error) {
      console.error('Supabase Save Error:', error)
      alert('Fehler beim Speichern: ' + error.message)
      return // Stop execution, don't update state!
    }

    // Only update the React state if the DB save was successful
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
