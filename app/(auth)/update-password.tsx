import React, { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { Button, Input } from '@/components/ui'
import { radius, spacing, typography } from '@/constants/theme'

export default function UpdatePasswordScreen() {
  const colors = useColors()
  const { t } = useTranslation()
  const { updatePassword } = useAuth()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleUpdate = async () => {
    if (password.length < 8) { setError(t('auth.updatePassword.updateBtn')); return }
    if (password !== confirm) { setError(t('auth.forgotPassword.passwordMismatch')); return }
    setError('')
    setLoading(true)
    const { error: err } = await updatePassword(password)
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
  }

  const s = makeStyles(colors)

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.container}>
        {done ? (
          <View style={s.centered}>
            <View style={s.iconCircle}>
              <Ionicons name='checkmark' size={40} color={colors.primary} />
            </View>
            <Text style={s.title}>{t('auth.updatePassword.successTitle')}</Text>
            <Text style={s.subtitle}>{t('auth.updatePassword.successSubtitle')}</Text>
            <Button
              title={t('common.done')}
              onPress={() => router.replace('/(tabs)' as any)}
              style={{ marginTop: spacing.xl, width: '100%' }}
            />
          </View>
        ) : (
          <>
            <View style={s.header}>
              <View style={s.iconCircle}>
                <Ionicons name='lock-closed-outline' size={36} color={colors.primary} />
              </View>
              <Text style={s.title}>{t('auth.updatePassword.title')}</Text>
              <Text style={s.subtitle}>{t('auth.forgotPassword.chooseNewPassword')}</Text>
            </View>
            <View style={s.form}>
              <Input
                label={t('auth.updatePassword.newPasswordLabel')}
                placeholder={t('auth.updatePassword.newPasswordPlaceholder')}
                value={password}
                onChangeText={(v) => { setPassword(v); setError('') }}
                secureTextEntry
                autoFocus
              />
              <Input
                label={t('auth.updatePassword.confirmPasswordLabel')}
                placeholder={t('auth.updatePassword.confirmPasswordPlaceholder')}
                value={confirm}
                onChangeText={(v) => { setConfirm(v); setError('') }}
                secureTextEntry
                error={error || undefined}
              />
              <Button
                title={t('auth.updatePassword.updateBtn')}
                onPress={handleUpdate}
                loading={loading}
                disabled={!password || !confirm}
              />
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
    header: { alignItems: 'center', marginBottom: spacing.xl },
    iconCircle: {
      width: 80, height: 80, borderRadius: radius.full,
      backgroundColor: colors.primary + '18',
      borderWidth: 1.5, borderColor: colors.primary + '40',
      alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
    },
    title: { ...typography.h2, color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
    subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    form: { gap: spacing.md },
  })
}
