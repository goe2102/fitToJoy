import { supabase } from '../../lib/supabase'
import type { Notification, NotificationType } from '@/types'

// ─── Insert helper ────────────────────────────────────────────────────────────
// Push notification is sent automatically by the DB trigger on_notification_insert

export async function insertNotification(
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown>
) {
  await supabase.from('notifications').insert({ user_id: userId, type, payload })
}

// ─── Notification service ─────────────────────────────────────────────────────

export const notificationService = {
  async getAll(userId: string): Promise<{ data: Notification[]; error: Error | null }> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60)
    return { data: data ?? [], error }
  },

  async getUnreadCount(userId: string): Promise<number> {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)
    return count ?? 0
  },

  async markAllRead(userId: string) {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
  },

  async markRead(notificationId: string) {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
  },

  async deleteOne(notificationId: string) {
    await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
  },
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export function notificationText(n: Notification): string {
  const p = n.payload as any
  switch (n.type) {
    case 'new_follower':     return `@${p.from_username} now follows you`
    case 'follow_request':   return `@${p.from_username} wants to follow you`
    case 'follow_accepted':  return `@${p.from_username} accepted your follow request`
    case 'join_request':     return `@${p.from_username} wants to join "${p.activity_title}"`
    case 'joined_activity':  return `@${p.from_username} joined your activity "${p.activity_title}"`
    case 'join_approved':    return `Your request to join "${p.activity_title}" was approved`
    case 'join_denied':      return `Your request to join "${p.activity_title}" was denied`
    case 'activity_updated': return `"${p.activity_title}" has been updated`
    case 'activity_cancelled': return `"${p.activity_title}" was cancelled`
    case 'kicked_from_activity': return `You were removed from "${p.activity_title}"`
    case 'new_message': return `@${p.from_username}: ${p.preview}`
    case 'new_group_message': return `@${p.from_username} in ${p.chat_title}: ${p.preview}`
    case 'activity_started': return `"${p.activity_title}" has started! Don't forget to check in`
    case 'waitlist_promoted': return `You got a spot in "${p.activity_title}"! Congrats`
    case 'next_session_scheduled': return `Next session of "${p.activity_title}" is now open — join up!`
    default: return 'New notification'
  }
}

export function notificationIcon(type: NotificationType): string {
  switch (type) {
    case 'new_follower':     return 'person-add-outline'
    case 'follow_request':   return 'person-add-outline'
    case 'follow_accepted':  return 'checkmark-circle-outline'
    case 'join_request':     return 'enter-outline'
    case 'joined_activity':  return 'person-add-outline'
    case 'join_approved':    return 'checkmark-done-outline'
    case 'join_denied':      return 'close-circle-outline'
    case 'activity_updated': return 'create-outline'
    case 'activity_cancelled': return 'ban-outline'
    case 'kicked_from_activity': return 'remove-circle-outline'
    case 'new_message':       return 'chatbubble-outline'
    case 'new_group_message': return 'chatbubbles-outline'
    case 'activity_started':  return 'play-circle-outline'
    case 'waitlist_promoted': return 'trophy-outline'
    case 'next_session_scheduled': return 'refresh-circle-outline'
    default: return 'notifications-outline'
  }
}

export function notificationColor(type: NotificationType, colors: { primary: string; error: string; success: string; warning: string; textSecondary: string }): string {
  switch (type) {
    case 'new_follower':
    case 'follow_request':
    case 'join_request':
    case 'joined_activity':  return colors.primary
    case 'follow_accepted':
    case 'join_approved':    return colors.success
    case 'join_denied':
    case 'kicked_from_activity':
    case 'activity_cancelled': return colors.error
    case 'activity_updated': return colors.warning
    case 'waitlist_promoted': return colors.success
    case 'next_session_scheduled': return colors.primary
    default: return colors.textSecondary
  }
}
