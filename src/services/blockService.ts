import { supabase } from '../../lib/supabase'

export const blockService = {
  async block(blockerId: string, blockedId: string) {
    // Also remove any follow relationships silently
    await Promise.all([
      supabase.from('follows').delete()
        .eq('follower_id', blockerId).eq('following_id', blockedId),
      supabase.from('follows').delete()
        .eq('follower_id', blockedId).eq('following_id', blockerId),
    ])
    const { error } = await supabase
      .from('blocks')
      .insert({ blocker_id: blockerId, blocked_id: blockedId })
    return { error }
  },

  async unblock(blockerId: string, blockedId: string) {
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId)
    return { error }
  },

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const { data } = await supabase
      .from('blocks')
      .select('blocker_id')
      .or(`and(blocker_id.eq.${blockerId},blocked_id.eq.${blockedId}),and(blocker_id.eq.${blockedId},blocked_id.eq.${blockerId})`)
      .maybeSingle()
    return !!data
  },

  async getBlockedUsers(userId: string) {
    const { data, error } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', userId)
    return { data: data?.map((b) => b.blocked_id) ?? [], error }
  },

  async getBlockedUsersWithProfiles(userId: string) {
    const { data, error } = await supabase
      .from('blocks')
      .select('created_at, blocked:profiles!blocks_blocked_id_fkey(id, username, avatar_url, is_verified)')
      .eq('blocker_id', userId)
      .order('created_at', { ascending: false })
    return {
      data: (data ?? []).map((b: any) => ({ ...b.blocked, blocked_since: b.created_at })) as {
        id: string
        username: string
        avatar_url: string | null
        is_verified: boolean
        blocked_since: string
      }[],
      error,
    }
  },
}
