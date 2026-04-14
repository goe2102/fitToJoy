import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { ratingService, type ActivityPhoto } from '@/services/ratingService'
import { activityService } from '@/services/activityService'
import { imageService } from '@/services/imageService'
import { supabase } from '../../lib/supabase'
import { radius, spacing, typography, type AppColors } from '@/constants/theme'
import type { Rating } from '@/types'

const { width: SCREEN_W } = Dimensions.get('window')
const HERO_H = 260

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivityDetail = {
  id: string
  title: string
  description: string | null
  date: string
  start_time: string
  duration_minutes: number
  cover_image_url: string | null
  host_id: string
  is_public: boolean
  price: number | null
  participant_count: number
  host: { id: string; username: string; avatar_url: string | null; is_verified: boolean; average_rating: number | null; rating_count: number } | null
}

type ReviewEntry = Rating & {
  rater: { id: string; username: string; avatar_url: string | null } | null
}

type ParticipantEntry = {
  user_id: string
  profile: { id: string; username: string; avatar_url: string | null } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}
function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}
function formatDuration(mins: number) {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60), m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1d ago'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

// ─── Stars ────────────────────────────────────────────────────────────────────

function Stars({ value, size = 13, colors }: { value: number; size?: number; colors: AppColors }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons key={s} name={s <= value ? 'star' : 'star-outline'} size={size} color={s <= value ? '#FFD60A' : colors.border} />
      ))}
    </View>
  )
}

function StarPicker({ value, onChange, colors }: { value: number; onChange: (v: number) => void; colors: AppColors }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <TouchableOpacity key={s} onPress={() => onChange(s)} activeOpacity={0.7}>
          <Ionicons name={s <= value ? 'star' : 'star-outline'} size={36} color={s <= value ? '#FFD60A' : colors.border} />
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ─── Detail Item ──────────────────────────────────────────────────────────────

function DetailItem({ icon, label, colors }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; colors: AppColors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: '45%' }}>
      <View style={{ width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.primary + '12', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={15} color={colors.primary} />
      </View>
      <Text style={[typography.bodySmall, { color: colors.text, fontWeight: '500', flex: 1 }]}>{label}</Text>
    </View>
  )
}

// ─── Rating Bar Chart ─────────────────────────────────────────────────────────

