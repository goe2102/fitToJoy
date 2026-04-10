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
  InteractionManager,
} from 'react-native'
import MapView, {
  Marker,
  PROVIDER_DEFAULT,
  type Region,
} from 'react-native-maps'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { router, useFocusEffect, useNavigation } from 'expo-router'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { useProfile } from '@/context/ProfileContext'
import { activityService } from '@/services/activityService'
import { chatService } from '@/services/chatService'
import { supabase } from '../../lib/supabase'
import { Button } from '@/components/ui'
import { radius, spacing, typography, type AppColors } from '@/constants/theme'
import type { Activity, Participant } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}
function formatDuration(m: number) {
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60),
    r = m % 60
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
  const accent = activity.is_public ? colors.primary : '#9CA3AF'
  const [imgLoaded, setImgLoaded] = useState(false)
  const hasCover = !!activity.cover_image_url

  return (
    <Marker
      coordinate={{
        latitude: activity.latitude,
        longitude: activity.longitude,
      }}
      onPress={onPress}
      tracksViewChanges={hasCover && !imgLoaded}
      anchor={{ x: 0.5, y: 1 }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={mStyles.wrapper}
      >
        {/* Pin circle */}
        <View style={[mStyles.pin, { backgroundColor: accent }]}>
          {hasCover ? (
            <Image
              source={{ uri: activity.cover_image_url! }}
              style={mStyles.pinImage}
              contentFit='cover'
              onLoad={() => setImgLoaded(true)}
            />
          ) : (
            <Ionicons name='flame-outline' size={22} color='#fff' />
          )}
          {/* Private lock badge */}
          {!activity.is_public && (
            <View style={mStyles.lockBadge}>
              <Ionicons name='lock-closed' size={8} color='#fff' />
            </View>
          )}
        </View>
        {/* Teardrop tail */}
        <View style={[mStyles.tail, { borderTopColor: accent }]} />
      </TouchableOpacity>
    </Marker>
  )
}

// ─── Participant Row ───────────────────────────────────────────────────────────

