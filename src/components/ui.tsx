import { colors, radius, spacing, typography } from '@/constants/theme'
import React, { useState } from 'react'
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
  variant?: 'primary' | 'outline' | 'ghost'
  style?: ViewStyle
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  style,
}: ButtonProps) {
  const isPrimary = variant === 'primary'
  const isOutline = variant === 'outline'

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.button,
        isPrimary && styles.buttonPrimary,
        isOutline && styles.buttonOutline,
        variant === 'ghost' && styles.buttonGhost,
        (disabled || loading) && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={isPrimary ? colors.white : colors.primary}
          size='small'
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            isPrimary && styles.buttonTextPrimary,
            isOutline && styles.buttonTextOutline,
            variant === 'ghost' && styles.buttonTextGhost,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  )
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
  editable?: boolean
  style?: ViewStyle
  autoFocus?: boolean
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
  editable = true,
  style,
  autoFocus,
}: InputProps) {
  // Track focus state to change border color
  const [isFocused, setIsFocused] = useState(false)

  return (
    <View style={[styles.inputWrapper, style]}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        style={[
          styles.input,
          isFocused && styles.inputFocused, // Apply active border when focused
          error && styles.inputError,
          !editable && styles.inputDisabled,
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
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  )
}

// ─── OTP Input ────────────────────────────────────────────────────────────────

interface OtpInputProps {
  value: string
  onChange: (val: string) => void
  length?: number
}

export function OtpInput({ value, onChange, length = 8 }: OtpInputProps) {
  const digits = value.split('')

  return (
    <View style={styles.otpContainer}>
      {Array.from({ length }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.otpBox,
            digits[i] ? styles.otpBoxFilled : styles.otpBoxEmpty,
          ]}
        >
          <Text style={styles.otpDigit}>{digits[i] || ''}</Text>
        </View>
      ))}
      {/* Hidden real input covering the boxes */}
      <TextInput
        style={styles.otpHiddenInput}
        value={value}
        onChangeText={(t) =>
          onChange(t.replace(/[^0-9]/g, '').slice(0, length))
        }
        keyboardType='number-pad'
        maxLength={length}
        autoFocus
        caretHidden
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  button: {
    height: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonOutline: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...typography.button,
  },
  buttonTextPrimary: {
    color: colors.white,
  },
  buttonTextOutline: {
    color: colors.primary,
  },
  buttonTextGhost: {
    color: colors.textSecondary,
  },
  inputWrapper: {
    width: '100%',
  },
  inputLabel: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    height: 50,
    paddingHorizontal: spacing.md,

    // 1. FORCE reset all vertical paddings to 0
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,

    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,

    ...typography.body,

    // 2. OVERRIDE any lineHeight coming from typography.body
    lineHeight: undefined,

    color: colors.text,

    // 3. Keep Android's vertical align
    textAlignVertical: 'center',
  },
  inputFocused: {
    borderColor: colors.primary, // The primary colored border
    backgroundColor: colors.background, // Optional: slightly changes bg on focus
  },
  inputError: {
    borderColor: colors.error,
  },
  inputDisabled: {
    opacity: 0.5,
    backgroundColor: colors.border,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
  // OTP
  otpContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    position: 'relative',
  },
  otpBox: {
    flex: 1,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  otpBoxEmpty: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  otpBoxFilled: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
  },
  otpDigit: {
    ...typography.h3,
    color: colors.text,
  },
  otpHiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
})
