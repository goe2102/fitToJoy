import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { Button, Input, OtpInput } from '@/components/ui'
import { radius, spacing, typography } from '@/constants/theme'

// ─── Forgot Password Modal (3-step OTP flow) ─────────────────────────────────

type FPStep = 'email' | 'code' | 'password' | 'done'

function ForgotPasswordModal({
  visible,
  onClose,
}: {
  visible: boolean
  onClose: () => void
}) {
  const colors = useColors()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { sendPasswordReset, verifyPasswordReset, updatePassword } = useAuth()

  const [step, setStep] = useState<FPStep>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setStep('email')
    setEmail('')
    setCode('')
    setPassword('')
    setConfirm('')
    setError('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSendCode = async () => {
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setError(t('auth.forgotPassword.invalidEmail'))
      return
    }
    setError('')
    setLoading(true)
    const { error: err } = await sendPasswordReset(email.trim().toLowerCase())
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    setStep('code')
  }

  const handleVerifyCode = async () => {
    if (code.length < 8) {
      setError(t('auth.forgotPassword.enterFullCode'))
      return
    }
    setError('')
    setLoading(true)
    const { error: err } = await verifyPasswordReset(
      email.trim().toLowerCase(),
      code
    )
    setLoading(false)
    if (err) {
      setError(t('auth.forgotPassword.invalidCode'))
      setCode('')
      return
    }
    setStep('password')
  }

  const handleUpdatePassword = async () => {
    if (password.length < 8) {
      setError(t('auth.forgotPassword.passwordTooShort'))
      return
    }
    if (password !== confirm) {
      setError(t('auth.forgotPassword.passwordMismatch'))
      return
    }
    setError('')
    setLoading(true)
    const { error: err } = await updatePassword(password)
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    setStep('done')
  }

  const stepTitle: Record<FPStep, string> = {
    email: t('auth.forgotPassword.title'),
    code: t('auth.forgotPassword.enterCodeTitle'),
    password: t('auth.forgotPassword.newPasswordTitle'),
    done: t('auth.forgotPassword.allDoneTitle'),
  }

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
      onRequestClose={handleClose}
    >
      <SafeAreaView
        style={[{ flex: 1, backgroundColor: colors.background }]}
        edges={['top']}
      >
        {/* Header */}
        <View style={[fpStyles.header, { borderBottomColor: colors.border }]}>
          <Text style={[typography.h3, { color: colors.text }]}>
            {stepTitle[step]}
          </Text>
          <TouchableOpacity onPress={handleClose} hitSlop={12}>
            <Ionicons name='close' size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View
          style={[fpStyles.body, { paddingBottom: insets.bottom + spacing.xl }]}
        >
          {/* Step 1 — email */}
          {step === 'email' && (
            <>
              <Text
                style={[
                  typography.body,
                  {
                    color: colors.textSecondary,
                    marginBottom: spacing.lg,
                    lineHeight: 22,
                  },
                ]}
              >
                {t('auth.forgotPassword.emailInstruction')}
              </Text>
              <Input
                label={t('auth.forgotPassword.emailLabel')}
                placeholder={t('auth.forgotPassword.emailPlaceholder')}
                value={email}
                onChangeText={(v) => {
                  setEmail(v)
                  setError('')
                }}
                keyboardType='email-address'
                autoCapitalize='none'
                autoFocus
                error={error || undefined}
              />
              <Button
                title={t('auth.forgotPassword.sendCode')}
                onPress={handleSendCode}
                loading={loading}
                style={{ marginTop: spacing.lg }}
              />
            </>
          )}

          {/* Step 2 — OTP code */}
          {step === 'code' && (
            <>
              <Text
                style={[
                  typography.body,
                  {
                    color: colors.textSecondary,
                    marginBottom: spacing.lg,
                    lineHeight: 22,
                  },
                ]}
              >
                {t('auth.forgotPassword.codeSentTo')}{' '}
                <Text style={{ color: colors.primary, fontWeight: '600' }}>
                  {email}
                </Text>
                {t('auth.forgotPassword.enterBelow')}
              </Text>
              <OtpInput
                value={code}
                onChange={(v) => {
                  setCode(v)
                  setError('')
                }}
                length={8}
              />
              {error ? (
                <Text
                  style={[
                    typography.bodySmall,
                    {
                      color: colors.error,
                      textAlign: 'center',
                      marginTop: spacing.sm,
                    },
                  ]}
                >
                  {error}
                </Text>
              ) : null}
              <Button
                title={t('auth.forgotPassword.verifyCode')}
                onPress={handleVerifyCode}
                loading={loading}
                disabled={code.length < 8}
                style={{ marginTop: spacing.lg }}
              />
              <TouchableOpacity
                style={fpStyles.resend}
                onPress={() => {
                  setStep('email')
                  setCode('')
                  setError('')
                }}
              >
                <Text
                  style={[
                    typography.bodySmall,
                    { color: colors.primary, fontWeight: '600' },
                  ]}
                >
                  {t('auth.forgotPassword.wrongEmail')}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Step 3 — new password */}
          {step === 'password' && (
            <>
              <Text
                style={[
                  typography.body,
                  { color: colors.textSecondary, marginBottom: spacing.lg },
                ]}
              >
                {t('auth.forgotPassword.chooseNewPassword')}
              </Text>
              <Input
                label={t('auth.forgotPassword.newPasswordLabel')}
                placeholder={t('auth.forgotPassword.newPasswordPlaceholder')}
                value={password}
                onChangeText={(v) => {
                  setPassword(v)
                  setError('')
                }}
                secureTextEntry
                autoFocus
              />
              <View style={{ height: spacing.md }} />
              <Input
                label={t('auth.forgotPassword.confirmPasswordLabel')}
                placeholder={t('auth.forgotPassword.confirmPasswordPlaceholder')}
                value={confirm}
                onChangeText={(v) => {
                  setConfirm(v)
                  setError('')
                }}
                secureTextEntry
                error={error || undefined}
              />
              <Button
                title={t('auth.forgotPassword.updatePassword')}
                onPress={handleUpdatePassword}
                loading={loading}
                disabled={!password || !confirm}
                style={{ marginTop: spacing.lg }}
              />
            </>
          )}

          {/* Step 4 — success */}
          {step === 'done' && (
            <View style={fpStyles.successContainer}>
              <View
                style={[
                  fpStyles.successIcon,
                  {
                    backgroundColor: colors.primary + '20',
                    borderColor: colors.primary + '40',
                  },
                ]}
              >
                <Ionicons name='checkmark' size={40} color={colors.primary} />
              </View>
              <Text
                style={[
                  typography.h3,
                  {
                    color: colors.text,
                    textAlign: 'center',
                    marginBottom: spacing.sm,
                  },
                ]}
              >
                {t('auth.forgotPassword.successTitle')}
              </Text>
              <Text
                style={[
                  typography.body,
                  { color: colors.textSecondary, textAlign: 'center' },
                ]}
              >
                {t('auth.forgotPassword.successSubtitle')}
              </Text>
              <Button
                title={t('auth.forgotPassword.signIn')}
                onPress={handleClose}
                style={{ marginTop: spacing.xl, width: '100%' }}
              />
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const fpStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  body: { flex: 1, padding: spacing.lg },
  resend: { alignItems: 'center', marginTop: spacing.md },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
})

// ─── Login Screen ─────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const colors = useColors()
  const { t } = useTranslation()
  const { signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotVisible, setForgotVisible] = useState(false)

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError(t('auth.login.fillAllFields'))
      return
    }
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email.trim().toLowerCase(), password)
    setLoading(false)
    if (err) setError(err.message)
  }

  const s = makeStyles(colors)

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps='handled'
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={s.logoSection}>
          <View style={s.logoCircle}>
            <Ionicons name='barbell-outline' size={36} color={colors.primary} />
          </View>
          <Text style={s.appName}>
            fit<Text style={{ color: colors.primary }}>ToJoy</Text>
          </Text>
          <Text style={s.tagline}>{t('auth.login.tagline')}</Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          <Input
            label={t('auth.login.emailLabel')}
            placeholder={t('auth.login.emailPlaceholder')}
            value={email}
            onChangeText={(v) => {
              setEmail(v)
              setError('')
            }}
            keyboardType='email-address'
            autoCapitalize='none'
          />

          <Input
            label={t('auth.login.passwordLabel')}
            placeholder={t('auth.login.passwordPlaceholder')}
            value={password}
            onChangeText={(v) => {
              setPassword(v)
              setError('')
            }}
            secureTextEntry
          />

          {/* Forgot password link */}
          <TouchableOpacity
            style={s.forgotRow}
            onPress={() => setForgotVisible(true)}
          >
            <Text style={s.forgotText}>{t('auth.login.forgotPassword')}</Text>
          </TouchableOpacity>

          {error ? <Text style={s.errorText}>{error}</Text> : null}

          <Button title={t('auth.login.signIn')} onPress={handleLogin} loading={loading} />
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>{t('auth.login.noAccount')}</Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/signup')}>
            <Text style={s.footerLink}>{t('auth.login.createOne')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ForgotPasswordModal
        visible={forgotVisible}
        onClose={() => setForgotVisible(false)}
      />
    </SafeAreaView>
  )
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xl,
    },
    logoSection: {
      alignItems: 'center',
      marginBottom: spacing.xxxl,
      marginTop: spacing.lg,
    },
    logoCircle: {
      width: 80,
      height: 80,
      borderRadius: radius.full,
      backgroundColor: colors.primary + '18',
      borderWidth: 1.5,
      borderColor: colors.primary + '40',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    appName: {
      ...typography.h2,
      color: colors.text,
      letterSpacing: -0.5,
    },
    tagline: {
      ...typography.body,
      color: colors.textMuted,
      marginTop: 4,
    },
    form: { gap: spacing.md, marginBottom: spacing.lg },
    forgotRow: { alignSelf: 'flex-end', marginTop: -spacing.xs },
    forgotText: {
      ...typography.bodySmall,
      color: colors.primary,
      fontWeight: '600',
    },
    errorText: {
      ...typography.bodySmall,
      color: colors.error,
      textAlign: 'center',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 'auto',
      paddingTop: spacing.xl,
    },
    footerText: { ...typography.body, color: colors.textSecondary },
    footerLink: {
      ...typography.body,
      color: colors.primary,
      fontWeight: '700',
    },
  })
}
