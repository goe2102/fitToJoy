import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Pressable,
  Platform,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { useUnread } from '@/context/UnreadContext'
import { usePendingRequests } from '@/hooks/usePendingRequests'
import { supabase } from '../../lib/supabase'
import { chatService } from '@/services/chatService'
import { groupChatService } from '@/services/groupChatService'
import { useTranslation } from 'react-i18next'
import { ScreenHeader, SearchBar } from '@/components/ui'
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

// ─── Activity status ─────────────────────────────────────────────────────────

type ActivityStatus = 'starting_soon' | 'live' | 'finished' | null

function getActivityStatus(activity?: ActivityChat['activity']): ActivityStatus {
  if (!activity?.date || !activity?.start_time || !activity?.duration_minutes) return null
  if (activity.status === 'finished') return 'finished'
  const now = Date.now()
  const start = new Date(`${activity.date}T${activity.start_time}:00`).getTime()
  const end = start + activity.duration_minutes * 60_000
  if (now >= end) return 'finished'
  if (now >= start) return 'live'
  if (start - now <= 30 * 60_000) return 'starting_soon'
  return null
}

function StatusPill({ status, colors }: { status: ActivityStatus; colors: AppColors }) {
  if (!status) return null
  const cfg = {
    live:          { icon: 'radio-outline' as const,            label: 'Live',          bg: '#16a34a' },
    starting_soon: { icon: 'time-outline' as const,             label: 'Starting soon', bg: colors.primary },
    finished:      { icon: 'checkmark-circle-outline' as const, label: 'Finished',      bg: colors.textMuted },
  }[status]
  return (
    <View style={[pill.wrap, { backgroundColor: cfg.bg + '22' }]}>
      <Ionicons name={cfg.icon} size={10} color={cfg.bg} />
      <Text style={[pill.label, { color: cfg.bg }]}>{cfg.label}</Text>
    </View>
  )
}

const pill = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
})

// ─── Group Action Sheet ───────────────────────────────────────────────────────

