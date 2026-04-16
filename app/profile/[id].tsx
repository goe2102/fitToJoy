import React, { useCallback, useEffect, useRef, useState } from 'react'
import FollowListModal from '../../components/FollowListModal'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { useProfile } from '@/context/ProfileContext'
import { profileService } from '@/services/profileService'
import { followService } from '@/services/followService'
import { blockService } from '@/services/blockService'
import { reportService } from '@/services/reportService'
import type { ReportReason } from '@/types'
import { chatService } from '@/services/chatService'
import { getCategoryMeta } from '@/constants/categories'
import { supabase } from '../../lib/supabase'
import { radius, spacing, typography } from '@/constants/theme'
import { getEarnedBadges } from '@/utils/hostBadges'
import type { Profile, ProfileStats, FollowStatus, Activity } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

// ─── Activity image card ───────────────────────────────────────────────────────

const CARD_GAP = spacing.sm
const CARD_WIDTH = (Dimensions.get('window').width - spacing.md * 2 - CARD_GAP) / 2

function ActivityImageCard({
  activity,
  colors,
}: {
  activity: Activity
  colors: ReturnType<typeof useColors>
}) {
  const cat = getCategoryMeta(activity.category)

  return (
    <TouchableOpacity
      style={[aStyles.card, { width: CARD_WIDTH }]}
      onPress={() => router.push(`/activity/${activity.id}` as any)}
      activeOpacity={0.82}
    >
      {/* Background: image or colored fallback */}
      {activity.cover_image_url ? (
        <Image
          source={{ uri: activity.cover_image_url }}
          style={StyleSheet.absoluteFillObject}
          contentFit='cover'
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: cat.color + '33', alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name={cat.icon as any} size={36} color={cat.color} />
        </View>
      )}

      {/* Private badge */}
      {!activity.is_public && (
        <View style={aStyles.privateBadge}>
          <Ionicons name='lock-closed' size={10} color='#fff' />
        </View>
      )}

      {/* Bottom gradient + info */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.72)']}
        style={aStyles.gradient}
      >
        {/* Category dot */}
        <View style={[aStyles.catDot, { backgroundColor: cat.color }]} />
        <Text style={aStyles.cardTitle} numberOfLines={2}>{activity.title}</Text>
        <Text style={aStyles.cardDate}>
          {formatDate(activity.date)} · {formatTime(activity.start_time)}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  )
}

const aStyles = StyleSheet.create({
  card: {
    height: 160,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.sm,
    paddingTop: spacing.xl,
  },
  catDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    marginBottom: 2,
  },
  cardDate: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '500',
  },
  privateBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})

