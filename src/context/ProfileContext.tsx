import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { profileService } from '@/services/profileService'
import { useAuth } from './AuthContext'
import type { Profile, ProfileStats } from '@/types'

interface ProfileContextType {
  profile: Profile | null
  stats: ProfileStats
  loading: boolean
  refreshProfile: () => Promise<void>
  updateProfile: (updates: Partial<Pick<Profile, 'username' | 'bio' | 'is_private'>>) => Promise<{ error: Error | null }>
  updateAvatar: (base64: string) => Promise<{ error: Error | null }>
}

const DEFAULT_STATS: ProfileStats = { follower_count: 0, following_count: 0, activity_count: 0, finished_count: 0 }

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<ProfileStats>(DEFAULT_STATS)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setStats(DEFAULT_STATS)
      setLoading(false)
      return
    }
    setLoading(true)
    const [{ data: p }, { data: s }] = await Promise.all([
      profileService.getProfile(user.id),
      profileService.getStats(user.id),
    ])
    setProfile(p)
    setStats(s)
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const updateProfile = async (updates: Partial<Pick<Profile, 'username' | 'bio' | 'is_private'>>) => {
    if (!user) return { error: new Error('Not authenticated') }
    const { error } = await profileService.updateProfile(user.id, updates)
    if (!error) setProfile((prev) => prev ? { ...prev, ...updates } : prev)
    return { error }
  }

  const updateAvatar = async (base64: string) => {
    if (!user) return { error: new Error('Not authenticated') }
    const { url, error } = await profileService.updateAvatar(user.id, base64)
    if (!error && url) setProfile((prev) => prev ? { ...prev, avatar_url: url } : prev)
    return { error }
  }

  return (
    <ProfileContext.Provider value={{ profile, stats, loading, refreshProfile: load, updateProfile, updateAvatar }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}
