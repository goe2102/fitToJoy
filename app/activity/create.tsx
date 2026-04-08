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
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { useProfile } from '@/context/ProfileContext'
import { activityService } from '@/services/activityService'
import { Input } from '@/components/ui'
import { radius, spacing, typography, type AppColors } from '@/constants/theme'

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

const DURATION_STEP = 15
const DURATION_MIN = 15
const DURATION_MAX = 480

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

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [maxParticipants, setMaxParticipants] = useState('')
  const [unlimited, setUnlimited] = useState(true)
  const [duration, setDuration] = useState(60)
  const [saving, setSaving] = useState(false)

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

  // Fetch current location on mount
  useEffect(() => {
    if (params.lat && params.lng) return // already have coords from params
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

  const onStreetChange = (v: string) => {
    setStreet(v)
    triggerGeocode(v, city, postalCode, country)
  }
  const onCityChange = (v: string) => {
    setCity(v)
    triggerGeocode(street, v, postalCode, country)
  }
  const onPostalChange = (v: string) => {
    setPostalCode(v)
    triggerGeocode(street, city, v, country)
  }
  const onCountryChange = (v: string) => {
    setCountry(v)
    triggerGeocode(street, city, postalCode, v)
  }

  const canSave = title.trim().length >= 2 && !saving

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
          <Marker coordinate={{ latitude, longitude }} pinColor='#6C63FF' />
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

  const isDark = colors.background === '#0F0F14'

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
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name='close' size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: colors.text }]}>
          New Activity
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* ── Scrollable form (button lives inside) ── */}
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps='handled'
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        showsVerticalScrollIndicator={false}
      >
        {/* Details */}
        <Input
          label='Title'
          placeholder='What are you doing?'
          value={title}
          onChangeText={setTitle}
          autoFocus
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

        {/* Location */}
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
                  name={
                    mode === 'address' ? 'home-outline' : 'map-outline'
                  }
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

            {/* Geocode status */}
            {geocoding ? (
              <View style={styles.geocodeStatus}>
                <ActivityIndicator size='small' color={colors.primary} />
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Finding location…
                </Text>
              </View>
            ) : geocodeResolved ? (
              <View style={styles.geocodeStatus}>
                <Ionicons
                  name='checkmark-circle'
                  size={15}
                  color={colors.primary}
                />
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
              <Marker coordinate={{ latitude, longitude }} pinColor='#6C63FF' />
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

        {/* When */}
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
            <View
              style={[styles.pickerInline, { borderTopColor: colors.border }]}
            >
              <DateTimePicker
                mode='date'
                value={date}
                minimumDate={new Date()}
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(_, d) => {
                  if (d) setDate(d)
                  if (Platform.OS !== 'ios') togglePicker(null)
                }}
                themeVariant={isDark ? 'dark' : 'light'}
                style={{ alignSelf: 'center' }}
              />
            </View>
          )}

          <View
            style={[styles.rowDivider, { backgroundColor: colors.border }]}
          />

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
                { borderTopColor: colors.border, alignItems: 'center' },
              ]}
            >
              <DateTimePicker
                mode='time'
                value={time}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, t) => {
                  if (t) setTime(t)
                  if (Platform.OS !== 'ios') togglePicker(null)
                }}
                themeVariant={isDark ? 'dark' : 'light'}
                style={{ width: 200 }}
              />
            </View>
          )}

          <View
            style={[styles.rowDivider, { backgroundColor: colors.border }]}
          />

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
              style={[styles.pickerInline, { borderTopColor: colors.border }]}
            >
              {/* Stepper */}
              <View style={styles.durationStepper}>
                <TouchableOpacity
                  style={[
                    styles.stepBtn,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                      opacity: duration <= DURATION_MIN ? 0.4 : 1,
                    },
                  ]}
                  onPress={() =>
                    setDuration((d) => Math.max(DURATION_MIN, d - DURATION_STEP))
                  }
                  disabled={duration <= DURATION_MIN}
                >
                  <Ionicons name='remove' size={20} color={colors.text} />
                </TouchableOpacity>
                <Text
                  style={[
                    typography.h2,
                    { color: colors.text, minWidth: 100, textAlign: 'center' },
                  ]}
                >
                  {formatDuration(duration)}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.stepBtn,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                      opacity: duration >= DURATION_MAX ? 0.4 : 1,
                    },
                  ]}
                  onPress={() =>
                    setDuration((d) => Math.min(DURATION_MAX, d + DURATION_STEP))
                  }
                  disabled={duration >= DURATION_MAX}
                >
                  <Ionicons name='add' size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
              {/* Quick-pick chips */}
              <View style={styles.durationChips}>
                {[30, 60, 90, 120, 180, 240].map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.chip,
                      { borderColor: colors.border },
                      opt === duration && {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      },
                    ]}
                    onPress={() => setDuration(opt)}
                  >
                    <Text
                      style={[
                        typography.caption,
                        {
                          fontWeight: '600',
                          color:
                            opt === duration
                              ? colors.white
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      {formatDuration(opt)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Visibility */}
        <SectionLabel title='Visibility' colors={colors} />
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.label, { color: colors.text }]}>
                Public
              </Text>
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

        {/* Participants */}
        <SectionLabel title='Participants' colors={colors} />
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.label, { color: colors.text }]}>
                Unlimited spots
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                No cap on participants
              </Text>
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
              <View
                style={[
                  styles.rowDivider,
                  { backgroundColor: colors.border, marginVertical: spacing.md },
                ]}
              />
              <Input
                label='Max participants'
                placeholder='e.g. 10'
                value={maxParticipants}
                onChangeText={(t) => setMaxParticipants(t.replace(/[^0-9]/g, ''))}
                keyboardType='number-pad'
              />
            </>
          )}
        </View>

        {/* ── Save button (inside scroll, at the bottom) ── */}
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
          {!canSave && (
            <Text
              style={[
                typography.caption,
                {
                  color: colors.textMuted,
                  textAlign: 'center',
                  marginTop: spacing.xs,
                },
              ]}
            >
              Add a title to continue
            </Text>
          )}
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
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  scroll: {
    padding: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
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
  // Picker group (date / time / duration)
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
  // Duration stepper
  durationStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
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
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
})
