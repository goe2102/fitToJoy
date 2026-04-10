import { supabase } from '../../lib/supabase'
import { insertNotification } from './notificationService'
import type { Activity, Participant, ParticipantStatus } from '@/types'

export interface CreateActivityInput {
  host_id: string
  title: string
  description?: string
  latitude: number
  longitude: number
  date: string        // ISO date string YYYY-MM-DD
  start_time: string  // HH:MM
  duration_minutes: number
  is_public: boolean
  max_participants?: number | null
  cover_image_url?: string | null
  price?: number | null
  min_age?: number | null
  max_age?: number | null
}

export const activityService = {
  async create(input: CreateActivityInput): Promise<{ data: Activity | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('activities')
      .insert({
        ...input,
        status: 'active',
      })
      .select()
      .single()
    return { data, error }
  },

  async getVisibleActivities(
    currentUserId: string
  ): Promise<{ data: Activity[]; error: Error | null }> {
    // Collect blocked user IDs (both directions) + activities already joined
    const [blocksRes, joinedRes] = await Promise.all([
      supabase
        .from('blocks')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${currentUserId},blocked_id.eq.${currentUserId}`),
      supabase
        .from('participants')
        .select('activity_id')
        .eq('user_id', currentUserId)
        .in('status', ['joined', 'approved']),
    ])

    const blockedIds = (blocksRes.data ?? []).map((b: any) =>
      b.blocker_id === currentUserId ? b.blocked_id : b.blocker_id
    )
    const joinedIds = (joinedRes.data ?? []).map((p: any) => p.activity_id)

    // Fetch activities with participant count + host info
    let query = supabase
      .from('activities')
      .select(`
        *,
        host:profiles!activities_host_id_fkey(id, username, avatar_url, is_verified),
        participant_count:participants(count)
      `)
      .eq('status', 'active')
      .neq('host_id', currentUserId)
      .order('date', { ascending: true })

    if (blockedIds.length > 0) {
      query = query.not('host_id', 'in', `(${blockedIds.join(',')})`)
    }
    if (joinedIds.length > 0) {
      query = query.not('id', 'in', `(${joinedIds.join(',')})`)
    }

    const { data, error } = await query
    if (error) return { data: [], error }

    const mapped = (data ?? []).map((a: any) => ({
      ...a,
      participant_count: a.participant_count?.[0]?.count ?? 0,
    }))

    return { data: mapped, error: null }
  },

  async getActivityById(id: string): Promise<{ data: Activity | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('activities')
      .select(`
        *,
        host:profiles!activities_host_id_fkey(id, username, avatar_url, is_verified),
        participant_count:participants(count)
      `)
      .eq('id', id)
      .single()

    if (error) return { data: null, error }
    return {
      data: { ...data, participant_count: data.participant_count?.[0]?.count ?? 0 },
      error: null,
    }
  },

  async getParticipants(activityId: string): Promise<{ data: Participant[]; error: Error | null }> {
    const { data, error } = await supabase
      .from('participants')
      .select('*, profile:profiles!participants_user_id_fkey(id, username, avatar_url)')
      .eq('activity_id', activityId)
      .in('status', ['approved', 'joined'])
      .order('created_at', { ascending: true })
    return { data: (data as any) ?? [], error }
  },

  async getPendingParticipants(activityId: string): Promise<{ data: Participant[]; error: Error | null }> {
    const { data, error } = await supabase
      .from('participants')
      .select('*, profile:profiles!participants_user_id_fkey(id, username, avatar_url)')
      .eq('activity_id', activityId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    return { data: (data as any) ?? [], error }
  },

  async getMyParticipantStatus(
    activityId: string,
    userId: string
  ): Promise<ParticipantStatus | null> {
    const { data } = await supabase
      .from('participants')
      .select('status')
      .eq('activity_id', activityId)
      .eq('user_id', userId)
      .maybeSingle()
    return (data?.status as ParticipantStatus) ?? null
  },

  async join(
    activityId: string,
    userId: string,
    isPublic: boolean,
    fromProfile?: { username: string; avatar_url: string | null },
    hostId?: string,
    activityTitle?: string,
    maxParticipants?: number | null
  ): Promise<{ error: Error | null; waitlisted: boolean }> {
    // Block kicked users from rejoining
    const { data: existing } = await supabase
      .from('participants')
      .select('status')
      .eq('activity_id', activityId)
      .eq('user_id', userId)
      .maybeSingle()
    if (existing?.status === 'kicked') {
      return { error: new Error('You have been removed from this activity'), waitlisted: false }
    }

    // For public activities with a cap: check current count to decide waitlist
    let status: string = isPublic ? 'joined' : 'pending'
    if (isPublic && maxParticipants) {
      const { count } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('activity_id', activityId)
        .in('status', ['joined', 'approved'])
      if ((count ?? 0) >= maxParticipants) {
        status = 'waitlisted'
      }
    }

    const { error } = await supabase
      .from('participants')
      .insert({ activity_id: activityId, user_id: userId, status })

    if (!error && hostId && fromProfile && activityTitle) {
      if (status === 'joined') {
        insertNotification(hostId, 'joined_activity', {
          from_user_id: userId,
          from_username: fromProfile.username,
          from_avatar_url: fromProfile.avatar_url,
          activity_id: activityId,
          activity_title: activityTitle,
        })
      } else if (status === 'pending') {
        insertNotification(hostId, 'join_request', {
          from_user_id: userId,
          from_username: fromProfile.username,
          from_avatar_url: fromProfile.avatar_url,
          activity_id: activityId,
          activity_title: activityTitle,
        })
      }
    }

    return { error, waitlisted: status === 'waitlisted' }
  },

  async leave(activityId: string, userId: string) {
    const { error } = await supabase
      .from('participants')
      .delete()
      .eq('activity_id', activityId)
      .eq('user_id', userId)

    if (!error) {
      // Remove from group chat immediately
      const { data: chat } = await supabase
        .from('activity_chats')
        .select('id')
        .eq('activity_id', activityId)
        .maybeSingle()
      if (chat) {
        await supabase
          .from('group_chat_members')
          .delete()
          .eq('chat_id', chat.id)
          .eq('user_id', userId)
      }

      // Promote first waitlisted user if this was a public limited-spot activity
      const { data: act } = await supabase
        .from('activities')
        .select('is_public, max_participants')
        .eq('id', activityId)
        .maybeSingle()
      if (act?.is_public && act?.max_participants) {
        await activityService.promoteFromWaitlist(activityId)
      }
    }

    return { error }
  },

  async approveParticipant(activityId: string, userId: string, activityTitle?: string) {
    const { error } = await supabase
      .from('participants')
      .update({ status: 'approved' })
      .eq('activity_id', activityId)
      .eq('user_id', userId)
    if (!error && activityTitle) {
      insertNotification(userId, 'join_approved', { activity_id: activityId, activity_title: activityTitle })
    }
    return { error }
  },

  async rejectParticipant(activityId: string, userId: string, activityTitle?: string) {
    const { error } = await supabase
      .from('participants')
      .update({ status: 'kicked' })
      .eq('activity_id', activityId)
      .eq('user_id', userId)
    if (!error && activityTitle) {
      insertNotification(userId, 'join_denied', { activity_id: activityId, activity_title: activityTitle })
    }
    return { error }
  },

  async kickParticipant(activityId: string, userId: string, activityTitle?: string) {
    const { error } = await supabase
      .from('participants')
      .update({ status: 'kicked' })
      .eq('activity_id', activityId)
      .eq('user_id', userId)
    if (!error) {
      // Remove from group chat immediately
      const { data: chat } = await supabase
        .from('activity_chats')
        .select('id')
        .eq('activity_id', activityId)
        .maybeSingle()
      if (chat) {
        await supabase
          .from('group_chat_members')
          .delete()
          .eq('chat_id', chat.id)
          .eq('user_id', userId)
      }

      if (activityTitle) {
        insertNotification(userId, 'kicked_from_activity', { activity_id: activityId, activity_title: activityTitle })
      }
      // Promote next person from waitlist
      const { data: act } = await supabase
        .from('activities')
        .select('is_public, max_participants')
        .eq('id', activityId)
        .maybeSingle()
      if (act?.is_public && act?.max_participants) {
        await activityService.promoteFromWaitlist(activityId)
      }
    }
    return { error }
  },

  async updateActivity(
    activityId: string,
    updates: Partial<Pick<Activity, 'title' | 'description' | 'date' | 'start_time' | 'duration_minutes' | 'max_participants'>>
  ) {
    const { error } = await supabase
      .from('activities')
      .update(updates)
      .eq('id', activityId)

    // Notify all active participants
    if (!error) {
      const { data: activity } = await supabase.from('activities').select('title').eq('id', activityId).single()
      const { data: parts } = await supabase
        .from('participants').select('user_id').eq('activity_id', activityId).in('status', ['joined', 'approved'])
      if (activity && parts) {
        parts.forEach((p) => insertNotification(p.user_id, 'activity_updated', { activity_id: activityId, activity_title: activity.title }))
      }
    }

    return { error }
  },

  async promoteFromWaitlist(activityId: string): Promise<void> {
    const { data: next } = await supabase
      .from('participants')
      .select('user_id')
      .eq('activity_id', activityId)
      .eq('status', 'waitlisted')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!next) return

    await supabase
      .from('participants')
      .update({ status: 'joined' })
      .eq('activity_id', activityId)
      .eq('user_id', next.user_id)

    const { data: act } = await supabase
      .from('activities')
      .select('title')
      .eq('id', activityId)
      .maybeSingle()

    if (act) {
      insertNotification(next.user_id, 'join_approved', {
        activity_id: activityId,
        activity_title: act.title,
      })
    }
  },

  async getWaitlist(activityId: string): Promise<{ data: Participant[]; error: Error | null }> {
    const { data, error } = await supabase
      .from('participants')
      .select('*, profile:profiles!participants_user_id_fkey(id, username, avatar_url)')
      .eq('activity_id', activityId)
      .eq('status', 'waitlisted')
      .order('created_at', { ascending: true })
    return { data: (data as any) ?? [], error }
  },

  async cancelActivity(activityId: string) {
    // 1. Notify all participants before deleting
    const { data: activity } = await supabase.from('activities').select('title').eq('id', activityId).single()
    const { data: parts } = await supabase
      .from('participants').select('user_id').eq('activity_id', activityId)
      .in('status', ['joined', 'approved', 'pending', 'waitlisted'])
    if (activity && parts) {
      parts.forEach((p) =>
        insertNotification(p.user_id, 'activity_cancelled', {
          activity_id: activityId,
          activity_title: activity.title,
        })
      )
    }

    // 2. Delete group chat messages + members + chats
    const { data: chats } = await supabase
      .from('activity_chats').select('id').eq('activity_id', activityId)
    if (chats?.length) {
      const chatIds = chats.map((c: any) => c.id)
      await supabase.from('group_messages').delete().in('chat_id', chatIds)
      await supabase.from('group_chat_members').delete().in('chat_id', chatIds)
      await supabase.from('activity_chats').delete().eq('activity_id', activityId)
    }

    // 3. Delete participants
    await supabase.from('participants').delete().eq('activity_id', activityId)

    // 4. Hard-delete the activity
    const { error } = await supabase.from('activities').delete().eq('id', activityId)
    return { error }
  },
}
