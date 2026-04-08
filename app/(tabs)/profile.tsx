import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useColors } from '@/hooks/useColors'
import { useProfile } from '@/context/ProfileContext'
import { useAuth } from '@/context/AuthContext'
import { profileService } from '@/services/profileService'
import { followService } from '@/services/followService'
import { imageService } from '@/services/imageService'
import { usePendingRequests } from '@/hooks/usePendingRequests'
import { Input, Button, Badge } from '@/components/ui'
import { radius, spacing, typography, type AppColors } from '@/constants/theme'
import type { Activity, Follow, Profile } from '@/types'

// ─── Follow Requests Modal ────────────────────────────────────────────────────

type RequestWithFollower = Follow & { follower: Pick<Profile, 'id' | 'username' | 'avatar_url'> }

function FollowRequestsModal({
  visible,
  onClose,
  onCountChange,
  currentUserId,
  colors,
}: {
  visible: boolean
  onClose: () => void
  onCountChange: () => void
  currentUserId: string
  colors: AppColors
}) {
  const { profile: myProfile } = useProfile()
  const [requests, setRequests] = useState<RequestWithFollower[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible) return
    ;(async () => {
      setLoading(true)
      const { data } = await followService.getPendingRequests(currentUserId)
      setRequests(data as RequestWithFollower[])
      setLoading(false)
    })()
  }, [visible, currentUserId])

  const onAccept = async (followerId: string) => {
    await followService.acceptRequest(followerId, currentUserId, myProfile
      ? { username: myProfile.username, avatar_url: myProfile.avatar_url }
      : undefined
    )
    setRequests((r) => r.filter((x) => x.follower_id !== followerId))
    onCountChange()
  }

  const onDecline = async (followerId: string) => {
    await followService.rejectRequest(followerId, currentUserId)
    setRequests((r) => r.filter((x) => x.follower_id !== followerId))
    onCountChange()
  }

  return (
    <Modal visible={visible} animationType='slide' presentationStyle='pageSheet' onRequestClose={onClose}>
      <SafeAreaView style={[{ flex: 1 }, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[reqStyles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name='close' size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[typography.h3, { color: colors.text }]}>Follow Requests</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading
          ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
          : requests.length === 0
            ? (
              <View style={reqStyles.empty}>
                <Ionicons name='people-outline' size={40} color={colors.textMuted} />
                <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.sm }]}>
                  No pending requests
                </Text>
              </View>
            )
            : requests.map((r) => (
              <View key={r.follower_id} style={[reqStyles.row, { borderBottomColor: colors.border }]}>
                {r.follower?.avatar_url
                  ? <Image source={{ uri: r.follower.avatar_url }} style={reqStyles.avatar} contentFit='cover' />
                  : (
                    <View style={[reqStyles.avatar, { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name='person' size={18} color={colors.textMuted} />
                    </View>
                  )
                }
                <Text style={[typography.label, { color: colors.text, flex: 1 }]}>
                  @{r.follower?.username ?? '—'}
                </Text>
                <TouchableOpacity
                  style={[reqStyles.actionBtn, { backgroundColor: colors.primary }]}
                  onPress={() => onAccept(r.follower_id)}
                >
                  <Text style={[typography.label, { color: colors.white, fontSize: 13 }]}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[reqStyles.actionBtn, { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border }]}
                  onPress={() => onDecline(r.follower_id)}
                >
                  <Text style={[typography.label, { color: colors.textSecondary, fontSize: 13 }]}>Decline</Text>
                </TouchableOpacity>
              </View>
            ))
        }
      </SafeAreaView>
    </Modal>
  )
}

const reqStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  empty: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  actionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
})

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
  onPress,
}: {
  activity: Activity
  colors: AppColors
  onPress: () => void
}) {
  const styles = useMemo(() => makeActivityCardStyles(colors), [colors])
  const spotsLeft =
    activity.max_participants !== null
      ? activity.max_participants - (activity.participant_count ?? 0)
      : null

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {activity.title}
        </Text>
        <Badge
          label={activity.is_public ? 'Public' : 'Private'}
          variant={activity.is_public ? 'primary' : 'neutral'}
        />
      </View>

      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Ionicons name='calendar-outline' size={13} color={colors.textMuted} />
          <Text style={styles.metaText}>
            {formatDate(activity.date)} · {formatTime(activity.start_time)}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name='time-outline' size={13} color={colors.textMuted} />
          <Text style={styles.metaText}>{formatDuration(activity.duration_minutes)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name='people-outline' size={13} color={colors.textMuted} />
          <Text style={styles.metaText}>
            {activity.participant_count ?? 0}
            {activity.max_participants !== null ? `/${activity.max_participants}` : ''} joined
            {spotsLeft !== null && spotsLeft <= 3 && spotsLeft > 0
              ? ` · ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`
              : ''}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
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
  })
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

// ─── Edit Profile Modal ───────────────────────────────────────────────────────