function ParticipantRow({
  p,
  colors,
  isHost,
  onKick,
  onPress,
  onMessage,
}: {
  p: Participant
  colors: AppColors
  isHost: boolean
  onKick: () => void
  onPress: () => void
  onMessage?: () => void
}) {
  return (
    <View
      style={[
        styles.participantRow,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <TouchableOpacity
        style={styles.participantInfo}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {p.profile?.avatar_url ? (
          <Image
            source={{ uri: p.profile.avatar_url }}
            style={styles.participantAvatar}
            contentFit='cover'
          />
        ) : (
          <View
            style={[
              styles.participantAvatar,
              {
                backgroundColor: colors.surfaceElevated,
                alignItems: 'center',
                justifyContent: 'center',
              },
            ]}
          >
            <Ionicons name='person' size={15} color={colors.textMuted} />
          </View>
        )}
        <View>
          <Text
            style={[typography.label, { color: colors.text, fontSize: 14 }]}
          >
            @{p.profile?.username ?? '—'}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Tap to view profile
          </Text>
        </View>
      </TouchableOpacity>
      {/* Message button */}
      {onMessage && (
        <TouchableOpacity
          onPress={onMessage}
          style={[styles.dmBtn, { borderColor: colors.border }]}
          activeOpacity={0.8}
        >
          <Ionicons
            name='chatbubble-outline'
            size={14}
            color={colors.primary}
          />
        </TouchableOpacity>
      )}
      {isHost && (
        <TouchableOpacity
          onPress={onKick}
          style={[styles.kickBtn, { backgroundColor: colors.error }]}
          activeOpacity={0.8}
        >
          <Ionicons name='person-remove-outline' size={14} color='#fff' />
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
            Kick
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── Activity Detail Sheet ────────────────────────────────────────────────────

function ActivityDetailSheet({
  activity,
  visible,
  onClose,
  onHostPress,
  onStartDM,
  colors,
  currentUserId,
}: {
  activity: Activity | null
  visible: boolean
  onClose: () => void
  onHostPress: (hostId: string) => void
  onStartDM: (targetId: string) => void
  colors: AppColors
  currentUserId: string
}) {
  const { profile: myProfile } = useProfile()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [liveCount, setLiveCount] = useState<number>(0)
  const [myStatus, setMyStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [joining, setJoining] = useState(false)

  const isHost = !!activity && activity.host?.id === currentUserId

  const loadData = useCallback(async () => {
    if (!activity) return
    const [{ data: p }, status] = await Promise.all([
      activityService.getParticipants(activity.id),
      activityService.getMyParticipantStatus(activity.id, currentUserId),
    ])
    setParticipants(p)
    setMyStatus(status)
    setLiveCount(p.length)
  }, [activity?.id, currentUserId])

  useEffect(() => {
    if (!activity || !visible) return
    setLoading(true)
    loadData().finally(() => setLoading(false))

    // Realtime — re-fetch on any participants change for this activity
    const channel = supabase
      .channel(`sheet-participants:${activity.id}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participants',
          filter: `activity_id=eq.${activity.id}`,
        },
        () => {
          loadData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activity?.id, visible])

  const onJoin = async () => {
    if (!activity) return

    // Age restriction check
    if (activity.min_age || activity.max_age) {
      if (!myProfile?.birthday) {
        Alert.alert(
          'Age Verification Required',
          'This activity has an age restriction. Please add your birthday in Settings to join.'
        )
        return
      }
      const birth = new Date(myProfile.birthday)
      const today = new Date()
      const age =
        today.getFullYear() -
        birth.getFullYear() -
        (today.getMonth() < birth.getMonth() ||
        (today.getMonth() === birth.getMonth() &&
          today.getDate() < birth.getDate())
          ? 1
          : 0)
      if (activity.min_age && age < activity.min_age) {
        Alert.alert(
          'Age Restriction',
          `You must be at least ${activity.min_age} years old to join this activity.`
        )
        return
      }
      if (activity.max_age && age > activity.max_age) {
        Alert.alert(
          'Age Restriction',
          `This activity is for participants up to ${activity.max_age} years old.`
        )
        return
      }
    }

    setJoining(true)
    const result = await activityService.join(
      activity.id,
      currentUserId,
      activity.is_public,
      myProfile
        ? { username: myProfile.username, avatar_url: myProfile.avatar_url }
        : undefined,
      activity.host?.id,
      activity.title,
      activity.max_participants
    )
    setJoining(false)
    if (result.error) {
      Alert.alert('Error', result.error.message)
      return
    }

    if (result.waitlisted) {
      setMyStatus('waitlisted')
      Alert.alert(
        'Added to Waitlist',
        "This activity is full. You've been added to the waitlist and will be notified automatically when a spot opens up."
      )
    } else {
      setMyStatus(activity.is_public ? 'joined' : 'pending')
      if (!activity.is_public)
        Alert.alert('Request sent', 'The host will review your request.')
    }
  }

  const onLeave = async () => {
    if (!activity) return
    const isWaitlisted = myStatus === 'waitlisted'
    Alert.alert(
      isWaitlisted ? 'Leave Waitlist' : 'Leave activity',
      isWaitlisted ? 'Remove yourself from the waitlist?' : 'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isWaitlisted ? 'Leave Waitlist' : 'Leave',
          style: 'destructive',
          onPress: async () => {
            await activityService.leave(activity.id, currentUserId)
            setMyStatus(null)
            if (!isWaitlisted)
              setParticipants((p) =>
                p.filter((x) => x.user_id !== currentUserId)
              )
          },
        },
      ]
    )
  }

  const onKickParticipant = (userId: string, username: string) => {
    if (!activity) return
    Alert.alert('Kick participant', `Remove @${username} from this activity?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Kick',
        style: 'destructive',
        onPress: async () => {
          await activityService.kickParticipant(
            activity.id,
            userId,
            activity.title
          )
          setParticipants((p) => p.filter((x) => x.user_id !== userId))
          setLiveCount((c) => Math.max(0, c - 1))
        },
      },
    ])
  }

  if (!activity) return null

  const isFull =
    activity.max_participants !== null && liveCount >= activity.max_participants

  const joinLabel =
    myStatus === 'kicked'
      ? 'Not allowed'
      : myStatus === 'joined' || myStatus === 'approved'
        ? 'Leave'
        : myStatus === 'pending'
          ? 'Request pending'
          : myStatus === 'waitlisted'
            ? 'Leave Waitlist'
            : isFull
              ? 'Join Waitlist'
              : activity.is_public
                ? 'Join'
                : 'Request to join'

  const joinVariant =
    myStatus === 'joined' ||
    myStatus === 'approved' ||
    myStatus === 'waitlisted'
      ? 'danger'
      : 'primary'
  const joinDisabled = myStatus === 'pending' || myStatus === 'kicked'

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.sheet, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ── */}
          <View style={styles.hero}>
            {activity.cover_image_url ? (
              <Image
                source={{ uri: activity.cover_image_url }}
                style={StyleSheet.absoluteFillObject}
                contentFit='cover'
              />
            ) : (
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    backgroundColor: colors.surfaceElevated,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                ]}
              >
                <Ionicons
                  name='flame-outline'
                  size={56}
                  color={colors.textMuted}
                />
              </View>
            )}

            {/* Top dark fade — keeps close button legible */}
            <LinearGradient
              colors={['rgba(0,0,0,0.38)', 'transparent']}
              locations={[0, 0.4]}
              style={StyleSheet.absoluteFillObject}
            />
            {/* Bottom fade into page background */}
            <LinearGradient
              colors={['transparent', colors.background]}
              locations={[0.5, 1]}
              style={StyleSheet.absoluteFillObject}
            />

            {/* Close button */}
            <TouchableOpacity
              style={styles.heroClose}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Ionicons name='close' size={18} color='#fff' />
            </TouchableOpacity>
          </View>

          {/* ── Title block (below image) ── */}
          <View style={styles.sheetTitleBlock}>
            {/* Badges */}
            {(!activity.is_public ||
              (!!activity.price && activity.price > 0) ||
              activity.min_age ||
              activity.max_age) && (
              <View style={styles.badgeRow}>
                {!activity.is_public && (
                  <View
                    style={[
                      styles.badgePill,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderWidth: 1,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name='lock-closed'
                      size={12}
                      color={colors.textMuted}
                    />
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.textMuted, fontWeight: '700' },
                      ]}
                    >
                      Private
                    </Text>
                  </View>
                )}
                {!!activity.price && activity.price > 0 && (
                  <View
                    style={[
                      styles.badgePill,
                      { backgroundColor: colors.primary + '18' },
                    ]}
                  >
                    <Ionicons
                      name='cash-outline'
                      size={12}
                      color={colors.primary}
                    />
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.primary, fontWeight: '700' },
                      ]}
                    >
                      €{activity.price} at location
                    </Text>
                  </View>
                )}
                {(activity.min_age || activity.max_age) && (
                  <View
                    style={[
                      styles.badgePill,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderWidth: 1,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name='person-outline'
                      size={12}
                      color={colors.textSecondary}
                    />
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.textSecondary, fontWeight: '600' },
                      ]}
                    >
                      {activity.min_age && activity.max_age
                        ? `Ages ${activity.min_age}–${activity.max_age}`
                        : activity.min_age
                          ? `${activity.min_age}+`
                          : `Up to ${activity.max_age}`}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <Text
              style={[styles.sheetTitle, { color: colors.text }]}
              numberOfLines={3}
            >
              {activity.title}
            </Text>

            {/* Host row */}
            <TouchableOpacity
              style={styles.sheetHostRow}
              onPress={() => activity.host?.id && onHostPress(activity.host.id)}
              activeOpacity={0.8}
            >
              {activity.host?.avatar_url ? (
                <Image
                  source={{ uri: activity.host.avatar_url }}
                  style={styles.sheetHostAvatar}
                  contentFit='cover'
                />
              ) : (
                <Ionicons
                  name='person-circle-outline'
                  size={26}
                  color={colors.textMuted}
                />
              )}
              <Text
                style={[
                  typography.label,
                  { color: colors.textSecondary, flex: 1 },
                ]}
              >
                @{activity.host?.username ?? '—'}
                {activity.host?.is_verified ? ' ✓' : ''}
              </Text>
              {!isHost && activity.host?.id && (
                <TouchableOpacity
                  style={[
                    styles.sheetMsgBtn,
                    {
                      backgroundColor: colors.primary + '15',
                      borderColor: colors.primary + '40',
                    },
                  ]}
                  onPress={() => onStartDM(activity.host!.id!)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name='chatbubble-outline'
                    size={14}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Body ── */}
          <View style={styles.sheetBody}>
            {/* Description */}
            {activity.description ? (
              <Text
                style={[
                  typography.body,
                  { color: colors.textSecondary, marginBottom: spacing.md },
                ]}
              >
                {activity.description}
              </Text>
            ) : null}

            {/* Meta grid */}
            <View
              style={[
                styles.metaGrid,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.metaCell}>
                <Ionicons
                  name='calendar-outline'
                  size={20}
                  color={colors.primary}
                />
                <Text style={[typography.label, { color: colors.text }]}>
                  {formatDate(activity.date)}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Date
                </Text>
              </View>
              <View
                style={[
                  styles.metaCellDivider,
                  { backgroundColor: colors.border },
                ]}
              />
              <View style={styles.metaCell}>
                <Ionicons
                  name='time-outline'
                  size={20}
                  color={colors.primary}
                />
                <Text style={[typography.label, { color: colors.text }]}>
                  {formatTime(activity.start_time)}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Start
                </Text>
              </View>
              <View
                style={[
                  styles.metaCellDivider,
                  { backgroundColor: colors.border },
                ]}
              />
              <View style={styles.metaCell}>
                <Ionicons
                  name='hourglass-outline'
                  size={20}
                  color={colors.primary}
                />
                <Text style={[typography.label, { color: colors.text }]}>
                  {formatDuration(activity.duration_minutes)}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Duration
                </Text>
              </View>
            </View>

            {/* Participants — visible to everyone on public, or to host on private */}
            {(activity.is_public || isHost) && (
              <View style={styles.participantsSection}>
                <Text
                  style={[
                    typography.label,
                    { color: colors.text, marginBottom: spacing.sm },
                  ]}
                >
                  Participants ({liveCount}
                  {activity.max_participants
                    ? `/${activity.max_participants}`
                    : ''}
                  )
                </Text>
                {loading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : participants.length === 0 ? (
                  <Text
                    style={[typography.caption, { color: colors.textMuted }]}
                  >
                    No participants yet
                  </Text>
                ) : (
                  participants.map((p) => (
                    <ParticipantRow
                      key={p.user_id}
                      p={p}
                      colors={colors}
                      isHost={isHost}
                      onKick={() =>
                        onKickParticipant(p.user_id, p.profile?.username ?? '?')
                      }
                      onPress={() => {
                        if (!p.profile?.id) return
                        onClose()
                        InteractionManager.runAfterInteractions(() =>
                          router.push(`/profile/${p.profile!.id}` as any)
                        )
                      }}
                      onMessage={
                        p.user_id !== currentUserId
                          ? () => onStartDM(p.user_id)
                          : undefined
                      }
                    />
                  ))
                )}
              </View>
            )}
          </View>
          {/* end sheetBody */}
        </ScrollView>

        {/* Join/Leave CTA */}
        <View
          style={[
            styles.sheetCta,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
        >
          <Button
            title={joinLabel}
            variant={joinVariant}
            loading={joining}
            disabled={joinDisabled}
            onPress={
              myStatus === 'joined' || myStatus === 'approved'
                ? onLeave
                : onJoin
            }
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

  const [activities, setActivities] = useState<Activity[]>([])

  // Offset markers that share the exact same coordinates so they don't stack
  const jitteredActivities = useMemo(() => {
    const groups: Record<string, number[]> = {}
    activities.forEach((a, i) => {
      const key = `${a.latitude.toFixed(5)},${a.longitude.toFixed(5)}`
      if (!groups[key]) groups[key] = []
      groups[key].push(i)
    })
    return activities.map((a, i) => {
      const key = `${a.latitude.toFixed(5)},${a.longitude.toFixed(5)}`
      const group = groups[key]
      if (group.length <= 1) return a
      const idx = group.indexOf(i)
      const angle = (2 * Math.PI * idx) / group.length
      const r = 0.00035
      return {
        ...a,
        latitude: a.latitude + r * Math.cos(angle),
        longitude: a.longitude + r * Math.sin(angle),
      }
    })
  }, [activities])

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null
  )
  const [detailVisible, setDetailVisible] = useState(false)
  const [mapCenter, setMapCenter] = useState({ lat: 48.1351, lng: 11.582 })
  const [refreshing, setRefreshing] = useState(false)

  const loadActivities = useCallback(async () => {
    if (!user) return
    const { data } = await activityService.getVisibleActivities(user.id)
    setActivities(data)
  }, [user])

  useEffect(() => {
    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        mapRef.current?.animateToRegion(
          {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
          },
          800
        )
        setMapCenter({ lat: loc.coords.latitude, lng: loc.coords.longitude })
      }
    })()
    loadActivities()
  }, [loadActivities])

  // Refresh on tab focus and on repeated tab press
  useFocusEffect(
    useCallback(() => {
      loadActivities()
    }, [loadActivities])
  )
  const navigation = useNavigation()
  useEffect(() => {
    const unsub = navigation.addListener('tabPress' as any, () => {
      loadActivities()
    })
    return unsub
  }, [navigation, loadActivities])

  // Realtime — new/cancelled/updated activities appear on map instantly
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`map-activities:${user.id}:${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activities' },
        () => {
          loadActivities()
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  const onMarkerPress = (activity: Activity) => {
    setSelectedActivity(activity)
    setDetailVisible(true)
  }

  const onRegionChange = (region: Region) => {
    setMapCenter({ lat: region.latitude, lng: region.longitude })
  }

  const onRefreshPress = async () => {
    if (refreshing) return
    setRefreshing(true)
    await loadActivities()
    setRefreshing(false)
  }

  const onCreatePress = () => {
    router.push(
      `/activity/create?lat=${mapCenter.lat}&lng=${mapCenter.lng}` as any
    )
  }

  const onHostPress = (hostId: string) => {
    setDetailVisible(false)
    InteractionManager.runAfterInteractions(() =>
      router.push(`/profile/${hostId}` as any)
    )
  }

  const onStartDM = async (targetId: string) => {
    if (!user) return
    setDetailVisible(false)
    const { data: convId } = await chatService.getOrCreateConversation(
      user.id,
      targetId
    )
    if (convId)
      InteractionManager.runAfterInteractions(() =>
        router.push(`/chat/${convId}` as any)
      )
  }

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: 48.1351,
          longitude: 11.582,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        onRegionChangeComplete={onRegionChange}
      >
        {jitteredActivities.map((a) => (
          <ActivityMarker
            key={a.id}
            activity={a}
            colors={colors}
            onPress={() => onMarkerPress(a)}
          />
        ))}
      </MapView>

      {/* FAB — create activity */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={onCreatePress}
        activeOpacity={0.85}
      >
        <Ionicons name='add' size={26} color='#fff' />
      </TouchableOpacity>

      <ActivityDetailSheet
        activity={selectedActivity}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onHostPress={onHostPress}
        onStartDM={onStartDM}
        colors={colors}
        currentUserId={user?.id ?? ''}
      />
    </View>
  )
}

// ─── Marker styles (static — no theme dependency needed for white card) ───────

const mStyles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  pin: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 7,
  },
  pinImage: { width: '100%', height: '100%' },
  lockBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 13,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
})

// ─── Sheet styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 108 : 92,
    right: spacing.md,
    width: 52,
    height: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  sheet: { flex: 1 },
  // ── Hero ──
  hero: {
    height: 280,
    overflow: 'hidden',
  },
  heroClose: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  // ── Title block below hero ──
  sheetTitleBlock: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 30,
    marginBottom: spacing.sm,
  },
  sheetHostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sheetHostAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  sheetMsgBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
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
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: 6,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  participantAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  kickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  dmBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCta: {
    padding: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
    borderTopWidth: 1,
  },
})
