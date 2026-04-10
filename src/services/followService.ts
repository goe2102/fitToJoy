import { supabase } from '../../lib/supabase'
import { insertNotification } from './notificationService'
import type { Follow, FollowStatus, Profile } from '@/types'

export const followService = {
  async getFollowStatus(currentUserId: string, targetUserId: string): Promise<FollowStatus> {
    const { data } = await supabase
      .from('follows')
      .select('status')
      .eq('follower_id', currentUserId)
      .eq('following_id', targetUserId)
      .maybeSingle()
    if (!data) return 'none'
    return data.status as FollowStatus
  },

  /** Send a follow request (or instantly follow if target is public) */
  async follow(
    followerId: string,
    followingId: string,
    targetIsPrivate: boolean,
    fromProfile?: { username: string; avatar_url: string | null }
  ) {
    const status = targetIsPrivate ? 'pending' : 'accepted'
    const { error } = await supabase
      .from('follows')
      .upsert(
        { follower_id: followerId, following_id: followingId, status },
        { onConflict: 'follower_id,following_id' }
      )

    if (!error && fromProfile) {
      const type = targetIsPrivate ? 'follow_request' : 'follow_accepted'
      insertNotification(followingId, type, {
        from_user_id: followerId,
        from_username: fromProfile.username,
        from_avatar_url: fromProfile.avatar_url,
      })
    }

    return { error }
  },

  async unfollow(followerId: string, followingId: string) {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
    return { error }
  },

  async acceptRequest(
    followerId: string,
    followingId: string,
    fromProfile?: { username: string; avatar_url: string | null }
  ) {
    const { error } = await supabase
      .from('follows')
      .update({ status: 'accepted' })
      .eq('follower_id', followerId)
      .eq('following_id', followingId)

    if (!error && fromProfile) {
      insertNotification(followerId, 'follow_accepted', {
        from_user_id: followingId,
        from_username: fromProfile.username,
        from_avatar_url: fromProfile.avatar_url,
      })
    }

    return { error }
  },

  async rejectRequest(followerId: string, followingId: string) {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
    return { error }
  },

  async getPendingRequests(
    userId: string
  ): Promise<{ data: (Follow & { follower: Pick<Profile, 'id' | 'username' | 'avatar_url'> })[]; error: Error | null }> {
    const { data, error } = await supabase
      .from('follows')
      .select('*, follower:profiles!follows_follower_id_fkey(id, username, avatar_url)')
      .eq('following_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    return { data: (data as any) ?? [], error }
  },

  async getFollowers(userId: string): Promise<{ data: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'is_verified'>[]; error: Error | null }> {
    const { data, error } = await supabase
      .from('follows')
      .select('follower:profiles!follows_follower_id_fkey(id, username, avatar_url, is_verified)')
      .eq('following_id', userId)
      .eq('status', 'accepted')
    return { data: data?.map((d: any) => d.follower) ?? [], error }
  },

  async getFollowing(userId: string): Promise<{ data: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'is_verified'>[]; error: Error | null }> {
    const { data, error } = await supabase
      .from('follows')
      .select('following:profiles!follows_following_id_fkey(id, username, avatar_url, is_verified)')
      .eq('follower_id', userId)
      .eq('status', 'accepted')
    return { data: data?.map((d: any) => d.following) ?? [], error }
  },
}
