import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { colors, spacing, typography, radius } from '../../src/constants/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingSlideData {
  id: string
  key: string
  title: string
  subtitle: string
  emoji: string
  render: (value: unknown, onChange: (val: unknown) => void) => React.ReactNode
}

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

// ─── Helper: safely cast unknown to the type OptionPicker expects ─────────────

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : []
}

// ─── Slides Array ─────────────────────────────────────────────────────────────
// ✅ TO ADD A NEW SLIDE: push a new object here. Slider updates automatically.

export const ONBOARDING_SLIDES: OnboardingSlideData[] = [
  {
    id: 'welcome',
    key: 'name',
    title: 'Wie heißt du?',
    subtitle: 'Wir personalisieren dein Training für dich.',
    emoji: '👋',
    render: (value, onChange) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Input } = require('../../src/components/ui')
      return (
        <Input
          placeholder='Dein Name'
          value={asString(value)}
          onChangeText={onChange}
          autoCapitalize='words'
          style={{ marginTop: spacing.md }}
        />
      )
    },
  },
  {
    id: 'goal',
    key: 'goal',
    title: 'Was ist dein Ziel?',
    subtitle: 'Wähle das Ziel, das am besten zu dir passt.',
    emoji: '🎯',
    render: (value, onChange) => (
      <OptionPicker
        value={asString(value)}
        onChange={onChange as (v: string | string[]) => void}
        options={[
          { label: 'Abnehmen', emoji: '🔥', value: 'weight_loss' },
          { label: 'Muskelaufbau', emoji: '💪', value: 'muscle_gain' },
          { label: 'Ausdauer', emoji: '🏃', value: 'endurance' },
          { label: 'Flexibilität', emoji: '🧘', value: 'flexibility' },
          { label: 'Gesundheit', emoji: '❤️', value: 'health' },
          { label: 'Spaß', emoji: '😄', value: 'fun' },
        ]}
      />
    ),
  },
  {
    id: 'level',
    key: 'fitnessLevel',
    title: 'Dein Fitnesslevel?',
    subtitle: 'Damit wir dein Training richtig anpassen können.',
    emoji: '📊',
    render: (value, onChange) => (
      <OptionPicker
        value={asString(value)}
        onChange={onChange as (v: string | string[]) => void}
        options={[
          { label: 'Anfänger', emoji: '🌱', value: 'beginner' },
          { label: 'Mittel', emoji: '⚡', value: 'intermediate' },
          { label: 'Fortgeschritten', emoji: '🚀', value: 'advanced' },
        ]}
      />
    ),
  },
  {
    id: 'frequency',
    key: 'weeklyWorkouts',
    title: 'Trainings pro Woche?',
    subtitle: 'Wie oft möchtest du trainieren?',
    emoji: '📅',
    render: (value, onChange) => (
      <OptionPicker
        value={asString(value)}
        onChange={(v) => onChange(parseInt(v as string, 10))}
        options={[
          { label: '1–2×', value: '1' },
          { label: '3–4×', value: '3' },
          { label: '5–6×', value: '5' },
          { label: 'Täglich', value: '7' },
        ]}
      />
    ),
  },
  {
    id: 'focus',
    key: 'focusAreas',
    title: 'Fokus-Bereiche?',
    subtitle: 'Mehrfachauswahl möglich.',
    emoji: '🎨',
    render: (value, onChange) => (
      <OptionPicker
        value={asStringArray(value)}
        onChange={onChange as (v: string | string[]) => void}
        multi
        options={[
          { label: 'Brust', emoji: '🫁', value: 'chest' },
          { label: 'Rücken', emoji: '🦾', value: 'back' },
          { label: 'Beine', emoji: '🦵', value: 'legs' },
          { label: 'Schultern', emoji: '💆', value: 'shoulders' },
          { label: 'Arme', emoji: '💪', value: 'arms' },
          { label: 'Core', emoji: '🔥', value: 'core' },
          { label: 'Cardio', emoji: '🏃', value: 'cardio' },
          { label: 'Ganzkörper', emoji: '✨', value: 'full_body' },
        ]}
      />
    ),
  },
]
