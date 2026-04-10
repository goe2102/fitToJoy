import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { useProfile } from '@/context/ProfileContext'
import { followService } from '@/services/followService'
import { searchService, type UserResult, type ActivityResult } from '@/services/searchService'
import { Badge } from '@/components/ui'
import { radius, spacing, typography, type AppColors } from '@/constants/theme'
import type { FollowStatus } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}
function formatDuration(m: number) {
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

// ─── Follow Button ────────────────────────────────────────────────────────────

function FollowButton({
  userId,
  targetIsPrivate,
  initialStatus,
  colors,
}: {
  userId: string
  targetIsPrivate: boolean
  initialStatus: FollowStatus
  colors: AppColors
}) {
  const { user } = useAuth()
  const { profile: myProfile } = useProfile()
  const [status, setStatus] = useState<FollowStatus>(initialStatus)
  const [loading, setLoading] = useState(false)

  const onPress = async () => {
    if (!user || loading) return
    setLoading(true)

    if (status === 'none') {
      await followService.follow(user.id, userId, targetIsPrivate,
        myProfile ? { username: myProfile.username, avatar_url: myProfile.avatar_url } : undefined
      )
      setStatus(targetIsPrivate ? 'pending' : 'accepted')
    } else if (status === 'pending') {
      Alert.alert('Cancel request', 'Cancel your follow request?', [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel request',
          style: 'destructive',
          onPress: async () => {
            await followService.unfollow(user.id, userId)
            setStatus('none')
          },
        },
      ])
    } else if (status === 'accepted') {
      Alert.alert('Unfollow', 'Unfollow this person?', [
        { text: 'No', style: 'cancel' },
        {
          text: 'Unfollow',
          style: 'destructive',
          onPress: async () => {
            await followService.unfollow(user.id, userId)
            setStatus('none')
          },
        },
      ])
    }

    setLoading(false)
  }

  const label =
    status === 'accepted' ? 'Following'
    : status === 'pending' ? 'Requested'
    : 'Follow'

  const bg =
    status === 'accepted' ? colors.surfaceElevated
    : status === 'pending' ? colors.surfaceElevated
    : colors.primary

  const textColor =
    status === 'none' ? colors.white : colors.textSecondary

  return (
    <TouchableOpacity
      style={[styles.followBtn, { backgroundColor: bg, borderColor: status !== 'none' ? colors.border : 'transparent' }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.75}
    >
      {loading
        ? <ActivityIndicator size='small' color={textColor} />
        : <Text style={[typography.label, { color: textColor, fontSize: 13 }]}>{label}</Text>
      }
    </TouchableOpacity>
  )
}

// ─── User Card ────────────────────────────────────────────────────────────────

function UserCard({ user: u, colors, currentUserId }: { user: UserResult; colors: AppColors; currentUserId: string }) {
  const styles = useMemo(() => makeCardStyles(colors), [colors])

  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        {u.avatar_url
          ? <Image source={{ uri: u.avatar_url }} style={styles.avatar} contentFit='cover' />
          : (
            <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name='person' size={18} color={colors.textMuted} />
            </View>
          )
        }
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>
              @{u.username}
            </Text>
            {u.is_verified && <Ionicons name='checkmark-circle' size={14} color={colors.primary} />}
            {u.is_private && <Ionicons name='lock-closed' size={12} color={colors.textMuted} />}
          </View>
          {u.bio ? (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]} numberOfLines={1}>
              {u.bio}
            </Text>
          ) : null}
        </View>
      </View>

      <FollowButton
        userId={u.id}
        targetIsPrivate={u.is_private}
        initialStatus={u.follow_status}
        colors={colors}
      />
    </View>
  )
}

function makeCardStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      gap: spacing.md,
    },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
    avatar: { width: 44, height: 44, borderRadius: 22 },
  })
}

// ─── Activity Card ────────────────────────────────────────────────────────────