function RatingBars({ reviews, onFilter, activeFilter, colors }: {
  reviews: ReviewEntry[]
  onFilter: (star: number | null) => void
  activeFilter: number | null
  colors: AppColors
}) {
  const counts = [5, 4, 3, 2, 1].map((star) => ({ star, count: reviews.filter((r) => r.rating === star).length }))
  const max = Math.max(...counts.map((c) => c.count), 1)
  return (
    <View style={{ gap: 5, flex: 1 }}>
      {counts.map(({ star, count }) => {
        const isActive = activeFilter === star
        return (
          <TouchableOpacity key={star} onPress={() => onFilter(isActive ? null : star)} activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[typography.caption, { color: colors.textMuted, width: 10, textAlign: 'right' }]}>{star}</Text>
            <Ionicons name='star' size={10} color='#FFD60A' />
            <View style={{ flex: 1, height: 7, backgroundColor: colors.surfaceElevated, borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ width: `${(count / max) * 100}%`, height: '100%', backgroundColor: count > 0 ? (isActive ? colors.primary : '#FFD60A') : 'transparent', borderRadius: 4 }} />
            </View>
            <Text style={[typography.caption, { color: isActive ? colors.primary : colors.textMuted, width: 16, textAlign: 'right', fontWeight: isActive ? '700' : '400' }]}>{count}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ─── Review Card ─────────────────────────────────────────────────────────────

const REVIEW_PHOTO_SIZE = 80

function ReviewCard({ review, reviewPhotos, onPhotoPress, colors }: {
  review: ReviewEntry
  reviewPhotos: ActivityPhoto[]
  onPhotoPress: (photo: ActivityPhoto) => void
  colors: AppColors
}) {
  return (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
    }}>
      {/* Header: avatar · username + time · stars */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <TouchableOpacity
          onPress={() => review.rater?.id && router.push(`/profile/${review.rater.id}` as any)}
          activeOpacity={0.8}
          style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surfaceElevated }}
        >
          {review.rater?.avatar_url
            ? <Image source={{ uri: review.rater.avatar_url }} style={{ width: 40, height: 40 }} contentFit='cover' />
            : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name='person' size={18} color={colors.textMuted} /></View>}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <TouchableOpacity onPress={() => review.rater?.id && router.push(`/profile/${review.rater.id}` as any)} activeOpacity={0.7}>
            <Text style={[typography.label, { color: colors.text }]}>@{review.rater?.username ?? 'Unknown'}</Text>
          </TouchableOpacity>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{timeAgo(review.created_at)}</Text>
        </View>
        <Stars value={review.rating} size={14} colors={colors} />
      </View>

      {/* Review text */}
      {review.review_text
        ? <Text style={[typography.bodySmall, { color: colors.textSecondary, lineHeight: 20 }]}>{review.review_text}</Text>
        : null}

      {/* Photos */}
      {reviewPhotos.length > 0 && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: review.review_text ? spacing.sm : 0 }}>
          {reviewPhotos.map((photo) => (
            <TouchableOpacity
              key={photo.id}
              onPress={() => onPhotoPress(photo)}
              activeOpacity={0.85}
              style={{ width: REVIEW_PHOTO_SIZE, height: REVIEW_PHOTO_SIZE, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceElevated }}
            >
              <Image source={{ uri: photo.url }} style={{ width: REVIEW_PHOTO_SIZE, height: REVIEW_PHOTO_SIZE }} contentFit='cover' />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

// ─── Photo Picker Row (inside modal) ─────────────────────────────────────────

function PhotoPickerRow({
  photos,
  onAdd,
  onRemove,
  colors,
}: {
  photos: string[]  // base64 strings
  onAdd: () => void
  onRemove: (index: number) => void
  colors: AppColors
}) {
  const slots = [0, 1, 2]
  return (
    <View>
      <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
        Photos · optional · max 3
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {slots.map((i) => {
          const hasPhoto = !!photos[i]
          return (
            <View key={i} style={{ position: 'relative' }}>
              <TouchableOpacity
                onPress={hasPhoto ? undefined : onAdd}
                activeOpacity={hasPhoto ? 1 : 0.75}
                style={{
                  width: 90, height: 90, borderRadius: radius.lg,
                  backgroundColor: colors.surfaceElevated,
                  borderWidth: hasPhoto ? 0 : 1.5,
                  borderColor: colors.border,
                  borderStyle: hasPhoto ? undefined : 'dashed',
                  alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {hasPhoto ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${photos[i]}` }} style={{ width: 90, height: 90 }} contentFit='cover' />
                ) : (
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <Ionicons name='camera-outline' size={22} color={colors.textMuted} />
                    <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>Add</Text>
                  </View>
                )}
              </TouchableOpacity>
              {hasPhoto && (
                <TouchableOpacity
                  onPress={() => onRemove(i)}
                  style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 22, height: 22, borderRadius: 11,
                    backgroundColor: colors.error,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 2, borderColor: colors.background,
                  }}
                >
                  <Ionicons name='close' size={11} color='#fff' />
                </TouchableOpacity>
              )}
            </View>
          )
        })}
      </View>
    </View>
  )
}


// ─── Rating Modal ─────────────────────────────────────────────────────────────

function RatingModal({
  visible, activityId, hostId, hostUsername, activityTitle,
  existingRating, currentUserId, onClose, onSubmitted, colors,
}: {
  visible: boolean
  activityId: string
  hostId: string
  hostUsername: string
  activityTitle: string
  existingRating: ReviewEntry | null
  currentUserId: string
  onClose: () => void
  onSubmitted: (rating: number, reviewText: string, photoUrls: string[]) => void
  colors: AppColors
}) {
  const [stars, setStars] = useState(existingRating?.rating ?? 0)
  const [review, setReview] = useState(existingRating?.review_text ?? '')
  const [photos, setPhotos] = useState<string[]>([])  // base64
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible) {
      setStars(existingRating?.rating ?? 0)
      setReview(existingRating?.review_text ?? '')
      setPhotos([])
    }
  }, [visible])

  const onAddPhoto = async () => {
    if (photos.length >= 3) return
    const result = await imageService.pickImage([1, 1])
    if (!result?.base64) return
    setPhotos((prev) => [...prev, result.base64!])
  }

  const onRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const submit = async () => {
    if (stars === 0) return
    setSaving(true)
    const { error } = await ratingService.submitRating(activityId, currentUserId, hostId, stars, review)
    if (error) { setSaving(false); Alert.alert('Error', error.message); return }

    let photoUrls: string[] = []
    if (photos.length > 0) {
      const { urls } = await ratingService.submitPhotos(activityId, currentUserId, photos)
      photoUrls = urls
    }

    setSaving(false)
    onSubmitted(stars, review, photoUrls)
    onClose()
  }

  return (
    <Modal visible={visible} animationType='slide' presentationStyle='pageSheet' onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
          <Text style={[typography.h3, { color: colors.text, flex: 1 }]}>Rate Host</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name='close' size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps='handled'>
          {/* Activity + host */}
          <View style={{ gap: 4 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Activity</Text>
            <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>{activityTitle}</Text>
          </View>
          <View style={{ gap: 4 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Host</Text>
            <Text style={[typography.label, { color: colors.text }]}>@{hostUsername}</Text>
          </View>

          {/* Stars */}
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Your Rating</Text>
            {existingRating
              ? <Stars value={existingRating.rating} size={28} colors={colors} />
              : <StarPicker value={stars} onChange={setStars} colors={colors} />}
          </View>

          {/* Review text */}
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Review · optional</Text>
            <TextInput
              style={[{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, color: colors.text, minHeight: 90, textAlignVertical: 'top' }, typography.body]}
              placeholder='Share your experience…'
              placeholderTextColor={colors.textMuted}
              value={review}
              onChangeText={setReview}
              multiline
              editable={!existingRating}
              maxLength={300}
            />
          </View>

          {/* Photo picker — only while submitting, not when viewing existing */}
          {!existingRating && (
            <PhotoPickerRow
              photos={photos}
              onAdd={onAddPhoto}
              onRemove={onRemovePhoto}
              colors={colors}
            />
          )}

          {existingRating ? (
            <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>You already rated this activity.</Text>
          ) : (
            <TouchableOpacity
              style={{ backgroundColor: stars > 0 ? colors.primary : colors.border, borderRadius: radius.full, paddingVertical: spacing.md, alignItems: 'center' }}
              onPress={submit}
              disabled={stars === 0 || saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color='#fff' />
                : <Text style={[typography.button, { color: stars > 0 ? colors.white : colors.textMuted }]}>
                    Submit{photos.length > 0 ? ` + ${photos.length} photo${photos.length > 1 ? 's' : ''}` : ''}
                  </Text>}
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PastActivityReviewsScreen() {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [activity, setActivity] = useState<ActivityDetail | null>(null)
  const [reviews, setReviews] = useState<ReviewEntry[]>([])
  const [participants, setParticipants] = useState<ParticipantEntry[]>([])
  const [photos, setPhotos] = useState<ActivityPhoto[]>([])
  const [myRating, setMyRating] = useState<ReviewEntry | null>(null)
  const [myCheckedIn, setMyCheckedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [ratingModalOpen, setRatingModalOpen] = useState(false)
  const [participantsExpanded, setParticipantsExpanded] = useState(false)
  const [starFilter, setStarFilter] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!id || !user) return
    const [actRes, reviewsRes, myRes, partsRes, photosRes, checkedIn] = await Promise.all([
      supabase
        .from('activities')
        .select('id, title, description, date, start_time, duration_minutes, cover_image_url, host_id, is_public, price, participant_count:participants(count), host:profiles!activities_host_id_fkey(id, username, avatar_url, is_verified, average_rating, rating_count)')
        .eq('id', id)
        .single()
        .then(({ data }) => {
          if (!data) return null
          const host = Array.isArray(data.host) ? (data.host as any)[0] : data.host
          return { ...data, host, participant_count: (data as any).participant_count?.[0]?.count ?? 0 } as ActivityDetail
        }),
      ratingService.getRatingsForActivity(id),
      ratingService.getMyRating(id, user.id),
      supabase
        .from('participants')
        .select('user_id, profile:profiles!participants_user_id_fkey(id, username, avatar_url)')
        .eq('activity_id', id)
        .in('status', ['joined', 'approved']),
      ratingService.getPhotosForActivity(id),
      activityService.getMyCheckedIn(id, user.id),
    ])
    setActivity(actRes)
    setReviews(reviewsRes.data)
    setMyRating(myRes ? ({ ...myRes, rater: null } as ReviewEntry) : null)
    setParticipants(
      (partsRes.data ?? []).map((p: any) => ({
        user_id: p.user_id,
        profile: Array.isArray(p.profile) ? p.profile[0] : p.profile,
      }))
    )
    setPhotos(photosRes.data)
    setMyCheckedIn(checkedIn)
    setLoading(false)
  }, [id, user?.id])

  useEffect(() => { load() }, [load])

  const onRatingSubmitted = (rating: number, reviewText: string, photoUrls: string[]) => {
    const newReview: ReviewEntry = {
      id: `local-${Date.now()}`,
      activity_id: id,
      rater_id: user!.id,
      ratee_id: activity!.host_id,
      rating,
      review_text: reviewText || null,
      created_at: new Date().toISOString(),
      rater: null,
    }
    setMyRating(newReview)
    setReviews((prev) => [newReview, ...prev])
    if (photoUrls.length > 0) {
      const newPhotos: ActivityPhoto[] = photoUrls.map((url, i) => ({
        id: `local-photo-${Date.now()}-${i}`,
        activity_id: id,
        user_id: user!.id,
        url,
        created_at: new Date().toISOString(),
        profile: null,
      }))
      setPhotos((prev) => [...newPhotos, ...prev])
    }
  }

  const isHost = !!user && !!activity && activity.host_id === user.id
  const host = activity?.host ?? null
  const canRate = !!user && !!activity && !isHost && !myRating && myCheckedIn
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null
  const filteredReviews = starFilter !== null ? reviews.filter((r) => r.rating === starFilter) : reviews

  // Map rater_id → their photos (for inline display in review cards)
  const photosByRater = photos.reduce<Record<string, ActivityPhoto[]>>((acc, p) => {
    if (!acc[p.user_id]) acc[p.user_id] = []
    acc[p.user_id].push(p)
    return acc
  }, {})

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size='large' />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: canRate ? 100 + insets.bottom : insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={{ height: HERO_H, width: SCREEN_W }}>
          {activity?.cover_image_url
            ? <Image source={{ uri: activity.cover_image_url }} style={StyleSheet.absoluteFill} contentFit='cover' />
            : <LinearGradient colors={[colors.primary + 'CC', colors.primaryDark + 'FF']} style={StyleSheet.absoluteFill}>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name='trophy' size={56} color='rgba(255,255,255,0.25)' />
                </View>
              </LinearGradient>}
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.72)']}
            locations={[0.35, 0.65, 1]}
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity onPress={() => router.back()} style={{ position: 'absolute', top: insets.top + spacing.sm, left: spacing.md, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name='arrow-back' size={20} color='#fff' />
          </TouchableOpacity>
          <View style={{ position: 'absolute', bottom: spacing.lg, left: spacing.md, right: spacing.md }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#fff', letterSpacing: -0.3 }} numberOfLines={2}>{activity?.title}</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>{activity ? formatDate(activity.date) : ''}</Text>
          </View>
        </View>

        {/* ── Activity Details ── */}
        {activity && (
          <View style={{ marginHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <DetailItem icon='calendar-outline' label={formatDate(activity.date)} colors={colors} />
              <DetailItem icon='time-outline' label={formatTime(activity.start_time)} colors={colors} />
              <DetailItem icon='hourglass-outline' label={formatDuration(activity.duration_minutes)} colors={colors} />
              <DetailItem icon='people-outline' label={`${activity.participant_count} joined`} colors={colors} />
              <DetailItem icon='globe-outline' label={activity.is_public ? 'Public' : 'Private'} colors={colors} />
              <DetailItem icon='pricetag-outline' label={activity.price ? `€${activity.price}` : 'Free'} colors={colors} />
            </View>
            {activity.description ? (
              <>
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />
                <Text style={[typography.bodySmall, { color: colors.textSecondary, lineHeight: 20 }]}>{activity.description}</Text>
              </>
            ) : null}
          </View>
        )}

        {/* ── Host card (hidden if you are the host) ── */}
        {host && !isHost && (
          <TouchableOpacity
            style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
            onPress={() => host.id && router.push(`/profile/${host.id}` as any)}
            activeOpacity={0.75}
          >
            {host.avatar_url
              ? <Image source={{ uri: host.avatar_url }} style={{ width: 52, height: 52, borderRadius: 26 }} contentFit='cover' />
              : <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}><Ionicons name='person' size={24} color={colors.textMuted} /></View>}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={[typography.label, { color: colors.text }]}>@{host.username}</Text>
                {host.is_verified && <Ionicons name='checkmark-circle' size={15} color={colors.primary} />}
              </View>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>Host</Text>
              {(host.rating_count ?? 0) > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Stars value={Math.round(host.average_rating ?? 0)} size={12} colors={colors} />
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{host.average_rating?.toFixed(1)} ({host.rating_count})</Text>
                </View>
              )}
            </View>
            <Ionicons name='chevron-forward' size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* ── Participants collapsible ── */}
        {participants.length > 0 && (
          <View style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
            <TouchableOpacity onPress={() => setParticipantsExpanded((v) => !v)} activeOpacity={0.75}
              style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm }}>
              <View style={{ width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.primary + '12', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name='people-outline' size={16} color={colors.primary} />
              </View>
              <Text style={[typography.label, { color: colors.text, flex: 1 }]}>Participants</Text>
              <View style={{ backgroundColor: colors.primary + '18', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2, marginRight: 6 }}>
                <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>{participants.length}</Text>
              </View>
              <Ionicons name={participantsExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            </TouchableOpacity>
            {participantsExpanded && (
              <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
                {participants.map((p, i) => (
                  <TouchableOpacity key={p.user_id} onPress={() => p.profile?.id && router.push(`/profile/${p.profile.id}` as any)} activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
                    {p.profile?.avatar_url
                      ? <Image source={{ uri: p.profile.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} contentFit='cover' />
                      : <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}><Ionicons name='person' size={16} color={colors.textMuted} /></View>}
                    <Text style={[typography.bodySmall, { color: colors.text, fontWeight: '500' }]}>@{p.profile?.username ?? 'Unknown'}</Text>
                    <Ionicons name='chevron-forward' size={14} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Rating overview ── */}
        <View style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          {avgRating !== null ? (
            <>
              <View style={{ alignItems: 'center', minWidth: 72 }}>
                <Text style={{ fontSize: 52, fontWeight: '800', color: colors.text, lineHeight: 60, letterSpacing: -2 }}>{avgRating.toFixed(1)}</Text>
                <Stars value={Math.round(avgRating)} size={14} colors={colors} />
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</Text>
              </View>
              <View style={{ width: 1, height: 70, backgroundColor: colors.border }} />
              <RatingBars reviews={reviews} onFilter={setStarFilter} activeFilter={starFilter} colors={colors} />
            </>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}>
              <Ionicons name='star-outline' size={32} color={colors.textMuted} />
              <Text style={[typography.label, { color: colors.textSecondary }]}>No reviews yet</Text>
            </View>
          )}
        </View>

        {/* ── Reviews timeline ── */}
        {reviews.length > 0 && (
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <Text style={[typography.h3, { color: colors.text }]}>Reviews</Text>
              <View style={{ backgroundColor: colors.primary + '18', borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 2 }}>
                <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>
                  {filteredReviews.length}{starFilter ? `/${reviews.length}` : ''}
                </Text>
              </View>
              {starFilter !== null && (
                <TouchableOpacity onPress={() => setStarFilter(null)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceElevated, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}
                  activeOpacity={0.7}>
                  <Ionicons name='star' size={11} color='#FFD60A' />
                  <Text style={[typography.caption, { color: colors.text, fontWeight: '600' }]}>{starFilter}</Text>
                  <Ionicons name='close-circle' size={13} color={colors.textMuted} />
                </TouchableOpacity>
              )}
              {photos.length > 0 && (
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/photo-gallery', params: { activityId: id } } as any)}
                  style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surfaceElevated, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name='images-outline' size={13} color={colors.primary} />
                  <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>{photos.length} photo{photos.length !== 1 ? 's' : ''}</Text>
                </TouchableOpacity>
              )}
            </View>
            {filteredReviews.length === 0
              ? <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
                  <Ionicons name='star-outline' size={28} color={colors.textMuted} />
                  <Text style={[typography.bodySmall, { color: colors.textMuted }]}>No {starFilter}-star reviews</Text>
                </View>
              : filteredReviews.map((r, i) => (
                  <ReviewCard
                    key={r.id || i}
                    review={r}
                    reviewPhotos={photosByRater[r.rater_id] ?? []}
                    onPhotoPress={(photo) => router.push({ pathname: '/photo-gallery', params: { activityId: id, startPhotoId: photo.id } } as any)}
                    colors={colors}
                  />
                ))}
          </View>
        )}
      </ScrollView>

      {/* ── Rate Host / not checked in footer ── */}
      {!isHost && !myRating && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          {canRate ? (
            <TouchableOpacity
              style={{ backgroundColor: colors.primary, borderRadius: radius.full, paddingVertical: spacing.md, alignItems: 'center' }}
              onPress={() => setRatingModalOpen(true)}
              activeOpacity={0.85}
            >
              <Text style={[typography.button, { color: colors.white }]}>Rate Host</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceElevated, borderRadius: radius.lg, padding: spacing.md }}>
              <Ionicons name='location-outline' size={18} color={colors.textMuted} />
              <Text style={[typography.bodySmall, { color: colors.textMuted, flex: 1 }]}>
                Check in during the activity to leave a rating
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Rating modal ── */}
      {activity && user && (
        <RatingModal
          visible={ratingModalOpen}
          activityId={activity.id}
          hostId={activity.host_id}
          hostUsername={host?.username ?? ''}
          activityTitle={activity.title}
          existingRating={myRating}
          currentUserId={user.id}
          onClose={() => setRatingModalOpen(false)}
          onSubmitted={onRatingSubmitted}
          colors={colors}
        />
      )}

    </View>
  )
}
