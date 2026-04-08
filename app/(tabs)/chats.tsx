import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { useUnread } from '@/context/UnreadContext'
import { notificationService, notificationText, notificationIcon, notificationColor } from '@/services/notificationService'
import { chatService } from '@/services/chatService'
import { radius, spacing, typography, type AppColors } from '@/constants/theme'
import type { Notification, Conversation } from '@/types'

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

// ─── Tab switcher ─────────────────────────────────────────────────────────────

function TabSwitcher({
  tab,
  onTabChange,
  notifCount,
  msgCount,
  colors,
}: {
  tab: 'notifications' | 'messages'
  onTabChange: (t: 'notifications' | 'messages') => void
  notifCount: number
  msgCount: number
  colors: AppColors
}) {
  return (
    <View style={[tabStyles.row, { borderBottomColor: colors.border }]}>
      {(['notifications', 'messages'] as const).map((t) => {
        const active = tab === t
        const count = t === 'notifications' ? notifCount : msgCount
        return (
          <TouchableOpacity
            key={t}
            style={[tabStyles.tab, active && { borderBottomColor: colors.primary }]}
            onPress={() => onTabChange(t)}
            activeOpacity={0.7}
          >
            <Text style={[typography.label, { color: active ? colors.primary : colors.textMuted }]}>
              {t === 'notifications' ? 'Notifications' : 'Messages'}
            </Text>
            {count > 0 && (
              <View style={[tabStyles.badge, { backgroundColor: colors.primary }]}>
                <Text style={[typography.caption, { color: colors.white, fontSize: 10, fontWeight: '700' }]}>
                  {count > 99 ? '99+' : count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const tabStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
})

// ─── Notification Row ─────────────────────────────────────────────────────────

function NotificationRow({
  notification: n,
  colors,
  onPress,
}: {
  notification: Notification
  colors: AppColors
  onPress: () => void
}) {
  const iconName = notificationIcon(n.type) as any
  const iconCol = notificationColor(n.type, colors)

  return (
    <TouchableOpacity
      style={[
        notifStyles.row,
        { borderBottomColor: colors.border },
        !n.read && { backgroundColor: colors.primary + '08' },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[notifStyles.iconCircle, { backgroundColor: iconCol + '20' }]}>
        <Ionicons name={iconName} size={20} color={iconCol} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typography.bodySmall, { color: colors.text }]}>
          {notificationText(n)}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {timeAgo(n.created_at)}
        </Text>
      </View>
      {!n.read && (
        <View style={[notifStyles.unreadDot, { backgroundColor: colors.primary }]} />
      )}
    </TouchableOpacity>
  )
}

const notifStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
})

// ─── Conversation Row ─────────────────────────────────────────────────────────

function ConversationRow({
  conversation: c,
  colors,
  currentUserId,
}: {
  conversation: Conversation
  colors: AppColors
  currentUserId: string
}) {
  const other = c.other_profile
  const isUnread = c.last_message && !c.last_message.read && c.last_message.sender_id !== currentUserId

  return (
    <TouchableOpacity
      style={[
        convStyles.row,
        { borderBottomColor: colors.border },
        isUnread && { backgroundColor: colors.primary + '08' },
      ]}
      onPress={() => router.push(`/chat/${c.id}` as any)}
      activeOpacity={0.7}
    >
      {other?.avatar_url
        ? <Image source={{ uri: other.avatar_url }} style={convStyles.avatar} contentFit='cover' />
        : (
          <View style={[convStyles.avatar, { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name='person' size={20} color={colors.textMuted} />
          </View>
        )
      }

      <View style={{ flex: 1 }}>
        <View style={convStyles.rowTop}>
          <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>
            @{other?.username ?? '—'}
            {other?.is_verified ? ' ✓' : ''}
          </Text>
          {c.last_message && (
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {timeAgo(c.last_message.created_at)}
            </Text>
          )}
        </View>
        {c.last_message && (
          <Text
            style={[
              typography.bodySmall,
              { color: isUnread ? colors.text : colors.textMuted, fontWeight: isUnread ? '600' : '400' },
            ]}
            numberOfLines={1}
          >
            {c.last_message.sender_id === currentUserId ? 'You: ' : ''}{c.last_message.content}
          </Text>
        )}
      </View>

      {isUnread && (
        <View style={[convStyles.unreadDot, { backgroundColor: colors.primary }]} />
      )}
    </TouchableOpacity>
  )
}

const convStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  unreadDot: { width: 10, height: 10, borderRadius: 5 },
})

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon, title, subtitle, colors }: { icon: string; title: string; subtitle: string; colors: AppColors }) {
  return (
    <View style={emptyStyles.root}>
      <Ionicons name={icon as any} size={48} color={colors.textMuted} />
      <Text style={[typography.h3, { color: colors.textSecondary, marginTop: spacing.md }]}>{title}</Text>
      <Text style={[typography.bodySmall, { color: colors.textMuted, textAlign: 'center', marginTop: 6 }]}>{subtitle}</Text>
    </View>
  )
}

const emptyStyles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, marginTop: spacing.xxl },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatsScreen() {
  const colors = useColors()
  const { user } = useAuth()
  const { notificationCount, messageCount, refreshNotifications, refreshMessages } = useUnread()

  const [tab, setTab] = useState<'notifications' | 'messages'>('notifications')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const loadNotifications = useCallback(async () => {
    if (!user) return
    const { data } = await notificationService.getAll(user.id)
    setNotifications(data)
  }, [user])

  const loadConversations = useCallback(async () => {
    if (!user) return
    const { data } = await chatService.getConversations(user.id)
    setConversations(data)
  }, [user])

  const loadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadNotifications(), loadConversations()])
    setLoading(false)
  }, [loadNotifications, loadConversations])

  useEffect(() => { loadAll() }, [loadAll])

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadAll(), refreshNotifications(), refreshMessages()])
    setRefreshing(false)
  }

  const onNotificationPress = async (n: Notification) => {
    if (!n.read) {
      await notificationService.markRead(n.id)
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x))
      refreshNotifications()
    }
  }

  const onMarkAllRead = async () => {
    if (!user) return
    await notificationService.markAllRead(user.id)
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })))
    refreshNotifications()
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[typography.h2, { color: colors.text }]}>Inbox</Text>
        {tab === 'notifications' && notificationCount > 0 && (
          <TouchableOpacity onPress={onMarkAllRead}>
            <Text style={[typography.label, { color: colors.primary, fontSize: 13 }]}>Mark all read</Text>
          </TouchableOpacity>
        )}
        {tab === 'messages' && (
          <TouchableOpacity
            style={[styles.newMsgBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/chat/new' as any)}
          >
            <Ionicons name='create-outline' size={18} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>

      <TabSwitcher
        tab={tab}
        onTabChange={setTab}
        notifCount={notificationCount}
        msgCount={messageCount}
        colors={colors}
      />

      {loading && !refreshing
        ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
        : tab === 'notifications'
          ? (
            <FlatList
              data={notifications}
              keyExtractor={(n) => n.id}
              renderItem={({ item }) => (
                <NotificationRow notification={item} colors={colors} onPress={() => onNotificationPress(item)} />
              )}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
              ListEmptyComponent={
                <EmptyState
                  icon='notifications-outline'
                  title='All caught up'
                  subtitle='Your notifications will appear here'
                  colors={colors}
                />
              }
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
            />
          )
          : (
            <FlatList
              data={conversations}
              keyExtractor={(c) => c.id}
              renderItem={({ item }) => (
                <ConversationRow conversation={item} colors={colors} currentUserId={user?.id ?? ''} />
              )}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
              ListEmptyComponent={
                <EmptyState
                  icon='chatbubble-outline'
                  title='No messages yet'
                  subtitle='Tap the compose button to start a conversation'
                  colors={colors}
                />
              }
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
            />
          )
      }
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  newMsgBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
