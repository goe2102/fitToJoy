import { supabase } from '../../lib/supabase'
import type { ActivityChat, GroupMessage } from '@/types'

// ─── Group Chat Service ────────────────────────────────────────────────────────

export const groupChatService = {

  /** Get (or create) the chat for an activity. Returns the chat id. */
  async getOrCreate(activityId: string): Promise<{ data: string | null; error: any }> {
    const { data: existing } = await supabase
      .from('activity_chats')
      .select('id')
      .eq('activity_id', activityId)
      .maybeSingle()

    if (existing) return { data: existing.id, error: null }

    const { data, error } = await supabase
      .from('activity_chats')
      .insert({ activity_id: activityId })
      .select('id')
      .single()

    return { data: data?.id ?? null, error }
  },

  /** All group chats the current user can access (host or participant). */
  async getMyChats(userId: string): Promise<{ data: ActivityChat[]; error: any }> {
    const { data: chats, error } = await supabase
      .from('activity_chats')
      .select('id, activity_id, activity:activities!activity_chats_activity_id_fkey(id, title, host_id, cover_image_url)')

    if (error || !chats?.length) return { data: [], error }

    const chatIds = chats.map((c: any) => c.id)

    const [msgRes, memberRes] = await Promise.all([
      supabase
        .from('group_messages')
        .select('chat_id, sender_id, content, created_at')
        .in('chat_id', chatIds)
        .order('created_at', { ascending: false })
        .limit(400),
      supabase
        .from('group_chat_members')
        .select('chat_id, muted, last_read_at')
        .eq('user_id', userId)
        .in('chat_id', chatIds),
    ])

    const memberMap: Record<string, { muted: boolean; last_read_at: string | null }> = {}
    for (const m of memberRes.data ?? []) {
      memberMap[m.chat_id] = { muted: m.muted, last_read_at: m.last_read_at }
    }

    const msgsByChat: Record<string, any[]> = {}
    for (const m of msgRes.data ?? []) {
      if (!msgsByChat[m.chat_id]) msgsByChat[m.chat_id] = []
      msgsByChat[m.chat_id].push(m)  // already sorted desc
    }

    const mapped: ActivityChat[] = chats.map((c: any) => {
      const msgs = msgsByChat[c.id] ?? []
      const lastMsg = msgs[0] ?? null
      const member = memberMap[c.id]
      const lastReadMs = member?.last_read_at ? new Date(member.last_read_at).getTime() : 0
      const unread = msgs.filter(
        (m) => m.sender_id !== userId && new Date(m.created_at).getTime() > lastReadMs
      ).length

      return {
        id: c.id,
        activity_id: c.activity_id,
        created_at: c.created_at ?? '',
        activity: Array.isArray(c.activity) ? c.activity[0] : c.activity,
        last_message: lastMsg,
        unread_count: unread,
        muted: member?.muted ?? false,
      }
    })

    // Sort: chats with messages first (newest), then those without
    mapped.sort((a, b) => {
      const ta = a.last_message ? new Date(a.last_message.created_at).getTime() : 0
      const tb = b.last_message ? new Date(b.last_message.created_at).getTime() : 0
      return tb - ta
    })

    return { data: mapped, error: null }
  },

  /** Total number of group chats that have at least 1 unread message. */
  async getGroupUnreadCount(userId: string): Promise<number> {
    const { data: chats } = await supabase
      .from('activity_chats')
      .select('id')

    if (!chats?.length) return 0
    const chatIds = chats.map((c: any) => c.id)

    const { data: members } = await supabase
      .from('group_chat_members')
      .select('chat_id, last_read_at')
      .eq('user_id', userId)
      .in('chat_id', chatIds)

    const lastReadMap: Record<string, string | null> = {}
    for (const m of members ?? []) lastReadMap[m.chat_id] = m.last_read_at

    let unreadChats = 0
    for (const chatId of chatIds) {
      const lastRead = lastReadMap[chatId]
      const q = supabase
        .from('group_messages')
        .select('id', { count: 'exact', head: true })
        .eq('chat_id', chatId)
        .neq('sender_id', userId)

      const { count } = lastRead ? await q.gt('created_at', lastRead) : await q
      if ((count ?? 0) > 0) unreadChats++
    }

    return unreadChats
  },

  /** Messages for a chat, with sender profiles. */
  async getMessages(chatId: string): Promise<{ data: GroupMessage[]; error: any }> {
    const { data, error } = await supabase
      .from('group_messages')
      .select('*, sender:profiles!group_messages_sender_id_fkey(id, username, avatar_url)')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(200)

    return {
      data: (data ?? []).map((m: any) => ({
        ...m,
        sender: Array.isArray(m.sender) ? m.sender[0] : m.sender,
      })),
      error,
    }
  },

  /** Send a message to a group chat. */
  async sendMessage(
    chatId: string,
    senderId: string,
    content: string
  ): Promise<{ data: GroupMessage | null; error: any }> {
    const { data, error } = await supabase
      .from('group_messages')
      .insert({ chat_id: chatId, sender_id: senderId, content: content.trim() })
      .select('*, sender:profiles!group_messages_sender_id_fkey(id, username, avatar_url)')
      .single()

    if (data) {
      ;(data as any).sender = Array.isArray((data as any).sender)
        ? (data as any).sender[0]
        : (data as any).sender
    }

    return { data: data as any, error }
  },

  /** Mark all messages in this chat as read for the user. */
  async markRead(chatId: string, userId: string) {
    await supabase
      .from('group_chat_members')
      .upsert(
        { chat_id: chatId, user_id: userId, last_read_at: new Date().toISOString() },
        { onConflict: 'chat_id,user_id' }
      )
  },

  /** Toggle mute for a user in a chat. */
  async setMuted(chatId: string, userId: string, muted: boolean) {
    await supabase
      .from('group_chat_members')
      .upsert({ chat_id: chatId, user_id: userId, muted }, { onConflict: 'chat_id,user_id' })
  },

  /** Get mute status. */
  async getMuted(chatId: string, userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('group_chat_members')
      .select('muted')
      .eq('chat_id', chatId)
      .eq('user_id', userId)
      .maybeSingle()
    return data?.muted ?? false
  },

  /** All participants (host-excluded) with profiles for the members modal. */
  async getParticipants(activityId: string) {
    const { data, error } = await supabase
      .from('participants')
      .select('user_id, status, profile:profiles!participants_user_id_fkey(id, username, avatar_url, is_verified)')
      .eq('activity_id', activityId)
      .in('status', ['joined', 'approved'])

    return {
      data: (data ?? []).map((p: any) => ({
        ...p,
        profile: Array.isArray(p.profile) ? p.profile[0] : p.profile,
      })),
      error,
    }
  },

  /** Subscribe to new messages in a chat; resolves sender inline. */
  subscribeToMessages(chatId: string, onMessage: (msg: GroupMessage) => void) {
    return supabase
      .channel(`group-msgs:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          // Re-fetch with sender profile
          const { data } = await supabase
            .from('group_messages')
            .select('*, sender:profiles!group_messages_sender_id_fkey(id, username, avatar_url)')
            .eq('id', (payload.new as any).id)
            .single()
          if (data) {
            ;(data as any).sender = Array.isArray((data as any).sender)
              ? (data as any).sender[0]
              : (data as any).sender
            onMessage(data as any)
          }
        }
      )
      .subscribe()
  },
}
