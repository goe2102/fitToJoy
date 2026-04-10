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
import { followService } from '@/services/followService'
import { useColors } from '@/hooks/useColors'
import { radius, spacing, typography } from '@/constants/theme'
import type { Profile } from '@/types'

type UserRow = Pick<Profile, 'id' | 'username' | 'avatar_url'>
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
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [users, setUsers] = useState<UserRow[]>([])
  const [myFollowingIds, setMyFollowingIds] = useState<Set<string>>(new Set())
  const [myFollowerIds, setMyFollowerIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

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
          <Image
            source={{ uri: item.avatar_url }}
            style={styles.avatar}
            contentFit='cover'
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name='person' size={18} color={colors.textMuted} />
          </View>
        )}
        <Text style={[typography.label, { color: colors.text, flex: 1 }]} numberOfLines={1}>
          @{item.username}
        </Text>
        {label && (
          <View style={[
            styles.badge,
            {
              backgroundColor:
                label === 'Friends' ? colors.primary + '20'
                : label === 'You' ? colors.surfaceElevated
                : colors.surfaceElevated,
              borderColor:
                label === 'Friends' ? colors.primary + '60'
                : colors.border,
            },
          ]}>
            <Text style={[
              typography.caption,
              {
                color: label === 'Friends' ? colors.primary : colors.textSecondary,
                fontWeight: '600',
              },
            ]}>
              {label}
            </Text>
          </View>
        )}
        {!isMe && (
          <Ionicons name='chevron-forward' size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
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
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
          <Text style={[typography.h3, { color: colors.text, flex: 1 }]}>
            {title ?? (type === 'followers' ? 'Followers' : 'Following')}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name='close' size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} size='large' />
          </View>
        ) : users.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name='people-outline' size={40} color={colors.textMuted} />
            <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.md }]}>
              {type === 'followers' ? 'No followers yet' : 'Not following anyone'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={users}
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
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