function ActivitySearchCard({ activity: a, colors }: { activity: ActivityResult; colors: AppColors }) {
  const spotsLeft = a.max_participants !== null
    ? a.max_participants - a.participant_count
    : null

  return (
    <TouchableOpacity
      style={[styles.activityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      activeOpacity={0.75}
    >
      <View style={styles.activityCardHeader}>
        <Text style={[typography.label, { color: colors.text, flex: 1 }]} numberOfLines={1}>
          {a.title}
        </Text>
        <Badge label='Public' variant='primary' />
      </View>

      <View style={styles.activityHost}>
        {a.host?.avatar_url
          ? <Image source={{ uri: a.host.avatar_url }} style={styles.hostAvatar} contentFit='cover' />
          : (
            <View style={[styles.hostAvatar, { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name='person' size={10} color={colors.textMuted} />
            </View>
          )
        }
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          @{a.host?.username ?? '—'}
          {a.host?.is_verified ? ' ✓' : ''}
        </Text>
      </View>

      <View style={styles.activityMeta}>
        <View style={styles.metaItem}>
          <Ionicons name='calendar-outline' size={12} color={colors.textMuted} />
          <Text style={[typography.caption, { color: colors.textMuted }]}>{formatDate(a.date)}</Text>
        </View>
        <Text style={[typography.caption, { color: colors.textMuted }]}>·</Text>
        <View style={styles.metaItem}>
          <Ionicons name='time-outline' size={12} color={colors.textMuted} />
          <Text style={[typography.caption, { color: colors.textMuted }]}>{formatTime(a.start_time)}</Text>
        </View>
        <Text style={[typography.caption, { color: colors.textMuted }]}>·</Text>
        <View style={styles.metaItem}>
          <Ionicons name='hourglass-outline' size={12} color={colors.textMuted} />
          <Text style={[typography.caption, { color: colors.textMuted }]}>{formatDuration(a.duration_minutes)}</Text>
        </View>
        <Text style={[typography.caption, { color: colors.textMuted }]}>·</Text>
        <View style={styles.metaItem}>
          <Ionicons name='people-outline' size={12} color={colors.textMuted} />
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {a.participant_count}
            {a.max_participants ? `/${a.max_participants}` : ''}
            {spotsLeft !== null && spotsLeft <= 3 && spotsLeft > 0 ? ` · ${spotsLeft} left` : ''}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, colors }: { title: string; colors: AppColors }) {
  return (
    <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
      <Text style={[typography.caption, { color: colors.textMuted, fontWeight: '600', letterSpacing: 0.8 }]}>
        {title.toUpperCase()}
      </Text>
    </View>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon, message, colors }: { icon: string; message: string; colors: AppColors }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon as any} size={40} color={colors.textMuted} />
      <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
        {message}
      </Text>
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type Tab = 'people' | 'activities'

export default function SearchScreen() {
  const colors = useColors()
  const { user } = useAuth()

  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('people')
  const [users, setUsers] = useState<UserResult[]>([])
  const [activities, setActivities] = useState<ActivityResult[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const inputRef = useRef<TextInput>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadDefaults = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [u, a] = await Promise.all([
      searchService.getSuggestedUsers(user.id),
      searchService.getRecentActivities(user.id),
    ])
    setUsers(u)
    setActivities(a)
    setLoading(false)
  }, [user])

  useEffect(() => { loadDefaults() }, [loadDefaults])

  const onQueryChange = (text: string) => {
    setQuery(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!text.trim()) { loadDefaults(); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      if (!user) return
      const [u, a] = await Promise.all([
        searchService.searchUsers(text.trim(), user.id),
        searchService.searchActivities(text.trim(), user.id),
      ])
      setUsers(u)
      setActivities(a)
      setLoading(false)
    }, 400)
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadDefaults()
    setRefreshing(false)
  }

  const isEmpty = tab === 'people' ? users.length === 0 : activities.length === 0

  // Build list data with section header as first item
  const listData = useMemo(() => {
    if (tab === 'people') return users
    return activities
  }, [tab, users, activities])

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={['top']}>
      {/* ── Search bar ── */}
      <View style={[styles.searchRow, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name='search' size={16} color={colors.textMuted} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder='Search people and activities…'
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={onQueryChange}
            autoCapitalize='none'
            returnKeyType='search'
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); loadDefaults() }} hitSlop={8}>
              <Ionicons name='close-circle' size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Tab switcher ── */}
      <View style={[styles.tabRow, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        {(['people', 'activities'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.tabPill,
              tab === t && { backgroundColor: colors.primary + '18' },
            ]}
            onPress={() => setTab(t)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={t === 'people' ? 'people-outline' : 'calendar-outline'}
              size={14}
              color={tab === t ? colors.primary : colors.textMuted}
            />
            <Text style={[
              typography.label,
              { fontSize: 13, color: tab === t ? colors.primary : colors.textMuted },
            ]}>
              {t === 'people' ? 'People' : 'Activities'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Results ── */}
      {loading && !refreshing
        ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )
        : (
          <FlatList
            data={listData as any[]}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListHeaderComponent={
              <SectionHeader
                title={query ? 'Results' : tab === 'people' ? 'Suggested' : 'Recent'}
                colors={colors}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon={tab === 'people' ? 'people-outline' : 'calendar-outline'}
                message={query
                  ? `No ${tab === 'people' ? 'users' : 'activities'} found for "${query}"`
                  : tab === 'people'
                    ? 'No suggestions yet'
                    : 'No recent activities'
                }
                colors={colors}
              />
            }
            renderItem={({ item }) =>
              tab === 'people'
                ? (
                  <>
                    <UserCard user={item} colors={colors} currentUserId={user?.id ?? ''} />
                    <View style={[styles.separator, { backgroundColor: colors.border }]} />
                  </>
                )
                : (
                  <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
                    <ActivitySearchCard activity={item} colors={colors} />
                  </View>
                )
            }
            contentContainerStyle={{ paddingBottom: 120 }}
            keyboardShouldPersistTaps='handled'
            keyboardDismissMode='on-drag'
          />
        )
      }
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  searchRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    paddingVertical: 0,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  separator: { height: 1, marginLeft: 72 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    marginTop: spacing.xxl,
  },
  activityCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  activityCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  activityHost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: spacing.sm,
  },
  hostAvatar: { width: 18, height: 18, borderRadius: 9 },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  followBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    minWidth: 84,
    alignItems: 'center',
  },
})
