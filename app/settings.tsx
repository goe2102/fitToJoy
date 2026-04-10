import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { useProfile } from '@/context/ProfileContext'
import { profileService } from '@/services/profileService'
import { imageService } from '@/services/imageService'
import { Input, Button } from '@/components/ui'
import { radius, spacing, typography } from '@/constants/theme'

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  colors,
}: {
  title: string
  colors: ReturnType<typeof useColors>
}) {
  return (
    <Text style={[s.sectionTitle, { color: colors.textMuted }]}>
      {title.toUpperCase()}
    </Text>
  )
}

// ─── Settings Row ─────────────────────────────────────────────────────────────

function SettingsRow({
  icon,
  label,
  sublabel,
  onPress,
  right,
  destructive,
  colors,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  sublabel?: string
  onPress?: () => void
  right?: React.ReactNode
  destructive?: boolean
  colors: ReturnType<typeof useColors>
}) {
  return (
    <TouchableOpacity
      style={[
        s.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onPress={onPress}
      disabled={!onPress && !right}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View
        style={[
          s.rowIcon,
          {
            backgroundColor:
              (destructive ? colors.error : colors.primary) + '18',
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={destructive ? colors.error : colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            typography.label,
            { color: destructive ? colors.error : colors.text },
          ]}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text
            style={[
              typography.caption,
              { color: colors.textMuted, marginTop: 1 },
            ]}
          >
            {sublabel}
          </Text>
        ) : null}
      </View>
      {right ??
        (onPress ? (
          <Ionicons name='chevron-forward' size={16} color={colors.textMuted} />
        ) : null)}
    </TouchableOpacity>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const colors = useColors()
  const { user, signOut } = useAuth()
  const { profile, stats, updateProfile, updateAvatar } = useProfile()

  // Edit profile form state
  const [username, setUsername] = useState(profile?.username ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [usernameState, setUsernameState] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle')
  const [saving, setSaving] = useState(false)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const checkRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync when profile loads
  useEffect(() => {
    if (profile) {
      setUsername(profile.username)
      setBio(profile.bio ?? '')
    }
  }, [profile?.id])

  const onUsernameChange = (val: string) => {
    setUsername(val)
    if (val === profile?.username) {
      setUsernameState('idle')
      return
    }
    if (val.length < 3) {
      setUsernameState('invalid')
      return
    }
    setUsernameState('checking')
    if (checkRef.current) clearTimeout(checkRef.current)
    checkRef.current = setTimeout(async () => {
      const available = await profileService.checkUsernameAvailable(
        val,
        user!.id
      )
      setUsernameState(available ? 'available' : 'taken')
    }, 500)
  }

  const onPickAvatar = async () => {
    const result = await imageService.pickImage([1, 1])
    if (!result?.base64) return
    setAvatarSaving(true)
    await updateAvatar(result.base64)
    setAvatarSaving(false)
  }

  const onSaveProfile = async () => {
    if (usernameState === 'taken' || usernameState === 'invalid') return
    setSaving(true)
    const updates: any = { bio: bio.trim() || null }
    if (username.trim() !== profile?.username)
      updates.username = username.trim()
    const { error } = await updateProfile(updates)
    setSaving(false)
    if (error) {
      Alert.alert('Error', error.message)
      return
    }
    Alert.alert('Saved', 'Your profile has been updated.')
  }

  const onTogglePrivacy = async (val: boolean) => {
    await updateProfile({ is_private: val })
    if (val) {
      Alert.alert(
        'Account private',
        'Only your followers can see your activities.'
      )
    }
  }

  const onSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ])
  }

  const onChangePassword = () => {
    // Navigate to the same forgot-password flow (logged in, so recovery is already set)
    Alert.alert(
      'Change Password',
      'Well send a reset code to your email address.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send code',
          onPress: async () => {
            if (!profile?.email) return
            const { sendPasswordReset } = require('@/context/AuthContext')
            // Just show the login modal — simplest path via forgot password
            router.back()
          },
        },
      ]
    )
  }

  const usernameHint =
    usernameState === 'checking'
      ? 'Checking…'
      : usernameState === 'available'
        ? '✓ Available'
        : usernameState === 'taken'
          ? 'Username taken'
          : usernameState === 'invalid'
            ? 'Min. 3 characters'
            : undefined

  const usernameError =
    usernameState === 'taken' || usernameState === 'invalid'
      ? usernameHint
      : undefined

  const profileChanged =
    username.trim() !== (profile?.username ?? '') ||
    (bio.trim() || null) !== (profile?.bio ?? null)

  return (
    <SafeAreaView
      style={[s.safe, { backgroundColor: colors.surface }]}
      edges={['top']}
    >
      {/* Header */}
      <View
        style={[
          s.header,
          { borderBottomColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name='chevron-back' size={26} color={colors.text} />
        </TouchableOpacity>
        <Text
          style={[
            typography.h3,
            { color: colors.text, flex: 1, marginLeft: spacing.md },
          ]}
        >
          Settings
        </Text>
      </View>

      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps='handled'
      >
        {/* ── Profile section ── */}
        <SectionHeader title='Profile' colors={colors} />

        {/* Avatar picker */}
        <View
          style={[
            s.avatarSection,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <TouchableOpacity
            onPress={onPickAvatar}
            disabled={avatarSaving}
            activeOpacity={0.8}
          >
            {avatarSaving ? (
              <View
                style={[
                  s.avatar,
                  {
                    backgroundColor: colors.surfaceElevated,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                ]}
              >
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={s.avatar}
                contentFit='cover'
              />
            ) : (
              <View
                style={[
                  s.avatar,
                  {
                    backgroundColor: colors.surfaceElevated,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                ]}
              >
                <Ionicons name='person' size={36} color={colors.textMuted} />
              </View>
            )}
            <View
              style={[
                s.cameraBadge,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.surface,
                },
              ]}
            >
              <Ionicons name='camera' size={13} color='#fff' />
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[typography.label, { color: colors.text }]}>
              {profile?.username ?? '—'}
              {profile?.is_verified && (
                <Text style={{ color: colors.primary }}> ✓</Text>
              )}
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.textMuted, marginTop: 2 },
              ]}
            >
              Tap to change photo
            </Text>
          </View>
        </View>

        <View
          style={[
            s.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Input
            label='Username'
            value={username}
            onChangeText={onUsernameChange}
            autoCapitalize='none'
            error={usernameError}
            hint={!usernameError ? usernameHint : undefined}
          />
          <View style={{ height: spacing.md }} />
          <Input
            label='Bio'
            value={bio}
            onChangeText={setBio}
            placeholder='Tell people about yourself…'
            multiline
            numberOfLines={3}
          />
          {profileChanged && (
            <Button
              title='Save changes'
              onPress={onSaveProfile}
              loading={saving}
              style={{ marginTop: spacing.md }}
            />
          )}
        </View>

        {/* ── Account section ── */}
        <SectionHeader title='Account' colors={colors} />

        <View style={s.group}>
          <SettingsRow
            icon={profile?.is_private ? 'lock-closed-outline' : 'globe-outline'}
            label='Private account'
            sublabel={
              profile?.is_private
                ? 'Only followers see your activities'
                : 'Everyone can see your activities'
            }
            right={
              <Switch
                value={profile?.is_private ?? false}
                onValueChange={onTogglePrivacy}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.white}
              />
            }
            colors={colors}
          />
          <View style={[s.separator, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon='key-outline'
            label='Change password'
            sublabel='Send a reset code to your email'
            onPress={() =>
              Alert.alert(
                'Change Password',
                'A password reset code will be sent to your registered email address. Use "Forgot password?" on the login screen.',
                [{ text: 'OK' }]
              )
            }
            colors={colors}
          />
        </View>

        {/* ── Stats (read-only) ── */}
        <SectionHeader title='Stats' colors={colors} />
        <View
          style={[
            s.statsRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={s.statCell}>
            <Text style={[typography.h3, { color: colors.text }]}>
              {stats.follower_count}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Followers
            </Text>
          </View>
          <View style={[s.statDivider, { backgroundColor: colors.border }]} />
          <View style={s.statCell}>
            <Text style={[typography.h3, { color: colors.text }]}>
              {stats.following_count}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Following
            </Text>
          </View>
          <View style={[s.statDivider, { backgroundColor: colors.border }]} />
          <View style={s.statCell}>
            <Text style={[typography.h3, { color: colors.text }]}>
              {stats.activity_count}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Activities
            </Text>
          </View>
        </View>

        {/* ── About section ── */}
        <SectionHeader title='About' colors={colors} />
        <View style={s.group}>
          <SettingsRow
            icon='information-circle-outline'
            label='Version'
            sublabel='1.0.0'
            colors={colors}
          />
          <View style={[s.separator, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon='document-text-outline'
            label='Terms of Service'
            onPress={() => {}}
            colors={colors}
          />
          <View style={[s.separator, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon='shield-checkmark-outline'
            label='Privacy Policy'
            onPress={() => {}}
            colors={colors}
          />
        </View>

        {/* ── Danger zone ── */}
        <SectionHeader title='Account' colors={colors} />
        <View style={s.group}>
          <SettingsRow
            icon='log-out-outline'
            label='Sign out'
            destructive
            onPress={onSignOut}
            colors={colors}
          />
        </View>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  body: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    marginLeft: 4,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  group: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: { height: 1, marginLeft: spacing.md + 34 + spacing.md },
  statsRow: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 2,
  },
  statDivider: { width: 1, marginVertical: spacing.sm },
})
