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
  ActionSheetIOS,
  Platform,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { useProfile } from '@/context/ProfileContext'
import { profileService } from '@/services/profileService'
import { followService } from '@/services/followService'
import { blockService } from '@/services/blockService'
import { chatService } from '@/services/chatService'
import { supabase } from '../../lib/supabase'
import { radius, spacing, typography } from '@/constants/theme'
import { getEarnedBadges, getNextBadge } from '@/utils/hostBadges'
import type { Profile, ProfileStats, FollowStatus, Activity } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}
function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

// ─── Activity Card ────────────────────────────────────────────────────────────

function ActivityCard({
  activity,
  colors,
}: {
  activity: Activity
  colors: ReturnType<typeof useColors>
}) {
  return (
    <TouchableOpacity
      style={[
        aStyles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onPress={() => router.push(`/activity/${activity.id}` as any)}
      activeOpacity={0.75}
    >
      <View
        style={[
          aStyles.accent,
          {
            backgroundColor: activity.is_public
              ? colors.primary
              : colors.textMuted,
          },
        ]}
      />
      <View style={aStyles.content}>
        <Text
          style={[typography.label, { color: colors.text }]}
          numberOfLines={1}
        >
          {activity.title}
        </Text>
        <Text
          style={[
            typography.caption,
            { color: colors.textMuted, marginTop: 2 },
          ]}
        >
          {formatDate(activity.date)} · {formatTime(activity.start_time)}
        </Text>
      </View>
      {!activity.is_public && (
        <Ionicons
          name='lock-closed'
          size={13}
          color={colors.textMuted}
          style={{ marginRight: spacing.sm }}
        />
      )}
      <Ionicons name='chevron-forward' size={14} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
    </TouchableOpacity>
  )
}

const aStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  accent: { width: 4, alignSelf: 'stretch' },
  content: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
})

