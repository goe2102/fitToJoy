import { supabase } from '../../lib/supabase'
import { imageService } from './imageService'
import type { Rating } from '@/types'

export type ActivityPhoto = {
  id: string
  activity_id: string
  user_id: string
  url: string
  created_at: string
  profile?: { username: string; avatar_url: string | null } | null
}

export const ratingService = {
  /** Submit a rating. One per (activity, rater) — enforced by DB UNIQUE constraint. */
  async submitRating(
    activityId: string,
    raterId: string,
    rateeId: string,
    rating: number,
    reviewText?: string
  ): Promise<{ error: Error | null }> {
    const { error } = await supabase.from('ratings').insert({
      activity_id: activityId,
      rater_id: raterId,
      ratee_id: rateeId,
      rating,
      review_text: reviewText?.trim() || null,
    })
    return { error }
  },

  /** Check if the current user has already rated for this activity. */
  async getMyRating(activityId: string, raterId: string): Promise<Rating | null> {
    const { data } = await supabase
      .from('ratings')
      .select('*')
      .eq('activity_id', activityId)
      .eq('rater_id', raterId)
      .maybeSingle()
    return data ?? null
  },

  /** All ratings received by a user (for their profile reviews section). */
  async getRatingsForHost(
    rateeId: string
  ): Promise<{ data: (Rating & { rater: { username: string; avatar_url: string | null } | null; activity_title: string | null })[]; error: Error | null }> {
    const { data, error } = await supabase
      .from('ratings')
      .select(`
        *,
        rater:profiles!ratings_rater_id_fkey(username, avatar_url),
        activity:activities!ratings_activity_id_fkey(title)
      `)
      .eq('ratee_id', rateeId)
      .order('created_at', { ascending: false })

    const mapped = (data ?? []).map((r: any) => ({
      ...r,
      rater: Array.isArray(r.rater) ? r.rater[0] : r.rater,
      activity_title: (Array.isArray(r.activity) ? r.activity[0] : r.activity)?.title ?? null,
    }))

    return { data: mapped, error }
  },

  /** All ratings for a specific activity (for the reviews screen). */
  async getRatingsForActivity(activityId: string): Promise<{
    data: (Rating & { rater: { id: string; username: string; avatar_url: string | null } | null })[]
    error: Error | null
  }> {
    const { data, error } = await supabase
      .from('ratings')
      .select(`*, rater:profiles!ratings_rater_id_fkey(id, username, avatar_url)`)
      .eq('activity_id', activityId)
      .order('created_at', { ascending: false })

    const mapped = (data ?? []).map((r: any) => ({
      ...r,
      rater: Array.isArray(r.rater) ? r.rater[0] : r.rater,
    }))

    return { data: mapped, error }
  },

  /** Upload and save up to 3 photos for an activity. Returns URLs saved. */
  async submitPhotos(
    activityId: string,
    userId: string,
    base64Photos: string[]
  ): Promise<{ urls: string[]; error: Error | null }> {
    const urls: string[] = []
    for (let i = 0; i < Math.min(base64Photos.length, 3); i++) {
      const filePath = `${activityId}/${userId}_${Date.now()}_${i}.jpg`
      const { url, error } = await imageService.uploadImage('activity-photos', filePath, base64Photos[i])
      if (error) return { urls, error: error as Error }
      if (url) urls.push(url)
    }
    if (urls.length === 0) return { urls, error: null }
    const { error } = await supabase.from('activity_photos').insert(
      urls.map((url) => ({ activity_id: activityId, user_id: userId, url }))
    )
    return { urls, error }
  },

  /** Fetch all photos for an activity with uploader info. */
  async getPhotosForActivity(activityId: string): Promise<{ data: ActivityPhoto[]; error: Error | null }> {
    const { data, error } = await supabase
      .from('activity_photos')
      .select('*, profile:profiles!activity_photos_user_id_fkey(username, avatar_url)')
      .eq('activity_id', activityId)
      .order('created_at', { ascending: false })
    const mapped = (data ?? []).map((p: any) => ({
      ...p,
      profile: Array.isArray(p.profile) ? p.profile[0] : p.profile,
    }))
    return { data: mapped, error }
  },

  /**
   * All finished activities for a user — both hosted and participated in.
   * canRate = true only for participated-in activities (not own hosted ones).
   */
  async getFinishedActivitiesForRating(userId: string): Promise<{
    data: {
      activity: { id: string; title: string; date: string; host_id: string; host_username: string; host_avatar_url: string | null }
      myRating: Rating | null
      canRate: boolean
    }[]
    error: Error | null
  }> {
    // Fetch hosted finished activities + participated finished activities in parallel
    const [hostedRes, partsRes] = await Promise.all([
      supabase
        .from('activities')
        .select('id, title, date, host_id, status, host:profiles!activities_host_id_fkey(username, avatar_url)')
        .eq('host_id', userId)
        .eq('status', 'finished'),
      supabase
        .from('participants')
        .select(`
          activity:activities!participants_activity_id_fkey(
            id, title, date, host_id, status,
            host:profiles!activities_host_id_fkey(username, avatar_url)
          )
        `)
        .eq('user_id', userId)
        .in('status', ['joined', 'approved']),
    ])

    if (hostedRes.error) return { data: [], error: hostedRes.error }

    // Hosted finished
    const hostedFinished = (hostedRes.data ?? []).map((a: any) => {
      const host = Array.isArray(a.host) ? a.host[0] : a.host
      return { id: a.id, title: a.title, date: a.date, host_id: a.host_id, host_username: host?.username ?? '', host_avatar_url: host?.avatar_url ?? null, canRate: false }
    })

    // Participated finished (not own hosted)
    const participatedFinished = (partsRes.data ?? [])
      .map((p: any) => (Array.isArray(p.activity) ? p.activity[0] : p.activity))
      .filter((a: any) => a && a.status === 'finished' && a.host_id !== userId)
      .map((a: any) => {
        const host = Array.isArray(a.host) ? a.host[0] : a.host
        return { id: a.id, title: a.title, date: a.date, host_id: a.host_id, host_username: host?.username ?? '', host_avatar_url: host?.avatar_url ?? null, canRate: true }
      })

    // Merge, deduplicate by id (in case somehow both)
    const seen = new Set<string>()
    const all = [...hostedFinished, ...participatedFinished].filter((a) => {
      if (seen.has(a.id)) return false
      seen.add(a.id)
      return true
    })

    if (!all.length) return { data: [], error: null }

    // Fetch existing ratings the user submitted
    const rateableIds = all.filter((a) => a.canRate).map((a) => a.id)
    const ratingMap: Record<string, Rating> = {}
    if (rateableIds.length) {
      const { data: myRatings } = await supabase
        .from('ratings')
        .select('*')
        .eq('rater_id', userId)
        .in('activity_id', rateableIds)
      for (const r of myRatings ?? []) ratingMap[r.activity_id] = r
    }

    // Sort newest first
    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return {
      data: all.map((a) => ({
        activity: { id: a.id, title: a.title, date: a.date, host_id: a.host_id, host_username: a.host_username, host_avatar_url: a.host_avatar_url },
        myRating: ratingMap[a.id] ?? null,
        canRate: a.canRate,
      })),
      error: null,
    }
  },
}
