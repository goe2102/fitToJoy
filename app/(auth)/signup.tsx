import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { Button, Input } from '@/components/ui'
import { radius, spacing, typography } from '@/constants/theme'

export default function SignupScreen() {
  const colors = useColors()
  const { t } = useTranslation()
  const { signUp } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!email.trim()) e.email = t('auth.signup.emailLabel') + ' is required.'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = t('auth.signup.emailLabel') + ' invalid.'
    if (!password) e.password = t('auth.signup.passwordLabel') + ' is required.'
    else if (password.length < 8) e.password = t('auth.signup.passwordTooShort')
    if (password !== confirmPassword) e.confirm = t('auth.signup.passwordMismatch')
    return e
  }

  const handleSignup = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setErrors({})
    setLoading(true)
    const { error } = await signUp(email.trim().toLowerCase(), password)
    setLoading(false)
    if (error) {
      setErrors({ general: error.message })
    } else {
      router.push({ pathname: '/(auth)/verify', params: { email: email.trim().toLowerCase() } })
    }
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
        {/* Back */}
        <TouchableOpacity style={s.back} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name='arrow-back' size={22} color={colors.text} />
        </TouchableOpacity>

        {/* Header */}
        <View style={s.headerSection}>
          <View style={s.logoCircle}>
            <Ionicons name='barbell-outline' size={32} color={colors.primary} />
          </View>
          <Text style={s.title}>{t('auth.signup.title')}</Text>
          <Text style={s.subtitle}>{t('onboarding.getStarted')}</Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          <Input
            label={t('auth.signup.emailLabel')}
            placeholder={t('auth.signup.emailPlaceholder')}
            value={email}
            onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: '' })) }}
            keyboardType='email-address'
            autoCapitalize='none'
            error={errors.email}
          />
          <Input
            label={t('auth.signup.passwordLabel')}
            placeholder={t('auth.signup.passwordPlaceholder')}
            value={password}
            onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: '' })) }}
            secureTextEntry
            error={errors.password}
          />
          <Input
            label={t('auth.signup.confirmPasswordLabel')}
            placeholder={t('auth.signup.confirmPasswordPlaceholder')}
            value={confirmPassword}
            onChangeText={(v) => { setConfirmPassword(v); setErrors((e) => ({ ...e, confirm: '' })) }}
            secureTextEntry
            error={errors.confirm}
          />
          {errors.general ? <Text style={s.errorText}>{errors.general}</Text> : null}
          <Button title={t('auth.signup.signUp')} onPress={handleSignup} loading={loading} />
        </View>

        {/* Note */}
        <Text style={s.hint}>
          {t('auth.verify.subtitle')} {t('auth.verify.instruction')}
        </Text>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>{t('auth.signup.hasAccount')}</Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text style={s.footerLink}>{t('auth.signup.signIn')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
    },
    back: { marginBottom: spacing.lg },
    headerSection: { alignItems: 'center', marginBottom: spacing.xl },
    logoCircle: {
      width: 68,
      height: 68,
      borderRadius: radius.full,
      backgroundColor: colors.primary + '18',
      borderWidth: 1.5,
      borderColor: colors.primary + '40',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    title: { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
    subtitle: { ...typography.body, color: colors.textSecondary },
    form: { gap: spacing.md, marginBottom: spacing.lg },
    errorText: {
      ...typography.bodySmall,
      color: colors.error,
      textAlign: 'center',
    },
    hint: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: spacing.xl,
      paddingHorizontal: spacing.md,
      lineHeight: 18,
    },
    footer: { flexDirection: 'row', justifyContent: 'center' },
    footerText: { ...typography.body, color: colors.textSecondary },
    footerLink: { ...typography.body, color: colors.primary, fontWeight: '700' },
  })
}
