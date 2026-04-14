import { radius, spacing, typography, type AppColors } from '@/constants/theme'
import { useColors } from '@/hooks/useColors'
import { Ionicons } from '@expo/vector-icons'
import React, { useMemo, useState } from 'react'
import {
  TouchableOpacity,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'

// ─── Button ───────────────────────────────────────────────────────────────────

interface ButtonProps {
  title: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  style?: ViewStyle
  fullWidth?: boolean
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  size = 'md',
  style,
  fullWidth = true,
}: ButtonProps) {
  const colors = useColors()
  const styles = useMemo(() => makeButtonStyles(colors), [colors])

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.button,
        styles[`button_${size}`],
        styles[`button_${variant}`],
        (disabled || loading) && styles.button_disabled,
        !fullWidth && styles.button_auto,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? colors.white : colors.primary}
          size='small'
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            styles[`buttonText_${variant}`],
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  )
}

function makeButtonStyles(colors: AppColors) {
  return StyleSheet.create({
    button: {
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    button_auto: { alignSelf: 'flex-start' },
    button_sm: { height: 38, paddingHorizontal: spacing.md },
    button_md: { height: 50 },
    button_lg: { height: 58 },
    button_primary: { backgroundColor: colors.primary },
    button_outline: {
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: 'transparent',
    },
    button_ghost: { backgroundColor: 'transparent' },
    button_danger: { backgroundColor: colors.error },
    button_disabled: { opacity: 0.45 },
    buttonText: { ...typography.button },
    buttonText_primary: { color: colors.white },
    buttonText_outline: { color: colors.primary },
    buttonText_ghost: { color: colors.textSecondary },
    buttonText_danger: { color: colors.white },
  })
}

// ─── Input ────────────────────────────────────────────────────────────────────

interface InputProps {
  label?: string
  placeholder?: string
  value: string
  onChangeText: (text: string) => void
  secureTextEntry?: boolean
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'number-pad'
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  error?: string
  hint?: string
  editable?: boolean
  style?: ViewStyle
  autoFocus?: boolean
  rightElement?: React.ReactNode
  multiline?: boolean
  numberOfLines?: number
}

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  error,
  hint,
  editable = true,
  style,
  autoFocus,
  rightElement,
  multiline,
  numberOfLines,
}: InputProps) {
  const colors = useColors()
  const styles = useMemo(() => makeInputStyles(colors), [colors])
  const [isFocused, setIsFocused] = useState(false)

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <TextInput
          style={[
            styles.input,
            isFocused && styles.input_focused,
            error && styles.input_error,
            !editable && styles.input_disabled,
            !!rightElement && styles.input_withRight,
            multiline && styles.input_multiline,
          ]}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          autoFocus={autoFocus}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          multiline={multiline}
          numberOfLines={numberOfLines}
        />
        {rightElement ? (
          <View style={styles.rightElement}>{rightElement}</View>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  )
}

function makeInputStyles(colors: AppColors) {
  return StyleSheet.create({
    wrapper: { width: '100%' },
    label: {
      ...typography.label,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    row: { flexDirection: 'row', alignItems: 'center' },
    input: {
      flex: 1,
      height: 50,
      paddingHorizontal: spacing.md,
      paddingVertical: 0,
      paddingTop: 0,
      paddingBottom: 0,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.md,
      ...typography.body,
      lineHeight: undefined,
      color: colors.text,
      textAlignVertical: 'center',
    },
    input_focused: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceElevated,
    },
    input_error: { borderColor: colors.error },
    input_disabled: { opacity: 0.5, backgroundColor: colors.border },
    input_withRight: { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
    input_multiline: {
      height: undefined,
      minHeight: 100,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      textAlignVertical: 'top',
    },
    rightElement: {
      height: 50,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1.5,
      borderLeftWidth: 0,
      borderColor: colors.border,
      borderTopRightRadius: radius.md,
      borderBottomRightRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorText: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
    hintText: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  })
}

// ─── OTP Input ────────────────────────────────────────────────────────────────

interface OtpInputProps {
  value: string
  onChange: (val: string) => void
  length?: number
}

export function OtpInput({ value, onChange, length = 8 }: OtpInputProps) {
  const colors = useColors()
  const styles = useMemo(() => makeOtpStyles(colors), [colors])
  const digits = value.split('')

  return (
    <View style={styles.container}>
      {Array.from({ length }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.box,
            digits[i] ? styles.box_filled : styles.box_empty,
          ]}
        >
          <Text style={styles.digit}>{digits[i] || ''}</Text>
        </View>
      ))}
      <TextInput
        style={styles.hiddenInput}
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9]/g, '').slice(0, length))}
        keyboardType='number-pad'
        maxLength={length}
        autoFocus
        caretHidden
      />
    </View>
  )
}

function makeOtpStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      gap: spacing.sm,
      position: 'relative',
    },
    box: {
      flex: 1,
      height: 56,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
    },
    box_empty: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    box_filled: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primary,
    },
    digit: { ...typography.h3, color: colors.text },
    hiddenInput: { ...StyleSheet.absoluteFillObject, opacity: 0 },
  })
}

// ─── Badge ────────────────────────────────────────────────────────────────────

interface BadgeProps {
  label: string
  variant?: 'primary' | 'success' | 'error' | 'warning' | 'neutral'
  style?: ViewStyle
}

export function Badge({ label, variant = 'neutral', style }: BadgeProps) {
  const colors = useColors()
  const styles = useMemo(() => makeBadgeStyles(colors), [colors])

  return (
    <View style={[styles.badge, styles[`badge_${variant}`], style]}>
      <Text style={[styles.badgeText, styles[`badgeText_${variant}`]]}>{label}</Text>
    </View>
  )
}

function makeBadgeStyles(colors: AppColors) {
  return StyleSheet.create({
    badge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.full,
      alignSelf: 'flex-start',
    },
    badge_neutral: { backgroundColor: colors.border },
    badge_primary: { backgroundColor: colors.primary + '22' },
    badge_success: { backgroundColor: colors.success + '22' },
    badge_error: { backgroundColor: colors.error + '22' },
    badge_warning: { backgroundColor: colors.warning + '22' },
    badgeText: { ...typography.caption, fontWeight: '600' as const },
    badgeText_neutral: { color: colors.textSecondary },
    badgeText_primary: { color: colors.primary },
    badgeText_success: { color: colors.success },
    badgeText_error: { color: colors.error },
    badgeText_warning: { color: colors.warning },
  })
}

// ─── Divider ──────────────────────────────────────────────────────────────────

export function Divider({ label }: { label?: string }) {
  const colors = useColors()
  if (!label) {
    return (
      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />
    )
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text style={{ ...typography.caption, color: colors.textMuted }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  )
}

// ─── ScreenHeader ─────────────────────────────────────────────────────────────

interface ScreenHeaderProps {
  title: string
  onBack?: () => void
  right?: React.ReactNode
}

export function ScreenHeader({ title, onBack, right }: ScreenHeaderProps) {
  const colors = useColors()
  const styles = useMemo(() => makeScreenHeaderStyles(colors), [colors])

  return (
    <View style={styles.container}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <Ionicons name='chevron-back' size={24} color={colors.text} />
        </TouchableOpacity>
      ) : null}
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  )
}

function makeScreenHeaderStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    backBtn: {
      width: 32,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.xs,
    },
    title: {
      ...typography.h2,
      color: colors.text,
      flex: 1,
    },
    right: {
      marginLeft: spacing.sm,
    },
  })
}

// ─── ModalHeader ──────────────────────────────────────────────────────────────

interface ModalHeaderProps {
  title: string
  onClose: () => void
}

export function ModalHeader({ title, onClose }: ModalHeaderProps) {
  const colors = useColors()
  const styles = useMemo(() => makeModalHeaderStyles(colors), [colors])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
        <Ionicons name='close' size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  )
}

function makeModalHeaderStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: { ...typography.h3, color: colors.text },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}

// ─── SearchBar ────────────────────────────────────────────────────────────────

interface SearchBarProps {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  style?: ViewStyle
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoFocus?: boolean
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search…',
  style,
  autoCapitalize = 'none',
  autoFocus,
}: SearchBarProps) {
  const colors = useColors()
  const [focused, setFocused] = useState(false)
  const styles = useMemo(() => makeSearchBarStyles(colors), [colors])

  return (
    <View style={[styles.container, focused && styles.container_focused, style]}>
      <Ionicons name='search' size={16} color={focused ? colors.primary : colors.textMuted} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        autoFocus={autoFocus}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8}>
          <Ionicons name='close-circle' size={16} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  )
}

function makeSearchBarStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      height: 44,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
    },
    container_focused: {
      borderColor: colors.primary,
    },
    input: {
      flex: 1,
      fontSize: typography.body.fontSize,
      fontWeight: typography.body.fontWeight,
      color: colors.text,
      padding: 0,
      height: '100%',
      textAlignVertical: 'center' as const,
      includeFontPadding: false,
    },
  })
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

interface SectionLabelProps {
  title: string
  style?: TextStyle
}

export function SectionLabel({ title, style }: SectionLabelProps) {
  const colors = useColors()
  return (
    <Text
      style={[
        {
          ...typography.caption,
          fontWeight: '700' as const,
          letterSpacing: 0.8,
          color: colors.textMuted,
          marginTop: spacing.md,
          marginBottom: spacing.xs,
          marginLeft: 4,
        },
        style,
      ]}
    >
      {title.toUpperCase()}
    </Text>
  )
}
