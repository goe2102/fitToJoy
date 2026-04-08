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
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        participant_1_profile:profiles!conversations_participant_1_fkey(id, username, avatar_url, is_verified),
        participant_2_profile:profiles!conversations_participant_2_fkey(id, username, avatar_url, is_verified),
        last_message:messages(content, sender_id, created_at, read)
      `)
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (error) return { data: [], error }

    // Attach the "other" profile and unread count
    const mapped = (data ?? []).map((c: any) => {
      const other = c.participant_1 === userId ? c.participant_2_profile : c.participant_1_profile
      // last_message is an array from the join — take the most recent
      const lastMsg = c.last_message?.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )?.[0] ?? null
      return {
        ...c,
        other_profile: other,
        last_message: lastMsg,
      }
    })

    return { data: mapped, error: null }
  },

  async getUnreadMessageCount(userId: string): Promise<number> {
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('read', false)
      .neq('sender_id', userId)
      .in(
        'conversation_id',
        (
          await supabase
            .from('conversations')
            .select('id')
            .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
        ).data?.map((c) => c.id) ?? []
      )
    return count ?? 0
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
