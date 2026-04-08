import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../src/context/AuthContext'
import { Button, OtpInput } from '../../src/components/ui'
import { colors, spacing, typography, radius } from '@/constants/theme'

const RESEND_COOLDOWN = 60

export default function VerifyScreen() {
  const { email } = useLocalSearchParams<{ email: string }>()
  const { verifyOtp, resendOtp } = useAuth()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)
  const [resending, setResending] = useState(false)

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleVerify = async () => {
    if (code.length < 6) {
      setError('Bitte gib den vollständigen 6-stelligen Code ein.')
      return
    }
    setError('')
    setLoading(true)
    const { error } = await verifyOtp(email!, code)
    setLoading(false)
    if (error) {
      setError('Ungültiger oder abgelaufener Code. Bitte erneut versuchen.')
      setCode('')
    }
    // On success: RouteGuard will navigate to onboarding automatically
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Back */}
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Zurück</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>✉️</Text>
          </View>
          <Text style={styles.title}>Code eingeben</Text>
          <Text style={styles.subtitle}>
            Wir haben einen 6-stelligen Code an{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
            {'\n'}geschickt.
          </Text>
        </View>

        {/* OTP */}
        <View style={styles.otpWrapper}>
          <OtpInput value={code} onChange={setCode} length={6} />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Verify button */}
        <Button
          title='Bestätigen'
          onPress={handleVerify}
          loading={loading}
          disabled={code.length < 6}
          style={styles.button}
        />

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={styles.resendText}>Kein Code erhalten? </Text>
          <TouchableOpacity
            onPress={handleResend}
            disabled={cooldown > 0 || resending}
          >
            <Text
              style={[styles.resendLink, cooldown > 0 && styles.resendDisabled]}
            >
              {cooldown > 0 ? `Erneut senden (${cooldown}s)` : 'Erneut senden'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  back: { marginBottom: spacing.xl },
  backText: { ...typography.body, color: colors.textSecondary },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  icon: { fontSize: 32 },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  emailHighlight: {
    color: colors.primary,
    fontWeight: '600',
  },
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
