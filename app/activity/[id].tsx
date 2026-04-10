import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  InteractionManager,
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
import { groupChatService } from '@/services/groupChatService'
import { chatService } from '@/services/chatService'
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
  colors: AppColors
}) {
  const profileId = participant.profile?.id
  return (
    <TouchableOpacity
      style={[styles.participantRow, { borderBottomColor: colors.border }]}
      onPress={() => profileId && router.push(`/profile/${profileId}` as any)}
      activeOpacity={0.7}
    >
      {participant.profile?.avatar_url ? (
        <Image source={{ uri: participant.profile.avatar_url }} style={styles.avatar} contentFit='cover' />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name='person' size={16} color={colors.textMuted} />
        </View>
      )}
      <Text style={[typography.label, { color: colors.text, flex: 1 }]}>
        @{participant.profile?.username ?? '—'}
      </Text>

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
  const isDark = colors.background === '#0F0F14'

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
        <View style={[styles.editHeader, { borderBottomColor: colors.border }]}>
          <Text style={[typography.h3, { color: colors.text }]}>Edit Activity</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name='close' size={24} color={colors.text} />
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
              <View style={[styles.pickerInline, { borderTopColor: colors.border }]}>
                <DateTimePicker
                  mode='date'
                  value={date}
                  minimumDate={new Date()}
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(_, d) => { if (d) setDate(d); if (Platform.OS !== 'ios') togglePicker(null) }}
                  themeVariant={isDark ? 'dark' : 'light'}
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
              <View style={[styles.pickerInline, { borderTopColor: colors.border, alignItems: 'center' }]}>
                <DateTimePicker
                  mode='time'
                  value={time}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, t) => { if (t) setTime(t); if (Platform.OS !== 'ios') togglePicker(null) }}
                  themeVariant={isDark ? 'dark' : 'light'}
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
  const [myStatus, setMyStatus] = useState<ParticipantStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [editVisible, setEditVisible] = useState(false)

  const loadData = useCallback(async () => {
    if (!id || !user) return
    setLoading(true)
    const [{ data: act }, { data: pend }, { data: join }, { data: wait }, status] = await Promise.all([
      activityService.getActivityById(id),
      activityService.getPendingParticipants(id),
      activityService.getParticipants(id),
      activityService.getWaitlist(id),
      activityService.getMyParticipantStatus(id, user.id),
    ])
    setActivity(act)
    setPending(pend)
    setJoined(join)
    setWaitlisted(wait)
    setMyStatus(status)
    setLoading(false)
  }, [id, user?.id])

  useEffect(() => { loadData() }, [loadData])

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

  const handleLeave = () => {
    Alert.alert('Leave activity', `Leave "${activity?.title}"?`, [
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

  const isDark = colors.background === '#0F0F14'
  const isHost = activity?.host_id === user?.id
  const isParticipant = joined.some((p) => p.user_id === user?.id)
  const isWaitlisted = myStatus === 'waitlisted'

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
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
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
              {isHost ? (
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
            {isHost ? (
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
          {(!activity.is_public || (!!activity.price && activity.price > 0) || activity.min_age || activity.max_age) && (
            <View style={styles.badgeRow}>
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
                  onMessage={p.user_id !== user?.id ? () => handleDM(p.user_id) : undefined}
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
                  colors={colors}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Delete activity (host only) ── */}
        {isHost && (
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
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
