import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  InteractionManager,
  Animated,
  Dimensions,
  TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { activityService } from '@/services/activityService'
import { blockService } from '@/services/blockService'
import { fetchWeather, type WeatherData } from '@/services/weatherService'
import { groupChatService } from '@/services/groupChatService'
import { chatService } from '@/services/chatService'
import { scheduleStartNotification, cancelStartNotification } from '@/utils/scheduleStartNotification'
import { getCategoryMeta } from '@/constants/categories'
import { Input, Button } from '@/components/ui'
import { radius, spacing, typography, type AppColors } from '@/constants/theme'
import type { Activity, Participant, ParticipantStatus } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function toTimeString(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function toDateString(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function displayDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function displayTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function formatDuration(m: number) {
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}
function parseDate(dateStr: string) {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const dt = new Date(); dt.setFullYear(y, mo - 1, d); dt.setHours(0, 0, 0, 0)
  return dt
}
function parseTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number)
  const dt = new Date(); dt.setHours(h, m, 0, 0)
  return dt
}

// ─── Participant Row ──────────────────────────────────────────────────────────

function ParticipantItem({
  participant,
  isPending,
  activityTitle,
  onAccept,
  onDeny,
  onKick,
  onMessage,
  waitlistPosition,
  isBlocked,
  colors,
}: {
  participant: Participant
  isPending: boolean
  activityTitle: string
  onAccept?: () => void
  onDeny?: () => void
  onKick?: () => void
  onMessage?: () => void
  waitlistPosition?: number
  isBlocked?: boolean
  colors: AppColors
}) {
  const profileId = participant.profile?.id
  return (
    <TouchableOpacity
      style={[styles.participantRow, { borderBottomColor: colors.border, opacity: isBlocked ? 0.5 : 1 }]}
      onPress={() => !isBlocked && profileId && router.push(`/profile/${profileId}` as any)}
      activeOpacity={isBlocked ? 1 : 0.7}
    >
      {participant.profile?.avatar_url ? (
        <Image source={{ uri: participant.profile.avatar_url }} style={styles.avatar} contentFit='cover' />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name='person' size={20} color={colors.textMuted} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>
            @{participant.profile?.username ?? '—'}
          </Text>
          {(participant.profile as any)?.is_verified && (
            <Ionicons name='checkmark-circle' size={15} color={colors.primary} />
          )}
        </View>
        {isBlocked && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>
            You blocked this user
          </Text>
        )}
      </View>

      {waitlistPosition !== undefined && (
        <View style={[styles.waitlistBadge, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[typography.caption, { color: colors.textMuted, fontWeight: '700' }]}>
            #{waitlistPosition}
          </Text>
        </View>
      )}

      {isPending && (
        <View style={styles.actionBtns}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={onAccept}>
            <Text style={[typography.caption, { color: colors.white, fontWeight: '700' }]}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border }]} onPress={onDeny}>
            <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '600' }]}>Deny</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isPending && (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {onMessage && (
            <TouchableOpacity style={[styles.iconAction, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]} onPress={onMessage}>
              <Ionicons name='chatbubble-outline' size={15} color={colors.primary} />
            </TouchableOpacity>
          )}
          {onKick && (
            <TouchableOpacity style={[styles.iconAction, { backgroundColor: '#FF3B3015', borderColor: '#FF3B3040' }]} onPress={onKick}>
              <Ionicons name='person-remove-outline' size={15} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

type ActivePicker = 'date' | 'time' | 'duration' | null

function EditModal({
  activity,
  visible,
  onClose,
  onSaved,
  colors,
}: {
  activity: Activity
  visible: boolean
  onClose: () => void
  onSaved: (updated: Partial<Activity>) => void
  colors: AppColors
}) {
  const insets = useSafeAreaInsets()
  const isDark = colors.text === '#F2F2F8'

  const [title, setTitle] = useState(activity.title)
  const [description, setDescription] = useState(activity.description ?? '')
  const [date, setDate] = useState(parseDate(activity.date))
  const [time, setTime] = useState(parseTime(activity.start_time))
  const [duration, setDuration] = useState(activity.duration_minutes)
  const [activePicker, setActivePicker] = useState<ActivePicker>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible) {
      setTitle(activity.title)
      setDescription(activity.description ?? '')
      setDate(parseDate(activity.date))
      setTime(parseTime(activity.start_time))
      setDuration(activity.duration_minutes)
      setActivePicker(null)
    }
  }, [visible])

  const togglePicker = (p: ActivePicker) =>
    setActivePicker((prev) => (prev === p ? null : p))

  const onSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    const { error } = await activityService.updateActivity(activity.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      date: toDateString(date),
      start_time: toTimeString(time),
      duration_minutes: duration,
    })
    setSaving(false)
    if (error) { Alert.alert('Error', error.message); return }
    onSaved({
      title: title.trim(),
      description: description.trim() || undefined,
      date: toDateString(date),
      start_time: toTimeString(time),
      duration_minutes: duration,
    })
    onClose()
  }

  return (
    <Modal visible={visible} animationType='slide' presentationStyle='pageSheet' onRequestClose={onClose}>
      <SafeAreaView style={[{ flex: 1 }, { backgroundColor: colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={styles.editHeader}>
          <Text style={[typography.h3, { color: colors.text }]}>Edit Activity</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={[styles.editCloseBtn, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name='close' size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.md }}
          keyboardShouldPersistTaps='handled'
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
            All joined participants will be notified of changes.
          </Text>

          <Input
            label='Title'
            value={title}
            onChangeText={setTitle}
            autoCapitalize='sentences'
          />
          <View style={{ height: spacing.md }} />
          <Input
            label='Description'
            value={description}
            onChangeText={setDescription}
            placeholder='More details… (optional)'
            autoCapitalize='sentences'
            multiline
            numberOfLines={3}
          />

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>WHEN</Text>

          <View style={[styles.pickerGroup, { borderColor: colors.border }]}>
            {/* Date */}
            <TouchableOpacity
              style={[styles.pickerRow, { backgroundColor: colors.surface }]}
              onPress={() => togglePicker('date')}
              activeOpacity={0.7}
            >
              <Ionicons name='calendar-outline' size={18} color={activePicker === 'date' ? colors.primary : colors.textSecondary} />
              <Text style={[typography.body, { flex: 1, color: colors.textSecondary }]}>Date</Text>
              <Text style={[typography.label, { color: activePicker === 'date' ? colors.primary : colors.text }]}>
                {displayDate(date)}
              </Text>
              <Ionicons name={activePicker === 'date' ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            </TouchableOpacity>
            {activePicker === 'date' && (
              <View style={[styles.pickerInline, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
                <DateTimePicker
                  mode='date'
                  value={date}
                  minimumDate={new Date()}
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(_, d) => { if (d) setDate(d); if (Platform.OS !== 'ios') togglePicker(null) }}
                  themeVariant={isDark ? 'dark' : 'light'}
                  accentColor={colors.primary}
                  style={{ alignSelf: 'center' }}
                />
              </View>
            )}

            <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

            {/* Time */}
            <TouchableOpacity
              style={[styles.pickerRow, { backgroundColor: colors.surface }]}
              onPress={() => togglePicker('time')}
              activeOpacity={0.7}
            >
              <Ionicons name='time-outline' size={18} color={activePicker === 'time' ? colors.primary : colors.textSecondary} />
              <Text style={[typography.body, { flex: 1, color: colors.textSecondary }]}>Start time</Text>
              <Text style={[typography.label, { color: activePicker === 'time' ? colors.primary : colors.text }]}>
                {displayTime(time)}
              </Text>
              <Ionicons name={activePicker === 'time' ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            </TouchableOpacity>
            {activePicker === 'time' && (
              <View style={[styles.pickerInline, { borderTopColor: colors.border, alignItems: 'center', backgroundColor: colors.surface }]}>
                <DateTimePicker
                  mode='time'
                  value={time}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, t) => { if (t) setTime(t); if (Platform.OS !== 'ios') togglePicker(null) }}
                  themeVariant={isDark ? 'dark' : 'light'}
                  accentColor={colors.primary}
                  textColor={colors.text}
                  style={{ width: 200 }}
                />
              </View>
            )}

            <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

            {/* Duration */}
            <TouchableOpacity
              style={[styles.pickerRow, { backgroundColor: colors.surface }]}
              onPress={() => togglePicker('duration')}
              activeOpacity={0.7}
            >
              <Ionicons name='hourglass-outline' size={18} color={activePicker === 'duration' ? colors.primary : colors.textSecondary} />
              <Text style={[typography.body, { flex: 1, color: colors.textSecondary }]}>Duration</Text>
              <Text style={[typography.label, { color: activePicker === 'duration' ? colors.primary : colors.text }]}>
                {formatDuration(duration)}
              </Text>
              <Ionicons name={activePicker === 'duration' ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            </TouchableOpacity>
            {activePicker === 'duration' && (
              <View style={[styles.pickerInline, { borderTopColor: colors.border }]}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.durationScroll}
                  keyboardShouldPersistTaps='handled'
                >
                  {[15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480].map((opt) => {
                    const active = opt === duration
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.durationPill,
                          { backgroundColor: active ? colors.primary : colors.surfaceElevated, borderColor: active ? colors.primary : colors.border },
                        ]}
                        onPress={() => setDuration(opt)}
                        activeOpacity={0.75}
                      >
                        <Text style={[typography.label, { color: active ? colors.white : colors.text }]}>
                          {formatDuration(opt)}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Save button pinned at bottom */}
        <View style={[styles.editSaveBar, { borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.sm }]}>
          <TouchableOpacity
            style={[styles.editSaveBtn, { backgroundColor: title.trim() ? colors.primary : colors.border }]}
            onPress={onSave}
            disabled={saving || !title.trim()}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={colors.white} />
              : (
                <>
                  <Ionicons name='checkmark-circle-outline' size={20} color={title.trim() ? colors.white : colors.textMuted} />
                  <Text style={[typography.button, { color: title.trim() ? colors.white : colors.textMuted }]}>
                    Save Changes
                  </Text>
                </>
              )
            }
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ActivityManageScreen() {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [activity, setActivity] = useState<Activity | null>(null)
  const [pending, setPending] = useState<Participant[]>([])
  const [joined, setJoined] = useState<Participant[]>([])
  const [waitlisted, setWaitlisted] = useState<Participant[]>([])
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set())
  const [myStatus, setMyStatus] = useState<ParticipantStatus | null>(null)
  const [myCheckedIn, setMyCheckedIn] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [showCheckInAnim, setShowCheckInAnim] = useState(false)
  const ciCircleScale   = useRef(new Animated.Value(0)).current
  const ciCheckOpacity  = useRef(new Animated.Value(0)).current
  const ciRing1Scale    = useRef(new Animated.Value(1)).current
  const ciRing1Opacity  = useRef(new Animated.Value(0)).current
  const ciRing2Scale    = useRef(new Animated.Value(1)).current
  const ciRing2Opacity  = useRef(new Animated.Value(0)).current
  const ciRing3Scale    = useRef(new Animated.Value(1)).current
  const ciRing3Opacity  = useRef(new Animated.Value(0)).current
  const ciTextOpacity   = useRef(new Animated.Value(0)).current
  const ciTextTranslate = useRef(new Animated.Value(16)).current
  const ciOverlayOpacity = useRef(new Animated.Value(0)).current
  const [loading, setLoading] = useState(true)
  const [editVisible, setEditVisible] = useState(false)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState(false)
  const [codeModalVisible, setCodeModalVisible] = useState(false)
  const [revealingCode, setRevealingCode] = useState(false)

  const loadData = useCallback(async () => {
    if (!id || !user) return
    setLoading(true)
    const [{ data: act }, { data: pend }, { data: join }, { data: wait }, status, checkedIn, { data: blocked }] = await Promise.all([
      activityService.getActivityById(id),
      activityService.getPendingParticipants(id),
      activityService.getParticipants(id),
      activityService.getWaitlist(id),
      activityService.getMyParticipantStatus(id, user.id),
      activityService.getMyCheckedIn(id, user.id),
      blockService.getBlockedUsers(user.id),
    ])
    setActivity(act)
    setPending(pend)
    setJoined(join)
    setWaitlisted(wait)
    setBlockedUserIds(new Set(blocked))
    setMyStatus(status)
    setMyCheckedIn(checkedIn)
    setLoading(false)
    // Schedule local start notification if participant (joined/approved)
    if (act && (status === 'joined' || status === 'approved') && act.host_id !== user?.id) {
      scheduleStartNotification(act.id, act.title, act.date, act.start_time)
    }
  }, [id, user?.id])

  useEffect(() => { loadData() }, [loadData])

  // Fetch weather once activity loads
  useEffect(() => {
    if (!activity?.is_outdoor) return
    fetchWeather(activity.latitude, activity.longitude, activity.date, activity.start_time)
      .then(setWeather)
  }, [activity?.id, activity?.is_outdoor])

  const onAccept = async (participant: Participant) => {
    await activityService.approveParticipant(participant.activity_id, participant.user_id, activity?.title)
    setPending((p) => p.filter((x) => x.user_id !== participant.user_id))
    setJoined((j) => [...j, { ...participant, status: 'approved' }])
  }

  const onDeny = async (participant: Participant) => {
    await activityService.rejectParticipant(participant.activity_id, participant.user_id, activity?.title)
    setPending((p) => p.filter((x) => x.user_id !== participant.user_id))
  }

  const onKick = (participant: Participant) => {
    Alert.alert(
      'Remove Participant',
      `Remove @${participant.profile?.username} from this activity?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await activityService.kickParticipant(participant.activity_id, participant.user_id, activity?.title)
            setJoined((j) => j.filter((x) => x.user_id !== participant.user_id))
          },
        },
      ]
    )
  }

  const onSaved = (updates: Partial<Activity>) => {
    setActivity((a) => a ? { ...a, ...updates } : a)
  }

  const openGroupChat = async () => {
    if (!activity) return
    const { data: chatId } = await groupChatService.getOrCreate(activity.id)
    if (chatId) InteractionManager.runAfterInteractions(() => router.push(`/group-chat/${chatId}` as any))
  }

  const handleDM = async (targetUserId: string) => {
    if (!user) return
    const { data: convId } = await chatService.getOrCreateConversation(user.id, targetUserId)
    if (convId) router.push(`/chat/${convId}` as any)
  }

  const [joining, setJoining] = useState(false)

  const handleJoin = async () => {
    if (!activity || !user) return
    setJoining(true)
    const { error, waitlisted } = await activityService.join(
      activity.id,
      user.id,
      activity.is_public,
      undefined,
      activity.host_id,
      activity.title,
      activity.max_participants ?? null
    )
    setJoining(false)
    if (error) {
      Alert.alert('Could not join', error.message)
      return
    }
    const newStatus: ParticipantStatus = waitlisted ? 'waitlisted' : activity.is_public ? 'joined' : 'pending'
    setMyStatus(newStatus)
    if (newStatus === 'joined') {
      scheduleStartNotification(activity.id, activity.title, activity.date, activity.start_time)
    }
    // Refresh participant list
    const { data: join } = await activityService.getParticipants(activity.id)
    setJoined(join)
  }

  const handleLeave = () => {
    Alert.alert('Leave activity', `Leave "${activity?.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive',
        onPress: async () => {
          if (!activity || !user) return
          await activityService.leave(activity.id, user.id)
          cancelStartNotification(activity.id)
          router.back()
        },
      },
    ])
  }

  const handleLeaveWaitlist = () => {
    Alert.alert('Leave Waitlist', 'Remove yourself from the waitlist?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive',
        onPress: async () => {
          if (!activity || !user) return
          await activityService.leave(activity.id, user.id)
          router.back()
        },
      },
    ])
  }

  const onKickFromWaitlist = (p: Participant) => {
    Alert.alert(
      'Remove from Waitlist',
      `Remove @${p.profile?.username} from the waitlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            await activityService.kickParticipant(p.activity_id, p.user_id)
            setWaitlisted((w) => w.filter((x) => x.user_id !== p.user_id))
          },
        },
      ]
    )
  }

  const handleCheckIn = async () => {
    if (!activity || !user || checkingIn) return
    setCheckingIn(true)
    const { error } = await activityService.checkIn(activity.id, user.id)
    setCheckingIn(false)
    if (error) { Alert.alert('Error', error.message); return }
    setMyCheckedIn(true)
    // Reset & run check-in celebration animation
    ciCircleScale.setValue(0); ciCheckOpacity.setValue(0)
    ciRing1Scale.setValue(1); ciRing1Opacity.setValue(0)
    ciRing2Scale.setValue(1); ciRing2Opacity.setValue(0)
    ciRing3Scale.setValue(1); ciRing3Opacity.setValue(0)
    ciTextOpacity.setValue(0); ciTextTranslate.setValue(16)
    ciOverlayOpacity.setValue(0)
    setShowCheckInAnim(true)
    const ring = (scale: Animated.Value, opacity: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.6, duration: 1, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(scale, { toValue: 2.8, duration: 900, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
          ]),
        ]),
      ])
    Animated.parallel([
      Animated.timing(ciOverlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(ciCircleScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
      Animated.sequence([Animated.delay(200), Animated.timing(ciCheckOpacity, { toValue: 1, duration: 200, useNativeDriver: true })]),
      ring(ciRing1Scale, ciRing1Opacity, 150),
      ring(ciRing2Scale, ciRing2Opacity, 350),
      ring(ciRing3Scale, ciRing3Opacity, 550),
      Animated.sequence([Animated.delay(400), Animated.parallel([
        Animated.timing(ciTextOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(ciTextTranslate, { toValue: 0, duration: 350, useNativeDriver: true }),
      ])]),
    ]).start()
    // Auto-dismiss after 2s
    setTimeout(() => {
      Animated.timing(ciOverlayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setShowCheckInAnim(false))
    }, 2000)
  }

  const handleCheckInWithCode = async () => {
    if (!activity || !user || checkingIn || codeInput.length !== 4) return
    setCheckingIn(true)
    const { error, wrongCode } = await activityService.checkInWithCode(activity.id, user.id, codeInput)
    setCheckingIn(false)
    if (wrongCode) {
      setCodeError(true)
      setTimeout(() => setCodeError(false), 1200)
      return
    }
    if (error) { Alert.alert('Error', error.message); return }
    setCodeModalVisible(false)
    setMyCheckedIn(true)
    // reuse existing animation trigger
    ciCircleScale.setValue(0); ciCheckOpacity.setValue(0)
    ciRing1Scale.setValue(1); ciRing1Opacity.setValue(0)
    ciRing2Scale.setValue(1); ciRing2Opacity.setValue(0)
    ciRing3Scale.setValue(1); ciRing3Opacity.setValue(0)
    ciTextOpacity.setValue(0); ciTextTranslate.setValue(16)
    ciOverlayOpacity.setValue(0)
    setShowCheckInAnim(true)
    const ring = (scale: Animated.Value, opacity: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.6, duration: 1, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(scale, { toValue: 2.8, duration: 900, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
          ]),
        ]),
      ])
    Animated.parallel([
      Animated.timing(ciOverlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(ciCircleScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
      Animated.sequence([Animated.delay(200), Animated.timing(ciCheckOpacity, { toValue: 1, duration: 200, useNativeDriver: true })]),
      ring(ciRing1Scale, ciRing1Opacity, 150),
      ring(ciRing2Scale, ciRing2Opacity, 350),
      ring(ciRing3Scale, ciRing3Opacity, 550),
      Animated.sequence([Animated.delay(400), Animated.parallel([
        Animated.timing(ciTextOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(ciTextTranslate, { toValue: 0, duration: 350, useNativeDriver: true }),
      ])]),
    ]).start()
    setTimeout(() => {
      Animated.timing(ciOverlayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setShowCheckInAnim(false))
    }, 2000)
  }

  const handleRevealCode = async () => {
    if (!activity || revealingCode) return
    setRevealingCode(true)
    const { code, error } = await activityService.generateCheckinCode(activity.id)
    setRevealingCode(false)
    if (error || !code) { Alert.alert('Error', 'Could not generate code.'); return }
    setActivity((a) => a ? { ...a, checkin_code: code } : a)
  }

  const isDark = colors.text === '#F2F2F8'
  const isHost = activity?.host_id === user?.id
  const isParticipant = joined.some((p) => p.user_id === user?.id)
  const isWaitlisted = myStatus === 'waitlisted'
  const isPending = myStatus === 'pending'
  const hasStarted = activity ? activityService.msUntilStart(activity.date, activity.start_time) <= 0 : false
  const canEdit = isHost && !hasStarted && activity?.status === 'active'
  const showCheckIn = isParticipant && hasStarted && activity?.status === 'active'
  const joinClosed = activity ? activityService.isJoinClosed(activity.date, activity.start_time, activity.join_cutoff_minutes) : false
  const isFull = activity?.max_participants != null && joined.length >= activity.max_participants
  const canJoin = !isHost && !isParticipant && !isWaitlisted && !isPending && !hasStarted && activity?.status === 'active' && !joinClosed

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={14} style={{ padding: spacing.md }}>
          <Ionicons name='chevron-back' size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size='large' />
        </View>
      </SafeAreaView>
    )
  }

  if (!activity) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={14} style={{ padding: spacing.md }}>
          <Ionicons name='chevron-back' size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.centered}>
          <Text style={[typography.body, { color: colors.textMuted }]}>Activity not found.</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['bottom']}>
      {/* ── Body ── */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: (showCheckIn && !myCheckedIn) || canJoin ? insets.bottom + 100 : insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        {activity.cover_image_url ? (
          <View style={styles.hero}>
            <Image
              source={{ uri: activity.cover_image_url }}
              style={StyleSheet.absoluteFillObject}
              contentFit='cover'
            />
            {/* Top dark fade — keeps buttons legible */}
            <LinearGradient
              colors={['rgba(0,0,0,0.38)', 'transparent']}
              locations={[0, 0.4]}
              style={[StyleSheet.absoluteFillObject]}
            />
            {/* Bottom fade into page background */}
            <LinearGradient
              colors={['transparent', colors.background]}
              locations={[0.5, 1]}
              style={StyleSheet.absoluteFillObject}
            />
            {/* Buttons row — safe area aware */}
            <View style={[styles.heroButtonRow, { top: insets.top + 8 }]}>
              <TouchableOpacity style={styles.heroBtn} onPress={() => router.back()} activeOpacity={0.8}>
                <Ionicons name='chevron-back' size={22} color='#fff' />
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              {canEdit ? (
                <TouchableOpacity style={styles.heroBtn} onPress={() => setEditVisible(true)} activeOpacity={0.8}>
                  <Ionicons name='pencil-outline' size={18} color='#fff' />
                </TouchableOpacity>
              ) : isParticipant ? (
                <TouchableOpacity style={[styles.heroBtn, { backgroundColor: 'rgba(255,59,48,0.65)' }]} onPress={handleLeave} activeOpacity={0.8}>
                  <Ionicons name='exit-outline' size={18} color='#fff' />
                </TouchableOpacity>
              ) : isWaitlisted ? (
                <TouchableOpacity style={styles.heroBtn} onPress={handleLeaveWaitlist} activeOpacity={0.8}>
                  <Ionicons name='exit-outline' size={18} color='#fff' />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : (
          /* No image — simple header bar */
          <View style={[styles.plainHeader, { backgroundColor: colors.background, paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
              <Ionicons name='chevron-back' size={26} color={colors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            {canEdit ? (
              <TouchableOpacity onPress={() => setEditVisible(true)} hitSlop={12}>
                <Ionicons name='pencil-outline' size={22} color={colors.primary} />
              </TouchableOpacity>
            ) : isParticipant ? (
              <TouchableOpacity onPress={handleLeave} hitSlop={12} style={[styles.leaveBtn, { borderColor: colors.error + '60' }]}>
                <Ionicons name='exit-outline' size={16} color={colors.error} />
                <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>Leave</Text>
              </TouchableOpacity>
            ) : isWaitlisted ? (
              <TouchableOpacity onPress={handleLeaveWaitlist} hitSlop={12} style={[styles.leaveBtn, { borderColor: colors.textMuted + '60' }]}>
                <Ionicons name='exit-outline' size={16} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textMuted, fontWeight: '700' }]}>Waitlist</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* ── Title block (always below image / header) ── */}
        <View style={styles.titleBlock}>
          {/* Badges */}
          {(true) && (
            <View style={styles.badgeRow}>
              {/* Category badge — always shown */}
              {(() => {
                const cat = getCategoryMeta(activity.category)
                return (
                  <View style={[styles.badgePill, { backgroundColor: cat.color + '18' }]}>
                    <Ionicons name={cat.icon as any} size={12} color={cat.color} />
                    <Text style={[typography.caption, { color: cat.color, fontWeight: '700' }]}>{cat.label}</Text>
                  </View>
                )
              })()}
              {activity.is_recurring && (
                <View style={[styles.badgePill, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name='refresh-circle-outline' size={12} color={colors.primary} />
                  <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>
                    {activity.recurrence === 'weekly' ? 'Weekly' : activity.recurrence === 'biweekly' ? 'Biweekly' : 'Monthly'}
                  </Text>
                </View>
              )}
              {!activity.is_public && (
                <View style={[styles.badgePill, { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border }]}>
                  <Ionicons name='lock-closed' size={12} color={colors.textMuted} />
                  <Text style={[typography.caption, { color: colors.textMuted, fontWeight: '700' }]}>Private</Text>
                </View>
              )}
              {!!activity.price && activity.price > 0 && (
                <View style={[styles.badgePill, { backgroundColor: colors.primary + '18' }]}>
                  <Ionicons name='cash-outline' size={12} color={colors.primary} />
                  <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>€{activity.price} at location</Text>
                </View>
              )}
              {(activity.min_age || activity.max_age) && (
                <View style={[styles.badgePill, { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border }]}>
                  <Ionicons name='person-outline' size={12} color={colors.textSecondary} />
                  <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '600' }]}>
                    {activity.min_age && activity.max_age
                      ? `Ages ${activity.min_age}–${activity.max_age}`
                      : activity.min_age ? `${activity.min_age}+` : `Up to ${activity.max_age}`}
                  </Text>
                </View>
              )}
            </View>
          )}
          <Text style={[styles.activityTitle, { color: colors.text }]}>{activity.title}</Text>
          {activity.description ? (
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>
              {activity.description}
            </Text>
          ) : null}
          {activity.tags?.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {activity.tags.map((tag) => (
                <View
                  key={tag}
                  style={{
                    paddingVertical: 4,
                    paddingHorizontal: 10,
                    borderRadius: radius.full,
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
        </View>

        <View style={styles.scroll}>

        {/* Waitlist banner for the user themselves */}
        {isWaitlisted && (
          <View style={[styles.waitlistBanner, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Ionicons name='time-outline' size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.label, { color: colors.text }]}>You're on the waitlist</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {waitlisted.findIndex((p) => p.user_id === user?.id) >= 0
                  ? `Position #${waitlisted.findIndex((p) => p.user_id === user?.id) + 1} · `
                  : ''}
                You'll be notified automatically when a spot opens up.
              </Text>
            </View>
          </View>
        )}

        {/* Activity info strip */}
        <View style={[styles.infoStrip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.infoCell}>
            <Ionicons name='calendar-outline' size={18} color={colors.primary} />
            <Text style={[typography.label, { color: colors.text }]}>
              {new Date(activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoCell}>
            <Ionicons name='time-outline' size={18} color={colors.primary} />
            <Text style={[typography.label, { color: colors.text }]}>
              {(() => { const [h, m] = activity.start_time.split(':'); const hr = parseInt(h); return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}` })()}
            </Text>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoCell}>
            <Ionicons name='hourglass-outline' size={18} color={colors.primary} />
            <Text style={[typography.label, { color: colors.text }]}>
              {formatDuration(activity.duration_minutes)}
            </Text>
          </View>
        </View>

        {/* ── Weather card ── */}
        {activity.is_outdoor && (
          <View style={[styles.weatherCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {weather ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                  <Ionicons name={weather.icon as any} size={30} color={colors.primary} />
                  <View>
                    <Text style={[typography.label, { color: colors.text }]}>
                      {weather.temp}°C · {weather.label}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>
                      {weather.precipProb}% chance of rain · {weather.windKph} km/h wind
                    </Text>
                  </View>
                </View>
                <View style={[styles.weatherBadge, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>Forecast</Text>
                </View>
              </>
            ) : (
              <>
                <Ionicons name='partly-sunny-outline' size={20} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textMuted }]}>Loading forecast…</Text>
              </>
            )}
          </View>
        )}

        {/* ── Checked-in banner (shown after check-in) ── */}
        {showCheckIn && myCheckedIn && (
          <View style={{
            marginBottom: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: colors.success + '15',
            borderWidth: 1,
            borderColor: colors.success + '40',
            borderRadius: radius.lg,
            paddingVertical: spacing.sm,
          }}>
            <Ionicons name='checkmark-circle' size={16} color={colors.success} />
            <Text style={[typography.label, { color: colors.success }]}>Already checked in</Text>
          </View>
        )}

        {/* ── Check-in code card (host only, code mode, after start) ── */}
        {isHost && hasStarted && activity.status === 'active' && activity.checkin_mode === 'code' && (
          <View style={[styles.codeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.label, { color: colors.text }]}>Check-in Code</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                Show this to participants so they can check in
              </Text>
            </View>
            {activity.checkin_code ? (
              <View style={[styles.codeBadge, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
                <Text style={[styles.codeText, { color: colors.primary }]}>{activity.checkin_code}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.revealBtn, { backgroundColor: colors.primary }]}
                onPress={handleRevealCode}
                disabled={revealingCode}
                activeOpacity={0.8}
              >
                {revealingCode
                  ? <ActivityIndicator size='small' color='#fff' />
                  : <Text style={[typography.label, { color: '#fff' }]}>Reveal Code</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Host card (visible to participants, not to host themselves) ── */}
        {isParticipant && !isHost && activity.host && (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md }}
            onPress={() => activity.host?.id && router.push(`/profile/${activity.host.id}` as any)}
            activeOpacity={0.75}
          >
            {activity.host.avatar_url ? (
              <Image source={{ uri: activity.host.avatar_url }} style={{ width: 42, height: 42, borderRadius: 21 }} contentFit='cover' />
            ) : (
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name='person' size={20} color={colors.textMuted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[typography.label, { color: colors.text }]}>@{activity.host.username}</Text>
                {activity.host.is_verified && <Ionicons name='checkmark-circle' size={14} color={colors.primary} />}
              </View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Host</Text>
            </View>
            <TouchableOpacity
              onPress={() => activity.host?.id && handleDM(activity.host.id)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '15', borderWidth: 1, borderColor: colors.primary + '40', alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={0.7}
              hitSlop={8}
            >
              <Ionicons name='chatbubble-outline' size={16} color={colors.primary} />
            </TouchableOpacity>
            <Ionicons name='chevron-forward' size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* ── Group Chat button ── */}
        {(isHost || isParticipant) && (
          <TouchableOpacity
            style={[gcBtn.btn, { backgroundColor: colors.primary }]}
            onPress={openGroupChat}
            activeOpacity={0.85}
          >
            <Ionicons name='chatbubbles-outline' size={18} color='#fff' />
            <Text style={[typography.label, { color: '#fff' }]}>Group Chat</Text>
          </TouchableOpacity>
        )}

        {/* ── Pending requests ── */}
        {isHost && pending.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Pending Requests
              <Text style={[typography.body, { color: colors.textMuted }]}> ({pending.length})</Text>
            </Text>
            <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {pending.map((p, i) => (
                <ParticipantItem
                  key={p.user_id}
                  participant={p}
                  isPending
                  activityTitle={activity.title}
                  onAccept={() => onAccept(p)}
                  onDeny={() => onDeny(p)}
                  colors={colors}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Joined participants ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Participants
            <Text style={[typography.body, { color: colors.textMuted }]}> ({joined.length}{activity.max_participants ? `/${activity.max_participants}` : ''})</Text>
          </Text>
          {joined.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name='people-outline' size={28} color={colors.textMuted} />
              <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.sm }]}>
                No participants yet
              </Text>
            </View>
          ) : (
            <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {joined.map((p) => (
                <ParticipantItem
                  key={p.user_id}
                  participant={p}
                  isPending={false}
                  activityTitle={activity.title}
                  onKick={isHost ? () => onKick(p) : undefined}
                  onMessage={p.user_id !== user?.id && !blockedUserIds.has(p.user_id) ? () => handleDM(p.user_id) : undefined}
                  isBlocked={blockedUserIds.has(p.user_id)}
                  colors={colors}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── Waitlist (host only) ── */}
        {isHost && waitlisted.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Waitlist
              <Text style={[typography.body, { color: colors.textMuted }]}> ({waitlisted.length})</Text>
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
              First in line is promoted automatically when a spot opens.
            </Text>
            <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {waitlisted.map((p, i) => (
                <ParticipantItem
                  key={p.user_id}
                  participant={p}
                  isPending={false}
                  activityTitle={activity.title}
                  waitlistPosition={i + 1}
                  onKick={() => onKickFromWaitlist(p)}
                  isBlocked={blockedUserIds.has(p.user_id)}
                  colors={colors}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Mark as Finished (host only, after start time) ── */}
        {isHost && activity.status === 'active' && activityService.msUntilStart(activity.date, activity.start_time) <= 0 && (
          <TouchableOpacity
            style={[styles.deleteBtn, { borderColor: colors.success + '50', marginBottom: spacing.sm }]}
            onPress={() => {
              Alert.alert(
                'Mark as Finished',
                'Mark this activity as finished? Participants will be able to rate you.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Finish',
                    onPress: async () => {
                      const { error } = await activityService.markAsFinished(activity.id)
                      if (error) { Alert.alert('Error', error.message); return }
                      setActivity((a) => a ? { ...a, status: 'finished' } : a)
                      router.push({ pathname: '/activity-finished', params: { title: activity.title } } as any)
                    },
                  },
                ]
              )
            }}
            activeOpacity={0.7}
          >
            <Ionicons name='checkmark-circle-outline' size={16} color={colors.success} />
            <Text style={[typography.label, { color: colors.success }]}>Mark as Finished</Text>
          </TouchableOpacity>
        )}

        {/* ── Finished banner ── */}
        {activity.status === 'finished' && (
          <View style={[styles.deleteBtn, { borderColor: colors.success + '50', opacity: 0.7 }]}>
            <Ionicons name='checkmark-circle' size={16} color={colors.success} />
            <Text style={[typography.label, { color: colors.success }]}>Activity Finished</Text>
          </View>
        )}

        {/* ── Schedule Next Session (host only, recurring, finished) ── */}
        {isHost && activity.status === 'finished' && activity.is_recurring && (
          <TouchableOpacity
            style={[styles.deleteBtn, { borderColor: colors.primary + '50', marginBottom: spacing.sm }]}
            onPress={() => {
              const label = activity.recurrence === 'weekly' ? 'next week' : activity.recurrence === 'biweekly' ? 'in 2 weeks' : 'next month'
              Alert.alert(
                'Schedule Next Session',
                `Create the next session of "${activity.title}" for ${label}? Previous participants will be notified.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Schedule',
                    onPress: async () => {
                      const { data: next, error } = await activityService.scheduleNextSession(activity)
                      if (error || !next) { Alert.alert('Error', error?.message ?? 'Failed to schedule'); return }
                      router.replace(`/activity/${next.id}` as any)
                    },
                  },
                ]
              )
            }}
            activeOpacity={0.7}
          >
            <Ionicons name='refresh-circle-outline' size={16} color={colors.primary} />
            <Text style={[typography.label, { color: colors.primary }]}>Schedule Next Session</Text>
          </TouchableOpacity>
        )}

        {/* ── Delete activity (host only, before start) ── */}
        {canEdit && (
          <TouchableOpacity
            style={[styles.deleteBtn, { borderColor: colors.error + '50' }]}
            onPress={() => {
              const count = joined.length
              Alert.alert(
                'Delete Activity',
                count > 0
                  ? `This will permanently delete the activity and notify ${count} participant${count === 1 ? '' : 's'}.`
                  : 'This will permanently delete the activity.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await activityService.cancelActivity(activity.id)
                      router.back()
                    },
                  },
                ]
              )
            }}
            activeOpacity={0.7}
          >
            <Ionicons name='trash-outline' size={16} color={colors.error} />
            <Text style={[typography.label, { color: colors.error }]}>Delete Activity</Text>
          </TouchableOpacity>
        )}

        </View>{/* end scroll inner padding */}
      </ScrollView>

      {/* ── Check-in sticky bottom ── */}
      {showCheckIn && !myCheckedIn && (
        <View style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.lg,
          paddingTop: spacing.sm,
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}>
          <TouchableOpacity
            onPress={activity.checkin_mode === 'code'
              ? () => { setCodeInput(''); setCodeError(false); setCodeModalVisible(true) }
              : handleCheckIn
            }
            activeOpacity={0.85}
            disabled={checkingIn}
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.full,
              paddingVertical: spacing.md,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: spacing.sm,
            }}
          >
            {checkingIn
              ? <ActivityIndicator size='small' color='#fff' />
              : <>
                  <Ionicons name='location-outline' size={18} color='#fff' />
                  <Text style={[typography.label, { color: '#fff' }]}>Check In</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* ── Code entry modal ── */}
      <Modal
        visible={codeModalVisible}
        transparent
        animationType='slide'
        onRequestClose={() => setCodeModalVisible(false)}
      >
        <Pressable
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
          onPress={() => setCodeModalVisible(false)}
        />
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          pointerEvents='box-none'
        >
          <View style={[styles.codeModalPanel, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom + 8, spacing.lg) }]}>
            <Text style={[typography.h2, { color: colors.text, textAlign: 'center', marginBottom: 4 }]}>Enter Code</Text>
            <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg }]}>
              Ask your host for the 4-digit check-in code
            </Text>

            {/* 4 boxes + hidden input */}
            <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[styles.codeBox, {
                      borderColor: codeError
                        ? colors.error
                        : codeInput.length === i ? colors.primary
                        : codeInput.length > i ? colors.primary + '60'
                        : colors.border,
                      backgroundColor: colors.surfaceElevated,
                    }]}
                  >
                    <Text style={[styles.codeBoxText, { color: codeError ? colors.error : colors.text }]}>
                      {codeInput[i] ?? ''}
                    </Text>
                  </View>
                ))}
                <TextInput
                  style={StyleSheet.absoluteFillObject}
                  value={codeInput}
                  onChangeText={(v) => { setCodeError(false); setCodeInput(v.replace(/[^0-9]/g, '').slice(0, 4)) }}
                  keyboardType='number-pad'
                  maxLength={4}
                  caretHidden
                  autoFocus
                  selectionColor='transparent'
                  onSubmitEditing={handleCheckInWithCode}
                />
              </View>
              {codeError && (
                <Text style={[typography.caption, { color: colors.error, marginTop: spacing.sm }]}>
                  Wrong code — try again
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={handleCheckInWithCode}
              disabled={codeInput.length !== 4 || checkingIn}
              activeOpacity={0.85}
              style={{
                backgroundColor: codeInput.length === 4 ? colors.primary : colors.border,
                borderRadius: radius.full,
                paddingVertical: spacing.md,
                marginHorizontal: spacing.lg,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: spacing.sm,
              }}
            >
              {checkingIn
                ? <ActivityIndicator size='small' color='#fff' />
                : <Text style={[typography.label, { color: '#fff' }]}>Check In</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Sticky Join button ── */}
      {canJoin && (
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: spacing.md,
          paddingBottom: insets.bottom + spacing.sm,
          paddingTop: spacing.sm,
          backgroundColor: colors.background,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        }}>
          <TouchableOpacity
            onPress={handleJoin}
            activeOpacity={0.85}
            disabled={joining}
            style={{
              backgroundColor: isFull ? colors.surfaceElevated : colors.primary,
              borderRadius: radius.full,
              paddingVertical: spacing.md,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: spacing.sm,
            }}
          >
            {joining ? (
              <ActivityIndicator size='small' color='#fff' />
            ) : isFull ? (
              <>
                <Ionicons name='hourglass-outline' size={18} color={colors.text} />
                <Text style={[typography.label, { color: colors.text }]}>Join Waitlist</Text>
              </>
            ) : activity?.is_public ? (
              <>
                <Ionicons name='checkmark-circle-outline' size={18} color='#fff' />
                <Text style={[typography.label, { color: '#fff' }]}>Join</Text>
              </>
            ) : (
              <>
                <Ionicons name='paper-plane-outline' size={18} color='#fff' />
                <Text style={[typography.label, { color: '#fff' }]}>Request to Join</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Check-in celebration overlay ── */}
      {showCheckInAnim && (
        <Animated.View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: colors.background,
          alignItems: 'center', justifyContent: 'center',
          opacity: ciOverlayOpacity,
        }}>
          {/* Ripple rings */}
          {([ciRing1Scale, ciRing2Scale, ciRing3Scale] as const).map((scale, i) => {
            const opacity = [ciRing1Opacity, ciRing2Opacity, ciRing3Opacity][i]
            return (
              <Animated.View key={i} pointerEvents='none' style={{
                position: 'absolute',
                width: 100, height: 100, borderRadius: 50,
                borderWidth: 2, borderColor: colors.success,
                transform: [{ scale }], opacity,
              }} />
            )
          })}
          {/* Circle + checkmark */}
          <Animated.View style={{
            width: 100, height: 100, borderRadius: 50,
            backgroundColor: colors.success,
            alignItems: 'center', justifyContent: 'center',
            transform: [{ scale: ciCircleScale }],
            shadowColor: colors.success,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35, shadowRadius: 20, elevation: 12,
          }}>
            <Animated.View style={{ opacity: ciCheckOpacity }}>
              <Ionicons name='checkmark' size={52} color='#fff' />
            </Animated.View>
          </Animated.View>
          {/* Text */}
          <Animated.View style={{
            marginTop: spacing.xl + spacing.md,
            alignItems: 'center',
            paddingHorizontal: spacing.xl,
            opacity: ciTextOpacity,
            transform: [{ translateY: ciTextTranslate }],
          }}>
            <Text style={[typography.h2, { color: colors.text, textAlign: 'center', marginBottom: spacing.sm }]}>
              Checked In!
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted, textAlign: 'center', lineHeight: 20 }]}>
              Your attendance is confirmed. You can now rate the host after the activity.
            </Text>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── Edit modal ── */}
      {activity && (
        <EditModal
          activity={activity}
          visible={editVisible}
          onClose={() => setEditVisible(false)}
          onSaved={onSaved}
          colors={colors}
        />
      )}
    </SafeAreaView>
  )
}

// ─── Group chat button styles ─────────────────────────────────────────────────

const gcBtn = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.lg,
  },
})

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // ── Hero (with cover image) ──
  hero: {
    height: 300,
    overflow: 'hidden',
  },
  heroButtonRow: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  heroBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Plain header (no cover image) ──
  plainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  // ── Title block below hero ──
  titleBlock: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  activityTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: 0 },
  // Info strip
  infoStrip: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  infoCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 6,
  },
  infoDivider: { width: 1, marginVertical: spacing.sm },
  // Sections
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  listCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  emptyCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    padding: spacing.xl,
  },
  // Participant row
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  actionBtns: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  kickBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitlistBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
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
  waitlistBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  codeBadge: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 6,
  },
  revealBtn: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  codeModalPanel: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.lg,
  },
  codeBox: {
    width: 56,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxText: {
    fontSize: 28,
    fontWeight: '700',
  },
  iconAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  // Edit modal
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  editCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSaveBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  editSaveBtn: {
    height: 54,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  pickerGroup: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  pickerInline: {
    borderTopWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
  },
  rowDivider: { height: 1 },
  durationScroll: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  durationPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
