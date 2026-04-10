import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { Button, OtpInput } from '@/components/ui'
import { radius, spacing, typography } from '@/constants/theme'

const RESEND_COOLDOWN = 60

export default function VerifyScreen() {
  const colors = useColors()
  const { email } = useLocalSearchParams<{ email: string }>()
  const { verifyOtp, resendOtp } = useAuth()

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleVerify = async () => {
    if (code.length < 8) {
      setError('Please enter the full 8-digit code.')
      return
    }
    setError('')
    setLoading(true)
    const { error: err } = await verifyOtp(email!, code)
    setLoading(false)
    if (err) {
      setError('Invalid or expired code. Please try again.')
      setCode('')
    }
    // On success RouteGuard handles navigation to onboarding
  }

  const handleResend = async () => {
    if (cooldown > 0 || !email) return
    setResending(true)
    await resendOtp(email)
    setResending(false)
    setCooldown(RESEND_COOLDOWN)
    setError('')
    setCode('')
  }

  const s = makeStyles(colors)

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.container}>
        {/* Back */}
        <TouchableOpacity style={s.back} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name='arrow-back' size={22} color={colors.text} />
        </TouchableOpacity>

        {/* Header */}
        <View style={s.header}>
          <View style={s.iconCircle}>
            <Ionicons name='mail-outline' size={36} color={colors.primary} />
          </View>
          <Text style={s.title}>Check your email</Text>
          <Text style={s.subtitle}>
            We sent an 8-digit code to{'\n'}
            <Text style={s.emailHighlight}>{email}</Text>
          </Text>
        </View>

        {/* OTP */}
        <View style={s.otpWrapper}>
          <OtpInput value={code} onChange={setCode} length={8} />
        </View>

        {error ? <Text style={s.errorText}>{error}</Text> : null}

        <Button
          title='Verify'
          onPress={handleVerify}
          loading={loading}
          disabled={code.length < 8}
          style={s.button}
        />

        {/* Resend */}
        <View style={s.resendRow}>
          <Text style={s.resendText}>Didn't receive it? </Text>
          <TouchableOpacity onPress={handleResend} disabled={cooldown > 0 || resending}>
            <Text style={[s.resendLink, cooldown > 0 && s.resendDisabled]}>
              {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    back: { marginBottom: spacing.lg },
    header: { alignItems: 'center', marginBottom: spacing.xxl },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: radius.full,
      backgroundColor: colors.primary + '18',
      borderWidth: 1.5,
      borderColor: colors.primary + '40',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    title: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    emailHighlight: { color: colors.primary, fontWeight: '600' },
    otpWrapper: { marginBottom: spacing.lg },
    errorText: {
      ...typography.bodySmall,
      color: colors.error,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    button: { marginBottom: spacing.lg },
    resendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    resendText: { ...typography.body, color: colors.textSecondary },
    resendLink: { ...typography.body, color: colors.primary, fontWeight: '700' },
    resendDisabled: { color: colors.textMuted },
  })
}
