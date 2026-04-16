import { supabase } from '../../lib/supabase'
import type { Activity } from '../types'

export const savedActivityService = {
  async save(userId: string, activityId: string) {
    const { error } = await supabase
      .from('saved_activities')
      .insert({ user_id: userId, activity_id: activityId })
    return { error }
  },

  async unsave(userId: string, activityId: string) {
    const { error } = await supabase
      .from('saved_activities')
      .delete()
      .eq('user_id', userId)
      .eq('activity_id', activityId)
    return { error }
  },

  async isSaved(userId: string, activityId: string): Promise<boolean> {
    const { data } = await supabase
      .from('saved_activities')
      .select('activity_id')
      .eq('user_id', userId)
      .eq('activity_id', activityId)
      .maybeSingle()
    return !!data
  },

  async getSavedActivities(userId: string): Promise<{ data: Activity[]; error: Error | null }> {
    const { data, error } = await supabase
      .from('saved_activities')
      .select(`
        activity:activities(
          *,
          host:profiles!activities_host_id_fkey(id, username, avatar_url, is_verified),
          participant_count:participants(count)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    const activities = (data ?? []).map((row: any) => row.activity).filter(Boolean) as Activity[]
    return { data: activities, error }
  },
}
