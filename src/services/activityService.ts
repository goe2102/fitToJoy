import { supabase } from '../../lib/supabase'
import { insertNotification } from './notificationService'
import { sendPushToUser } from './pushService'
import type { Activity, Participant, ParticipantStatus, RecurrenceType } from '@/types'
import type { ActivityCategory } from '@/constants/categories'

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
  join_cutoff_minutes?: number | null
  is_outdoor?: boolean
  category?: ActivityCategory
  tags?: string[]
  is_recurring?: boolean
  recurrence?: RecurrenceType | null
  parent_id?: string | null
  checkin_mode?: 'button' | 'code'
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

    const mapped = (data ?? [])
      .map((a: any) => ({
        ...a,
        participant_count: a.participant_count?.[0]?.count ?? 0,
      }))
      .filter(
        (a: Activity) =>
          !activityService.isJoinClosed(a.date, a.start_time, a.join_cutoff_minutes)
      )

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
      .select('*, profile:profiles!participants_user_id_fkey(id, username, avatar_url, is_verified)')
      .eq('activity_id', activityId)
      .in('status', ['approved', 'joined'])
      .order('created_at', { ascending: true })
    return { data: (data as any) ?? [], error }
  },

  async getPendingParticipants(activityId: string): Promise<{ data: Participant[]; error: Error | null }> {
    const { data, error } = await supabase
      .from('participants')
      .select('*, profile:profiles!participants_user_id_fkey(id, username, avatar_url, is_verified)')
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

    // Check join cutoff
    const { data: actInfo } = await supabase
      .from('activities')
      .select('date, start_time, join_cutoff_minutes')
      .eq('id', activityId)
      .single()
    if (actInfo && activityService.isJoinClosed(actInfo.date, actInfo.start_time, actInfo.join_cutoff_minutes)) {
      return { error: new Error('Joining is no longer available for this activity'), waitlisted: false }
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

  /** Returns ms until activity starts (negative if already started). */
  msUntilStart(date: string, startTime: string): number {
    const [y, mo, d] = date.split('-').map(Number)
    const [h, m] = startTime.split(':').map(Number)
    const start = new Date(y, mo - 1, d, h, m, 0, 0)
    return start.getTime() - Date.now()
  },

  /** Returns true if joining is no longer allowed (cutoff has passed or activity started). */
  isJoinClosed(date: string, startTime: string, joinCutoffMinutes: number | null): boolean {
    const msUntil = activityService.msUntilStart(date, startTime)
    if (msUntil <= 0) return true // already started
    if (joinCutoffMinutes == null) return false
    return msUntil <= joinCutoffMinutes * 60 * 1000
  },

  async markAsFinished(activityId: string): Promise<{ error: Error | null }> {
    // Fetch to verify start time has passed
    const { data: act } = await supabase
      .from('activities')
      .select('date, start_time, title')
      .eq('id', activityId)
      .single()

    if (!act) return { error: new Error('Activity not found') }
    if (activityService.msUntilStart(act.date, act.start_time) > 0) {
      return { error: new Error('You can only mark an activity as finished after it has started.') }
    }

    const { error } = await supabase
      .from('activities')
      .update({ status: 'finished' })
      .eq('id', activityId)

    // Notify all joined/approved participants via direct push (not DB trigger — faster + shows banner)
    if (!error) {
      const { data: parts } = await supabase
        .from('participants')
        .select('user_id')
        .eq('activity_id', activityId)
        .in('status', ['joined', 'approved'])
      if (parts) {
        const notifPayload = { activity_id: activityId, activity_title: act.title }
        parts.forEach((p) => {
          insertNotification(p.user_id, 'activity_started', notifPayload)
          sendPushToUser(p.user_id, 'activity_started', notifPayload)
        })
      }
    }

    return { error }
  },

  /** Create the next session of a recurring activity, shifted by recurrence interval.
   *  Notifies all previous joined/approved participants. Returns the new activity. */
  async scheduleNextSession(prev: Activity): Promise<{ data: Activity | null; error: Error | null }> {
    const daysToAdd = prev.recurrence === 'weekly' ? 7 : prev.recurrence === 'biweekly' ? 14 : 30

    const [y, mo, d] = prev.date.split('-').map(Number)
    const nextDate = new Date(y, mo - 1, d + daysToAdd)
    const pad = (n: number) => String(n).padStart(2, '0')
    const nextDateStr = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}-${pad(nextDate.getDate())}`

    const { data: newActivity, error } = await activityService.create({
      host_id: prev.host_id,
      title: prev.title,
      description: prev.description ?? undefined,
      latitude: prev.latitude,
      longitude: prev.longitude,
      date: nextDateStr,
      start_time: prev.start_time,
      duration_minutes: prev.duration_minutes,
      is_public: prev.is_public,
      max_participants: prev.max_participants,
      cover_image_url: prev.cover_image_url,
      price: prev.price,
      min_age: prev.min_age,
      max_age: prev.max_age,
      join_cutoff_minutes: prev.join_cutoff_minutes,
      is_outdoor: prev.is_outdoor,
      category: prev.category,
      tags: prev.tags ?? [],
      is_recurring: true,
      recurrence: prev.recurrence,
      parent_id: prev.parent_id ?? prev.id,
    })

    if (!error && newActivity) {
      // Notify all joined/approved participants from previous session
      const { data: parts } = await supabase
        .from('participants')
        .select('user_id')
        .eq('activity_id', prev.id)
        .in('status', ['joined', 'approved'])

      if (parts) {
        const payload = { activity_id: newActivity.id, activity_title: newActivity.title, date: nextDateStr }
        parts.forEach((p) => {
          insertNotification(p.user_id, 'next_session_scheduled', payload)
          sendPushToUser(p.user_id, 'next_session_scheduled', payload)
        })
      }
    }

    return { data: newActivity, error }
  },

  async updateActivity(
    activityId: string,
    updates: Partial<Pick<Activity, 'title' | 'description' | 'date' | 'start_time' | 'duration_minutes' | 'max_participants'>>
  ) {
    const { data: act } = await supabase
      .from('activities')
      .select('date, start_time')
      .eq('id', activityId)
      .single()
    if (act && activityService.msUntilStart(act.date, act.start_time) <= 0) {
      return { error: new Error('This activity has already started and can no longer be edited.') }
    }

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
      insertNotification(next.user_id, 'waitlist_promoted', {
        activity_id: activityId,
        activity_title: act.title,
      })
    }
  },

  async checkIn(activityId: string, userId: string): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('participants')
      .update({ checked_in: true })
      .eq('activity_id', activityId)
      .eq('user_id', userId)
      .in('status', ['joined', 'approved'])
    return { error }
  },

  async checkInWithCode(activityId: string, userId: string, code: string): Promise<{ error: Error | null; wrongCode?: boolean }> {
    const { data: act } = await supabase
      .from('activities')
      .select('checkin_code')
      .eq('id', activityId)
      .single()
    if (!act?.checkin_code || act.checkin_code !== code.trim()) {
      return { error: new Error('Wrong code'), wrongCode: true }
    }
    return activityService.checkIn(activityId, userId)
  },

  async generateCheckinCode(activityId: string): Promise<{ code: string | null; error: Error | null }> {
    const code = String(Math.floor(1000 + Math.random() * 9000))
    const { error } = await supabase
      .from('activities')
      .update({ checkin_code: code })
      .eq('id', activityId)
    return { code: error ? null : code, error }
  },

  /** For a list of activity IDs, returns a map of activityId → friend profiles joined.
   *  "Friends" = users the current user follows with accepted status. */
  async getFriendParticipants(
    activityIds: string[],
    currentUserId: string
  ): Promise<Record<string, { user_id: string; username: string; avatar_url: string | null }[]>> {
    if (!activityIds.length) return {}

    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId)
      .eq('status', 'accepted')

    const followingIds = (follows ?? []).map((f: any) => f.following_id)
    if (!followingIds.length) return {}

    const { data: parts } = await supabase
      .from('participants')
      .select('activity_id, user_id, profile:profiles!participants_user_id_fkey(id, username, avatar_url)')
      .in('activity_id', activityIds)
      .in('status', ['joined', 'approved'])
      .in('user_id', followingIds)

    const result: Record<string, { user_id: string; username: string; avatar_url: string | null }[]> = {}
    for (const p of parts ?? []) {
      const profile = Array.isArray((p as any).profile) ? (p as any).profile[0] : (p as any).profile
      if (!profile) continue
      if (!result[p.activity_id]) result[p.activity_id] = []
      result[p.activity_id].push({ user_id: p.user_id, username: profile.username, avatar_url: profile.avatar_url })
    }
    return result
  },

  async getMyCheckedIn(activityId: string, userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('participants')
      .select('checked_in')
      .eq('activity_id', activityId)
      .eq('user_id', userId)
      .maybeSingle()
    return data?.checked_in ?? false
  },

  async getWaitlistPosition(activityId: string, userId: string): Promise<number | null> {
    const { data } = await supabase
      .from('participants')
      .select('user_id, created_at')
      .eq('activity_id', activityId)
      .eq('status', 'waitlisted')
      .order('created_at', { ascending: true })
    if (!data) return null
    const idx = data.findIndex((p: any) => p.user_id === userId)
    return idx >= 0 ? idx + 1 : null
  },

  async getWaitlist(activityId: string): Promise<{ data: Participant[]; error: Error | null }> {
    const { data, error } = await supabase
      .from('participants')
      .select('*, profile:profiles!participants_user_id_fkey(id, username, avatar_url, is_verified)')
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
