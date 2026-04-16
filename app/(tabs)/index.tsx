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
import { useTranslation } from 'react-i18next'
import MapView, {
  Marker,
  PROVIDER_DEFAULT,
  type Region,
} from 'react-native-maps'
import Supercluster from 'supercluster'
import { fetchWeather, type WeatherData } from '@/services/weatherService'
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
import { scheduleStartNotification, cancelStartNotification } from '@/utils/scheduleStartNotification'
import { CATEGORIES, getCategoryMeta, type ActivityCategory } from '@/constants/categories'
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

type FriendParticipant = { user_id: string; username: string; avatar_url: string | null }

function ActivityMarker({
  activity,
  friends,
  colors,
  onPress,
}: {
  activity: Activity
  friends: FriendParticipant[]
  colors: AppColors
  onPress: () => void
}) {
  const cat = getCategoryMeta(activity.category)
  const accent = activity.is_public ? cat.color : '#9CA3AF'
  const hasCover = !!activity.cover_image_url
  const displayFriends = friends.slice(0, 3)
  const extraFriends = friends.length - displayFriends.length

  // Track view changes until all images are loaded
  const totalImages = (hasCover ? 1 : 0) + displayFriends.filter(f => !!f.avatar_url).length
  const [loadedCount, setLoadedCount] = useState(0)
  const onImageLoad = () => setLoadedCount(n => n + 1)
  const tracksViewChanges = loadedCount < totalImages

  return (
    <Marker
      coordinate={{ latitude: activity.latitude, longitude: activity.longitude }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: 1 }}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={mStyles.wrapper}>
        {/* Pin circle */}
        <View style={[mStyles.pin, { backgroundColor: accent }]}>
          {hasCover ? (
            <Image
              source={{ uri: activity.cover_image_url! }}
              style={mStyles.pinImage}
              contentFit='cover'
              onLoad={onImageLoad}
            />
          ) : (
            <Ionicons name={cat.icon as any} size={22} color='#fff' />
          )}
          {!activity.is_public && (
            <View style={mStyles.lockBadge}>
              <Ionicons name='lock-closed' size={8} color='#fff' />
            </View>
          )}
        </View>

        {/* Teardrop tail */}
        <View style={[mStyles.tail, { borderTopColor: accent }]} />

        {/* Friend avatars — shown below the tail */}
        {friends.length > 0 && (
          <View style={mStyles.friendRow}>
            {displayFriends.map((f, i) => (
              <View
                key={f.user_id}
                style={[mStyles.friendAvatar, { marginLeft: i === 0 ? 0 : -6, borderColor: '#fff' }]}
              >
                {f.avatar_url ? (
                  <Image
                    source={{ uri: f.avatar_url }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit='cover'
                    onLoad={onImageLoad}
                  />
                ) : (
                  <View style={[mStyles.friendAvatarFallback, { backgroundColor: accent }]}>
                    <Text style={mStyles.friendInitial}>{f.username[0].toUpperCase()}</Text>
                  </View>
                )}
              </View>
            ))}
            {extraFriends > 0 && (
              <View style={[mStyles.friendExtra, { backgroundColor: accent, marginLeft: -6 }]}>
                <Text style={mStyles.friendExtraText}>+{extraFriends}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    </Marker>
  )
}

// ─── Cluster Marker ───────────────────────────────────────────────────────────

function ClusterMarker({
  count,
  coordinate,
  colors,
  onPress,
}: {
  count: number
  coordinate: { latitude: number; longitude: number }
  colors: AppColors
  onPress: () => void
}) {
  // Scale cluster bubble slightly with count
  const size = count < 10 ? 42 : count < 50 ? 50 : 58
  return (
    <Marker coordinate={coordinate} onPress={onPress} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        {/* Outer ring */}
        <View style={[mStyles.clusterOuter, { width: size + 14, height: size + 14, borderRadius: (size + 14) / 2, borderColor: colors.primary + '40' }]}>
          {/* Inner filled circle */}
          <View style={[mStyles.clusterInner, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary }]}>
            <Text style={mStyles.clusterText}>{count}</Text>
          </View>
        </View>
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
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [joining, setJoining] = useState(false)
  const [weather, setWeather] = useState<WeatherData | null>(null)

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
    if (status === 'waitlisted') {
      const pos = await activityService.getWaitlistPosition(activity.id, currentUserId)
      setWaitlistPosition(pos)
    } else {
      setWaitlistPosition(null)
    }
  }, [activity?.id, currentUserId])

  useEffect(() => {
    if (!activity || !visible) return
    setLoading(true)
    setWeather(null)
    loadData().finally(() => setLoading(false))

    // Fetch weather for outdoor activities
    if (activity.is_outdoor) {
      fetchWeather(activity.latitude, activity.longitude, activity.date, activity.start_time)
        .then(setWeather)
    }

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
      const newStatus = activity.is_public ? 'joined' : 'pending'
      setMyStatus(newStatus)
      if (!activity.is_public) {
        Alert.alert('Request sent', 'The host will review your request.')
      } else {
        // Schedule a local notification at the actual start time
        scheduleStartNotification(activity.id, activity.title, activity.date, activity.start_time)
      }
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
            if (!isWaitlisted) {
              setParticipants((p) => p.filter((x) => x.user_id !== currentUserId))
              cancelStartNotification(activity.id)
            }
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
            {(true) && (
              <View style={styles.badgeRow}>
                {/* Category */}
                {(() => {
                  const cat = getCategoryMeta(activity.category)
                  return (
                    <View style={[styles.badgePill, { backgroundColor: cat.color + '18' }]}>
                      <Ionicons name={cat.icon as any} size={12} color={cat.color} />
                      <Text style={[typography.caption, { color: cat.color, fontWeight: '700' }]}>{cat.label}</Text>
                    </View>
                  )
                })()}
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

            {activity.tags?.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 2 }}>
                {activity.tags.map((tag) => (
                  <View
                    key={tag}
                    style={{
                      paddingVertical: 3,
                      paddingHorizontal: 9,
                      borderRadius: 99,
                      backgroundColor: colors.surfaceElevated,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '600' }]}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}

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

            {/* Weather card — outdoor activities only */}
            {activity.is_outdoor && weather && (
              <View style={[styles.weatherCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                  <Ionicons name={weather.icon as any} size={28} color={colors.primary} />
                  <View>
                    <Text style={[typography.label, { color: colors.text }]}>
                      {weather.temp}°C · {weather.label}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>
                      {weather.precipProb}% rain · {weather.windKph} km/h wind
                    </Text>
                  </View>
                </View>
                <View style={[styles.weatherBadge, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>Forecast</Text>
                </View>
              </View>
            )}
            {activity.is_outdoor && !weather && (
              <View style={[styles.weatherCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name='partly-sunny-outline' size={18} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textMuted }]}>Loading forecast…</Text>
              </View>
            )}

            {/* Waitlist banner */}
            {myStatus === 'waitlisted' && (
              <View style={[styles.cutoffBanner, { backgroundColor: colors.warning + '15', borderColor: colors.warning + '40' }]}>
                <Ionicons name='time-outline' size={14} color={colors.warning} />
                <Text style={[typography.caption, { color: colors.warning, flex: 1, fontWeight: '600' }]}>
                  You're on the waitlist{waitlistPosition != null ? ` · Position #${waitlistPosition}` : ''}
                </Text>
              </View>
            )}

            {/* Join cutoff notice */}
            {activity.join_cutoff_minutes != null && (() => {
              const msUntil = activityService.msUntilStart(activity.date, activity.start_time)
              const cutoffMs = activity.join_cutoff_minutes * 60 * 1000
              const inWindow = msUntil > cutoffMs
              const mins = activity.join_cutoff_minutes
              const label = mins >= 60
                ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}`
                : `${mins}m`
              return (
                <View style={[styles.cutoffBanner, {
                  backgroundColor: inWindow ? colors.primary + '12' : colors.error + '12',
                  borderColor: inWindow ? colors.primary + '30' : colors.error + '30',
                }]}>
                  <Ionicons
                    name={inWindow ? 'time-outline' : 'lock-closed-outline'}
                    size={14}
                    color={inWindow ? colors.primary : colors.error}
                  />
                  <Text style={[typography.caption, { color: inWindow ? colors.primary : colors.error, flex: 1 }]}>
                    {inWindow
                      ? `Joining closes ${label} before start`
                      : 'Joining is closed for this activity'}
                  </Text>
                </View>
              )
            })()}

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

  const { t } = useTranslation()
  const [activities, setActivities] = useState<Activity[]>([])
  const [friendsByActivity, setFriendsByActivity] = useState<Record<string, FriendParticipant[]>>({})
  const [activeCategories, setActiveCategories] = useState<Set<ActivityCategory>>(new Set())
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('standard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [region, setRegion] = useState<Region>({
    latitude: 48.1351,
    longitude: 11.582,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  })
  const [refreshing, setRefreshing] = useState(false)

  // ── Filter helpers ──
  const toggleCategory = (id: ActivityCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filteredActivities = useMemo(() =>
    activeCategories.size === 0
      ? activities
      : activities.filter((a) => activeCategories.has(a.category)),
    [activities, activeCategories]
  )

  // ── Supercluster instance — rebuilt only when filtered activities change ──
  const supercluster = useMemo(() => {
    const sc = new Supercluster<{ activity: Activity }>({ radius: 60, maxZoom: 15, minZoom: 1 })
    sc.load(
      filteredActivities.map((a) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [a.longitude, a.latitude] },
        properties: { activity: a },
      }))
    )
    return sc
  }, [filteredActivities])

  // ── Clusters — recomputed on region change ──
  const clusters = useMemo(() => {
    const bbox: [number, number, number, number] = [
      region.longitude - region.longitudeDelta / 2,
      region.latitude - region.latitudeDelta / 2,
      region.longitude + region.longitudeDelta / 2,
      region.latitude + region.latitudeDelta / 2,
    ]
    const zoom = Math.round(Math.log2(360 / region.latitudeDelta))
    return supercluster.getClusters(bbox, Math.max(0, Math.min(zoom, 20)))
  }, [supercluster, region])

  const loadActivities = useCallback(async () => {
    if (!user) return
    const { data } = await activityService.getVisibleActivities(user.id)
    setActivities(data)
    // Load friend participants in parallel (fire-and-forget style — non-blocking)
    if (data.length) {
      activityService
        .getFriendParticipants(data.map(a => a.id), user.id)
        .then(setFriendsByActivity)
    }
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
        setRegion((r) => ({ ...r, latitude: loc.coords.latitude, longitude: loc.coords.longitude }))
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

  const onClusterPress = (clusterId: number, coordinate: { latitude: number; longitude: number }) => {
    const expansionZoom = Math.min(supercluster.getClusterExpansionZoom(clusterId), 15)
    const delta = 360 / Math.pow(2, expansionZoom)
    mapRef.current?.animateToRegion(
      {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        latitudeDelta: delta * 0.6,
        longitudeDelta: delta * 0.6,
      },
      350
    )
  }

  const onRefreshPress = async () => {
    if (refreshing) return
    setRefreshing(true)
    await loadActivities()
    setRefreshing(false)
  }

  const onCreatePress = () => {
    router.push(
      `/activity/create?lat=${region.latitude}&lng=${region.longitude}` as any
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
        mapType={mapType}
        initialRegion={{
          latitude: 48.1351,
          longitude: 11.582,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        onRegionChangeComplete={setRegion}
      >
        {clusters.map((item) => {
          const [lng, lat] = item.geometry.coordinates
          const coordinate = { latitude: lat, longitude: lng }
          const props = item.properties as any

          if (props.cluster) {
            return (
              <ClusterMarker
                key={`cluster-${props.cluster_id}`}
                count={props.point_count as number}
                coordinate={coordinate}
                colors={colors}
                onPress={() => onClusterPress(props.cluster_id as number, coordinate)}
              />
            )
          }

          const activity = props.activity as Activity
          return (
            <ActivityMarker
              key={activity.id}
              activity={activity}
              friends={friendsByActivity[activity.id] ?? []}
              colors={colors}
              onPress={() => onMarkerPress(activity)}
            />
          )
        })}
      </MapView>

      {/* ── Map options button ── */}
      <TouchableOpacity
        style={[
          styles.menuBtn,
          {
            backgroundColor: colors.surface,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 6,
            elevation: 4,
          },
        ]}
        onPress={() => setMenuOpen((v) => !v)}
        activeOpacity={0.8}
      >
        <Ionicons name='options-outline' size={20} color={colors.text} />
        {(activeCategories.size > 0 || mapType !== 'standard') && (
          <View style={[styles.menuBadge, { backgroundColor: colors.primary }]} />
        )}
      </TouchableOpacity>

      {menuOpen && (
        <>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setMenuOpen(false)}
          />
          <View style={[styles.menuPanel, { backgroundColor: colors.surface, shadowColor: '#000' }]}>
            {/* Map style section */}
            <Text style={[typography.caption, { color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.sm }]}>
              {t('map.mapStyle').toUpperCase()}
            </Text>
            <View style={styles.mapTypeRow}>
              {(['standard', 'satellite', 'hybrid'] as const).map((mt) => (
                <TouchableOpacity
                  key={mt}
                  onPress={() => setMapType(mt)}
                  activeOpacity={0.8}
                  style={[
                    styles.mapTypeBtn,
                    {
                      backgroundColor: mapType === mt ? colors.primary : colors.surfaceElevated,
                      borderColor: mapType === mt ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[typography.caption, { color: mapType === mt ? '#fff' : colors.text, fontWeight: '600' }]}>
                    {t(`map.${mt}` as any)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

            {/* Category section */}
            <Text style={[typography.caption, { color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.sm }]}>
              {t('map.categories').toUpperCase()}
            </Text>
            <View style={styles.categoryGrid}>
              <TouchableOpacity
                onPress={() => setActiveCategories(new Set())}
                activeOpacity={0.8}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: activeCategories.size === 0 ? colors.primary : colors.surfaceElevated,
                    borderColor: activeCategories.size === 0 ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[typography.caption, { color: activeCategories.size === 0 ? '#fff' : colors.text, fontWeight: '600' }]}>
                  {t('map.allCategories')}
                </Text>
              </TouchableOpacity>
              {CATEGORIES.map((cat) => {
                const active = activeCategories.has(cat.id)
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => toggleCategory(cat.id)}
                    activeOpacity={0.8}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: active ? cat.color : colors.surfaceElevated,
                        borderColor: active ? cat.color : colors.border,
                      },
                    ]}
                  >
                    <Ionicons name={cat.icon as any} size={12} color={active ? '#fff' : colors.textSecondary} />
                    <Text style={[typography.caption, { color: active ? '#fff' : colors.textSecondary, fontWeight: '600' }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        </>
      )}

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
  friendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
  },
  friendAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: '#ccc',
  },
  friendAvatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendInitial: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  friendExtra: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendExtraText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: '800',
  },
  clusterOuter: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 6,
  },
  clusterInner: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  clusterText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: -0.3,
  },
})

// ─── Sheet styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  menuBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 44,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBadge: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  menuPanel: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 108 : 92,
    right: spacing.md,
    width: 228,
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  mapTypeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.md,
  },
  mapTypeBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
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
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  weatherBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cutoffBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
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
