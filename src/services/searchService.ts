import { supabase } from '../../lib/supabase'
import type { Profile, Activity, FollowStatus } from '@/types'

export interface UserResult extends Pick<Profile, 'id' | 'username' | 'avatar_url' | 'bio' | 'is_verified' | 'is_private'> {
  follow_status: FollowStatus
}

export interface ActivityResult extends Activity {
  host: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'is_verified'>
  participant_count: number
}

// Fetch IDs of users blocked by or blocking currentUserId (both directions)
async function getBlockedIds(currentUserId: string): Promise<string[]> {
  const { data } = await supabase
    .from('blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${currentUserId},blocked_id.eq.${currentUserId}`)
  if (!data) return []
  return data.map((b) => (b.blocker_id === currentUserId ? b.blocked_id : b.blocker_id))
}

// For a list of user IDs, get the current user's follow status toward each
async function getFollowStatuses(
  currentUserId: string,
  targetIds: string[]
): Promise<Record<string, FollowStatus>> {
  if (targetIds.length === 0) return {}
  const { data } = await supabase
    .from('follows')
    .select('following_id, status')
    .eq('follower_id', currentUserId)
    .in('following_id', targetIds)
  const map: Record<string, FollowStatus> = {}
  for (const row of data ?? []) {
    map[row.following_id] = row.status as FollowStatus
  }
  return map
}

export const searchService = {
  async searchUsers(query: string, currentUserId: string): Promise<UserResult[]> {
    const blockedIds = await getBlockedIds(currentUserId)

    let q = supabase
      .from('profiles')
      .select('id, username, avatar_url, bio, is_verified, is_private')
      .neq('id', currentUserId)
      .ilike('username', `%${query}%`)
      .limit(30)

    if (blockedIds.length > 0) q = q.not('id', 'in', `(${blockedIds.join(',')})`)

    const { data } = await q
    if (!data || data.length === 0) return []

    const statuses = await getFollowStatuses(currentUserId, data.map((u) => u.id))
    return data.map((u) => ({ ...u, follow_status: statuses[u.id] ?? 'none' }))
  },

  async getSuggestedUsers(currentUserId: string): Promise<UserResult[]> {
    const blockedIds = await getBlockedIds(currentUserId)

    // People the current user already follows
    const { data: following } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId)
    const followingIds = following?.map((f) => f.following_id) ?? []

    const excludeIds = [...new Set([currentUserId, ...blockedIds, ...followingIds])]

    let q = supabase
      .from('profiles')
      .select('id, username, avatar_url, bio, is_verified, is_private')
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .limit(20)

    const { data } = await q
    if (!data || data.length === 0) return []

    const statuses = await getFollowStatuses(currentUserId, data.map((u) => u.id))
    return data.map((u) => ({ ...u, follow_status: statuses[u.id] ?? 'none' }))
  },

  async searchActivities(query: string, currentUserId: string): Promise<ActivityResult[]> {
    const blockedIds = await getBlockedIds(currentUserId)

    let q = supabase
      .from('activities')
      .select(`
        *,
        host:profiles!activities_host_id_fkey(id, username, avatar_url, is_verified),
        participant_count:participants(count)
      `)
      .eq('status', 'active')
      .eq('is_public', true)
      .ilike('title', `%${query}%`)
      .limit(30)

    if (blockedIds.length > 0) q = q.not('host_id', 'in', `(${blockedIds.join(',')})`)

    const { data } = await q
    if (!data) return []

    return data.map((a: any) => ({
      ...a,
      participant_count: a.participant_count?.[0]?.count ?? 0,
    }))
  },

  async getRecentActivities(currentUserId: string): Promise<ActivityResult[]> {
    const blockedIds = await getBlockedIds(currentUserId)

    let q = supabase
      .from('activities')
      .select(`
        *,
        host:profiles!activities_host_id_fkey(id, username, avatar_url, is_verified),
        participant_count:participants(count)
      `)
      .eq('status', 'active')
      .eq('is_public', true)
      .neq('host_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (blockedIds.length > 0) q = q.not('host_id', 'in', `(${blockedIds.join(',')})`)

    const { data } = await q
    if (!data) return []

    return data.map((a: any) => ({
      ...a,
      participant_count: a.participant_count?.[0]?.count ?? 0,
    }))
  },
}
