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
    // Fetch activities with participant count + host info
    const { data, error } = await supabase
      .from('activities')
      .select(`
        *,
        host:profiles!activities_host_id_fkey(id, username, avatar_url, is_verified),
        participant_count:participants(count)
      `)
      .eq('status', 'active')
      .neq('host_id', currentUserId) // own activities excluded from map
      .order('date', { ascending: true })

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
    activityTitle?: string
  ) {
    const status = isPublic ? 'joined' : 'pending'
    const { error } = await supabase
      .from('participants')
      .insert({ activity_id: activityId, user_id: userId, status })

    // Notify host when someone requests to join a private activity
    if (!error && !isPublic && hostId && fromProfile && activityTitle) {
      insertNotification(hostId, 'join_request', {
        from_user_id: userId,
        from_username: fromProfile.username,
        from_avatar_url: fromProfile.avatar_url,
        activity_id: activityId,
        activity_title: activityTitle,
      })
    }

    return { error }
  },

  async leave(activityId: string, userId: string) {
    const { error } = await supabase
      .from('participants')
      .delete()
      .eq('activity_id', activityId)
      .eq('user_id', userId)
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
    if (!error && activityTitle) {
      insertNotification(userId, 'kicked_from_activity', { activity_id: activityId, activity_title: activityTitle })
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

  async cancelActivity(activityId: string) {
    // Notify participants before cancelling
    const { data: activity } = await supabase.from('activities').select('title').eq('id', activityId).single()
    const { data: parts } = await supabase
      .from('participants').select('user_id').eq('activity_id', activityId).in('status', ['joined', 'approved', 'pending'])
    if (activity && parts) {
      parts.forEach((p) => insertNotification(p.user_id, 'activity_cancelled', { activity_id: activityId, activity_title: activity.title }))
    }

    const { error } = await supabase
      .from('activities')
      .update({ status: 'cancelled' })
      .eq('id', activityId)
    return { error }
  },
}
