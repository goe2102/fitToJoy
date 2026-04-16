import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { savedActivityService } from '@/services/savedActivityService'
import { getCategoryMeta } from '@/constants/categories'
import { radius, spacing, typography } from '@/constants/theme'
import type { Activity } from '@/types'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hr = parseInt(h, 10)
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}

export default function SavedActivitiesScreen() {
  const colors = useColors()
  const { user } = useAuth()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      if (!user) return
      setLoading(true)
      savedActivityService.getSavedActivities(user.id).then(({ data }) => {
        setActivities(data)
        setLoading(false)
      })
    }, [user?.id])
  )

  const handleUnsave = async (activityId: string) => {
    if (!user) return
    await savedActivityService.unsave(user.id, activityId)
    setActivities((prev) => prev.filter((a) => a.id !== activityId))
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name='chevron-back' size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: colors.text }]}>Saved Activities</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={colors.primary} size='large' />
        </View>
      ) : activities.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name='bookmark-outline' size={48} color={colors.textMuted} />
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' }]}>
            No saved activities yet
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' }]}>
            Bookmark activities from the map to find them here
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
        >
          {activities.map((activity) => {
            const cat = getCategoryMeta(activity.category)
            return (
              <TouchableOpacity
                key={activity.id}
                style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push(`/activity/${activity.id}` as any)}
                activeOpacity={0.75}
              >
                {/* Cover */}
                <View style={s.cardImage}>
                  {activity.cover_image_url ? (
                    <Image source={{ uri: activity.cover_image_url }} style={StyleSheet.absoluteFillObject} contentFit='cover' />
                  ) : (
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name={cat.icon as any} size={28} color={colors.textMuted} />
                    </View>
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.55)']}
                    locations={[0.4, 1]}
                    style={StyleSheet.absoluteFillObject}
                  />
                  {/* Category pill */}
                  <View style={[s.catPill, { backgroundColor: cat.color + '22' }]}>
                    <Ionicons name={cat.icon as any} size={11} color={cat.color} />
                    <Text style={[typography.caption, { color: cat.color, fontWeight: '700' }]}>{cat.label}</Text>
                  </View>
                </View>

                {/* Info */}
                <View style={s.cardBody}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>{activity.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                      <Ionicons name='calendar-outline' size={12} color={colors.textMuted} />
                      <Text style={[typography.caption, { color: colors.textMuted }]}>
                        {formatDate(activity.date)} · {formatTime(activity.start_time)}
                      </Text>
                    </View>
                    {activity.host && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Ionicons name='person-outline' size={12} color={colors.textMuted} />
                        <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                          @{activity.host.username}
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleUnsave(activity.id)}
                    hitSlop={8}
                    style={[s.unsaveBtn, { backgroundColor: colors.surfaceElevated }]}
                  >
                    <Ionicons name='bookmark' size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardImage: {
    height: 120,
    overflow: 'hidden',
  },
  catPill: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  unsaveBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
