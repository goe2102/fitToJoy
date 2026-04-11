import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { ratingService } from '@/services/ratingService'
import { radius, spacing, typography } from '@/constants/theme'

export default function MyPastActivitiesScreen() {
  const colors = useColors()
  const { user } = useAuth()

  const [entries, setEntries] = useState<
    Awaited<ReturnType<typeof ratingService.getFinishedActivitiesForRating>>['data']
  >([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await ratingService.getFinishedActivitiesForRating(user.id)
    // Only hosted activities (canRate = false)
    setEntries(data.filter((e) => !e.canRate))
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingHorizontal: spacing.md, paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name='arrow-back' size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: colors.text }]}>My Past Activities</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size='large' />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {entries.length === 0 ? (
            <View style={{
              alignItems: 'center', padding: spacing.xl,
              borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed',
              borderColor: colors.border, backgroundColor: colors.surface,
              marginTop: spacing.xl,
            }}>
              <Ionicons name='trophy-outline' size={36} color={colors.textMuted} />
              <Text style={[typography.label, { color: colors.textSecondary, marginTop: spacing.sm }]}>No past activities yet</Text>
              <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: 4 }]}>
                Activities you hosted will appear here once finished
              </Text>
            </View>
          ) : (
            entries.map((entry) => (
              <TouchableOpacity
                key={entry.activity.id}
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
                  <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>
                    {entry.activity.title}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    {new Date(entry.activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <Ionicons name='chevron-forward' size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
