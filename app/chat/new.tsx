import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
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
import { searchService, type UserResult } from '@/services/searchService'
import { chatService } from '@/services/chatService'
import { radius, spacing, typography } from '@/constants/theme'

export default function NewChatScreen() {
  const colors = useColors()
  const { user } = useAuth()

  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<UserResult[]>([])
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadSuggested = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const results = await searchService.getSuggestedUsers(user.id)
    // Only show users I follow (accepted) for DMs — suggested includes people I might follow
    setUsers(results.filter((u) => u.follow_status === 'accepted'))
    setLoading(false)
  }, [user])

  useEffect(() => { loadSuggested() }, [loadSuggested])

  const onQueryChange = (text: string) => {
    setQuery(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!text.trim()) { loadSuggested(); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      if (!user) return
      const results = await searchService.searchUsers(text.trim(), user.id)
      setUsers(results)
      setLoading(false)
    }, 350)
  }

  const onSelectUser = async (targetId: string) => {
    if (!user || starting) return
    setStarting(targetId)
    const { data: convId, error } = await chatService.getOrCreateConversation(user.id, targetId)
    setStarting(null)
    if (error || !convId) return
    router.replace(`/chat/${convId}` as any)
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name='close' size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: colors.text }]}>New Message</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search */}
      <View style={[styles.searchRow, { borderBottomColor: colors.border }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name='search' size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder='Search people…'
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={onQueryChange}
            autoCapitalize='none'
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); loadSuggested() }} hitSlop={8}>
              <Ionicons name='close-circle' size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading
        ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
        : (
          <FlatList
            data={users}
            keyExtractor={(u) => u.id}
            keyboardShouldPersistTaps='handled'
            ListHeaderComponent={
              users.length > 0
                ? <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                    {query ? 'RESULTS' : 'FOLLOWING'}
                  </Text>
                : null
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name='people-outline' size={40} color={colors.textMuted} />
                <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
                  {query ? `No users found for "${query}"` : 'Follow people to message them'}
                </Text>
              </View>
            }
            renderItem={({ item: u }) => (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: colors.border }]}
                onPress={() => onSelectUser(u.id)}
                activeOpacity={0.7}
                disabled={starting === u.id}
              >
                {u.avatar_url
                  ? <Image source={{ uri: u.avatar_url }} style={styles.avatar} contentFit='cover' />
                  : (
                    <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name='person' size={18} color={colors.textMuted} />
                    </View>
                  )
                }
                <View style={{ flex: 1 }}>
                  <Text style={[typography.label, { color: colors.text }]}>
                    @{u.username}
                    {u.is_verified ? ' ✓' : ''}
                  </Text>
                  {u.bio ? <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>{u.bio}</Text> : null}
                </View>
                {starting === u.id
                  ? <ActivityIndicator size='small' color={colors.primary} />
                  : <Ionicons name='chevron-forward' size={18} color={colors.textMuted} />
                }
              </TouchableOpacity>
            )}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}
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
  sectionLabel: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, marginTop: spacing.xxl },
})
