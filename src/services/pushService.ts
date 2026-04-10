import { supabase } from '../../lib/supabase'
import type { NotificationType } from '@/types'

// ─── Push title / body ────────────────────────────────────────────────────────

function pushTitle(type: NotificationType): string {
  switch (type) {
    case 'follow_request':        return 'New Follow Request'
    case 'follow_accepted':       return 'Follow Request Accepted'
    case 'join_request':          return 'New Join Request'
    case 'joined_activity':       return 'Someone Joined Your Activity'
    case 'join_approved':         return 'Request Approved 🎉'
    case 'join_denied':           return 'Request Declined'
    case 'activity_updated':      return 'Activity Updated'
    case 'activity_cancelled':    return 'Activity Cancelled'
    case 'kicked_from_activity':  return 'Removed from Activity'
    default: return 'fitToJoy'
  }
}

function pushBody(type: NotificationType, payload: Record<string, unknown>): string {
  const p = payload as any
  switch (type) {
    case 'follow_request':        return `@${p.from_username} wants to follow you`
    case 'follow_accepted':       return `@${p.from_username} accepted your follow request`
    case 'join_request':          return `@${p.from_username} wants to join "${p.activity_title}"`
    case 'joined_activity':       return `@${p.from_username} joined "${p.activity_title}"`
    case 'join_approved':         return `Your request to join "${p.activity_title}" was approved`
    case 'join_denied':           return `Your request to join "${p.activity_title}" was declined`
    case 'activity_updated':      return `"${p.activity_title}" has been updated`
    case 'activity_cancelled':    return `"${p.activity_title}" was cancelled`
    case 'kicked_from_activity':  return `You were removed from "${p.activity_title}"`
    default: return 'You have a new notification'
  }
}

// ─── Send via Edge Function (uses service role key → bypasses RLS) ────────────

/**
 * Fire-and-forget push notification via Supabase Edge Function.
 * The Edge Function reads the target user's expo_push_token with the service
 * role key, so RLS on the profiles table never blocks it.
 */
export async function sendPushToUser(
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown>
) {
  try {
    await supabase.functions.invoke('send-push', {
      body: {
        userId,
        title: pushTitle(type),
        body: pushBody(type, payload),
        data: { type, ...payload },
      },
    })
  } catch (err) {
    console.warn('[Push] sendPushToUser failed:', err)
  }
}

/** Save or update the Expo push token for the current user. */
export async function savePushToken(userId: string, token: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ expo_push_token: token })
    .eq('id', userId)
  if (error) console.warn('[Push] Failed to save token:', error.message)
}
