import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { useProfile } from '@/context/ProfileContext'
import { useUnread } from '@/context/UnreadContext'
import { usePendingRequests } from '@/hooks/usePendingRequests'
import { supabase } from '../lib/supabase'
import { followService } from '@/services/followService'
import { activityService } from '@/services/activityService'
import { notificationService, notificationText, notificationIcon, notificationColor } from '@/services/notificationService'
import { useTranslation } from 'react-i18next'
import { ScreenHeader } from '@/components/ui'
import { radius, spacing, typography, type AppColors } from '@/constants/theme'
import type { Follow, Notification, Profile } from '@/types'

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

function Avatar({ uri, size = 46, colors }: { uri?: string | null; size?: number; colors: AppColors }) {
  return uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit='cover' />
    : (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name='person' size={size * 0.42} color={colors.textMuted} />
      </View>
    )
}

type RequestWithFollower = Follow & { follower: Pick<Profile, 'id' | 'username' | 'avatar_url'> }

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const colors = useColors()
  const { t } = useTranslation()
  const { user } = useAuth()
  const { profile: myProfile } = useProfile()
  const { refreshNotifications } = useUnread()
  const { refresh: refreshRequestCount } = usePendingRequests()

  const [requests, setRequests] = useState<RequestWithFollower[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [reqRes, notifRes] = await Promise.all([
      followService.getPendingRequests(user.id),
      notificationService.getAll(user.id),
    ])
    setRequests(reqRes.data as RequestWithFollower[])
    setNotifications(notifRes.data.filter((n) => n.type !== 'follow_request'))
    setLoading(false)
    notificationService.markAllRead(user.id).then(refreshNotifications)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  // Realtime
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`notifications-screen:${user.id}:${Date.now()}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notification
          if (n.type === 'follow_request') {
            followService.getPendingRequests(user.id).then((res) => setRequests(res.data as RequestWithFollower[]))
          } else {
            setNotifications((prev) => [n, ...prev])
          }
          refreshNotifications()
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => { setNotifications((prev) => prev.filter((n) => n.id !== (payload.old as any).id)) }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const onAccept = async (followerId: string) => {
    await followService.acceptRequest(followerId, user!.id,
      myProfile ? { username: myProfile.username, avatar_url: myProfile.avatar_url } : undefined)
    setRequests((r) => r.filter((x) => x.follower_id !== followerId))
    refreshRequestCount()
  }

  const onDecline = async (followerId: string) => {
    await followService.rejectRequest(followerId, user!.id)
    const { data: notifs } = await supabase.from('notifications').select('id')
      .eq('user_id', user!.id).eq('type', 'follow_request').contains('payload', { from_user_id: followerId })
    if (notifs?.length) await supabase.from('notifications').delete().in('id', notifs.map((n: any) => n.id))
    setRequests((r) => r.filter((x) => x.follower_id !== followerId))
    refreshRequestCount()
  }

  const onDeleteNotification = async (id: string) => {
    await notificationService.deleteOne(id)
    setNotifications((n) => n.filter((x) => x.id !== id))
  }

  const onApproveJoin = async (notif: Notification) => {
    const p = notif.payload as any
    await activityService.approveParticipant(p.activity_id, p.from_user_id, p.activity_title)
    await notificationService.deleteOne(notif.id)
    setNotifications((n) => n.filter((x) => x.id !== notif.id))
  }

  const onDenyJoin = async (notif: Notification) => {
    const p = notif.payload as any
    await activityService.rejectParticipant(p.activity_id, p.from_user_id, p.activity_title)
    await notificationService.deleteOne(notif.id)
    setNotifications((n) => n.filter((x) => x.id !== notif.id))
  }

  const onNotificationPress = (n: Notification) => {
    const p = n.payload as any
    if (p?.activity_id) {
      router.push(`/activity/${p.activity_id}` as any)
    } else if (p?.from_user_id) {
      router.push(`/profile/${p.from_user_id}` as any)
    }
  }

  const isEmpty = requests.length === 0 && notifications.length === 0

  const allItems = [
    ...requests.map((r) => ({ kind: 'request' as const, key: `req-${r.follower_id}`, data: r })),
    ...notifications.map((n) => ({ kind: 'notif' as const, key: `notif-${n.id}`, data: n })),
  ]

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScreenHeader title={t('notifications.title')} onBack={() => router.back()} />

      <View style={{ flex: 1 }}>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : isEmpty ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name='notifications-outline' size={32} color={colors.textMuted} />
          </View>
          <Text style={[typography.label, { color: colors.text, marginTop: spacing.md }]}>{t('notifications.empty')}</Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>{t('notifications.emptyHint')}</Text>
        </View>
      ) : (
        <FlatList
          data={allItems}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 100 }}
          renderItem={({ item }) => {
            if (item.kind === 'request') {
              const r = item.data as RequestWithFollower
              return (
                <TouchableOpacity
                  style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: colors.primary }]}
                  onPress={() => router.push(`/profile/${r.follower.id}` as any)}
                  activeOpacity={0.75}
                >
                  <View style={styles.cardRow}>
                    <View style={styles.avatarWrap}>
                      <Avatar uri={r.follower?.avatar_url} colors={colors} />
                      <View style={[styles.typeDot, { backgroundColor: colors.primary }]}>
                        <Ionicons name='person-add' size={8} color='#fff' />
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.label, { color: colors.text }]}>@{r.follower?.username ?? '—'}</Text>
                      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{t('notifications.followRequest')}</Text>
                    </View>
                  </View>
                  <View style={styles.btnRow}>
                    <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }]} onPress={() => onAccept(r.follower_id)}>
                      <Text style={[typography.label, { color: '#fff', fontSize: 13 }]}>{t('common.follow')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, { backgroundColor: colors.surfaceElevated, flex: 1, borderWidth: 1, borderColor: colors.border }]} onPress={() => onDecline(r.follower_id)}>
                      <Text style={[typography.label, { color: colors.textSecondary, fontSize: 13 }]}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              )
            }

            const n = item.data as Notification
            const p = n.payload as any
            const accentCol = notificationColor(n.type, colors)
            const iconName = notificationIcon(n.type) as any
            const isJoinRequest = n.type === 'join_request'
            const hasFromUser = !!p?.from_avatar_url || !!p?.from_username
            const isTappable = !!p?.activity_id || !!p?.from_user_id

            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: accentCol }]}
                onPress={isTappable ? () => onNotificationPress(n) : undefined}
                activeOpacity={isTappable ? 0.75 : 1}
              >
                <View style={styles.cardRow}>
                  <View style={styles.avatarWrap}>
                    {hasFromUser
                      ? <Avatar uri={p.from_avatar_url} colors={colors} />
                      : <View style={[styles.iconCircle, { backgroundColor: accentCol + '22' }]}><Ionicons name={iconName} size={20} color={accentCol} /></View>
                    }
                    <View style={[styles.typeDot, { backgroundColor: accentCol }]}>
                      <Ionicons name={iconName} size={8} color='#fff' />
                    </View>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    {p?.from_username && <Text style={[typography.label, { color: colors.text }]}>@{p.from_username}</Text>}
                    <Text style={[typography.bodySmall, { color: p?.from_username ? colors.textSecondary : colors.text }]}>
                      {notificationText(n)}
                    </Text>
                    {p?.activity_title && (
                      <View style={[styles.chip, { backgroundColor: accentCol + '18' }]}>
                        <Ionicons name='calendar-outline' size={10} color={accentCol} />
                        <Text style={[typography.caption, { color: accentCol, fontWeight: '600' }]} numberOfLines={1}>{p.activity_title}</Text>
                      </View>
                    )}
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{timeAgo(n.created_at)}</Text>
                  </View>
                  {!isJoinRequest && (
                    <TouchableOpacity onPress={() => onDeleteNotification(n.id)} hitSlop={12}
                      style={[styles.dismissBtn, { backgroundColor: colors.surfaceElevated }]}>
                      <Ionicons name='close' size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
                {isJoinRequest && (
                  <View style={styles.btnRow}>
                    <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }]} onPress={() => onApproveJoin(n)}>
                      <Ionicons name='checkmark' size={14} color='#fff' />
                      <Text style={[typography.label, { color: '#fff', fontSize: 13 }]}>{t('common.follow')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, { backgroundColor: colors.surfaceElevated, flex: 1, borderWidth: 1, borderColor: colors.border }]} onPress={() => onDenyJoin(n)}>
                      <Ionicons name='close' size={14} color={colors.textSecondary} />
                      <Text style={[typography.label, { color: colors.textSecondary, fontSize: 13 }]}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            )
          }}
        />
      )}
      </View>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  card: { borderRadius: radius.lg, borderWidth: 1, borderLeftWidth: 4, overflow: 'hidden', padding: spacing.md, gap: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  avatarWrap: { position: 'relative' },
  typeDot: { position: 'absolute', bottom: -1, right: -1, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  iconCircle: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, marginTop: 3 },
  dismissBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  btnRow: { flexDirection: 'row', gap: spacing.sm },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: radius.full },
})
