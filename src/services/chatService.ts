import { supabase } from '../../lib/supabase'
import type { Message, Conversation } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Ensure participant_1 < participant_2 (DB constraint) */
function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

// ─── Chat service ─────────────────────────────────────────────────────────────

export const chatService = {
  async getConversations(userId: string): Promise<{ data: Conversation[]; error: Error | null }> {
    const [convsRes, unreadRes, muteRes] = await Promise.all([
      supabase
        .from('conversations')
        .select(`
          *,
          participant_1_profile:profiles!conversations_participant_1_fkey(id, username, avatar_url, is_verified),
          participant_2_profile:profiles!conversations_participant_2_fkey(id, username, avatar_url, is_verified),
          last_message:messages(content, sender_id, created_at, read)
        `)
        .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
        .order('last_message_at', { ascending: false, nullsFirst: false }),
      supabase
        .from('messages')
        .select('conversation_id')
        .eq('read', false)
        .neq('sender_id', userId),
      supabase
        .from('conversation_mutes')
        .select('conversation_id')
        .eq('user_id', userId),
    ])

    if (convsRes.error) return { data: [], error: convsRes.error }

    const unreadMap: Record<string, number> = {}
    for (const msg of unreadRes.data ?? []) {
      unreadMap[msg.conversation_id] = (unreadMap[msg.conversation_id] ?? 0) + 1
    }

    const mutedSet = new Set((muteRes.data ?? []).map((m: any) => m.conversation_id))

    const mapped = (convsRes.data ?? []).map((c: any) => {
      const other = c.participant_1 === userId ? c.participant_2_profile : c.participant_1_profile
      const lastMsg = c.last_message?.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )?.[0] ?? null
      return {
        ...c,
        other_profile: other,
        last_message: lastMsg,
        unread_count: unreadMap[c.id] ?? 0,
        muted: mutedSet.has(c.id),
      }
    })

    return { data: mapped, error: null }
  },

  /** Number of conversations that have at least 1 unread message — used for tab badge. */
  async getUnreadConversationCount(userId: string): Promise<number> {
    const { data } = await supabase
      .from('messages')
      .select('conversation_id')
      .eq('read', false)
      .neq('sender_id', userId)
    if (!data?.length) return 0
    return new Set(data.map((m) => m.conversation_id)).size
  },

  async getOrCreateConversation(userId: string, otherUserId: string): Promise<{ data: string | null; error: Error | null }> {
    const [p1, p2] = orderedPair(userId, otherUserId)

    // Try to find existing
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('participant_1', p1)
      .eq('participant_2', p2)
      .maybeSingle()

    if (existing) return { data: existing.id, error: null }

    // Create new
    const { data, error } = await supabase
      .from('conversations')
      .insert({ participant_1: p1, participant_2: p2 })
      .select('id')
      .single()

    return { data: data?.id ?? null, error }
  },

  async getMessages(conversationId: string): Promise<{ data: Message[]; error: Error | null }> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    return { data: data ?? [], error }
  },

  async sendMessage(conversationId: string, senderId: string, content: string): Promise<{ data: Message | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: senderId, content: content.trim() })
      .select()
      .single()
    return { data, error }
  },

  async markMessagesRead(conversationId: string, userId: string) {
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .eq('read', false)
      .neq('sender_id', userId)
  },

  async setConversationMuted(conversationId: string, userId: string, muted: boolean) {
    if (muted) {
      await supabase
        .from('conversation_mutes')
        .upsert({ conversation_id: conversationId, user_id: userId })
    } else {
      await supabase
        .from('conversation_mutes')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
    }
  },

  async deleteConversation(conversationId: string): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)
    return { error }
  },

  subscribeToMessages(conversationId: string, onMessage: (msg: Message) => void) {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => onMessage(payload.new as Message)
      )
      .subscribe()
    return channel
  },
}
