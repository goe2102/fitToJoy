import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../../src/context/AuthContext'
import { Button, Input } from '../../src/components/ui'
import { colors, spacing, typography } from '@/constants/theme'

export default function SignupScreen() {
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!email.trim()) e.email = 'E-Mail ist erforderlich.'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Ungültige E-Mail-Adresse.'
    if (!password) e.password = 'Passwort ist erforderlich.'
    else if (password.length < 8) e.password = 'Mindestens 8 Zeichen.'
    if (password !== confirmPassword)
      e.confirm = 'Passwörter stimmen nicht überein.'
    return e
  }

  const handleSignup = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) {
      setErrors(e)
      return
    }
    setErrors({})
    setLoading(true)
    const { error } = await signUp(email.trim().toLowerCase(), password)
    setLoading(false)
    if (error) {
      setErrors({ general: error.message })
    } else {
      // Navigate to OTP verification, pass email as param
      router.push({
        pathname: '/(auth)/verify',
        params: { email: email.trim().toLowerCase() },
      })
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps='handled'
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backText}>← Zurück</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Konto erstellen</Text>
            <Text style={styles.subtitle}>
              Deine Fitness-Journey beginnt hier.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label='E-Mail'
              placeholder='deine@email.com'
              value={email}
              onChangeText={setEmail}
              keyboardType='email-address'
              autoCapitalize='none'
              error={errors.email}
            />
            <Input
              label='Passwort'
              placeholder='Min. 8 Zeichen'
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              error={errors.password}
            />
            <Input
              label='Passwort bestätigen'
              placeholder='••••••••'
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              error={errors.confirm}
            />
            {errors.general ? (
              <Text style={styles.errorText}>{errors.general}</Text>
            ) : null}
            <Button
              title='Registrieren'
              onPress={handleSignup}
              loading={loading}
            />
          </View>

          {/* Info */}
          <Text style={styles.hint}>
            Nach der Registrierung erhältst du einen 8-stelligen Code per
            E-Mail.
          </Text>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Schon ein Konto?</Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.footerLink}> Einloggen</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  back: { marginBottom: spacing.xl },
  backText: { ...typography.body, color: colors.textSecondary },
  header: { marginBottom: spacing.xl },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary },
  form: { gap: spacing.md, marginBottom: spacing.lg },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { ...typography.body, color: colors.textSecondary },
  footerLink: { ...typography.body, color: colors.primary, fontWeight: '700' },
})