function GroupActionSheet({
  chat,
  currentUserId,
  colors,
  onClose,
  onHide,
  onMuteToggle,
  onLeave,
  onDelete,
}: {
  chat: ActivityChat
  currentUserId: string
  colors: AppColors
  onClose: () => void
  onHide: () => void
  onMuteToggle: (muted: boolean) => void
  onLeave: () => void
  onDelete: () => void
}) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const isHost = chat.activity?.host_id === currentUserId

  const rows: { icon: string; label: string; color: string; onPress: () => void }[] = [
    {
      icon: 'eye-off-outline',
      label: t('chats.hideChat'),
      color: colors.text,
      onPress: () => { onClose(); onHide() },
    },
    {
      icon: chat.muted ? 'notifications-outline' : 'notifications-off-outline',
      label: chat.muted ? t('chats.unmuteNotifications') : t('chats.muteNotifications'),
      color: colors.text,
      onPress: () => { onClose(); onMuteToggle(!chat.muted) },
    },
    {
      icon: isHost ? 'trash-outline' : 'exit-outline',
      label: isHost ? t('chats.deleteGroup') : t('chats.leaveGroup'),
      color: colors.error,
      onPress: () => { onClose(); isHost ? onDelete() : onLeave() },
    },
  ]

  return (
    <Modal transparent animationType='fade' onRequestClose={onClose}>
      <Pressable style={sheet.overlay} onPress={onClose}>
        <Pressable style={[sheet.panel, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, spacing.md) }]} onPress={() => {}}>

          {/* Group identity */}
          <View style={[sheet.identity, { borderBottomColor: colors.border }]}>
            {chat.activity?.cover_image_url ? (
              <Image source={{ uri: chat.activity.cover_image_url }} style={sheet.identityImage} contentFit='cover' />
            ) : (
              <View style={[sheet.identityImagePlaceholder, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons name='people' size={22} color={colors.primary} />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[sheet.identityName, { color: colors.text }]} numberOfLines={1}>
                {chat.activity?.title ?? 'Activity Chat'}
              </Text>
              <Text style={[sheet.identityRole, { color: colors.textMuted }]}>
                {isHost ? t('chats.youAreHost') : t('chats.youAreMember')}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={[sheet.closeBtn, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name='close' size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Actions */}
          {rows.map((row, i) => (
            <TouchableOpacity
              key={row.label}
              style={[
                sheet.row,
                { borderBottomColor: colors.border },
                i === rows.length - 1 && { borderBottomWidth: 0 },
              ]}
              onPress={row.onPress}
              activeOpacity={0.7}
            >
              <View style={[sheet.iconWrap, {
                backgroundColor: row.color === colors.error ? colors.error + '15' : colors.surfaceElevated,
              }]}>
                <Ionicons name={row.icon as any} size={18} color={row.color} />
              </View>
              <Text style={[sheet.rowLabel, { color: row.color }]}>{row.label}</Text>
            </TouchableOpacity>
          ))}

          {/* Cancel */}
          <TouchableOpacity style={[sheet.cancel, { backgroundColor: colors.primary }]} onPress={onClose} activeOpacity={0.7}>
            <Text style={[sheet.cancelLabel, { color: '#fff' }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>

        </Pressable>
      </Pressable>
    </Modal>
  )
}

const sheet = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  panel: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.sm,
    overflow: 'hidden',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.xs,
  },
  identityImage: { width: 48, height: 48, borderRadius: radius.md },
  identityImagePlaceholder: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  identityName: { fontSize: 16, fontWeight: '700' },
  identityRole: { fontSize: 12, marginTop: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowSub: { fontSize: 12, marginTop: 1 },
  cancel: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelLabel: { fontSize: 15, fontWeight: '600' },
})

// ─── DM Action Sheet ──────────────────────────────────────────────────────────

function DmActionSheet({
  conversation,
  currentUserId,
  colors,
  onClose,
  onHide,
  onMuteToggle,
  onClearForMe,
}: {
  conversation: Conversation
  currentUserId: string
  colors: AppColors
  onClose: () => void
  onHide: () => void
  onMuteToggle: (muted: boolean) => void
  onClearForMe: () => void
}) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const other = conversation.other_profile

  const rows: { icon: string; label: string; sub?: string; color: string; onPress: () => void }[] = [
    {
      icon: 'eye-off-outline',
      label: t('chats.hideChat'),
      sub: t('chats.hideChatHint'),
      color: colors.text,
      onPress: () => { onClose(); onHide() },
    },
    {
      icon: conversation.muted ? 'notifications-outline' : 'notifications-off-outline',
      label: conversation.muted ? t('chats.unmuteNotifications') : t('chats.muteNotifications'),
      color: colors.text,
      onPress: () => { onClose(); onMuteToggle(!conversation.muted) },
    },
    {
      icon: 'trash-outline',
      label: t('chats.deleteForMe'),
      sub: t('chats.deleteForMeHint'),
      color: colors.error,
      onPress: () => { onClose(); onClearForMe() },
    },
  ]

  return (
    <Modal transparent animationType='fade' onRequestClose={onClose}>
      <Pressable style={sheet.overlay} onPress={onClose}>
        <Pressable style={[sheet.panel, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, spacing.md) }]} onPress={() => {}}>

          {/* Identity */}
          <View style={[sheet.identity, { borderBottomColor: colors.border }]}>
            {other?.avatar_url ? (
              <Image source={{ uri: other.avatar_url }} style={[sheet.identityImage, { borderRadius: 24 }]} contentFit='cover' />
            ) : (
              <View style={[sheet.identityImagePlaceholder, { backgroundColor: colors.surfaceElevated, borderRadius: 24 }]}>
                <Ionicons name='person' size={22} color={colors.textMuted} />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[sheet.identityName, { color: colors.text }]} numberOfLines={1}>
                {other?.username ?? '—'}
              </Text>
              <Text style={[sheet.identityRole, { color: colors.textMuted }]}>{t('chat.messagePlaceholder')}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={[sheet.closeBtn, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name='close' size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {rows.map((row, i) => (
            <TouchableOpacity
              key={row.label}
              style={[sheet.row, { borderBottomColor: colors.border }, i === rows.length - 1 && { borderBottomWidth: 0 }]}
              onPress={row.onPress}
              activeOpacity={0.7}
            >
              <View style={[sheet.iconWrap, { backgroundColor: row.color === colors.error ? colors.error + '15' : colors.surfaceElevated }]}>
                <Ionicons name={row.icon as any} size={18} color={row.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[sheet.rowLabel, { color: row.color }]}>{row.label}</Text>
                {row.sub && <Text style={[sheet.rowSub, { color: colors.textMuted }]}>{row.sub}</Text>}
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={[sheet.cancel, { backgroundColor: colors.primary }]} onPress={onClose} activeOpacity={0.7}>
            <Text style={[sheet.cancelLabel, { color: '#fff' }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>

        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ─── Group Chat Card ──────────────────────────────────────────────────────────

function GroupChatCard({
  chat,
  colors,
  onLongPress,
}: {
  chat: ActivityChat
  colors: AppColors
  onLongPress: () => void
}) {
  const unread = chat.unread_count ?? 0
  const actStatus = getActivityStatus(chat.activity)

  return (
    <TouchableOpacity
      style={[c.card, { backgroundColor: colors.surface }]}
      onPress={() => router.push(`/group-chat/${chat.id}` as any)}
      onLongPress={onLongPress}
      activeOpacity={0.82}
      delayLongPress={350}
    >
      <View style={c.imageWrap}>
        {chat.activity?.cover_image_url ? (
          <Image source={{ uri: chat.activity.cover_image_url }} style={c.image} contentFit='cover' />
        ) : (
          <View style={[c.imagePlaceholder, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name='people' size={26} color={colors.primary} />
          </View>
        )}
        {chat.muted && (
          <View style={[c.mutedBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.background }]}>
            <Ionicons name='notifications-off' size={9} color={colors.textMuted} />
          </View>
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Row 1: title + time */}
        <View style={c.row}>
          <Text style={[c.title, { color: colors.text }]} numberOfLines={1}>
            {chat.activity?.title ?? 'Activity Chat'}
          </Text>
          {chat.last_message && (
            <Text style={[c.time, { color: colors.textMuted }]}>{timeAgo(chat.last_message.created_at)}</Text>
          )}
        </View>
        {/* Row 2: preview + badge */}
        <View style={[c.row, { marginTop: 2 }]}>
          <Text
            style={[c.preview, { color: unread > 0 && !chat.muted ? colors.text : colors.textMuted, fontWeight: unread > 0 && !chat.muted ? '600' : '400' }]}
            numberOfLines={1}
          >
            {chat.last_message ? chat.last_message.content : 'No messages yet'}
          </Text>
          {unread > 0 && !chat.muted && (
            <View style={[c.badge, { backgroundColor: colors.primary }]}>
              <Text style={c.badgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </View>
        {actStatus && <View style={{ marginTop: 4 }}><StatusPill status={actStatus} colors={colors} /></View>}
      </View>
    </TouchableOpacity>
  )
}

// ─── DM Conversation Card ─────────────────────────────────────────────────────

function ConversationCard({
  conversation: cv,
  colors,
  currentUserId,
  onLongPress,
}: {
  conversation: Conversation
  colors: AppColors
  currentUserId: string
  onLongPress: () => void
}) {
  const other = cv.other_profile
  const unreadCount = cv.unread_count ?? 0
  const isUnread = unreadCount > 0 && !cv.muted

  return (
    <TouchableOpacity
      style={[c.card, { backgroundColor: colors.surface }]}
      onPress={() => router.push(`/chat/${cv.id}` as any)}
      onLongPress={onLongPress}
      activeOpacity={0.82}
      delayLongPress={350}
    >
      <TouchableOpacity onPress={() => other?.id && router.push(`/profile/${other.id}` as any)} activeOpacity={0.8}>
        <View style={c.imageWrap}>
          {other?.avatar_url ? (
            <Image source={{ uri: other.avatar_url }} style={[c.image, { borderRadius: 27 }]} contentFit='cover' />
          ) : (
            <View style={[c.imagePlaceholder, { backgroundColor: colors.surfaceElevated, borderRadius: 27 }]}>
              <Ionicons name='person' size={24} color={colors.textMuted} />
            </View>
          )}
          {isUnread && <View style={[c.unreadDot, { backgroundColor: colors.primary, borderColor: colors.background }]} />}
          {cv.muted && (
            <View style={[c.mutedBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.background }]}>
              <Ionicons name='notifications-off' size={9} color={colors.textMuted} />
            </View>
          )}
        </View>
      </TouchableOpacity>

      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Row 1: username + time */}
        <View style={c.row}>
          <Text style={[c.title, { color: colors.text }]} numberOfLines={1}>
            {other?.username ?? '—'}{other?.is_verified ? ' ✓' : ''}
          </Text>
          {cv.last_message && <Text style={[c.time, { color: colors.textMuted }]}>{timeAgo(cv.last_message.created_at)}</Text>}
        </View>
        {/* Row 2: preview + badge */}
        <View style={[c.row, { marginTop: 2 }]}>
          <Text
            style={[c.preview, { color: isUnread ? colors.text : colors.textMuted, fontWeight: isUnread ? '600' : '400' }]}
            numberOfLines={1}
          >
            {cv.last_message
              ? `${cv.last_message.sender_id === currentUserId ? 'You: ' : ''}${cv.last_message.content}`
              : 'No messages yet'}
          </Text>
          {isUnread && (
            <View style={[c.badge, { backgroundColor: colors.primary }]}>
              <Text style={c.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ─── Shared card styles ───────────────────────────────────────────────────────

const c = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  imageWrap: { position: 'relative' },
  image: { width: 54, height: 54, borderRadius: radius.md },
  imagePlaceholder: { width: 54, height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  mutedBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 7, borderWidth: 2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '600', flex: 1 },
  time: { fontSize: 12 },
  preview: { fontSize: 13, lineHeight: 18 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatsScreen() {
  const colors = useColors()
  const { t } = useTranslation()
  const { user } = useAuth()
  const { notificationCount, refreshMessages } = useUnread()
  const { count: requestCount } = usePendingRequests()

  const [groupChats, setGroupChats] = useState<ActivityChat[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [hiddenGroupIds, setHiddenGroupIds] = useState<Set<string>>(new Set())
  const [hiddenDmIds, setHiddenDmIds] = useState<Set<string>>(new Set())

  // Action sheets
  const [groupSheet, setGroupSheet] = useState<ActivityChat | null>(null)
  const [dmSheet, setDmSheet] = useState<Conversation | null>(null)

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

  // Silent reload when navigating back from a chat — clears stale unread counts
  useFocusEffect(
    useCallback(() => {
      loadAll()
      refreshMessages()
    }, [loadAll, refreshMessages])
  )

  useEffect(() => {
    if (!user) return
    const uid = user.id

    const channel = supabase
      .channel(`chats-list:${uid}:${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as any
        // Un-hide DM when a new message arrives
        setHiddenDmIds((prev) => {
          if (!prev.has(msg.conversation_id)) return prev
          const next = new Set(prev); next.delete(msg.conversation_id); return next
        })
        setConversations((prev) => {
          if (!prev.some((cv) => cv.id === msg.conversation_id)) return prev
          return prev.map((cv) => {
            if (cv.id !== msg.conversation_id) return cv
            return {
              ...cv,
              last_message: { content: msg.content, sender_id: msg.sender_id, created_at: msg.created_at, read: msg.read },
              unread_count: msg.sender_id !== uid ? (cv.unread_count ?? 0) + 1 : cv.unread_count,
            }
          }).sort((a, b) => {
            const ta = a.last_message ? new Date(a.last_message.created_at).getTime() : 0
            const tb = b.last_message ? new Date(b.last_message.created_at).getTime() : 0
            return tb - ta
          })
        })
        refreshMessages()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, () => loadAll())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => loadAll())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, (payload) => {
        const msg = payload.new as any
        // Un-hide when a new message arrives
        setHiddenGroupIds((prev) => {
          if (!prev.has(msg.chat_id)) return prev
          const next = new Set(prev); next.delete(msg.chat_id); return next
        })
        setGroupChats((prev) => {
          if (!prev.some((g) => g.id === msg.chat_id)) return prev
          return prev.map((g) => {
            if (g.id !== msg.chat_id) return g
            return {
              ...g,
              last_message: { content: msg.content, sender_id: msg.sender_id, created_at: msg.created_at },
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
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_chat_members', filter: `user_id=eq.${uid}` }, () => loadAll())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'activity_chats' }, (payload) => {
        const deletedId = (payload.old as any)?.id
        if (deletedId) setGroupChats((prev) => prev.filter((g) => g.id !== deletedId))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_chat_members', filter: `user_id=eq.${uid}` }, () => loadAll())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, loadAll, refreshMessages])

  // ── Unified sorted list ──────────────────────────────────────────────────────

  const allChats = useMemo<ChatItem[]>(() => {
    const dms: ChatItem[] = conversations
      .filter((cv) => !hiddenDmIds.has(cv.id))
      .map((cv) => ({
        kind: 'dm',
        id: `dm-${cv.id}`,
        data: cv,
        sortKey: cv.last_message ? new Date(cv.last_message.created_at).getTime() : new Date(cv.created_at).getTime(),
      }))
    const groups: ChatItem[] = groupChats
      .filter((g) => !hiddenGroupIds.has(g.id))
      .map((g) => ({
        kind: 'group',
        id: `group-${g.id}`,
        data: g,
        sortKey: g.last_message ? new Date(g.last_message.created_at).getTime() : new Date(g.created_at).getTime(),
      }))
    return [...dms, ...groups].sort((a, b) => b.sortKey - a.sortKey)
  }, [conversations, groupChats, hiddenGroupIds, hiddenDmIds])

  const filtered = useMemo<ChatItem[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allChats
    return allChats.filter((item) => {
      if (item.kind === 'dm') return item.data.other_profile?.username?.toLowerCase().includes(q)
      return item.data.activity?.title?.toLowerCase().includes(q)
    })
  }, [allChats, query])

  // ── Actions ──────────────────────────────────────────────────────────────────

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadAll(), refreshMessages()])
    setRefreshing(false)
  }

  const onHideDm = (conversationId: string) => {
    setHiddenDmIds((prev) => { const next = new Set(prev); next.add(conversationId); return next })
  }

  const onClearDmForMe = (conversationId: string) => {
    Alert.alert(
      t('chats.deleteForMe'),
      t('chats.deleteForMeHint'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('chats.deleteForMe'), style: 'destructive',
          onPress: async () => {
            await chatService.clearForUser(conversationId, user!.id)
            setConversations((prev) => prev.filter((cv) => cv.id !== conversationId))
            refreshMessages()
          },
        },
      ]
    )
  }

  const onMuteDM = async (conversationId: string, muted: boolean) => {
    await chatService.setConversationMuted(conversationId, user!.id, muted)
    setConversations((prev) => prev.map((cv) => (cv.id === conversationId ? { ...cv, muted } : cv)))
  }

  const onMuteGroup = async (chatId: string, muted: boolean) => {
    await groupChatService.setMuted(chatId, user!.id, muted)
    setGroupChats((prev) => prev.map((g) => (g.id === chatId ? { ...g, muted } : g)))
  }

  const onHideGroup = (chatId: string) => {
    setHiddenGroupIds((prev) => { const next = new Set(prev); next.add(chatId); return next })
  }

  const onLeaveGroup = (chatId: string) => {
    Alert.alert(t('chats.leaveGroup'), t('chats.leaveGroupConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('chats.leaveGroup'), style: 'destructive',
        onPress: async () => {
          await groupChatService.leaveGroup(chatId, user!.id)
          setGroupChats((prev) => prev.filter((g) => g.id !== chatId))
        },
      },
    ])
  }

  const onDeleteGroup = (chatId: string) => {
    Alert.alert(t('chats.deleteGroup'), t('chats.deleteChatConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          await groupChatService.deleteGroup(chatId)
          setGroupChats((prev) => prev.filter((g) => g.id !== chatId))
        },
      },
    ])
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>

        {/* Header */}
        <ScreenHeader
          title={t('chats.title')}
          right={
            <View style={s.headerRight}>
              <TouchableOpacity style={s.bellBtn} onPress={() => router.push('/notifications' as any)} activeOpacity={0.7}>
                <Ionicons name='notifications-outline' size={22} color={colors.text} />
                {bellBadge > 0 && (
                  <View style={[s.bellBadge, { backgroundColor: colors.error }]}>
                    <Text style={s.bellBadgeText}>{bellBadge > 9 ? '9+' : bellBadge}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.composeBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/chat/new' as any)}
              >
                <Ionicons name='create-outline' size={18} color='#fff' />
              </TouchableOpacity>
            </View>
          }
        />

        {/* Search */}
        <View style={[s.searchWrap, { backgroundColor: colors.background }]}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder={t('chats.searchPlaceholder')}
          />
        </View>

        {/* List */}
        {loading && !refreshing ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : filtered.length === 0 ? (
          <View style={s.empty}>
            <View style={[s.emptyIcon, { backgroundColor: colors.surface }]}>
              <Ionicons name={query ? 'search-outline' : 'chatbubbles-outline'} size={32} color={colors.textMuted} />
            </View>
            <Text style={[s.emptyTitle, { color: colors.text }]}>{query ? t('common.noResults') : t('chats.noChats')}</Text>
            <Text style={[s.emptyHint, { color: colors.textMuted }]}>
              {query ? t('search.noResults', { query }) : t('chats.noChatsHint')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.listContent}
            keyboardShouldPersistTaps='handled'
            renderItem={({ item }) => {
              if (item.kind === 'group') {
                return (
                  <GroupChatCard
                    chat={item.data}
                    colors={colors}
                    onLongPress={() => setGroupSheet(item.data)}
                  />
                )
              }
              return (
                <ConversationCard
                  conversation={item.data}
                  colors={colors}
                  currentUserId={user?.id ?? ''}
                  onLongPress={() => setDmSheet(item.data)}
                />
              )
            }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          />
        )}

      </View>

      {/* Group action sheet */}
      {groupSheet && user && (
        <GroupActionSheet
          chat={groupSheet}
          currentUserId={user.id}
          colors={colors}
          onClose={() => setGroupSheet(null)}
          onHide={() => { onHideGroup(groupSheet.id); setGroupSheet(null) }}
          onMuteToggle={(muted) => { onMuteGroup(groupSheet.id, muted); setGroupSheet(null) }}
          onLeave={() => { setGroupSheet(null); onLeaveGroup(groupSheet.id) }}
          onDelete={() => { setGroupSheet(null); onDeleteGroup(groupSheet.id) }}
        />
      )}

      {/* DM action sheet */}
      {dmSheet && user && (
        <DmActionSheet
          conversation={dmSheet}
          currentUserId={user.id}
          colors={colors}
          onClose={() => setDmSheet(null)}
          onHide={() => { onHideDm(dmSheet.id); setDmSheet(null) }}
          onMuteToggle={(muted) => { onMuteDM(dmSheet.id, muted); setDmSheet(null) }}
          onClearForMe={() => { setDmSheet(null); onClearDmForMe(dmSheet.id) }}
        />
      )}

    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bellBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  bellBadge: { position: 'absolute', top: 1, right: 1, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  bellBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  composeBtn: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  listContent: { paddingTop: spacing.sm, paddingBottom: 120 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyHint: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