// ─── Profile Screen ───────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { profile: myProfile } = useProfile()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [followStatus, setFollowStatus] = useState<FollowStatus>('none')
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [dmLoading, setDmLoading] = useState(false)
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null)

  const isMe = id === user?.id

  // If this is the logged-in user's own profile, redirect to the tab
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

    // Load activities if public or following or own profile
    const canSeeActivities =
      isMe ||
      !profileRes.data?.is_private ||
      (followRes as FollowStatus) === 'accepted'

    if (canSeeActivities) {
      const { data } = await profileService.getUserActivities(id)
      setActivities(data)
    }

    setLoading(false)
  }, [id, user, isMe])

  useEffect(() => {
    load()
  }, [load])

  // Realtime — stats + activities update live while viewing someone's profile
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`profile-view:${id}:${Date.now()}`)
      // Follow count changes (someone follows/unfollows this profile)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'follows' },
        () => {
          profileService.getStats(id).then(({ data }) => { if (data) setStats(data) })
        }
      )
      // Their activities change
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'activities', filter: `host_id=eq.${id}` },
        () => {
          profileService.getUserActivities(id).then(({ data }) => setActivities(data))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  const handleFollow = async () => {
    if (!user || !profile || isMe) return
    setFollowLoading(true)

    if (followStatus === 'none') {
      const { error } = await followService.follow(
        user.id,
        profile.id,
        profile.is_private,
        myProfile
          ? { username: myProfile.username, avatar_url: myProfile.avatar_url }
          : undefined
      )
      if (!error) {
        const newStatus: FollowStatus = profile.is_private
          ? 'pending'
          : 'accepted'
        setFollowStatus(newStatus)
        if (newStatus === 'accepted') {
          // Now can see activities if profile was private
          if (profile.is_private) {
            const { data } = await profileService.getUserActivities(profile.id)
            setActivities(data)
          }
          setStats((s) =>
            s ? { ...s, follower_count: s.follower_count + 1 } : s
          )
        }
      }
    } else {
      // Unfollow or cancel request
      const { error } = await followService.unfollow(user.id, profile.id)
      if (!error) {
        const wasAccepted = followStatus === 'accepted'
        setFollowStatus('none')
        if (wasAccepted) {
          setStats((s) =>
            s ? { ...s, follower_count: Math.max(0, s.follower_count - 1) } : s
          )
          if (profile.is_private) setActivities([])
        }
      }
    }

    setFollowLoading(false)
  }

  // Instagram-style: can DM if profile is public, OR if I follow them (accepted)
  const canMessage = !isMe && !!profile && (!profile.is_private || followStatus === 'accepted')

  const handleDM = async () => {
    if (!user || !profile || dmLoading) return
    setDmLoading(true)
    const { data: convId } = await chatService.getOrCreateConversation(user.id, profile.id)
    setDmLoading(false)
    if (convId) router.push(`/chat/${convId}` as any)
  }

  const handleMorePress = () => {
    if (!profile || !user) return

    const options = ['Block', 'Report', 'Cancel']
    const destructiveIdx = 0

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 2,
          destructiveButtonIndex: destructiveIdx,
          title: `@${profile.username}`,
        },
        async (idx) => {
          if (idx === 0) confirmBlock()
          if (idx === 1)
            Alert.alert('Report sent', 'Thank you, well review this account.')
        }
      )
    } else {
      Alert.alert(`@${profile.username}`, undefined, [
        { text: 'Block', style: 'destructive', onPress: confirmBlock },
        {
          text: 'Report',
          onPress: () =>
            Alert.alert('Report sent', 'Thank you, well review this account.'),
        },
        { text: 'Cancel', style: 'cancel' },
      ])
    }
  }

  const confirmBlock = () => {
    if (!profile || !user) return
    Alert.alert(
      `Block @${profile.username}?`,
      'They wont be able to see your profile or activities.',
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

  const followButtonLabel =
    followStatus === 'accepted'
      ? 'Following'
      : followStatus === 'pending'
        ? 'Requested'
        : 'Follow'

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
      <SafeAreaView
        style={[s.safe, { backgroundColor: colors.surface }]}
        edges={['top']}
      >
        <View style={s.loadingContainer}>
          <ActivityIndicator color={colors.primary} size='large' />
        </View>
      </SafeAreaView>
    )
  }

  if (!profile) {
    return (
      <SafeAreaView
        style={[s.safe, { backgroundColor: colors.surface }]}
        edges={['top']}
      >
        <View style={s.loadingContainer}>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            User not found.
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const canSeeActivities =
    isMe || !profile.is_private || followStatus === 'accepted'

  return (
    <SafeAreaView
      style={[s.safe, { backgroundColor: colors.surface }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name='chevron-back' size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: spacing.md, minWidth: 0 }}>
          <Text
            style={[typography.h3, { color: colors.text, flexShrink: 1 }]}
            numberOfLines={1}
          >
            @{profile.username}
          </Text>
          {profile.is_verified && (
            <Ionicons name='checkmark-circle' size={18} color={colors.primary} />
          )}
        </View>
        {!isMe && (
          <TouchableOpacity onPress={handleMorePress} hitSlop={12}>
            <Ionicons
              name='ellipsis-horizontal'
              size={22}
              color={colors.text}
            />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + name */}
        <View style={s.avatarSection}>
          {profile.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={s.avatar}
              contentFit='cover'
            />
          ) : (
            <View
              style={[
                s.avatar,
                {
                  backgroundColor: colors.surfaceElevated,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              ]}
            >
              <Ionicons name='person' size={40} color={colors.textMuted} />
            </View>
          )}
          <View style={s.nameRow}>
            <Text style={[typography.h3, { color: colors.text }]}>
              {profile.username}
            </Text>
            {profile.is_verified && (
              <Ionicons
                name='checkmark-circle'
                size={18}
                color={colors.primary}
                style={{ marginLeft: 4 }}
              />
            )}
            {profile.is_private && (
              <Ionicons
                name='lock-closed'
                size={14}
                color={colors.textMuted}
                style={{ marginLeft: 4 }}
              />
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
            <Text
              style={[
                typography.body,
                {
                  color: colors.textSecondary,
                  textAlign: 'center',
                  marginTop: spacing.xs,
                },
              ]}
            >
              {profile.bio}
            </Text>
          ) : null}
        </View>

        {/* Stats */}
        <View
          style={[
            s.statsRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <TouchableOpacity style={s.statCell} activeOpacity={0.7} onPress={() => setFollowModal('followers')}>
            <Text style={[typography.h3, { color: colors.text }]}>
              {stats?.follower_count ?? 0}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Followers
            </Text>
          </TouchableOpacity>
          <View style={[s.statDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={s.statCell} activeOpacity={0.7} onPress={() => setFollowModal('following')}>
            <Text style={[typography.h3, { color: colors.text }]}>
              {stats?.following_count ?? 0}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Following
            </Text>
          </TouchableOpacity>
          <View style={[s.statDivider, { backgroundColor: colors.border }]} />
          <View style={s.statCell}>
            <Text style={[typography.h3, { color: colors.text }]}>
              {stats?.activity_count ?? 0}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Activities
            </Text>
          </View>
        </View>

        {/* Host badges */}
        {(stats?.finished_count ?? 0) > 0 && (() => {
          const earned = getEarnedBadges(stats!.finished_count)
          if (!earned.length) return null
          return (
            <View style={{ marginHorizontal: spacing.md, marginBottom: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm }}>
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
                  : <Text style={[s.followBtnText, { color: colors.text }]}>Message</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Activities section */}
        <View style={s.section}>
          <Text
            style={[
              typography.label,
              { color: colors.text, marginBottom: spacing.sm },
            ]}
          >
            Activities
          </Text>

          {!canSeeActivities ? (
            <View
              style={[
                s.lockedBox,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name='lock-closed-outline'
                size={28}
                color={colors.textMuted}
              />
              <Text
                style={[
                  typography.body,
                  {
                    color: colors.textSecondary,
                    marginTop: spacing.sm,
                    textAlign: 'center',
                  },
                ]}
              >
                This account is private.{'\n'}Follow to see their activities.
              </Text>
            </View>
          ) : activities.length === 0 ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              No active activities.
            </Text>
          ) : (
            activities.map((a) => (
              <ActivityCard key={a.id} activity={a} colors={colors} />
            ))
          )}
        </View>
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
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  body: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  followBtnOutline: {
    borderWidth: 1.5,
  },
  followBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    marginTop: spacing.xs,
  },
  lockedBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
})