// ─── Profile Screen ───────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const { user } = useAuth()
  const { profile: myProfile } = useProfile()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [followStatus, setFollowStatus] = useState<FollowStatus>('none')
  const [hostedActivities, setHostedActivities] = useState<Activity[]>([])
  const [joinedActivities, setJoinedActivities] = useState<Activity[]>([])
  const [activeTab, setActiveTab] = useState<'hosting' | 'joined'>('hosting')
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [dmLoading, setDmLoading] = useState(false)
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null)
  const [reportModalVisible, setReportModalVisible] = useState(false)
  const [reportStep, setReportStep] = useState<1 | 2>(1)
  const [reportReason, setReportReason] = useState<ReportReason | null>(null)
  const [reportDescription, setReportDescription] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)

  const isMe = id === user?.id

  useEffect(() => {
    if (isMe) router.replace('/(tabs)/profile' as any)
  }, [isMe])

  const load = useCallback(async () => {
    if (!id || !user) return
    setLoading(true)
    const [profileRes, statsRes, followRes] = await Promise.all([
      profileService.getProfile(id),
      profileService.getStats(id),
      isMe
        ? Promise.resolve<FollowStatus>('none')
        : followService.getFollowStatus(user.id, id),
    ])
    setProfile(profileRes.data)
    setStats(statsRes.data)
    setFollowStatus(followRes as FollowStatus)

    const canSeeActivities =
      isMe ||
      !profileRes.data?.is_private ||
      (followRes as FollowStatus) === 'accepted'

    if (canSeeActivities) {
      const [hostedRes, joinedRes] = await Promise.all([
        profileService.getUserActivities(id),
        // Hide private joined activities when viewing someone else
        // (they attended someone else's invite-only event — not theirs to share)
        profileService.getJoinedActivities(id, !isMe),
      ])
      setHostedActivities(hostedRes.data)
      // Exclude activities they're hosting (already shown in Hosting tab)
      setJoinedActivities(joinedRes.data.filter((a) => a.host_id !== id))
    }

    setLoading(false)
  }, [id, user, isMe])

  useEffect(() => { load() }, [load])

  // Realtime
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`profile-view:${id}:${Date.now()}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'follows' },
        () => { profileService.getStats(id).then(({ data }) => { if (data) setStats(data) }) }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'activities', filter: `host_id=eq.${id}` },
        () => { profileService.getUserActivities(id).then(({ data }) => setHostedActivities(data)) }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, isMe])

  const handleFollow = async () => {
    if (!user || !profile || isMe) return
    setFollowLoading(true)

    if (followStatus === 'none') {
      const { error } = await followService.follow(
        user.id,
        profile.id,
        profile.is_private,
        myProfile ? { username: myProfile.username, avatar_url: myProfile.avatar_url } : undefined
      )
      if (!error) {
        const newStatus: FollowStatus = profile.is_private ? 'pending' : 'accepted'
        setFollowStatus(newStatus)
        if (newStatus === 'accepted') {
          if (profile.is_private) {
            const [hostedRes, joinedRes] = await Promise.all([
              profileService.getUserActivities(profile.id),
              profileService.getJoinedActivities(profile.id, true),
            ])
            setHostedActivities(hostedRes.data)
            setJoinedActivities(joinedRes.data.filter((a) => a.host_id !== profile.id))
          }
          setStats((s) => s ? { ...s, follower_count: s.follower_count + 1 } : s)
        }
      }
    } else {
      const { error } = await followService.unfollow(user.id, profile.id)
      if (!error) {
        const wasAccepted = followStatus === 'accepted'
        setFollowStatus('none')
        if (wasAccepted) {
          setStats((s) => s ? { ...s, follower_count: Math.max(0, s.follower_count - 1) } : s)
          if (profile.is_private) {
            setHostedActivities([])
            setJoinedActivities([])
          }
        }
      }
    }

    setFollowLoading(false)
  }

  const canMessage = !isMe && !!profile && (!profile.is_private || followStatus === 'accepted')

  const handleDM = async () => {
    if (!user || !profile || dmLoading) return
    setDmLoading(true)
    const { data: convId } = await chatService.getOrCreateConversation(user.id, profile.id)
    setDmLoading(false)
    if (convId) router.push(`/chat/${convId}` as any)
  }

  const [menuVisible, setMenuVisible] = useState(false)

  const confirmBlock = () => {
    if (!profile || !user) return
    setMenuVisible(false)
    Alert.alert(
      `Block @${profile.username}?`,
      "They won't be able to see your profile or activities.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            await blockService.block(user.id, profile.id)
            router.back()
          },
        },
      ]
    )
  }

  const confirmReport = () => {
    setMenuVisible(false)
    setReportReason(null)
    setReportDescription('')
    setReportStep(1)
    setReportModalVisible(true)
  }

  const closeReport = () => {
    Keyboard.dismiss()
    setReportModalVisible(false)
  }

  const submitReport = async () => {
    if (!profile || !user || !reportReason) return
    setReportSubmitting(true)
    const alreadyReported = await reportService.hasReported(user.id, profile.id)
    if (alreadyReported) {
      setReportSubmitting(false)
      closeReport()
      Alert.alert('', t('publicProfile.reportAlreadySent'))
      return
    }
    const { error } = await reportService.submit(user.id, profile.id, reportReason, reportDescription.trim() || undefined)
    setReportSubmitting(false)
    closeReport()
    if (!error) {
      Alert.alert(t('publicProfile.reportSuccessTitle'), t('publicProfile.reportSuccessMessage'))
      router.back()
    }
  }

  const followButtonLabel =
    followStatus === 'accepted' ? t('publicProfile.following') :
    followStatus === 'pending' ? t('publicProfile.pendingRequest') :
    t('publicProfile.follow')

  const followButtonStyle =
    followStatus !== 'none'
      ? [s.followBtn, s.followBtnOutline, { borderColor: colors.border }]
      : [s.followBtn, { backgroundColor: colors.primary }]

  const followButtonTextStyle =
    followStatus !== 'none'
      ? [s.followBtnText, { color: colors.text }]
      : [s.followBtnText, { color: '#FFFFFF' }]

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.surface }]} edges={['top']}>
        <View style={s.loadingContainer}>
          <ActivityIndicator color={colors.primary} size='large' />
        </View>
      </SafeAreaView>
    )
  }

  if (!profile) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.surface }]} edges={['top']}>
        <View style={s.loadingContainer}>
          <Text style={[typography.body, { color: colors.textSecondary }]}>User not found.</Text>
        </View>
      </SafeAreaView>
    )
  }

  const canSeeActivities = isMe || !profile.is_private || followStatus === 'accepted'
  const displayedActivities = activeTab === 'hosting' ? hostedActivities : joinedActivities

  // Pair activities into rows for the 2-col grid
  const rows: [Activity, Activity | null][] = []
  for (let i = 0; i < displayedActivities.length; i += 2) {
    rows.push([displayedActivities[i], displayedActivities[i + 1] ?? null])
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Fixed top nav — back left, 3-dots right */}
      <View style={[s.topNav, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.navBtn}>
          <Ionicons name='chevron-back' size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        {!isMe && (
          <TouchableOpacity onPress={() => setMenuVisible(true)} hitSlop={12} style={s.navBtn}>
            <Ionicons name='ellipsis-vertical' size={22} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar centered */}
        <View style={s.avatarSection}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={s.avatar} contentFit='cover' />
          ) : (
            <View style={[s.avatar, { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name='person' size={40} color={colors.textMuted} />
            </View>
          )}
        </View>

        {/* Name + bio centered below avatar */}
        <View style={s.nameSection}>
          <View style={s.nameRow}>
            <Text style={[typography.h3, { color: colors.text }]}>{profile.username}</Text>
            {profile.is_verified && (
              <Ionicons name='checkmark-circle' size={18} color={colors.primary} style={{ marginLeft: 4 }} />
            )}
            {profile.is_private && (
              <Ionicons name='lock-closed' size={14} color={colors.textMuted} style={{ marginLeft: 4 }} />
            )}
          </View>
          {profile.rating_count > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name='star' size={13} color='#FFD60A' />
              <Text style={[typography.bodySmall, { color: colors.text, fontWeight: '700' }]}>
                {profile.average_rating?.toFixed(1)}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                ({profile.rating_count} {profile.rating_count === 1 ? 'rating' : 'ratings'})
              </Text>
            </View>
          )}
          {profile.bio ? (
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }]}>
              {profile.bio}
            </Text>
          ) : null}
        </View>

        {/* Separator between profile info and actions */}
        <View style={[s.separator, { backgroundColor: colors.border }]} />

        {/* Stats */}
        <View style={[s.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity style={s.statCell} activeOpacity={0.7} onPress={() => setFollowModal('followers')}>
            <Text style={[typography.h3, { color: colors.text }]}>{stats?.follower_count ?? 0}</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{t('publicProfile.followers')}</Text>
          </TouchableOpacity>
          <View style={[s.statDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={s.statCell} activeOpacity={0.7} onPress={() => setFollowModal('following')}>
            <Text style={[typography.h3, { color: colors.text }]}>{stats?.following_count ?? 0}</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{t('publicProfile.following_count')}</Text>
          </TouchableOpacity>
          <View style={[s.statDivider, { backgroundColor: colors.border }]} />
          <View style={s.statCell}>
            <Text style={[typography.h3, { color: colors.text }]}>{stats?.activity_count ?? 0}</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{t('publicProfile.activities')}</Text>
          </View>
        </View>

        {/* Host badges */}
        {(stats?.finished_count ?? 0) > 0 && (() => {
          const earned = getEarnedBadges(stats!.finished_count)
          if (!earned.length) return null
          return (
            <View style={{ marginBottom: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>HOST BADGES</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {earned.map((b) => (
                  <View key={b.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: b.color + '18', borderRadius: radius.full, borderWidth: 1, borderColor: b.color + '40', paddingHorizontal: 12, paddingVertical: 5 }}>
                    <Ionicons name={b.icon as any} size={14} color={b.color} />
                    <Text style={[typography.caption, { color: b.color, fontWeight: '700' }]}>{b.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )
        })()}

        {/* Follow + Message buttons */}
        {!isMe && (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
              <TouchableOpacity
                style={[followButtonStyle, { flex: 1, marginBottom: 0 }]}
                onPress={handleFollow}
                disabled={followLoading}
                activeOpacity={0.75}
              >
                {followLoading ? (
                  <ActivityIndicator color={followStatus !== 'none' ? colors.text : '#FFF'} size='small' />
                ) : (
                  <Text style={followButtonTextStyle}>{followButtonLabel}</Text>
                )}
              </TouchableOpacity>

              {canMessage && (
                <TouchableOpacity
                  style={[s.followBtn, s.followBtnOutline, { borderColor: colors.border, flex: 1 }]}
                  onPress={handleDM}
                  disabled={dmLoading}
                  activeOpacity={0.75}
                >
                  {dmLoading
                    ? <ActivityIndicator color={colors.text} size='small' />
                    : <Text style={[s.followBtnText, { color: colors.text }]}>{t('publicProfile.message')}</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Activities section */}
        {!canSeeActivities ? (
          <View style={[s.lockedBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name='lock-closed-outline' size={28} color={colors.textMuted} />
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
              {t('publicProfile.privateAccount')}{'\n'}{t('publicProfile.privateAccountHint')}
            </Text>
          </View>
        ) : (
          <View>
            {/* Tab switcher */}
            <View style={[s.tabRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              {(['hosting', 'joined'] as const).map((tab) => {
                const active = activeTab === tab
                const count = tab === 'hosting' ? hostedActivities.length : joinedActivities.length
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[s.tabBtn, active && [s.tabBtnActive, { backgroundColor: colors.surface }]]}
                    onPress={() => setActiveTab(tab)}
                    activeOpacity={0.7}
                  >
                    <Text style={[typography.label, { color: active ? colors.text : colors.textMuted, fontSize: 13 }]}>
                      {tab === 'hosting' ? t('activity.host') : t('activity.joined')}
                    </Text>
                    {count > 0 && (
                      <View style={[s.tabCount, { backgroundColor: active ? colors.primary : colors.border }]}>
                        <Text style={{ color: active ? '#fff' : colors.textMuted, fontSize: 10, fontWeight: '700' }}>
                          {count}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Activity grid */}
            {rows.length === 0 ? (
              <View style={s.emptyGrid}>
                <Ionicons name='calendar-outline' size={32} color={colors.textMuted} />
                <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
                  {t('publicProfile.noActivities')}
                </Text>
              </View>
            ) : (
              <View style={s.grid}>
                {rows.map(([left, right], i) => (
                  <View key={i} style={s.gridRow}>
                    <ActivityImageCard activity={left} colors={colors} />
                    {right
                      ? <ActivityImageCard activity={right} colors={colors} />
                      : <View style={{ width: CARD_WIDTH }} />
                    }
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {user && followModal && (
        <FollowListModal
          visible={!!followModal}
          onClose={() => setFollowModal(null)}
          targetUserId={id!}
          currentUserId={user.id}
          type={followModal}
        />
      )}

      {/* Block / Report bottom sheet */}
      <Modal
        visible={menuVisible}
        transparent
        animationType='fade'
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={s.sheetOverlay} onPress={() => setMenuVisible(false)}>
          <Pressable
            style={[s.sheetPanel, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, spacing.md) }]}
            onPress={() => {}}
          >
            {/* Identity header */}
            <View style={[s.sheetIdentity, { borderBottomColor: colors.border }]}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={s.sheetAvatar} contentFit='cover' />
              ) : (
                <View style={[s.sheetAvatar, s.sheetAvatarPlaceholder, { backgroundColor: colors.surfaceElevated }]}>
                  <Ionicons name='person' size={22} color={colors.textMuted} />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.sheetName, { color: colors.text }]} numberOfLines={1}>
                  @{profile?.username}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setMenuVisible(false)}
                hitSlop={12}
                style={[s.sheetCloseBtn, { backgroundColor: colors.surfaceElevated }]}
              >
                <Ionicons name='close' size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Report row */}
            <TouchableOpacity
              style={[s.sheetRow, { borderBottomColor: colors.border }]}
              onPress={confirmReport}
              activeOpacity={0.7}
            >
              <View style={[s.sheetIconWrap, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name='flag-outline' size={18} color={colors.text} />
              </View>
              <Text style={[s.sheetRowLabel, { color: colors.text }]}>Report</Text>
            </TouchableOpacity>

            {/* Block row */}
            <TouchableOpacity
              style={[s.sheetRow, { borderBottomWidth: 0 }]}
              onPress={confirmBlock}
              activeOpacity={0.7}
            >
              <View style={[s.sheetIconWrap, { backgroundColor: colors.error + '15' }]}>
                <Ionicons name='ban-outline' size={18} color={colors.error} />
              </View>
              <Text style={[s.sheetRowLabel, { color: colors.error }]}>Block</Text>
            </TouchableOpacity>

            {/* Cancel button */}
            <TouchableOpacity
              style={[s.sheetCancel, { backgroundColor: colors.primary }]}
              onPress={() => setMenuVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={[s.sheetCancelLabel, { color: '#fff' }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Report modal — two steps */}
      <Modal
        visible={reportModalVisible}
        transparent
        animationType='slide'
        onRequestClose={closeReport}
      >
        {/* Dim overlay */}
        <Pressable
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
          onPress={closeReport}
        />

        {/* Panel — KAV only wraps the sheet, not the overlay */}
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          pointerEvents='box-none'
        >
          <View style={[s.reportPanel, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom + 8, spacing.lg) }]}>

            {/* ── Step 1: pick a reason ── */}
            {reportStep === 1 && (
              <>
                <View style={[s.reportHeader, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.sheetName, { color: colors.text }]} numberOfLines={1}>
                      {t('publicProfile.reportTitle', { username: profile?.username ?? '' })}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                      {t('publicProfile.reportSubtitle')}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={closeReport} hitSlop={12} style={[s.sheetCloseBtn, { backgroundColor: colors.surfaceElevated }]}>
                    <Ionicons name='close' size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {(['spam', 'harassment', 'inappropriate', 'fake', 'other'] as ReportReason[]).map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={[s.reasonRow, { borderColor: reportReason === reason ? colors.primary : colors.border }]}
                    onPress={() => setReportReason(reason)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.reasonRadio, { borderColor: reportReason === reason ? colors.primary : colors.border }]}>
                      {reportReason === reason && <View style={[s.reasonRadioFill, { backgroundColor: colors.primary }]} />}
                    </View>
                    <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>
                      {t(`publicProfile.reportReason${reason.charAt(0).toUpperCase() + reason.slice(1)}` as any)}
                    </Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={[s.sheetCancel, { backgroundColor: reportReason ? colors.primary : colors.border, marginTop: spacing.xs, marginHorizontal: 0 }]}
                  onPress={() => setReportStep(2)}
                  disabled={!reportReason}
                  activeOpacity={0.7}
                >
                  <Text style={[s.sheetCancelLabel, { color: '#fff' }]}>Next</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── Step 2: optional details + submit ── */}
            {reportStep === 2 && (
              <>
                <View style={[s.reportHeader, { borderBottomColor: colors.border }]}>
                  <TouchableOpacity onPress={() => setReportStep(1)} hitSlop={12} style={[s.sheetCloseBtn, { backgroundColor: colors.surfaceElevated }]}>
                    <Ionicons name='arrow-back' size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, minWidth: 0, marginLeft: spacing.sm }}>
                    <Text style={[s.sheetName, { color: colors.text }]} numberOfLines={1}>
                      {t(`publicProfile.reportReason${reportReason!.charAt(0).toUpperCase() + reportReason!.slice(1)}` as any)}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                      {t('publicProfile.reportDescriptionPlaceholder')}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={closeReport} hitSlop={12} style={[s.sheetCloseBtn, { backgroundColor: colors.surfaceElevated }]}>
                    <Ionicons name='close' size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[s.reportTextInput, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border }]}
                  placeholder={t('publicProfile.reportDescriptionPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={reportDescription}
                  onChangeText={setReportDescription}
                  multiline
                  maxLength={500}
                  autoFocus
                />

                <TouchableOpacity
                  style={[s.sheetCancel, { backgroundColor: colors.error, marginHorizontal: 0 }]}
                  onPress={submitReport}
                  disabled={reportSubmitting}
                  activeOpacity={0.7}
                >
                  <Text style={[s.sheetCancelLabel, { color: '#fff' }]}>
                    {reportSubmitting ? t('common.loading') : t('publicProfile.reportSubmit')}
                  </Text>
                </TouchableOpacity>
              </>
            )}

          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    height: 48,
  },
  navBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  nameSection: {
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginBottom: spacing.lg,
  },
  // Block/Report bottom sheet (matches chat action sheet style)
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheetPanel: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.sm,
    overflow: 'hidden',
  },
  sheetIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.xs,
  },
  sheetAvatar: { width: 48, height: 48, borderRadius: 24 },
  sheetAvatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  sheetName: { fontSize: 16, fontWeight: '700' },
  sheetCloseBtn: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetIconWrap: {
    width: 36, height: 36, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetRowLabel: { fontSize: 15, fontWeight: '500' },
  sheetCancel: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sheetCancelLabel: { fontSize: 15, fontWeight: '600' },
  reportPanel: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  reasonRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonRadioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  reportTextInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 96,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 2,
  },
  statDivider: { width: 1, marginVertical: spacing.sm },
  followBtn: {
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  followBtnOutline: { borderWidth: 1.5 },
  followBtnText: { fontSize: 15, fontWeight: '600' },
  lockedBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  tabRow: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 3,
    marginBottom: spacing.md,
    gap: 3,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: radius.md,
  },
  tabBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  grid: { gap: CARD_GAP },
  gridRow: { flexDirection: 'row', gap: CARD_GAP },
  emptyGrid: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
})