function EditProfileModal({
  visible,
  onClose,
  colors,
}: {
  visible: boolean
  onClose: () => void
  colors: AppColors
}) {
  const { profile, updateProfile, updateAvatar } = useProfile()
  const { user } = useAuth()
  const styles = useMemo(() => makeEditStyles(colors), [colors])

  const [username, setUsername] = useState(profile?.username ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [usernameState, setUsernameState] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [saving, setSaving] = useState(false)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const checkRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (visible) {
      setUsername(profile?.username ?? '')
      setBio(profile?.bio ?? '')
      setUsernameState('idle')
    }
  }, [visible])

  const onUsernameChange = (val: string) => {
    setUsername(val)
    if (val === profile?.username) { setUsernameState('idle'); return }
    if (val.length < 3) { setUsernameState('invalid'); return }
    setUsernameState('checking')
    if (checkRef.current) clearTimeout(checkRef.current)
    checkRef.current = setTimeout(async () => {
      const available = await profileService.checkUsernameAvailable(val, user!.id)
      setUsernameState(available ? 'available' : 'taken')
    }, 500)
  }

  const onPickAvatar = async () => {
    const result = await imageService.pickImage([1, 1])
    if (!result?.base64) return
    setAvatarSaving(true)
    await updateAvatar(result.base64)
    setAvatarSaving(false)
  }

  const onSave = async () => {
    if (usernameState === 'taken' || usernameState === 'invalid') return
    setSaving(true)
    const updates: any = { bio: bio.trim() || null }
    if (username !== profile?.username) updates.username = username.trim()
    const { error } = await updateProfile(updates)
    setSaving(false)
    if (error) { Alert.alert('Error', error.message); return }
    onClose()
  }

  const usernameHint =
    usernameState === 'checking' ? 'Checking…'
    : usernameState === 'available' ? '✓ Available'
    : usernameState === 'taken' ? 'Username taken'
    : usernameState === 'invalid' ? 'Min. 3 characters'
    : undefined

  const usernameError = usernameState === 'taken' || usernameState === 'invalid' ? usernameHint : undefined

  return (
    <Modal visible={visible} animationType='slide' presentationStyle='pageSheet' onRequestClose={onClose}>
      <SafeAreaView style={[styles.modal, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[typography.label, { color: colors.text }]}>Edit Profile</Text>
          <TouchableOpacity onPress={onSave} disabled={saving}>
            {saving
              ? <ActivityIndicator size='small' color={colors.primary} />
              : <Text style={[typography.label, { color: colors.primary }]}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps='handled'>
          {/* Avatar picker */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={onPickAvatar} disabled={avatarSaving} activeOpacity={0.8}>
              {avatarSaving
                ? (
                  <View style={[styles.avatarCircle, { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                )
                : profile?.avatar_url
                  ? <Image source={{ uri: profile.avatar_url }} style={styles.avatarCircle} contentFit='cover' />
                  : (
                    <View style={[styles.avatarCircle, { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name='person' size={36} color={colors.textMuted} />
                    </View>
                  )
              }
              <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name='camera' size={13} color={colors.white} />
              </View>
            </TouchableOpacity>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
              Tap to change photo
            </Text>
          </View>

          <Input
            label='Username'
            value={username}
            onChangeText={onUsernameChange}
            autoCapitalize='none'
            error={usernameError}
            hint={!usernameError ? usernameHint : undefined}
          />
          <View style={{ height: spacing.md }} />
          <Input
            label='Bio'
            value={bio}
            onChangeText={setBio}
            placeholder='Tell people about yourself…'
            multiline
            numberOfLines={3}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

function makeEditStyles(colors: AppColors) {
  return StyleSheet.create({
    modal: { flex: 1 },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalBody: { padding: spacing.md, gap: 0 },
    avatarSection: { alignItems: 'center', marginBottom: spacing.xl },
    avatarCircle: { width: 90, height: 90, borderRadius: 45 },
    avatarBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.background,
    },
  })
}

// ─── Main Profile Screen ──────────────────────────────────────────────────────

export default function ProfileScreen() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { profile, stats, loading, refreshProfile, updateProfile } = useProfile()
  const { signOut } = useAuth()

  const { count: requestCount, refresh: refreshRequestCount } = usePendingRequests()

  const [activities, setActivities] = useState<Activity[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [editVisible, setEditVisible] = useState(false)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [requestsVisible, setRequestsVisible] = useState(false)

  const loadActivities = useCallback(async () => {
    if (!profile) return
    setActivitiesLoading(true)
    const { data } = await profileService.getUserActivities(profile.id)
    setActivities(data)
    setActivitiesLoading(false)
  }, [profile?.id])

  useEffect(() => { loadActivities() }, [loadActivities])

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refreshProfile(), loadActivities()])
    setRefreshing(false)
  }

  const onTogglePrivacy = async (val: boolean) => {
    await updateProfile({ is_private: val })
    if (val) {
      Alert.alert(
        'Account set to private',
        'Your activities are now only visible to your followers.'
      )
    }
  }

  const onSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ])
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size='large' />
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.safe]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <Text style={styles.screenTitle}>Profile</Text>
          <View style={styles.topBarActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setSettingsVisible(true)}>
              <Ionicons name='settings-outline' size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Avatar + identity ── */}
        <View style={styles.identitySection}>
          <View style={styles.avatarWrapper}>
            {profile?.avatar_url
              ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={styles.avatar}
                  contentFit='cover'
                />
              )
              : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name='person' size={40} color={colors.textMuted} />
                </View>
              )
            }
            {profile?.is_verified && (
              <View style={[styles.verifiedBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name='checkmark' size={11} color={colors.white} />
              </View>
            )}
          </View>

          <Text style={styles.username}>@{profile?.username ?? '—'}</Text>
          {profile?.bio
            ? <Text style={styles.bio}>{profile.bio}</Text>
            : (
              <TouchableOpacity onPress={() => setEditVisible(true)}>
                <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 4 }]}>
                  + Add a bio
                </Text>
              </TouchableOpacity>
            )
          }

          <Button
            title='Edit Profile'
            variant='outline'
            size='sm'
            fullWidth={false}
            style={{ marginTop: spacing.md }}
            onPress={() => setEditVisible(true)}
          />
        </View>

        {/* ── Stats ── */}
        <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <StatPill label='Followers' value={stats.follower_count} colors={colors} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatPill label='Following' value={stats.following_count} colors={colors} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatPill label='Activities' value={stats.activity_count} colors={colors} />
        </View>

        {/* ── Follow Requests ── */}
        {requestCount > 0 && (
          <TouchableOpacity
            style={[styles.settingRow, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40', marginBottom: spacing.md }]}
            onPress={() => setRequestsVisible(true)}
            activeOpacity={0.75}
          >
            <View style={styles.settingLeft}>
              <Ionicons name='person-add-outline' size={20} color={colors.primary} />
              <Text style={[typography.label, { color: colors.primary }]}>
                {requestCount} follow request{requestCount !== 1 ? 's' : ''}
              </Text>
            </View>
            <Ionicons name='chevron-forward' size={18} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* ── Privacy toggle ── */}
        <View style={[styles.settingRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingLeft}>
            <Ionicons
              name={profile?.is_private ? 'lock-closed-outline' : 'globe-outline'}
              size={20}
              color={profile?.is_private ? colors.primary : colors.textSecondary}
            />
            <View>
              <Text style={[typography.label, { color: colors.text }]}>Private account</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {profile?.is_private
                  ? 'Only followers see your activities'
                  : 'Your activities are visible to everyone'}
              </Text>
            </View>
          </View>
          <Switch
            value={profile?.is_private ?? false}
            onValueChange={onTogglePrivacy}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.white}
          />
        </View>

        {/* ── Activities ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Activities</Text>
            <TouchableOpacity onPress={() => router.push('/activity/create' as any)}>
              <Text style={[typography.label, { color: colors.primary }]}>+ New</Text>
            </TouchableOpacity>
          </View>

          {activitiesLoading
            ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
            : activities.length === 0
              ? (
                <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name='calendar-outline' size={32} color={colors.textMuted} />
                  <Text style={[typography.label, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                    No active activities
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: 4 }]}>
                    Create one from the map and it'll appear here
                  </Text>
                </View>
              )
              : activities.map((a) => (
                <ActivityCard key={a.id} activity={a} colors={colors} onPress={() => {}} />
              ))
          }
        </View>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>

      {/* ── Follow requests modal ── */}
      <FollowRequestsModal
        visible={requestsVisible}
        onClose={() => setRequestsVisible(false)}
        onCountChange={refreshRequestCount}
        currentUserId={profile?.id ?? ''}
        colors={colors}
      />

      {/* ── Edit profile modal ── */}
      <EditProfileModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        colors={colors}
      />

      {/* ── Settings bottom sheet (simple modal) ── */}
      <Modal
        visible={settingsVisible}
        animationType='fade'
        transparent
        onRequestClose={() => setSettingsVisible(false)}
      >
        <TouchableOpacity
          style={styles.settingsOverlay}
          onPress={() => setSettingsVisible(false)}
          activeOpacity={1}
        >
          <View style={[styles.settingsSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.settingsHandle, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => { setSettingsVisible(false); onSignOut() }}
            >
              <Ionicons name='log-out-outline' size={20} color={colors.error} />
              <Text style={[typography.body, { color: colors.error }]}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },

    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    screenTitle: { ...typography.h2, color: colors.text },
    topBarActions: { flexDirection: 'row', gap: spacing.sm },
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

    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginBottom: spacing.md,
    },
    settingLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },

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

    settingsOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    settingsSheet: {
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      borderWidth: 1,
      paddingBottom: Platform.OS === 'ios' ? 36 : 24,
      paddingTop: spacing.sm,
    },
    settingsHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    settingsItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
  })
}
