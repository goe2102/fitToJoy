import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FollowListModal from '../../components/FollowListModal'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native'
import { imageService } from '@/services/imageService'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { useProfile } from '@/context/ProfileContext'
import { profileService } from '@/services/profileService'
import { activityService } from '@/services/activityService'
import { ratingService } from '@/services/ratingService'
import { supabase } from '../../lib/supabase'
import { useTranslation } from 'react-i18next'
import { Badge, ScreenHeader, ModalHeader, SearchBar } from '@/components/ui'
import { radius, spacing, typography, type AppColors } from '@/constants/theme'
import { getEarnedBadges, getNextBadge } from '@/utils/hostBadges'
import type { Activity } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12}:${m} ${ampm}`
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

// ─── Activity Card ────────────────────────────────────────────────────────────

function ActivityCard({
  activity,
  colors,
  variant,
  onDelete,
  openSwipeRef,
}: {
  activity: Activity
  colors: AppColors
  variant: 'hosting' | 'joined'
  onDelete?: () => void
  openSwipeRef: React.MutableRefObject<Swipeable | null>
}) {
  const cardStyles = useMemo(() => makeActivityCardStyles(colors), [colors])
  const swipeRef = useRef<Swipeable>(null)
  const spotsLeft =
    activity.max_participants !== null
      ? activity.max_participants - (activity.participant_count ?? 0)
      : null

  const cardContent = (
    <TouchableOpacity
      style={cardStyles.card}
      onPress={() => {
        openSwipeRef.current?.close()
        router.push(`/activity/${activity.id}` as any)
      }}
      activeOpacity={0.75}
    >
      <View style={cardStyles.cardHeader}>
        <Text style={cardStyles.cardTitle} numberOfLines={1}>
          {activity.title}
        </Text>
        <Badge
          label={activity.is_public ? 'Public' : 'Private'}
          variant={activity.is_public ? 'primary' : 'neutral'}
        />
      </View>
      <View style={cardStyles.cardMeta}>
        <View style={cardStyles.metaItem}>
          <Ionicons name='calendar-outline' size={13} color={colors.textMuted} />
          <Text style={cardStyles.metaText}>
            {formatDate(activity.date)} · {formatTime(activity.start_time)}
          </Text>
        </View>
        <View style={cardStyles.metaItem}>
          <Ionicons name='time-outline' size={13} color={colors.textMuted} />
          <Text style={cardStyles.metaText}>{formatDuration(activity.duration_minutes)}</Text>
        </View>
        <View style={cardStyles.metaItem}>
          <Ionicons name='people-outline' size={13} color={colors.textMuted} />
          <Text style={cardStyles.metaText}>
            {activity.participant_count ?? 0}
            {activity.max_participants !== null ? `/${activity.max_participants}` : ''} joined
            {spotsLeft !== null && spotsLeft <= 3 && spotsLeft > 0
              ? ` · ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`
              : ''}
          </Text>
        </View>
        {variant === 'joined' && activity.host && (
          <View style={cardStyles.metaItem}>
            <Ionicons name='person-outline' size={13} color={colors.textMuted} />
            <Text style={cardStyles.metaText}>Host: @{(activity.host as any).username}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )

  if (variant !== 'hosting' || !onDelete) return cardContent

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={() => (
        <TouchableOpacity
          style={cardStyles.deleteAction}
          onPress={() => { swipeRef.current?.close(); onDelete() }}
          activeOpacity={0.85}
        >
          <Ionicons name='trash-outline' size={22} color='#fff' />
          <Text style={cardStyles.deleteActionText}>Delete</Text>
        </TouchableOpacity>
      )}
      overshootRight={false}
      onSwipeableOpen={() => {
        if (openSwipeRef.current !== swipeRef.current) openSwipeRef.current?.close()
        openSwipeRef.current = swipeRef.current
      }}
      onSwipeableClose={() => {
        if (openSwipeRef.current === swipeRef.current) openSwipeRef.current = null
      }}
    >
      {cardContent}
    </Swipeable>
  )
}

function makeActivityCardStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    cardTitle: {
      ...typography.label,
      color: colors.text,
      flex: 1,
    },
    cardMeta: { gap: 5 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { ...typography.caption, color: colors.textMuted },
    deleteAction: {
      backgroundColor: colors.error,
      borderRadius: radius.lg,
      marginBottom: spacing.sm,
      marginLeft: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      gap: 4,
    },
    deleteActionText: {
      ...typography.caption,
      color: '#fff',
      fontWeight: '700',
    },
  })
}

// ─── Past Activity Card ───────────────────────────────────────────────────────

function PastActivityCard({
  entry,
  colors,
}: {
  entry: { activity: { id: string; title: string; date: string; host_id: string; host_username: string; host_avatar_url: string | null }; myRating: any; canRate: boolean }
  colors: AppColors
}) {
  const rated = !!entry.myRating
  return (
    <TouchableOpacity
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
      onPress={() => router.push(`/past-activity/${entry.activity.id}` as any)}
      activeOpacity={0.75}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>{entry.activity.title}</Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
          Host: @{entry.activity.host_username} · {new Date(entry.activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </Text>
        {rated && (
          <View style={{ flexDirection: 'row', gap: 3, marginTop: 4 }}>
            {[1,2,3,4,5].map((s) => (
              <Ionicons key={s} name={s <= entry.myRating.rating ? 'star' : 'star-outline'} size={12} color={s <= entry.myRating.rating ? '#FFD60A' : colors.border} />
            ))}
          </View>
        )}
      </View>
      <View style={{
        backgroundColor: rated ? colors.success + '18' : colors.primary + '18',
        borderRadius: radius.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
      }}>
        <Text style={[typography.caption, { color: rated ? colors.success : colors.primary, fontWeight: '700' }]}>
          {rated ? 'Rated' : 'Rate'}
        </Text>
      </View>
      <Ionicons name='chevron-forward' size={16} color={colors.textMuted} />
    </TouchableOpacity>
  )
}

// ─── Activities Modal ─────────────────────────────────────────────────────────

function ActivitiesModal({
  visible,
  userId,
  onClose,
  colors,
}: {
  visible: boolean
  userId: string
  onClose: () => void
  colors: AppColors
}) {
  const { t } = useTranslation()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!visible) return
    setLoading(true)
    setQuery('')
    supabase
      .from('activities')
      .select('*')
      .eq('host_id', userId)
      .in('status', ['active', 'finished'])
      .order('date', { ascending: false })
      .then(({ data }) => {
        setActivities((data as any) ?? [])
        setLoading(false)
      })
  }, [visible, userId])

  const filtered = query.trim()
    ? activities.filter((a) => a.title.toLowerCase().includes(query.toLowerCase()))
    : activities

  return (
    <Modal visible={visible} animationType='slide' presentationStyle='pageSheet' onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ModalHeader title={t('profile.myActivities')} onClose={onClose} />
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={t('profile.searchActivities')}
          style={{ marginHorizontal: spacing.md, marginVertical: spacing.sm }}
        />

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : filtered.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingBottom: 60 }}>
            <Ionicons name='calendar-outline' size={36} color={colors.textMuted} />
            <Text style={[typography.body, { color: colors.textMuted }]}>
              {query ? t('common.noResults') : t('profile.noActivities')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(a) => a.id}
            contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.sm }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
                onPress={() => {
                  onClose()
                  if (item.status === 'finished') {
                    router.push(`/past-activity/${item.id}` as any)
                  } else {
                    router.push(`/activity/${item.id}` as any)
                  }
                }}
                activeOpacity={0.75}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <View style={{ backgroundColor: item.status === 'finished' ? colors.success + '18' : colors.primary + '18', borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 }}>
                  <Text style={[typography.caption, { color: item.status === 'finished' ? colors.success : colors.primary, fontWeight: '700' }]}>
                    {item.status === 'finished' ? t('chats.finished') : t('activity.joined')}
                  </Text>
                </View>
                <Ionicons name='chevron-forward' size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Modal>
  )
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  colors,
  onPress,
}: {
  label: string
  value: number
  colors: AppColors
  onPress?: () => void
}) {
  const styles = useMemo(() => makeStatStyles(colors), [colors])
  return (
    <TouchableOpacity style={styles.stat} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

function makeStatStyles(colors: AppColors) {
  return StyleSheet.create({
    stat: { alignItems: 'center', flex: 1 },
    statValue: { ...typography.h3, color: colors.text },
    statLabel: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  })
}

// ─── Main Profile Screen ──────────────────────────────────────────────────────

type ActivityTab = 'hosting' | 'joined' | 'past'

export default function ProfileScreen() {
  const colors = useColors()
  const { t } = useTranslation()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { user } = useAuth()
  const { profile, stats, loading, refreshProfile, updateAvatar } = useProfile()
  const [avatarSaving, setAvatarSaving] = useState(false)

  const onPickAvatar = async () => {
    const result = await imageService.pickImage([1, 1])
    if (!result?.base64) return
    setAvatarSaving(true)
    const { error } = await updateAvatar(result.base64)
    setAvatarSaving(false)
    if (error) Alert.alert(t('common.error'), 'Could not update photo. Please try again.')
  }

  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null)
  const [activitiesModal, setActivitiesModal] = useState(false)
  const [activeTab, setActiveTab] = useState<ActivityTab>('hosting')
  const [hostingActivities, setHostingActivities] = useState<Activity[]>([])
  const [joinedActivities, setJoinedActivities] = useState<Activity[]>([])
  const [pastEntries, setPastEntries] = useState<Awaited<ReturnType<typeof ratingService.getFinishedActivitiesForRating>>['data']>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const openSwipeRef = useRef<Swipeable | null>(null)

  const loadActivities = useCallback(async () => {
    if (!profile) return
    setActivitiesLoading(true)
    const [{ data: hosting }, { data: joined }, { data: past }] = await Promise.all([
      profileService.getUserActivities(profile.id),
      profileService.getJoinedActivities(profile.id),
      ratingService.getFinishedActivitiesForRating(profile.id),
    ])
    setHostingActivities(hosting)
    setJoinedActivities(joined)
    setPastEntries(past)
    setActivitiesLoading(false)
  }, [profile?.id])

  useEffect(() => { loadActivities() }, [loadActivities])

  // Realtime: participant count changes + new/cancelled activities + follow counts
  useEffect(() => {
    if (!profile?.id) return

    const channel = supabase
      .channel(`profile-live:${profile.id}:${Date.now()}`)
      // Participant joins/leaves → refresh activity participant counts
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' },
        () => loadActivities()
      )
      // Activities created or cancelled by this user
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'activities', filter: `host_id=eq.${profile.id}` },
        () => loadActivities()
      )
      // Follow count changes
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'follows' },
        () => refreshProfile()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

  const onDeleteActivity = useCallback(async (activity: Activity) => {
    const count = activity.participant_count ?? 0
    const msg = count > 0
      ? `This will cancel the activity and notify ${count} participant${count === 1 ? '' : 's'}.`
      : 'This will permanently delete the activity.'
    Alert.alert(t('activity.deleteConfirmTitle'), msg, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await activityService.cancelActivity(activity.id)
          setHostingActivities((prev) => prev.filter((a) => a.id !== activity.id))
        },
      },
    ])
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refreshProfile(), loadActivities()])
    setRefreshing(false)
  }

  const displayedActivities = activeTab === 'hosting' ? hostingActivities : joinedActivities
  // Past tab only shows activities the user participated in (not hosted)
  const participatedPastEntries = pastEntries.filter((e) => e.canRate)

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe]} edges={['top']}>
        <ScreenHeader title={t('profile.title')} />
        <View style={[styles.centered, { flex: 1, backgroundColor: colors.background }]}>
          <ActivityIndicator color={colors.primary} size='large' />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.safe]} edges={['top']}>
      {/* ── Header ── */}
      <ScreenHeader
        title={t('profile.title')}
        right={
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/settings' as any)}>
            <Ionicons name='settings-outline' size={22} color={colors.text} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        onScrollBeginDrag={() => openSwipeRef.current?.close()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Avatar + identity ── */}
        <View style={styles.identitySection}>
          <TouchableOpacity onPress={onPickAvatar} disabled={avatarSaving} activeOpacity={0.8} style={styles.avatarWrapper}>
            {avatarSaving ? (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit='cover' />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name='person' size={40} color={colors.textMuted} />
              </View>
            )}
            {profile?.is_verified && (
              <View style={[styles.verifiedBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name='checkmark' size={11} color={colors.white} />
              </View>
            )}
            <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
              <Ionicons name='camera' size={12} color='#fff' />
            </View>
          </TouchableOpacity>

          <Text style={styles.username}>@{profile?.username ?? '—'}</Text>
          {profile && profile.rating_count > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Ionicons name='star' size={14} color='#FFD60A' />
              <Text style={[typography.bodySmall, { color: colors.text, fontWeight: '700' }]}>
                {profile.average_rating?.toFixed(1)}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                ({profile.rating_count})
              </Text>
            </View>
          )}
          {profile?.bio
            ? <Text style={styles.bio}>{profile.bio}</Text>
            : (
              <TouchableOpacity onPress={() => router.push('/settings' as any)}>
                <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 4 }]}>
                  + Add a bio
                </Text>
              </TouchableOpacity>
            )
          }
        </View>

        {/* ── Stats ── */}
        <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <StatPill label={t('profile.followers')} value={stats.follower_count} colors={colors} onPress={() => setFollowModal('followers')} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatPill label={t('profile.following')} value={stats.following_count} colors={colors} onPress={() => setFollowModal('following')} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatPill label={t('profile.activities')} value={stats.activity_count} colors={colors} onPress={() => setActivitiesModal(true)} />
        </View>

        {/* ── Host badges ── */}
        {stats.finished_count > 0 && (() => {
          const earned = getEarnedBadges(stats.finished_count)
          const next = getNextBadge(stats.finished_count)
          return (
            <View style={{ marginBottom: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>HOST BADGES</Text>
                {next && (
                  <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>
                    {next.remaining} more for {next.label}
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {earned.map((b) => (
                  <View key={b.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: b.color + '18', borderRadius: radius.full, borderWidth: 1, borderColor: b.color + '40', paddingHorizontal: 12, paddingVertical: 5 }}>
                    <Ionicons name={b.icon as any} size={14} color={b.color} />
                    <Text style={[typography.caption, { color: b.color, fontWeight: '700' }]}>{b.label}</Text>
                  </View>
                ))}
              </View>
              {next && (
                <View style={{ height: 4, backgroundColor: colors.surfaceElevated, borderRadius: 2, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.round(((next.threshold - next.remaining) / next.threshold) * 100)}%`, height: '100%', backgroundColor: colors.primary, borderRadius: 2 }} />
                </View>
              )}
            </View>
          )
        })()}

        {/* ── Activities ── */}
        <View style={styles.section}>
          {/* Tab bar */}
          <View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {(['hosting', 'joined', 'past'] as const).map((tab) => {
              const count = tab === 'hosting' ? hostingActivities.length : tab === 'joined' ? joinedActivities.length : participatedPastEntries.length
              const label = tab === 'hosting' ? t('activity.host') : tab === 'joined' ? t('activity.joined') : t('pastActivity.title')
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tabItem, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.7}
                >
                  <Text style={[typography.label, { color: activeTab === tab ? colors.primary : colors.textMuted }]}>
                    {label}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.tabBadge, { backgroundColor: activeTab === tab ? colors.primary : colors.border }]}>
                      <Text style={[styles.tabBadgeText, { color: activeTab === tab ? '#fff' : colors.textMuted }]}>
                        {count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>

          {activitiesLoading
            ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
            : activeTab === 'past'
              ? participatedPastEntries.length === 0
                ? (
                  <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name='trophy-outline' size={32} color={colors.textMuted} />
                    <Text style={[typography.label, { color: colors.textSecondary, marginTop: spacing.sm }]}>{t('profile.noActivities')}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: 4 }]}>
                      {t('profile.noActivitiesHint')}
                    </Text>
                  </View>
                )
                : participatedPastEntries.map((entry) => (
                  <PastActivityCard
                    key={entry.activity.id}
                    entry={entry}
                    colors={colors}
                  />
                ))
              : displayedActivities.length === 0
                ? (
                  <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name='calendar-outline' size={32} color={colors.textMuted} />
                    <Text style={[typography.label, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                      {t('profile.noActivities')}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: 4 }]}>
                      {t('profile.noActivitiesHint')}
                    </Text>
                  </View>
                )
                : displayedActivities.map((a) => (
                  <ActivityCard
                    key={a.id}
                    activity={a}
                    colors={colors}
                    variant={activeTab as 'hosting' | 'joined'}
                    onDelete={activeTab === 'hosting' ? () => onDeleteActivity(a) : undefined}
                    openSwipeRef={openSwipeRef}
                  />
                ))
          }
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {profile && user && followModal && (
        <FollowListModal
          visible={!!followModal}
          onClose={() => setFollowModal(null)}
          targetUserId={profile.id}
          currentUserId={user.id}
          type={followModal}
        />
      )}

      {profile && (
        <ActivitiesModal
          visible={activitiesModal}
          userId={profile.id}
          onClose={() => setActivitiesModal(false)}
          colors={colors}
        />
      )}
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    centered: { alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    identitySection: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    avatarWrapper: { position: 'relative', marginBottom: spacing.md },
    cameraBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
    },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      borderWidth: 3,
      borderColor: colors.primary + '40',
    },
    avatarPlaceholder: {
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    verifiedBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.background,
    },
    username: {
      ...typography.h3,
      color: colors.text,
      marginBottom: 4,
    },
    bio: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
      lineHeight: 20,
    },

    statsRow: {
      flexDirection: 'row',
      borderRadius: radius.lg,
      borderWidth: 1,
      paddingVertical: spacing.md,
      marginBottom: spacing.md,
    },
    statDivider: { width: 1, marginVertical: 4 },

    section: { marginTop: spacing.sm },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    sectionTitle: { ...typography.h3, color: colors.text },

    emptyState: {
      alignItems: 'center',
      padding: spacing.xl,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
    },

    tabBar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.lg,
      borderWidth: 1,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    tabItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      flex: 1,
      justifyContent: 'center',
    },
    tabBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    tabBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#fff',
    },
  })
}
