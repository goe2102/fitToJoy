import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '@/hooks/useColors'
import { spacing, typography, radius } from '../../src/constants/theme'
import { imageService } from '@/services/imageService'
import { Input } from '../../src/components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingSlideData {
  id: string
  key: string
  title: string
  subtitle: string
  emoji: string
  render: (
    value: unknown,
    onChange: (val: unknown) => void,
    extraState?: any
  ) => React.ReactNode
}

// ─── Profile Pic Upload ───────────────────────────────────────────────────────

function ProfilePicUpload({
  value,
  onChange,
}: {
  value: string | null
  onChange: (base64: string, uri: string) => void
}) {
  const colors = useColors()

  const handlePickImage = async () => {
    const image = await imageService.pickImage([1, 1])
    if (image?.base64) onChange(image.base64, image.uri)
  }

  return (
    <View style={picStyles.container}>
      <TouchableOpacity activeOpacity={0.8} onPress={handlePickImage} style={picStyles.wrapper}>
        {value ? (
          <Image source={{ uri: value }} style={picStyles.image} contentFit='cover' />
        ) : (
          <View style={[picStyles.placeholder, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name='person-outline' size={44} color={colors.textMuted} />
          </View>
        )}
        <View style={[picStyles.badge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
          <Ionicons name='camera' size={14} color='#fff' />
        </View>
      </TouchableOpacity>
      <Text style={[picStyles.hint, { color: colors.textMuted }]}>
        Tap to choose a photo
      </Text>
    </View>
  )
}

const picStyles = StyleSheet.create({
  container: { alignItems: 'center', marginTop: spacing.lg },
  wrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 60,
  },
  badge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  hint: { ...typography.caption, marginTop: spacing.md },
})

// ─── Option Picker ────────────────────────────────────────────────────────────

function OptionPicker({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: { label: string; emoji?: string; value: string }[]
  value: string | string[]
  onChange: (v: string | string[]) => void
  multi?: boolean
}) {
  const colors = useColors()

  const isSelected = (v: string) =>
    multi ? (value as string[]).includes(v) : value === v

  const handlePress = (v: string) => {
    if (multi) {
      const arr = value as string[]
      onChange(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
    } else {
      onChange(v)
    }
  }

  return (
    <View style={pickerStyles.grid}>
      {options.map((opt) => {
        const selected = isSelected(opt.value)
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              pickerStyles.option,
              {
                backgroundColor: selected ? colors.primary + '18' : colors.surface,
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}
            onPress={() => handlePress(opt.value)}
            activeOpacity={0.7}
          >
            {opt.emoji ? <Text style={pickerStyles.emoji}>{opt.emoji}</Text> : null}
            <Text style={[pickerStyles.label, { color: selected ? colors.primary : colors.textSecondary }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const pickerStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  option: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    minWidth: 100,
  },
  emoji: { fontSize: 24, marginBottom: 4 },
  label: { ...typography.label },
})

// ─── Birthday Input ───────────────────────────────────────────────────────────

function BirthdayInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const handleTextChange = (text: string) => {
    let cleaned = text.replace(/[^0-9]/g, '')
    if (cleaned.length > 8) cleaned = cleaned.slice(0, 8)
    let formatted = cleaned
    if (cleaned.length > 2) formatted = cleaned.slice(0, 2) + '.' + cleaned.slice(2)
    if (cleaned.length > 4) formatted = formatted.slice(0, 5) + '.' + cleaned.slice(4)
    onChange(formatted)
  }

  return (
    <View style={{ width: '100%', marginTop: spacing.md }}>
      <Input
        placeholder='DD.MM.YYYY'
        value={value}
        onChangeText={handleTextChange}
        keyboardType='number-pad'
      />
    </View>
  )
}

// ─── Username Slide Content ───────────────────────────────────────────────────

function UsernameSlide({
  value,
  onChange,
  status,
}: {
  value: string
  onChange: (v: unknown) => void
  status: string
}) {
  const colors = useColors()
  return (
    <View style={{ width: '100%', marginTop: spacing.md }}>
      <Input
        placeholder='@username'
        value={value}
        onChangeText={onChange}
        autoCapitalize='none'
      />
      {status === 'checking' && (
        <Text style={[statusStyles.hint, { color: colors.textMuted }]}>Checking…</Text>
      )}
      {status === 'invalid' && (
        <Text style={[statusStyles.hint, { color: colors.error }]}>At least 3 characters.</Text>
      )}
      {status === 'taken' && (
        <Text style={[statusStyles.hint, { color: colors.error }]}>Username already taken.</Text>
      )}
      {status === 'available' && (
        <Text style={[statusStyles.hint, { color: colors.primary }]}>✓ Available</Text>
      )}
    </View>
  )
}

const statusStyles = StyleSheet.create({
  hint: { ...typography.caption, marginTop: spacing.xs, textAlign: 'center' },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

// ─── Slides Array ─────────────────────────────────────────────────────────────

export const ONBOARDING_SLIDES: OnboardingSlideData[] = [
  {
    id: 'username',
    key: 'username',
    title: 'Choose a username',
    subtitle: 'This is how others will find you.',
    emoji: '👋',
    render: (value, onChange, extraState) => (
      <UsernameSlide
        value={asString(value)}
        onChange={onChange}
        status={extraState?.usernameStatus ?? 'idle'}
      />
    ),
  },
  {
    id: 'birthday',
    key: 'birthday',
    title: "When's your birthday?",
    subtitle: "We'll tailor your experience to your age.",
    emoji: '🎂',
    render: (value, onChange) => (
      <BirthdayInput value={asString(value)} onChange={onChange} />
    ),
  },
  {
    id: 'avatar',
    key: 'avatar',
    title: 'Add a profile photo',
    subtitle: 'Put a face to your fitness journey. (Optional)',
    emoji: '📸',
    render: (value, onChange) => {
      const valObj = value as { base64: string; uri: string } | undefined
      return (
        <ProfilePicUpload
          value={valObj?.uri || null}
          onChange={(base64, uri) => onChange({ base64, uri })}
        />
      )
    },
  },
]
