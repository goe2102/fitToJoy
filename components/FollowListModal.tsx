import React, { useEffect, useState, useMemo } from 'react'
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  InteractionManager,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { followService } from '@/services/followService'
import { useColors } from '@/hooks/useColors'
import { ModalHeader, SearchBar } from '@/components/ui'
import { radius, spacing, typography } from '@/constants/theme'
import type { Profile } from '@/types'

type UserRow = Pick<Profile, 'id' | 'username' | 'avatar_url' | 'is_verified'>
type ListType = 'followers' | 'following'

// ─── Relationship label ───────────────────────────────────────────────────────
// From current user's perspective:
//   "You"       → this IS the current user
//   "Friends"   → mutual follow
//   "Follows you" → they follow me, I don't follow them
//   "Following" → I follow them, they don't follow me

function relationLabel(
  userId: string,
  currentUserId: string,
  myFollowingIds: Set<string>,
  myFollowerIds: Set<string>
): string | null {
  if (userId === currentUserId) return 'You'
  const iFollow = myFollowingIds.has(userId)
  const followsMe = myFollowerIds.has(userId)
  if (iFollow && followsMe) return 'Friends'
  if (followsMe) return 'Follows you'
  if (iFollow) return 'Following'
  return null
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean
  onClose: () => void
  /** Whose followers/following list to show */
  targetUserId: string
  /** The logged-in user */
  currentUserId: string
  type: ListType
  title?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FollowListModal({
  visible,
  onClose,
  targetUserId,
  currentUserId,
  type,
  title,
}: Props) {
  const colors = useColors()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [users, setUsers] = useState<UserRow[]>([])
  const [myFollowingIds, setMyFollowingIds] = useState<Set<string>>(new Set())
  const [myFollowerIds, setMyFollowerIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!visible) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const [listRes, followingRes, followersRes] = await Promise.all([
        type === 'followers'
          ? followService.getFollowers(targetUserId)
          : followService.getFollowing(targetUserId),
        // My following list — to compute relationship labels
        followService.getFollowing(currentUserId),
        // My followers list — to compute relationship labels
        followService.getFollowers(currentUserId),
      ])
      if (cancelled) return
      setUsers(listRes.data ?? [])
      setMyFollowingIds(new Set((followingRes.data ?? []).map((u) => u.id)))
      setMyFollowerIds(new Set((followersRes.data ?? []).map((u) => u.id)))
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [visible, targetUserId, currentUserId, type])

  const filtered = query.trim()
    ? users.filter((u) => u.username?.toLowerCase().includes(query.toLowerCase()))
    : users

  const handleUserPress = (userId: string) => {
    onClose()
    InteractionManager.runAfterInteractions(() => router.push(`/profile/${userId}` as any))
  }

  const renderItem = ({ item }: { item: UserRow }) => {
    const label = relationLabel(item.id, currentUserId, myFollowingIds, myFollowerIds)
    const isMe = item.id === currentUserId

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => handleUserPress(item.id)}
      >
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} contentFit='cover' />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name='person' size={22} color={colors.textMuted} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>
              @{item.username}
            </Text>
            {item.is_verified && (
              <Ionicons name='checkmark-circle' size={15} color={colors.primary} />
            )}
          </View>
          {label && (
            <Text style={[typography.caption, { color: label === 'Friends' ? colors.primary : colors.textMuted, marginTop: 1 }]}>
              {label === 'Friends' ? t('common.friends') : label === 'You' ? t('common.you') : label === 'Follows you' ? t('common.followsYou') : t('common.following')}
            </Text>
          )}
        </View>
        {!isMe && (
          <Ionicons name='chevron-forward' size={16} color={colors.textMuted} />
        )}
      </TouchableOpacity>
    )
  }

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ModalHeader
          title={title ?? (type === 'followers' ? t('profile.followers') : t('profile.following'))}
          onClose={onClose}
        />
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={t('common.search')}
          style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm }}
        />

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} size='large' />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name='people-outline' size={40} color={colors.textMuted} />
            <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.md }]}>
              {query ? t('common.noResults') : type === 'followers' ? t('profile.noFollowers') : t('profile.notFollowing')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(u) => u.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
    },
    avatarPlaceholder: {
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.full,
      borderWidth: 1,
    },
  })
}
