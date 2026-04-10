import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { useUnread } from '@/context/UnreadContext'
import { usePendingRequests } from '@/hooks/usePendingRequests'
import { supabase } from '../../lib/supabase'
import { chatService } from '@/services/chatService'
import { groupChatService } from '@/services/groupChatService'
import { radius, spacing, typography, type AppColors } from '@/constants/theme'
import type { ActivityChat, Conversation } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Unified list item type ───────────────────────────────────────────────────

type ChatItem =
  | { kind: 'dm';    id: string; data: Conversation;  sortKey: number }
  | { kind: 'group'; id: string; data: ActivityChat;  sortKey: number }

// ─── Group Chat Card ──────────────────────────────────────────────────────────

function GroupChatCard({
  chat,
  colors,
  currentUserId,
  onMuteToggle,
  openSwipeRef,
}: {
  chat: ActivityChat
  colors: AppColors
  currentUserId: string
  onMuteToggle: (muted: boolean) => void
  openSwipeRef: React.MutableRefObject<Swipeable | null>
}) {
  const swipeRef = useRef<Swipeable>(null)
  const unread = chat.unread_count ?? 0

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={() => (
        <TouchableOpacity
          style={[card.muteAction, { backgroundColor: chat.muted ? colors.primary : colors.surfaceElevated }]}
          onPress={() => { swipeRef.current?.close(); onMuteToggle(!chat.muted) }}
          activeOpacity={0.85}
        >
          <Ionicons name={chat.muted ? 'notifications-outline' : 'notifications-off-outline'} size={20} color={chat.muted ? '#fff' : colors.textSecondary} />
          <Text style={[card.muteText, { color: chat.muted ? '#fff' : colors.textSecondary }]}>
            {chat.muted ? 'Unmute' : 'Mute'}
          </Text>
        </TouchableOpacity>
      )}
      overshootLeft={false}
      containerStyle={{ marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: radius.lg, overflow: 'hidden' }}
      onSwipeableOpen={() => { if (openSwipeRef.current !== swipeRef.current) openSwipeRef.current?.close(); openSwipeRef.current = swipeRef.current }}
      onSwipeableClose={() => { if (openSwipeRef.current === swipeRef.current) openSwipeRef.current = null }}
    >
      <TouchableOpacity
        style={[card.container, { backgroundColor: colors.surface, marginHorizontal: 0, marginBottom: 0, borderRadius: 0 }]}
        onPress={() => { openSwipeRef.current?.close(); router.push(`/group-chat/${chat.id}` as any) }}
        activeOpacity={0.85}
      >
        <View style={{ position: 'relative' }}>
          {chat.activity?.cover_image_url ? (
            <Image source={{ uri: chat.activity.cover_image_url }} style={card.avatar} contentFit='cover' />
          ) : (
            <View style={[card.groupIcon, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name='people' size={24} color={colors.primary} />
            </View>
          )}
          {chat.muted && (
            <View style={[card.mutedDot, { backgroundColor: colors.surfaceElevated, borderColor: colors.surface }]}>
              <Ionicons name='notifications-off' size={9} color={colors.textMuted} />
            </View>
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={card.rowTop}>
            <Text style={[card.name, { color: colors.text }]} numberOfLines={1}>
              {chat.activity?.title ?? 'Activity Chat'}
            </Text>
            <View style={card.rightCol}>
              {chat.last_message && (
                <Text style={[card.time, { color: colors.textMuted }]}>
                  {timeAgo(chat.last_message.created_at)}
                </Text>
              )}
              {unread > 0 && !chat.muted && (
                <View style={[card.badge, { backgroundColor: colors.primary }]}>
                  <Text style={card.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              )}
            </View>
          </View>
          <Text
            style={[card.preview, { color: unread > 0 && !chat.muted ? colors.text : colors.textMuted, fontWeight: unread > 0 && !chat.muted ? '600' : '400' }]}
            numberOfLines={1}
          >
            {chat.last_message ? chat.last_message.content : 'No messages yet'}
          </Text>
        </View>
      </TouchableOpacity>
    </Swipeable>
  )
}

// ─── DM Conversation Card ─────────────────────────────────────────────────────

function ConversationCard({ conversation: c, colors, currentUserId, onDelete, onMuteToggle, openSwipeRef }: {
  conversation: Conversation
  colors: AppColors
  currentUserId: string
  onDelete: () => void
  onMuteToggle: (muted: boolean) => void
  openSwipeRef: React.MutableRefObject<Swipeable | null>
}) {
  const swipeRef = useRef<Swipeable>(null)
  const other = c.other_profile
  const unreadCount = c.unread_count ?? 0
  const isUnread = unreadCount > 0 && !c.muted

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={() => (
        <TouchableOpacity
          style={[card.muteAction, { backgroundColor: c.muted ? colors.primary : colors.surfaceElevated }]}
          onPress={() => { swipeRef.current?.close(); onMuteToggle(!c.muted) }}
          activeOpacity={0.85}
        >
          <Ionicons name={c.muted ? 'notifications-outline' : 'notifications-off-outline'} size={20} color={c.muted ? '#fff' : colors.textSecondary} />
          <Text style={[card.muteText, { color: c.muted ? '#fff' : colors.textSecondary }]}>
            {c.muted ? 'Unmute' : 'Mute'}
          </Text>
        </TouchableOpacity>
      )}
      renderRightActions={() => (
        <TouchableOpacity
          style={[card.deleteAction, { backgroundColor: colors.error }]}
          onPress={() => { swipeRef.current?.close(); onDelete() }}
          activeOpacity={0.85}
        >
          <Ionicons name='trash-outline' size={20} color='#fff' />
          <Text style={card.deleteText}>Delete</Text>
        </TouchableOpacity>
      )}
      overshootLeft={false}
      overshootRight={false}
      containerStyle={{ marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: radius.lg, overflow: 'hidden' }}
      onSwipeableOpen={() => { if (openSwipeRef.current !== swipeRef.current) openSwipeRef.current?.close(); openSwipeRef.current = swipeRef.current }}
      onSwipeableClose={() => { if (openSwipeRef.current === swipeRef.current) openSwipeRef.current = null }}
    >
      <TouchableOpacity
        style={[card.container, { backgroundColor: colors.surface, marginHorizontal: 0, marginBottom: 0, borderRadius: 0 }]}
        onPress={() => { openSwipeRef.current?.close(); router.push(`/chat/${c.id}` as any) }}
        activeOpacity={0.85}
      >
        <TouchableOpacity
          onPress={() => { openSwipeRef.current?.close(); other?.id && router.push(`/profile/${other.id}` as any) }}
          activeOpacity={0.85}
        >
          <View style={{ position: 'relative' }}>
            {other?.avatar_url
              ? <Image source={{ uri: other.avatar_url }} style={card.avatar} contentFit='cover' />
              : (
                <View style={[card.avatar, { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name='person' size={22} color={colors.textMuted} />
                </View>
              )
            }
            {isUnread && <View style={[card.unreadDot, { backgroundColor: colors.primary, borderColor: colors.surface }]} />}
            {c.muted && (
              <View style={[card.mutedDot, { backgroundColor: colors.surfaceElevated, borderColor: colors.surface }]}>
                <Ionicons name='notifications-off' size={9} color={colors.textMuted} />
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={card.rowTop}>
            <Text style={[card.name, { color: colors.text }]} numberOfLines={1}>
              {other?.username ?? '—'}{other?.is_verified ? ' ✓' : ''}
            </Text>
            <View style={card.rightCol}>
              {c.last_message && (
                <Text style={[card.time, { color: colors.textMuted }]}>{timeAgo(c.last_message.created_at)}</Text>
              )}
              {isUnread && (
                <View style={[card.badge, { backgroundColor: colors.primary }]}>
                  <Text style={card.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
          <Text
            style={[card.preview, { color: isUnread ? colors.text : colors.textMuted, fontWeight: isUnread ? '600' : '400' }]}
            numberOfLines={1}
          >
            {c.last_message
              ? `${c.last_message.sender_id === currentUserId ? 'You: ' : ''}${c.last_message.content}`
              : 'No messages yet'
            }
          </Text>
        </View>
      </TouchableOpacity>
    </Swipeable>
  )
}

// ─── Shared card styles ───────────────────────────────────────────────────────

const card = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  groupIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  unreadDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  name: { fontSize: 15, fontWeight: '600', flex: 1 },
  time: { fontSize: 12 },
  rightCol: { alignItems: 'flex-end', gap: 4 },
  preview: { fontSize: 13, lineHeight: 18 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  deleteAction: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, gap: 4, borderRadius: radius.lg },
  deleteText: { ...typography.caption, color: '#fff', fontWeight: '700' },
  muteAction: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, gap: 4, borderRadius: radius.lg },
  muteText: { ...typography.caption, fontWeight: '700' },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatsScreen() {
  const colors = useColors()
  const { user } = useAuth()
  const { notificationCount, refreshMessages } = useUnread()
  const { count: requestCount } = usePendingRequests()

  const [groupChats, setGroupChats] = useState<ActivityChat[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const openSwipeRef = useRef<Swipeable | null>(null)

  const bellBadge = requestCount + notificationCount

  const loadAll = useCallback(async () => {
    if (!user) return
    const [{ data: convs }, { data: groups }] = await Promise.all([
      chatService.getConversations(user.id),
      groupChatService.getMyChats(user.id),
    ])
    setConversations(convs)
    setGroupChats(groups)
  }, [user])

  useEffect(() => {
    setLoading(true)
    loadAll().finally(() => setLoading(false))
  }, [loadAll])

  useEffect(() => {
    if (!user) return
    // Capture uid so handlers never close over a stale user object
    const uid = user.id

    const channel = supabase
      .channel(`chats-list:${uid}:${Date.now()}`)
      // ── DM: new message → update preview + unread count inline ──────────────
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as any
        setConversations((prev) => {
          if (!prev.some((c) => c.id === msg.conversation_id)) return prev
          return prev.map((c) => {
            if (c.id !== msg.conversation_id) return c
            return {
              ...c,
              last_message: {
                content: msg.content,
                sender_id: msg.sender_id,
                created_at: msg.created_at,
                read: msg.read,
              },
              unread_count: msg.sender_id !== uid ? (c.unread_count ?? 0) + 1 : c.unread_count,
            }
          }).sort((a, b) => {
            const ta = a.last_message ? new Date(a.last_message.created_at).getTime() : 0
            const tb = b.last_message ? new Date(b.last_message.created_at).getTime() : 0
            return tb - ta
          })
        })
        refreshMessages()
      })
      // ── DM: new conversation started → full reload to add the row ─────────────
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, () => {
        loadAll()
      })
      // ── DM: read-status changed → refresh unread counts ──────────────────────
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => {
        loadAll()
      })
      // ── Group: new message → update preview + unread count inline ────────────
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, (payload) => {
        const msg = payload.new as any
        setGroupChats((prev) => {
          if (!prev.some((g) => g.id === msg.chat_id)) return prev
          return prev.map((g) => {
            if (g.id !== msg.chat_id) return g
            return {
              ...g,
              last_message: {
                content: msg.content,
                sender_id: msg.sender_id,
                created_at: msg.created_at,
              },
              unread_count: msg.sender_id !== uid ? (g.unread_count ?? 0) + 1 : g.unread_count,
            }
          }).sort((a, b) => {
            const ta = a.last_message ? new Date(a.last_message.created_at).getTime() : 0
            const tb = b.last_message ? new Date(b.last_message.created_at).getTime() : 0
            return tb - ta
          })
        })
        refreshMessages()
      })
      // ── Group: member removed (leave / kick) ──────────────────────────────────
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_chat_members', filter: `user_id=eq.${uid}` }, () => {
        loadAll()
      })
      // ── Group: host deleted the activity → chat gone for everyone ─────────────
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'activity_chats' }, (payload) => {
        const deletedId = (payload.old as any)?.id
        if (deletedId) {
          setGroupChats((prev) => prev.filter((g) => g.id !== deletedId))
        }
      })
      // ── Group: joined a new activity chat ─────────────────────────────────────
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_chat_members', filter: `user_id=eq.${uid}` }, () => {
        loadAll()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, loadAll, refreshMessages])

  // ── Unified sorted list ──────────────────────────────────────────────────────

  const allChats = useMemo<ChatItem[]>(() => {
    const dms: ChatItem[] = conversations.map((c) => ({
      kind: 'dm',
      id: `dm-${c.id}`,
      data: c,
      sortKey: c.last_message ? new Date(c.last_message.created_at).getTime() : new Date(c.created_at).getTime(),
    }))
    const groups: ChatItem[] = groupChats.map((g) => ({
      kind: 'group',
      id: `group-${g.id}`,
      data: g,
      sortKey: g.last_message ? new Date(g.last_message.created_at).getTime() : new Date(g.created_at).getTime(),
    }))
    return [...dms, ...groups].sort((a, b) => b.sortKey - a.sortKey)
  }, [conversations, groupChats])

  const filtered = useMemo<ChatItem[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allChats
    return allChats.filter((item) => {
      if (item.kind === 'dm') {
        return item.data.other_profile?.username?.toLowerCase().includes(q)
      }
      return item.data.activity?.title?.toLowerCase().includes(q)
    })
  }, [allChats, query])

  // ── Actions ──────────────────────────────────────────────────────────────────

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadAll(), refreshMessages()])
    setRefreshing(false)
  }

  const onDeleteConversation = (conversationId: string) => {
    Alert.alert('Delete conversation', 'This will permanently delete all messages.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await chatService.deleteConversation(conversationId)
          setConversations((prev) => prev.filter((c) => c.id !== conversationId))
          refreshMessages()
        },
      },
    ])
  }

  const onMuteDM = async (conversationId: string, muted: boolean) => {
    await chatService.setConversationMuted(conversationId, user!.id, muted)
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, muted } : c)))
  }

  const onMuteGroup = async (chatId: string, muted: boolean) => {
    await groupChatService.setMuted(chatId, user!.id, muted)
    setGroupChats((prev) => prev.map((g) => (g.id === chatId ? { ...g, muted } : g)))
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>

        {/* ── Header ── */}
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <Text style={[typography.h2, { color: colors.text }]}>Messages</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/notifications' as any)} activeOpacity={0.7}>
              <Ionicons name='notifications-outline' size={22} color={colors.text} />
              {bellBadge > 0 && (
                <View style={[styles.bellBadge, { backgroundColor: colors.error }]}>
                  <Text style={styles.bellBadgeText}>{bellBadge > 9 ? '9+' : bellBadge}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.composeBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/chat/new' as any)}
            >
              <Ionicons name='create-outline' size={18} color='#fff' />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Search bar ── */}
        <View style={[styles.searchWrap, { backgroundColor: colors.background }]}>
          <View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated, borderColor: searchFocused ? colors.primary : colors.border }]}>
            <Ionicons name='search-outline' size={16} color={searchFocused ? colors.primary : colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder='Search chats…'
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              returnKeyType='search'
              clearButtonMode='never'
              autoCorrect={false}
              autoCapitalize='none'
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name='close-circle' size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── List ── */}
        {loading && !refreshing ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
              <Ionicons
                name={query ? 'search-outline' : 'chatbubbles-outline'}
                size={32}
                color={colors.textMuted}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {query ? 'No results' : 'No chats yet'}
            </Text>
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              {query
                ? `Nothing matched "${query}"`
                : 'Start a conversation or join an activity to chat'
              }
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            extraData={filtered}
            keyExtractor={(item) => item.id}
            onScrollBeginDrag={() => openSwipeRef.current?.close()}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps='handled'
            renderItem={({ item }) => {
              if (item.kind === 'group') {
                return (
                  <GroupChatCard
                    chat={item.data}
                    colors={colors}
                    currentUserId={user?.id ?? ''}
                    onMuteToggle={(muted) => onMuteGroup(item.data.id, muted)}
                    openSwipeRef={openSwipeRef}
                  />
                )
              }
              return (
                <ConversationCard
                  conversation={item.data}
                  colors={colors}
                  currentUserId={user?.id ?? ''}
                  onDelete={() => onDeleteConversation(item.data.id)}
                  onMuteToggle={(muted) => onMuteDM(item.data.id, muted)}
                  openSwipeRef={openSwipeRef}
                />
              )
            }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
          />
        )}

      </View>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bellBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  bellBadge: { position: 'absolute', top: 1, right: 1, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  bellBadgeText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },
  composeBtn: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },

  searchWrap: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },

  listContent: { paddingTop: spacing.sm, paddingBottom: 120 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyHint: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
