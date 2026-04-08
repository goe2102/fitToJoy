import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Platform,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { useProfile } from '@/context/ProfileContext'
import { activityService } from '@/services/activityService'
import { Button, Badge } from '@/components/ui'
import { radius, spacing, typography, type AppColors } from '@/constants/theme'
import type { Activity, Participant } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
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

// ─── Activity Marker ──────────────────────────────────────────────────────────

function ActivityMarker({
  activity,
  colors,
  onPress,
}: {
  activity: Activity
  colors: AppColors
  onPress: () => void
}) {
  const bg = activity.is_public ? colors.primary : colors.textSecondary
  return (
    <Marker
      coordinate={{ latitude: activity.latitude, longitude: activity.longitude }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <TouchableOpacity
        onPress={onPress}
        style={[styles.markerBubble, { backgroundColor: bg }]}
        activeOpacity={0.85}
      >
        <Text style={styles.markerText} numberOfLines={1}>
          {activity.title}
        </Text>
        {!activity.is_public && (
          <Ionicons name='lock-closed' size={10} color='rgba(255,255,255,0.8)' />
        )}
      </TouchableOpacity>
      <View style={[styles.markerTail, { borderTopColor: bg }]} />
    </Marker>
  )
}

// ─── Participant Avatar Row ────────────────────────────────────────────────────

function ParticipantRow({ p, colors }: { p: Participant; colors: AppColors }) {
  return (
    <View style={styles.participantRow}>
      {p.profile?.avatar_url
        ? <Image source={{ uri: p.profile.avatar_url }} style={styles.participantAvatar} contentFit='cover' />
        : (
          <View style={[styles.participantAvatar, { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name='person' size={14} color={colors.textMuted} />
          </View>
        )
      }
      <Text style={[typography.bodySmall, { color: colors.text }]}>
        @{p.profile?.username ?? '—'}
      </Text>
    </View>
  )
}

// ─── Activity Detail Sheet ────────────────────────────────────────────────────

function ActivityDetailSheet({
  activity,
  visible,
  onClose,
  colors,
  currentUserId,
}: {
  activity: Activity | null
  visible: boolean
  onClose: () => void
  colors: AppColors
  currentUserId: string
}) {
  const { profile: myProfile } = useProfile()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [myStatus, setMyStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!activity || !visible) return
    ;(async () => {
      setLoading(true)
      const [{ data: p }, status] = await Promise.all([
        activityService.getParticipants(activity.id),
        activityService.getMyParticipantStatus(activity.id, currentUserId),
      ])
      setParticipants(p)
      setMyStatus(status)
      setLoading(false)
    })()
  }, [activity?.id, visible])

  const onJoin = async () => {
    if (!activity) return
    setJoining(true)
    const { error } = await activityService.join(
      activity.id, currentUserId, activity.is_public,
      myProfile ? { username: myProfile.username, avatar_url: myProfile.avatar_url } : undefined,
      activity.host?.id,
      activity.title
    )
    setJoining(false)
    if (error) { Alert.alert('Error', error.message); return }
    setMyStatus(activity.is_public ? 'joined' : 'pending')
    if (!activity.is_public) Alert.alert('Request sent', 'The host will review your request.')
  }

  const onLeave = async () => {
    if (!activity) return
    Alert.alert('Leave activity', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await activityService.leave(activity.id, currentUserId)
          setMyStatus(null)
          setParticipants((p) => p.filter((x) => x.user_id !== currentUserId))
        },
      },
    ])
  }

  if (!activity) return null

  const isFull = activity.max_participants !== null
    && (activity.participant_count ?? 0) >= activity.max_participants

  const joinLabel =
    myStatus === 'joined' || myStatus === 'approved' ? 'Leave'
    : myStatus === 'pending' ? 'Request pending'
    : isFull ? 'Full'
    : activity.is_public ? 'Join'
    : 'Request to join'

  const joinVariant = (myStatus === 'joined' || myStatus === 'approved') ? 'danger' : 'primary'
  const joinDisabled = myStatus === 'pending' || isFull

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.sheet, { backgroundColor: colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name='close' size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[typography.h3, { color: colors.text, flex: 1, marginLeft: spacing.md }]} numberOfLines={1}>
            {activity.title}
          </Text>
          <Badge
            label={activity.is_public ? 'Public' : 'Private'}
            variant={activity.is_public ? 'primary' : 'neutral'}
          />
        </View>

        <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
          {/* Host */}
          <View style={[styles.hostRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {activity.host?.avatar_url
              ? <Image source={{ uri: activity.host.avatar_url }} style={styles.hostAvatar} contentFit='cover' />
              : (
                <View style={[styles.hostAvatar, { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name='person' size={18} color={colors.textMuted} />
                </View>
              )
            }
            <View style={{ flex: 1 }}>
              <Text style={[typography.label, { color: colors.text }]}>
                @{activity.host?.username ?? '—'}
                {activity.host?.is_verified && (
                  <Text style={{ color: colors.primary }}> ✓</Text>
                )}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Host</Text>
            </View>
          </View>

          {/* Description */}
          {activity.description ? (
            <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              {activity.description}
            </Text>
          ) : null}

          {/* Meta */}
          <View style={[styles.metaGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.metaCell}>
              <Ionicons name='calendar-outline' size={20} color={colors.primary} />
              <Text style={[typography.label, { color: colors.text }]}>{formatDate(activity.date)}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Date</Text>
            </View>
            <View style={[styles.metaCellDivider, { backgroundColor: colors.border }]} />
            <View style={styles.metaCell}>
              <Ionicons name='time-outline' size={20} color={colors.primary} />
              <Text style={[typography.label, { color: colors.text }]}>{formatTime(activity.start_time)}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Start</Text>
            </View>
            <View style={[styles.metaCellDivider, { backgroundColor: colors.border }]} />
            <View style={styles.metaCell}>
              <Ionicons name='hourglass-outline' size={20} color={colors.primary} />
              <Text style={[typography.label, { color: colors.text }]}>{formatDuration(activity.duration_minutes)}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Duration</Text>
            </View>
          </View>

          {/* Participants */}
          {activity.is_public && (
            <View style={styles.participantsSection}>
              <Text style={[typography.label, { color: colors.text, marginBottom: spacing.sm }]}>
                Participants ({activity.participant_count ?? 0}
                {activity.max_participants ? `/${activity.max_participants}` : ''})
              </Text>
              {loading
                ? <ActivityIndicator color={colors.primary} />
                : participants.length === 0
                  ? <Text style={[typography.caption, { color: colors.textMuted }]}>No participants yet</Text>
                  : participants.map((p) => (
                    <ParticipantRow key={p.user_id} p={p} colors={colors} />
                  ))
              }
            </View>
          )}
        </ScrollView>

        {/* Join/Leave CTA */}
        <View style={[styles.sheetCta, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <Button
            title={joinLabel}
            variant={joinVariant}
            loading={joining}
            disabled={joinDisabled}
            onPress={myStatus === 'joined' || myStatus === 'approved' ? onLeave : onJoin}
          />
        </View>
      </SafeAreaView>
    </Modal>
  )
}

// ─── Map Screen ───────────────────────────────────────────────────────────────

export default function MapScreen() {
  const colors = useColors()
  const { user } = useAuth()
  const mapRef = useRef<MapView>(null)

  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard')
  const [activities, setActivities] = useState<Activity[]>([])
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [mapCenter, setMapCenter] = useState({ lat: 48.1351, lng: 11.582 })

  const loadActivities = useCallback(async () => {
    if (!user) return
    const { data } = await activityService.getVisibleActivities(user.id)
    setActivities(data)
  }, [user])

  useEffect(() => {
    // Request location permission and center map on user
    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        mapRef.current?.animateToRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        }, 800)
        setMapCenter({ lat: loc.coords.latitude, lng: loc.coords.longitude })
      }
    })()

    loadActivities()
  }, [loadActivities])

  const onMarkerPress = (activity: Activity) => {
    setSelectedActivity(activity)
    setDetailVisible(true)
  }

  const onRegionChange = (region: Region) => {
    setMapCenter({ lat: region.latitude, lng: region.longitude })
  }

  const onCreatePress = () => {
    router.push(`/activity/create?lat=${mapCenter.lat}&lng=${mapCenter.lng}` as any)
  }

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        initialRegion={{ latitude: 48.1351, longitude: 11.582, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
        mapType={mapType}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        onRegionChangeComplete={onRegionChange}
      >
        {activities.map((a) => (
          <ActivityMarker
            key={a.id}
            activity={a}
            colors={colors}
            onPress={() => onMarkerPress(a)}
          />
        ))}
      </MapView>

      {/* Right-side controls */}
      <View style={styles.rightControls}>
        {/* Map type */}
        <TouchableOpacity
          style={[styles.controlBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setMapType((t) => (t === 'standard' ? 'satellite' : 'standard'))}
          hitSlop={8}
        >
          <Ionicons
            name={mapType === 'standard' ? 'layers-outline' : 'map-outline'}
            size={20}
            color={colors.primary}
          />
        </TouchableOpacity>

        {/* My location */}
        <TouchableOpacity
          style={[styles.controlBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={async () => {
            const loc = await Location.getCurrentPositionAsync({})
            mapRef.current?.animateToRegion({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            }, 600)
          }}
          hitSlop={8}
        >
          <Ionicons name='locate-outline' size={20} color={colors.primary} />
        </TouchableOpacity>

        {/* Refresh */}
        <TouchableOpacity
          style={[styles.controlBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={loadActivities}
          hitSlop={8}
        >
          <Ionicons name='refresh-outline' size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* FAB — create activity */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={onCreatePress}
        activeOpacity={0.85}
      >
        <Ionicons name='add' size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Activity detail sheet */}
      <ActivityDetailSheet
        activity={selectedActivity}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        colors={colors}
        currentUserId={user?.id ?? ''}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  rightControls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 160 : 144,
    right: spacing.md,
    gap: spacing.sm,
  },
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 108 : 92,
    right: spacing.md,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  // Marker
  markerBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    maxWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  markerText: {
    ...typography.caption,
    fontWeight: '700',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  markerTail: {
    width: 0,
    height: 0,
    alignSelf: 'center',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  // Sheet
  sheet: { flex: 1 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  sheetBody: {
    padding: spacing.md,
    gap: 0,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  hostAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  metaGrid: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  metaCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 4,
  },
  metaCellDivider: { width: 1, marginVertical: spacing.sm },
  participantsSection: { marginTop: spacing.sm },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  sheetCta: {
    padding: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
    borderTopWidth: 1,
  },
})
