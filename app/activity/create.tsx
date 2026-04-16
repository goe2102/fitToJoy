import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
  TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as Location from 'expo-location'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { useProfile } from '@/context/ProfileContext'
import { activityService } from '@/services/activityService'
import { imageService } from '@/services/imageService'
import { Input } from '@/components/ui'
import { radius, spacing, typography, type AppColors } from '@/constants/theme'
import type { RecurrenceType } from '@/types'
import { CATEGORIES, type ActivityCategory } from '@/constants/categories'

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
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
function displayTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function formatDuration(m: number) {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60),
    r = m % 60
  return r ? `${h}h ${r}min` : `${h}h`
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ title, colors }: { title: string; colors: AppColors }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
      {title.toUpperCase()}
    </Text>
  )
}

// ─── Picker row (collapsible) ─────────────────────────────────────────────────

function PickerRow({
  icon,
  label,
  value,
  active,
  onPress,
  colors,
}: {
  icon: string
  label: string
  value: string
  active: boolean
  onPress: () => void
  colors: AppColors
}) {
  return (
    <TouchableOpacity
      style={[
        styles.pickerRow,
        { backgroundColor: colors.surface, borderColor: colors.border },
        active && { borderColor: colors.primary },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon as any}
        size={18}
        color={active ? colors.primary : colors.textSecondary}
      />
      <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.pickerValue,
          { color: active ? colors.primary : colors.text },
        ]}
      >
        {value}
      </Text>
      <Ionicons
        name={active ? 'chevron-up' : 'chevron-down'}
        size={16}
        color={active ? colors.primary : colors.textMuted}
      />
    </TouchableOpacity>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

type ActivePicker = 'date' | 'time' | 'duration' | null
type LocationMode = 'address' | 'map'

export default function CreateActivityScreen() {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { profile } = useProfile()
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>()

  // Cover image
  const [coverBase64, setCoverBase64] = useState<string | null>(null)
  const [coverUploading, setCoverUploading] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [maxParticipants, setMaxParticipants] = useState('')
  const [unlimited, setUnlimited] = useState(true)
  const [duration, setDuration] = useState(60)
  const [saving, setSaving] = useState(false)

  // Indoor / outdoor
  const [isOutdoor, setIsOutdoor] = useState(true)

  // Price
  const [price, setPrice] = useState('')

  // Age restriction
  const [hasAgeRestriction, setHasAgeRestriction] = useState(false)
  const [minAge, setMinAge] = useState('')
  const [maxAge, setMaxAge] = useState('')

  // Join cutoff
  const [hasCutoff, setHasCutoff] = useState(false)
  const [cutoffMinutes, setCutoffMinutes] = useState(60)

  // Category
  const [category, setCategory] = useState<ActivityCategory>('social')

  // Tags
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  // Recurrence
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrence, setRecurrence] = useState<RecurrenceType>('weekly')

  // Location
  const [latitude, setLatitude] = useState(parseFloat(params.lat ?? '48.1351'))
  const [longitude, setLongitude] = useState(parseFloat(params.lng ?? '11.5820'))
  const [locationMode, setLocationMode] = useState<LocationMode>('address')
  const [locationPicking, setLocationPicking] = useState(false)

  // Address fields
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeResolved, setGeocodeResolved] = useState(false)

  const mapRef = useRef<MapView>(null)
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Date / time
  const defaultDate = new Date()
  defaultDate.setDate(defaultDate.getDate() + 1)
  defaultDate.setHours(10, 0, 0, 0)
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState(defaultDate)

  // Which inline picker is open
  const [activePicker, setActivePicker] = useState<ActivePicker>(null)
  const togglePicker = (p: ActivePicker) =>
    setActivePicker((prev) => (prev === p ? null : p))

  // Returns true if the selected date is today (local date comparison)
  const isToday = toDateString(date) === toDateString(new Date())

  // Earliest selectable time when today is selected — rounded up to the next minute
  const minTimeToday = (() => {
    const now = new Date()
    now.setSeconds(0, 0)
    now.setMinutes(now.getMinutes() + 1)
    return now
  })()

  // Fetch current location on mount
  useEffect(() => {
    if (params.lat && params.lng) return
    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      const loc = await Location.getCurrentPositionAsync({})
      setLatitude(loc.coords.latitude)
      setLongitude(loc.coords.longitude)
      mapRef.current?.animateToRegion(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      )
    })()
  }, [])

  // Geocode address fields (debounced)
  const triggerGeocode = (s: string, c: string, p: string, co: string) => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current)
    const query = [s, c, p, co].filter(Boolean).join(', ')
    if (!query.trim()) return
    geocodeTimer.current = setTimeout(async () => {
      setGeocoding(true)
      setGeocodeResolved(false)
      try {
        const results = await Location.geocodeAsync(query)
        if (results.length > 0) {
          setLatitude(results[0].latitude)
          setLongitude(results[0].longitude)
          setGeocodeResolved(true)
          mapRef.current?.animateToRegion(
            {
              latitude: results[0].latitude,
              longitude: results[0].longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            500
          )
        }
      } catch (_) {}
      setGeocoding(false)
    }, 800)
  }

  const onStreetChange = (v: string) => { setStreet(v); triggerGeocode(v, city, postalCode, country) }
  const onCityChange = (v: string) => { setCity(v); triggerGeocode(street, v, postalCode, country) }
  const onPostalChange = (v: string) => { setPostalCode(v); triggerGeocode(street, city, v, country) }
  const onCountryChange = (v: string) => { setCountry(v); triggerGeocode(street, city, postalCode, v) }

  const onPickCoverImage = async () => {
    const result = await imageService.pickImage([16, 9])
    if (!result?.base64) return
    setCoverBase64(result.base64)
  }

  const canSave =
    title.trim().length >= 2 &&
    !!coverBase64 &&
    !saving &&
    (unlimited || maxParticipants.trim().length > 0)

  const onSave = async () => {
    if (!canSave || !user) return

    if (profile?.is_private && isPublic) {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Public event on private account',
          'This event will be visible to everyone on the map even though your account is private. Continue?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Continue', onPress: () => resolve(true) },
          ]
        )
      })
      if (!confirmed) return
    }

    setSaving(true)

    // Upload cover image if one was picked
    let coverUrl: string | null = null
    if (coverBase64) {
      setCoverUploading(true)
      const filePath = `${user.id}/${Date.now()}.jpg`
      const { url } = await imageService.uploadImage('activity-covers', filePath, coverBase64)
      coverUrl = url ?? null
      setCoverUploading(false)
    }

    const parsedPrice = price.trim() ? parseFloat(price.replace(',', '.')) : null
    const parsedMin = hasAgeRestriction && minAge.trim() ? parseInt(minAge, 10) : null
    const parsedMax = hasAgeRestriction && maxAge.trim() ? parseInt(maxAge, 10) : null
    const parsedCutoff = hasCutoff ? cutoffMinutes : null

    const { error } = await activityService.create({
      host_id: user.id,
      title: title.trim(),
      description: description.trim() || undefined,
      latitude,
      longitude,
      date: toDateString(date),
      start_time: toTimeString(time),
      duration_minutes: duration,
      is_public: isPublic,
      max_participants: unlimited ? null : parseInt(maxParticipants, 10) || null,
      cover_image_url: coverUrl,
      price: parsedPrice,
      min_age: parsedMin,
      max_age: parsedMax,
      join_cutoff_minutes: parsedCutoff,
      is_outdoor: isOutdoor,
      category,
      tags,
      is_recurring: isRecurring,
      recurrence: isRecurring ? recurrence : null,
    })
    setSaving(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }
    router.back()
  }

  // ── Full-screen location picker ──────────────────────────────────────────────

  if (locationPicking) {
    return (
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude,
            longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation
          onPress={(e) => {
            setLatitude(e.nativeEvent.coordinate.latitude)
            setLongitude(e.nativeEvent.coordinate.longitude)
          }}
        >
          <Marker coordinate={{ latitude, longitude }} pinColor={colors.primary} />
        </MapView>

        {/* Top bar */}
        <View
          style={[
            styles.mapPickerTop,
            {
              paddingTop: insets.top + spacing.sm,
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Ionicons name='location-outline' size={16} color={colors.primary} />
          <Text style={[typography.bodySmall, { color: colors.text, flex: 1 }]}>
            Tap anywhere to place your activity
          </Text>
          <TouchableOpacity onPress={() => setLocationPicking(false)}>
            <Text style={[typography.label, { color: colors.primary }]}>
              Done
            </Text>
          </TouchableOpacity>
        </View>

        {/* Confirm button */}
        <View
          style={[
            styles.mapPickerBottom,
            { bottom: insets.bottom + spacing.md },
          ]}
        >
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
            onPress={() => setLocationPicking(false)}
          >
            <Ionicons name='checkmark' size={20} color={colors.white} />
            <Text style={[typography.button, { color: colors.white }]}>
              Confirm Location
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // ── Main form ────────────────────────────────────────────────────────────────

  const isDark = colors.text === '#F2F2F8'

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 10,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <Text style={[typography.h3, { color: colors.text }]}>New Activity</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={[styles.closeBtn, { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons name='close' size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Scrollable form ── */}
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps='handled'
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Cover Image ── */}
        <SectionLabel title='Cover Photo (Optional)' colors={colors} />
        <TouchableOpacity
          style={[
            styles.coverPicker,
            {
              backgroundColor: colors.surface,
              borderColor: coverBase64 ? colors.primary : colors.border,
            },
          ]}
          onPress={onPickCoverImage}
          activeOpacity={0.85}
        >
          {coverBase64 ? (
            <>
              <Image
                source={{ uri: `data:image/jpeg;base64,${coverBase64}` }}
                style={StyleSheet.absoluteFillObject}
                contentFit='cover'
              />
              <View style={styles.coverOverlay}>
                <View style={[styles.coverEditBadge, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
                  <Ionicons name='camera' size={14} color='#fff' />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Change photo</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name='image-outline' size={34} color={colors.textMuted} />
              <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
                Add cover photo
              </Text>
              <Text style={[typography.caption, { color: colors.primary, marginTop: 2, fontWeight: '600' }]}>
                Required
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Details ── */}
        <SectionLabel title='Details' colors={colors} />
        <Input
          label='Title'
          placeholder='What are you doing?'
          value={title}
          onChangeText={setTitle}
          autoCapitalize='sentences'
        />
        <View style={{ height: spacing.md }} />
        <Input
          label='Description'
          placeholder='More details… (optional)'
          value={description}
          onChangeText={setDescription}
          autoCapitalize='sentences'
          multiline
          numberOfLines={3}
        />

        {/* ── Category ── */}
        <SectionLabel title='Category' colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: spacing.sm }]}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {CATEGORIES.map((cat) => {
              const active = category === cat.id
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setCategory(cat.id)}
                  activeOpacity={0.75}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 9,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.full,
                    borderWidth: 1.5,
                    backgroundColor: active ? cat.color : colors.surfaceElevated,
                    borderColor: active ? cat.color : colors.border,
                  }}
                >
                  <Ionicons name={cat.icon as any} size={15} color={active ? '#fff' : colors.textMuted} />
                  <Text style={[typography.label, { color: active ? '#fff' : colors.textSecondary }]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* ── Tags ── */}
        <SectionLabel title='Tags (Optional · max 5)' colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {tags.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
              {tags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => setTags((prev) => prev.filter((t) => t !== tag))}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingVertical: 5,
                    paddingHorizontal: spacing.sm,
                    borderRadius: radius.full,
                    backgroundColor: colors.primary + '15',
                    borderWidth: 1,
                    borderColor: colors.primary + '40',
                  }}
                >
                  <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>#{tag}</Text>
                  <Ionicons name='close' size={12} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          {tags.length < 5 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <TextInput
                style={[typography.body, { flex: 1, color: colors.text }]}
                placeholder='Add a tag… (e.g. chill, 21+, beer)'
                placeholderTextColor={colors.textMuted}
                value={tagInput}
                onChangeText={(v) => setTagInput(v.replace(/\s/g, '').toLowerCase())}
                autoCapitalize='none'
                autoCorrect={false}
                returnKeyType='done'
                onSubmitEditing={() => {
                  const t = tagInput.trim().toLowerCase()
                  if (t && !tags.includes(t) && tags.length < 5) {
                    setTags((prev) => [...prev, t])
                    setTagInput('')
                  }
                }}
              />
              <TouchableOpacity
                onPress={() => {
                  const t = tagInput.trim().toLowerCase()
                  if (t && !tags.includes(t) && tags.length < 5) {
                    setTags((prev) => [...prev, t])
                    setTagInput('')
                  }
                }}
                disabled={!tagInput.trim()}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: 6,
                  borderRadius: radius.full,
                  backgroundColor: tagInput.trim() ? colors.primary : colors.surfaceElevated,
                }}
              >
                <Text style={[typography.label, { color: tagInput.trim() ? '#fff' : colors.textMuted }]}>Add</Text>
              </TouchableOpacity>
            </View>
          )}
          {tags.length >= 5 && (
            <Text style={[typography.caption, { color: colors.textMuted }]}>Maximum 5 tags reached</Text>
          )}
        </View>

        {/* ── Location ── */}
        <SectionLabel title='Location' colors={colors} />

        {/* Mode segmented control */}
        <View
          style={[
            styles.segmentedControl,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {(['address', 'map'] as LocationMode[]).map((mode) => {
            const active = locationMode === mode
            return (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.segment,
                  active && { backgroundColor: colors.primary },
                ]}
                onPress={() => setLocationMode(mode)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={mode === 'address' ? 'home-outline' : 'map-outline'}
                  size={14}
                  color={active ? colors.white : colors.textSecondary}
                />
                <Text
                  style={[
                    typography.caption,
                    {
                      fontWeight: '600',
                      color: active ? colors.white : colors.textSecondary,
                    },
                  ]}
                >
                  {mode === 'address' ? 'Address' : 'Pick on Map'}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {locationMode === 'address' ? (
          /* ── Address form ── */
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Input
              label='Street & Number'
              placeholder='e.g. Main St 12'
              value={street}
              onChangeText={onStreetChange}
              autoCapitalize='words'
            />
            <View style={{ height: spacing.sm }} />
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Input
                  label='City'
                  placeholder='Munich'
                  value={city}
                  onChangeText={onCityChange}
                  autoCapitalize='words'
                />
              </View>
              <View style={{ width: spacing.sm }} />
              <View style={{ flex: 0.55 }}>
                <Input
                  label='Postal Code'
                  placeholder='80331'
                  value={postalCode}
                  onChangeText={onPostalChange}
                  keyboardType='number-pad'
                />
              </View>
            </View>
            <View style={{ height: spacing.sm }} />
            <Input
              label='Country'
              placeholder='Germany'
              value={country}
              onChangeText={onCountryChange}
              autoCapitalize='words'
            />

            {geocoding ? (
              <View style={styles.geocodeStatus}>
                <ActivityIndicator size='small' color={colors.primary} />
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Finding location…
                </Text>
              </View>
            ) : geocodeResolved ? (
              <View style={styles.geocodeStatus}>
                <Ionicons name='checkmark-circle' size={15} color={colors.primary} />
                <Text style={[typography.caption, { color: colors.primary }]}>
                  Location found
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          /* ── Map preview ── */
          <View style={[styles.mapPreview, { borderColor: colors.border }]}>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFillObject}
              provider={PROVIDER_DEFAULT}
              region={{
                latitude,
                longitude,
                latitudeDelta: 0.008,
                longitudeDelta: 0.008,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              pointerEvents='none'
            >
              <Marker coordinate={{ latitude, longitude }} pinColor={colors.primary} />
            </MapView>
            <TouchableOpacity
              style={[styles.mapEditBadge, { backgroundColor: colors.primary }]}
              onPress={() => setLocationPicking(true)}
              activeOpacity={0.85}
            >
              <Ionicons name='expand-outline' size={13} color={colors.white} />
              <Text
                style={[
                  typography.caption,
                  { color: colors.white, fontWeight: '600' },
                ]}
              >
                Tap to move pin
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── When ── */}
        <SectionLabel title='When' colors={colors} />
        <View style={[styles.pickerGroup, { borderColor: colors.border }]}>
          {/* Date */}
          <PickerRow
            icon='calendar-outline'
            label='Date'
            value={displayDate(date)}
            active={activePicker === 'date'}
            onPress={() => togglePicker('date')}
            colors={colors}
          />
          {activePicker === 'date' && (
            <View style={[styles.pickerInline, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
              <DateTimePicker
                mode='date'
                value={date}
                minimumDate={new Date()}
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(_, d) => {
                  if (d) {
                    setDate(d)
                    // If user picked today and the current time value is in the past, snap forward
                    const pickedIsToday = toDateString(d) === toDateString(new Date())
                    if (pickedIsToday) {
                      const now = new Date()
                      const timeCopy = new Date(time)
                      timeCopy.setFullYear(now.getFullYear(), now.getMonth(), now.getDate())
                      if (timeCopy <= now) {
                        const snapped = new Date(now)
                        snapped.setMinutes(snapped.getMinutes() + 30, 0, 0)
                        setTime(snapped)
                      }
                    }
                  }
                  if (Platform.OS !== 'ios') togglePicker(null)
                }}
                themeVariant={isDark ? 'dark' : 'light'}
                accentColor={colors.primary}
                style={{ alignSelf: 'center' }}
              />
            </View>
          )}

          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

          {/* Time */}
          <PickerRow
            icon='time-outline'
            label='Start time'
            value={displayTime(time)}
            active={activePicker === 'time'}
            onPress={() => togglePicker('time')}
            colors={colors}
          />
          {activePicker === 'time' && (
            <View
              style={[
                styles.pickerInline,
                { borderTopColor: colors.border, alignItems: 'center', backgroundColor: colors.surface },
              ]}
            >
              <DateTimePicker
                mode='time'
                value={time}
                minimumDate={isToday ? minTimeToday : undefined}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, t) => {
                  if (t) {
                    // On Android the picker doesn't enforce minimumDate for time mode,
                    // so we guard it manually.
                    if (isToday) {
                      const now = new Date()
                      const candidate = new Date(t)
                      candidate.setFullYear(now.getFullYear(), now.getMonth(), now.getDate())
                      if (candidate <= now) return
                    }
                    setTime(t)
                  }
                  if (Platform.OS !== 'ios') togglePicker(null)
                }}
                themeVariant={isDark ? 'dark' : 'light'}
                accentColor={colors.primary}
                textColor={colors.text}
                style={{ width: 200 }}
              />
            </View>
          )}

          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

          {/* Duration */}
          <PickerRow
            icon='hourglass-outline'
            label='Duration'
            value={formatDuration(duration)}
            active={activePicker === 'duration'}
            onPress={() => togglePicker('duration')}
            colors={colors}
          />
          {activePicker === 'duration' && (
            <View
              style={[styles.pickerInline, { borderTopColor: colors.border, paddingHorizontal: 0, gap: spacing.sm }]}
            >
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
                        {
                          backgroundColor: active ? colors.primary : colors.surfaceElevated,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setDuration(opt)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          typography.label,
                          { color: active ? colors.white : colors.text },
                        ]}
                      >
                        {formatDuration(opt)}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>

              <View style={[styles.durationCustomRow, { borderTopColor: colors.border }]}>
                <Ionicons name='time-outline' size={16} color={colors.textMuted} />
                <Text style={[typography.body, { color: colors.textSecondary }]}>Custom</Text>
                <View
                  style={[
                    styles.durationCustomInput,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  ]}
                >
                  <TextInput
                    style={[typography.label, { color: colors.text, minWidth: 36, textAlign: 'center' }]}
                    value={String(duration)}
                    onChangeText={(v) => {
                      const n = parseInt(v.replace(/[^0-9]/g, ''), 10)
                      if (!isNaN(n) && n > 0) setDuration(Math.min(n, 1440))
                    }}
                    keyboardType='number-pad'
                    selectTextOnFocus
                  />
                </View>
                <Text style={[typography.body, { color: colors.textSecondary }]}>min</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Visibility ── */}
        <SectionLabel title='Visibility' colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.label, { color: colors.text }]}>Public</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {isPublic
                  ? 'Anyone can see and join instantly'
                  : 'Only followers can see it — join requires approval'}
              </Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        {/* ── Indoor / Outdoor ── */}
        <SectionLabel title='Venue Type' colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: 0, overflow: 'hidden' }]}>
          <View style={{ flexDirection: 'row' }}>
            {([
              { label: 'Outdoor', icon: 'sunny-outline',  value: true  },
              { label: 'Indoor',  icon: 'home-outline',   value: false },
            ] as const).map(({ label, icon, value }, i) => {
              const active = isOutdoor === value
              return (
                <TouchableOpacity
                  key={label}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.sm,
                    paddingVertical: spacing.md + 2,
                    backgroundColor: active ? colors.primary : 'transparent',
                    borderRightWidth: i === 0 ? StyleSheet.hairlineWidth : 0,
                    borderRightColor: colors.border,
                  }}
                  onPress={() => setIsOutdoor(value)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={icon} size={18} color={active ? colors.white : colors.textSecondary} />
                  <Text style={[typography.label, { color: active ? colors.white : colors.textSecondary }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
          {isOutdoor && (
            <View style={[styles.infoNote, { backgroundColor: colors.primary + '10', margin: spacing.sm, marginTop: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.primary + '25', borderRadius: 0, borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md }]}>
              <Ionicons name='partly-sunny-outline' size={13} color={colors.primary} />
              <Text style={[typography.caption, { color: colors.primary, flex: 1 }]}>
                Weather forecast will be shown to participants
              </Text>
            </View>
          )}
        </View>

        {/* ── Participants ── */}
        <SectionLabel title='Participants' colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.label, { color: colors.text }]}>Unlimited spots</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>No cap on participants</Text>
            </View>
            <Switch
              value={unlimited}
              onValueChange={setUnlimited}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.white}
            />
          </View>
          {!unlimited && (
            <>
              <View style={[styles.rowDivider, { backgroundColor: colors.border, marginVertical: spacing.md }]} />
              <Input
                label='Max participants'
                placeholder='e.g. 10'
                value={maxParticipants}
                onChangeText={(t) => setMaxParticipants(t.replace(/[^0-9]/g, ''))}
                keyboardType='number-pad'
              />
              <View style={[styles.infoNote, { backgroundColor: colors.primary + '12' }]}>
                <Ionicons name='time-outline' size={13} color={colors.primary} />
                <Text style={[typography.caption, { color: colors.primary, flex: 1 }]}>
                  When full, users join a waitlist. First in line gets the spot automatically when someone leaves.
                </Text>
              </View>
            </>
          )}
        </View>

        {/* ── Price ── */}
        <SectionLabel title='Entry Price (Optional)' colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.priceRow}>
            <Text style={[styles.currencySymbol, { color: colors.textSecondary }]}>€</Text>
            <TextInput
              style={[styles.priceInput, { color: colors.text }]}
              placeholder='0.00 — free'
              placeholderTextColor={colors.textMuted}
              value={price}
              onChangeText={(v) => setPrice(v.replace(/[^0-9.,]/g, ''))}
              keyboardType='decimal-pad'
            />
          </View>
          <View style={[styles.rowDivider, { backgroundColor: colors.border, marginVertical: spacing.sm }]} />
          <View style={[styles.infoNote, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name='lock-closed-outline' size={13} color={colors.textMuted} />
            <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>
              Paid at location · Cannot be changed after creation
            </Text>
          </View>
        </View>

        {/* ── Age Restriction ── */}
        <SectionLabel title='Age Restriction (Optional)' colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.label, { color: colors.text }]}>Restrict by age</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Limit who can join based on their age
              </Text>
            </View>
            <Switch
              value={hasAgeRestriction}
              onValueChange={setHasAgeRestriction}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.white}
            />
          </View>
          {hasAgeRestriction && (
            <>
              <View style={[styles.rowDivider, { backgroundColor: colors.border, marginVertical: spacing.md }]} />
              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <Input
                    label='Min Age'
                    placeholder='e.g. 18'
                    value={minAge}
                    onChangeText={(v) => setMinAge(v.replace(/[^0-9]/g, ''))}
                    keyboardType='number-pad'
                  />
                </View>
                <View style={{ width: spacing.md }} />
                <View style={{ flex: 1 }}>
                  <Input
                    label='Max Age'
                    placeholder='e.g. 35'
                    value={maxAge}
                    onChangeText={(v) => setMaxAge(v.replace(/[^0-9]/g, ''))}
                    keyboardType='number-pad'
                  />
                </View>
              </View>
              <View style={[styles.infoNote, { backgroundColor: colors.surfaceElevated, marginTop: spacing.sm }]}>
                <Ionicons name='lock-closed-outline' size={13} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>
                  Cannot be changed after creation
                </Text>
              </View>
            </>
          )}
        </View>

        {/* ── Join Cutoff ── */}
        <SectionLabel title='Join Window (Optional)' colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.label, { color: colors.text }]}>Limit join window</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Stop accepting joins before the activity starts
              </Text>
            </View>
            <Switch
              value={hasCutoff}
              onValueChange={setHasCutoff}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.white}
            />
          </View>
          {hasCutoff && (
            <>
              <View style={[styles.rowDivider, { backgroundColor: colors.border, marginVertical: spacing.md }]} />
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                Close joining this long before the start
              </Text>

              {/* Preset pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm, paddingBottom: 2 }}
                keyboardShouldPersistTaps='handled'
              >
                {[
                  { label: '15 min', value: 15 },
                  { label: '30 min', value: 30 },
                  { label: '1 h',    value: 60 },
                  { label: '2 h',    value: 120 },
                  { label: '3 h',    value: 180 },
                  { label: '6 h',    value: 360 },
                  { label: '12 h',   value: 720 },
                  { label: '24 h',   value: 1440 },
                ].map(({ label, value }) => {
                  const active = cutoffMinutes === value
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[
                        styles.durationPill,
                        {
                          backgroundColor: active ? colors.primary : colors.surfaceElevated,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setCutoffMinutes(value)}
                      activeOpacity={0.75}
                    >
                      <Text style={[typography.label, { color: active ? colors.white : colors.text }]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>

              <View style={[styles.infoNote, { backgroundColor: colors.primary + '12', marginTop: spacing.md }]}>
                <Ionicons name='eye-off-outline' size={13} color={colors.primary} />
                <Text style={[typography.caption, { color: colors.primary, flex: 1 }]}>
                  The activity disappears from the map and joining is blocked once this window closes.
                </Text>
              </View>
            </>
          )}
        </View>

        {/* ── Recurring ── */}
        <SectionLabel title='Recurrence (Optional)' colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.label, { color: colors.text }]}>Recurring activity</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Repeat this activity at a set interval
              </Text>
            </View>
            <Switch
              value={isRecurring}
              onValueChange={setIsRecurring}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.white}
            />
          </View>
          {isRecurring && (
            <>
              <View style={[styles.rowDivider, { backgroundColor: colors.border, marginVertical: spacing.md }]} />
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                How often does this repeat?
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {([
                  { label: 'Weekly',   value: 'weekly'   },
                  { label: 'Biweekly', value: 'biweekly' },
                  { label: 'Monthly',  value: 'monthly'  },
                ] as { label: string; value: RecurrenceType }[]).map(({ label, value }) => {
                  const active = recurrence === value
                  return (
                    <TouchableOpacity
                      key={value}
                      onPress={() => setRecurrence(value)}
                      activeOpacity={0.75}
                      style={[
                        styles.durationPill,
                        { flex: 1, justifyContent: 'center',
                          backgroundColor: active ? colors.primary : colors.surfaceElevated,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[typography.label, { color: active ? colors.white : colors.text }]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              <View style={[styles.infoNote, { backgroundColor: colors.primary + '12', marginTop: spacing.md }]}>
                <Ionicons name='refresh-circle-outline' size={13} color={colors.primary} />
                <Text style={[typography.caption, { color: colors.primary, flex: 1 }]}>
                  After each session you can schedule the next one with one tap. Previous participants get notified automatically.
                </Text>
              </View>
            </>
          )}
        </View>

        {/* ── Save button ── */}
        <View style={{ marginTop: spacing.xl }}>
          <TouchableOpacity
            style={[
              styles.saveBtn,
              { backgroundColor: canSave ? colors.primary : colors.border },
            ]}
            onPress={onSave}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons
                  name='checkmark-circle-outline'
                  size={20}
                  color={canSave ? colors.white : colors.textMuted}
                />
                <Text
                  style={[
                    typography.button,
                    { color: canSave ? colors.white : colors.textMuted },
                  ]}
                >
                  Create Activity
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  // Cover image
  coverPicker: {
    height: 200,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.md,
  },
  coverEditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  // Location mode toggle
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 4,
    gap: 4,
    marginBottom: spacing.sm,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  // Address form card
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  twoCol: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  geocodeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  // Map preview
  mapPreview: {
    height: 180,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
  },
  mapEditBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  // Picker group
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
    borderWidth: 0,
  },
  pickerLabel: { ...typography.body, flex: 1 },
  pickerValue: { ...typography.label },
  pickerInline: {
    borderTopWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
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
  durationCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderTopWidth: 1,
  },
  durationCustomInput: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginLeft: 'auto',
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // Price
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: '600',
  },
  priceInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: spacing.xs,
  },
  // Info note
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  // Save button
  saveBtn: {
    height: 54,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  // Full-screen map picker
  mapPickerTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  mapPickerBottom: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
  },
  confirmBtn: {
    height: 54,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
})
