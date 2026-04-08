import React from 'react'
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native'
import { colors, spacing, typography, radius } from '../../src/constants/theme'
import { imageService } from '@/services/imageService'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingSlideData {
  id: string
  key: string
  title: string
  subtitle: string
  emoji: string
  // Added optional extraState so the slide can read validation statuses from index.tsx
  render: (
    value: unknown,
    onChange: (val: unknown) => void,
    extraState?: any
  ) => React.ReactNode
}

function ProfilePicUpload({
  value,
  onChange,
}: {
  value: string | null
  onChange: (base64: string, uri: string) => void
}) {
  const handlePickImage = async () => {
    const image = await imageService.pickImage([1, 1]) // Square crop
    if (image && image.base64) {
      onChange(image.base64, image.uri)
    }
  }

  return (
    <View style={picStyles.container}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handlePickImage}
        style={picStyles.imageWrapper}
      >
        {value ? (
          <Image source={{ uri: value }} style={picStyles.image} />
        ) : (
          <View style={picStyles.placeholder}>
            <Text style={{ fontSize: 40 }}>👤</Text>
          </View>
        )}
        <View style={picStyles.editBadge}>
          <Text style={{ fontSize: 16, color: 'white' }}>+</Text>
        </View>
      </TouchableOpacity>
      <Text style={picStyles.hint}>Tippe, um ein Bild zu wählen</Text>
    </View>
  )
}

const picStyles = StyleSheet.create({
  container: { alignItems: 'center', marginTop: spacing.lg },
  imageWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  image: { width: '100%', height: '100%', borderRadius: 60 },
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
})

// ─── Reusable Option Picker ───────────────────────────────────────────────────

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
    <View style={picker.grid}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[
            picker.option,
            isSelected(opt.value) && picker.optionSelected,
          ]}
          onPress={() => handlePress(opt.value)}
          activeOpacity={0.7}
        >
          {opt.emoji ? <Text style={picker.emoji}>{opt.emoji}</Text> : null}
          <Text
            style={[
              picker.label,
              isSelected(opt.value) && picker.labelSelected,
            ]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const picker = StyleSheet.create({
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
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    minWidth: 100,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDark + '33',
  },
  emoji: { fontSize: 24, marginBottom: 4 },
  label: { ...typography.label, color: colors.textSecondary },
  labelSelected: { color: colors.primary },
})

// ─── Reusable Auto-Formatting Birthday Picker ─────────────────────────────────

function BirthdayInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Input } = require('../../src/components/ui')

  const handleTextChange = (text: string) => {
    // 1. Strip all non-numeric characters
    let cleaned = text.replace(/[^0-9]/g, '')
    if (cleaned.length > 8) cleaned = cleaned.slice(0, 8)

    // 2. Format as TT.MM.JJJJ automatically while typing
    let formatted = cleaned
    if (cleaned.length > 2) {
      formatted = cleaned.slice(0, 2) + '.' + cleaned.slice(2)
    }
    if (cleaned.length > 4) {
      formatted = formatted.slice(0, 5) + '.' + cleaned.slice(4)
    }

    onChange(formatted)
  }

  return (
    <View style={{ width: '100%', marginTop: spacing.md }}>
      <Input
        placeholder='TT.MM.JJJJ'
        value={value}
        onChangeText={handleTextChange}
        keyboardType='number-pad'
        maxLength={10}
      />
    </View>
  )
}

// ─── Slide Local Styles ───────────────────────────────────────────────────────
const slideStyles = StyleSheet.create({
  hintText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  successText: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
})

// ─── Helper: safely cast unknown to the type OptionPicker expects ─────────────

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : []
}

// ─── Slides Array ─────────────────────────────────────────────────────────────

export const ONBOARDING_SLIDES: OnboardingSlideData[] = [
  {
    id: 'username',
    key: 'username',
    title: 'Wähle einen Benutzernamen',
    subtitle: 'Dieser Name ist einzigartig für dich.',
    emoji: '👋',
    render: (value, onChange, extraState) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Input } = require('../../src/components/ui')
      const status = extraState?.usernameStatus

      return (
        <View style={{ width: '100%', marginTop: spacing.md }}>
          <Input
            placeholder='@benutzername'
            value={asString(value)}
            onChangeText={onChange}
            autoCapitalize='none'
            autoCorrect={false}
          />
          {status === 'checking' && (
            <Text style={slideStyles.hintText}>Wird geprüft...</Text>
          )}
          {status === 'invalid' && (
            <Text style={slideStyles.errorText}>Mindestens 3 Zeichen.</Text>
          )}
          {status === 'taken' && (
            <Text style={slideStyles.errorText}>
              Benutzername ist bereits vergeben.
            </Text>
          )}
          {status === 'available' && (
            <Text style={slideStyles.successText}>Verfügbar!</Text>
          )}
        </View>
      )
    },
  },
  {
    id: 'birthday',
    key: 'birthday',
    title: 'Wann hast du Geburtstag?',
    subtitle: 'Wir passen dein Erlebnis an dein Alter an.',
    emoji: '🎂',
    render: (value, onChange) => (
      <BirthdayInput value={asString(value)} onChange={onChange} />
    ),
  },
  {
    id: 'avatar',
    key: 'avatar',
    title: 'Dein Profilbild',
    subtitle: 'Ein Gesicht zur Fitness-Reise. (Optional)',
    emoji: '📸',
    render: (value, onChange) => {
      // We store an object { base64, uri } so we can show the preview instantly, but upload the base64 later
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
