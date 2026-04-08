import { supabase } from '../../lib/supabase'
import { imageService } from './imageService'
import type { Profile, ProfileStats, Activity } from '@/types'

export const profileService = {
  async getProfile(userId: string): Promise<{ data: Profile | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return { data, error }
  },

  async updateProfile(
    userId: string,
    updates: Partial<Pick<Profile, 'username' | 'bio' | 'is_private'>>
  ): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
    return { error }
  },

  async updateAvatar(
    userId: string,
    base64: string
  ): Promise<{ url: string | null; error: Error | null }> {
    const filePath = `${userId}/profile.jpg`
    const { url, error } = await imageService.uploadImage('avatars', filePath, base64)
    if (error || !url) return { url: null, error: error as Error | null }

    const { error: dbError } = await supabase
      .from('profiles')
      .update({ avatar_url: url, updated_at: new Date().toISOString() })
      .eq('id', userId)

    return { url, error: dbError as Error | null }
  },

  async getStats(userId: string): Promise<{ data: ProfileStats; error: Error | null }> {
    const [followers, following, activities] = await Promise.all([
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId)
        .eq('status', 'accepted'),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId)
        .eq('status', 'accepted'),
      supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', userId)
        .eq('status', 'active'),
    ])

    return {
      data: {
        follower_count: followers.count ?? 0,
        following_count: following.count ?? 0,
        activity_count: activities.count ?? 0,
      },
      error: followers.error ?? following.error ?? activities.error,
    }
  },

  async getUserActivities(userId: string): Promise<{ data: Activity[]; error: Error | null }> {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('host_id', userId)
      .eq('status', 'active')
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    return { data: data ?? [], error }
  },

  async checkUsernameAvailable(username: string, currentUserId: string): Promise<boolean> {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .neq('id', currentUserId)
      .maybeSingle()
    return !data
  },
}
