import React, { useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { useProfile } from '@/context/ProfileContext'
import { useTheme, type ThemePreference } from '@/context/ThemeContext'
import { profileService } from '@/services/profileService'
import { blockService } from '@/services/blockService'
import { Image } from 'expo-image'
import { FlatList } from 'react-native'
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
      style={[s.row, { backgroundColor: colors.surface }]}
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

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({
  visible,
  title,
  value,
  placeholder,
  multiline,
  onClose,
  onSave,
  saving,
  hint,
  error,
}: {
  visible: boolean
  title: string
  value: string
  placeholder?: string
  multiline?: boolean
  onClose: () => void
  onSave: (val: string) => void
  saving?: boolean
  hint?: string
  error?: string
}) {
  const colors = useColors()
  const [draft, setDraft] = useState(value)

  React.useEffect(() => {
    if (visible) setDraft(value)
  }, [visible, value])

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <SafeAreaView
          style={[s.modalSafe, { backgroundColor: colors.background }]}
          edges={['top', 'bottom']}
        >
          <View style={s.modalTop}>
            <Text style={[typography.h3, { color: colors.text }]}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              style={[
                s.modalClose,
                { backgroundColor: colors.surfaceElevated },
              ]}
            >
              <Ionicons name='close' size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              s.modalInputWrap,
              {
                backgroundColor: colors.surface,
                borderColor: error ? colors.error : colors.border,
              },
            ]}
          >
            <TextInput
              style={[
                s.modalInput,
                { color: colors.text },
                multiline && { height: 110, textAlignVertical: 'top' },
              ]}
              value={draft}
              onChangeText={setDraft}
              placeholder={placeholder}
              placeholderTextColor={colors.textMuted}
              autoFocus
              multiline={multiline}
              autoCapitalize='none'
              autoCorrect={false}
            />
          </View>
          {(error || hint) && (
            <Text
              style={[
                typography.caption,
                {
                  color: error ? colors.error : colors.textMuted,
                  marginHorizontal: spacing.lg,
                  marginTop: spacing.xs,
                },
              ]}
            >
              {error ?? hint}
            </Text>
          )}

          <TouchableOpacity
            style={[
              s.modalSaveBtn,
              { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 },
            ]}
            onPress={() => onSave(draft)}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size='small' color='#fff' />
            ) : (
              <Text style={[typography.label, { color: '#fff' }]}>Save</Text>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Blocked Users Modal ─────────────────────────────────────────────────────

type BlockedUser = {
  id: string
  username: string
  avatar_url: string | null
  is_verified: boolean
  blocked_since: string
}

function BlockedUsersModal({
  visible,
  userId,
  onClose,
}: {
  visible: boolean
  userId: string
  onClose: () => void
}) {
  const colors = useColors()
  const [users, setUsers] = useState<BlockedUser[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [unblocking, setUnblocking] = useState<string | null>(null)

  React.useEffect(() => {
    if (!visible) return
    setLoading(true)
    blockService.getBlockedUsersWithProfiles(userId).then(({ data }) => {
      setUsers(data)
      setLoading(false)
    })
  }, [visible, userId])

  const onUnblock = (user: BlockedUser) => {
    Alert.alert('Unblock', `Unblock @${user.username}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        style: 'destructive',
        onPress: async () => {
          setUnblocking(user.id)
          await blockService.unblock(userId, user.id)
          setUsers((prev) => prev.filter((u) => u.id !== user.id))
          setUnblocking(null)
        },
      },
    ])
  }

  const filtered = query.trim()
    ? users.filter((u) =>
        u.username.toLowerCase().includes(query.toLowerCase())
      )
    : users

  function blockedSince(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[s.modalSafe, { backgroundColor: colors.background }]}
        edges={['top', 'bottom']}
      >
        <View style={s.modalTop}>
          <Text style={[typography.h3, { color: colors.text }]}>
            Blocked Users
          </Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={12}
            style={[s.modalClose, { backgroundColor: colors.surfaceElevated }]}
          >
            <Ionicons name='close' size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View
          style={[
            s.blockSearchBar,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: searchFocused ? colors.primary : colors.border,
            },
          ]}
        >
          <Ionicons
            name='search'
            size={16}
            color={searchFocused ? colors.primary : colors.textMuted}
          />
          <TextInput
            style={[s.blockSearchInput, { color: colors.text }]}
            placeholder='Search blocked users…'
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            autoCorrect={false}
            autoCapitalize='none'
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons
                name='close-circle'
                size={16}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginTop: spacing.xxl }}
          />
        ) : filtered.length === 0 ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Ionicons name='ban-outline' size={40} color={colors.textMuted} />
            <Text style={[typography.body, { color: colors.textMuted }]}>
              {query ? 'No results' : 'No blocked users'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(u) => u.id}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            renderItem={({ item }) => (
              <View style={[s.blockRow, { borderBottomColor: colors.border }]}>
                {item.avatar_url ? (
                  <Image
                    source={{ uri: item.avatar_url }}
                    style={s.blockAvatar}
                    contentFit='cover'
                  />
                ) : (
                  <View
                    style={[
                      s.blockAvatar,
                      {
                        backgroundColor: colors.surfaceElevated,
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                    ]}
                  >
                    <Ionicons
                      name='person'
                      size={22}
                      color={colors.textMuted}
                    />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Text
                      style={[typography.label, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      @{item.username}
                    </Text>
                    {item.is_verified && (
                      <Ionicons
                        name='checkmark-circle'
                        size={15}
                        color={colors.primary}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textMuted, marginTop: 1 },
                    ]}
                  >
                    Blocked {blockedSince(item.blocked_since)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[s.unblockBtn, { borderColor: colors.error }]}
                  onPress={() => onUnblock(item)}
                  disabled={unblocking === item.id}
                  activeOpacity={0.7}
                >
                  {unblocking === item.id ? (
                    <ActivityIndicator size='small' color={colors.error} />
                  ) : (
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.error, fontWeight: '700' },
                      ]}
                    >
                      Unblock
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const colors = useColors()
  const { user, signOut } = useAuth()
  const { profile, updateProfile } = useProfile()
  const { preference, setPreference } = useTheme()

  const [usernameModal, setUsernameModal] = useState(false)
  const [bioModal, setBioModal] = useState(false)
  const [blockedModal, setBlockedModal] = useState(false)

  const [usernameSaving, setUsernameSaving] = useState(false)
  const [bioSaving, setBioSaving] = useState(false)

  const [usernameState, setUsernameState] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle')
  const checkRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onSaveUsername = async (val: string) => {
    const trimmed = val.trim()
    if (trimmed.length < 3) return
    setUsernameSaving(true)
    const available = await profileService.checkUsernameAvailable(
      trimmed,
      user!.id
    )
    if (!available) {
      setUsernameSaving(false)
      setUsernameState('taken')
      return
    }
    const { error } = await updateProfile({ username: trimmed })
    setUsernameSaving(false)
    if (error) {
      Alert.alert('Error', error.message)
      return
    }
    setUsernameModal(false)
    setUsernameState('idle')
  }

  const onUsernameChange = (val: string) => {
    if (val.length < 3) {
      setUsernameState('invalid')
      return
    }
    setUsernameState('checking')
    if (checkRef.current) clearTimeout(checkRef.current)
    checkRef.current = setTimeout(async () => {
      if (val === profile?.username) {
        setUsernameState('idle')
        return
      }
      const ok = await profileService.checkUsernameAvailable(val, user!.id)
      setUsernameState(ok ? 'available' : 'taken')
    }, 500)
  }

  const onSaveBio = async (val: string) => {
    setBioSaving(true)
    const { error } = await updateProfile({ bio: val.trim() || null })
    setBioSaving(false)
    if (error) {
      Alert.alert('Error', error.message)
      return
    }
    setBioModal(false)
  }

  const onTogglePrivacy = async (val: boolean) => {
    await updateProfile({ is_private: val })
    if (val)
      Alert.alert(
        'Account private',
        'Only your followers can see your activities.'
      )
  }

  const onSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ])
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

  return (
    <SafeAreaView
      style={[s.safe, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          style={s.backBtn}
        >
          <Ionicons name='chevron-back' size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text }]}>Settings</Text>
      </View>

      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile ── */}
        <SectionHeader title='Profile' colors={colors} />
        <View style={[s.group, { backgroundColor: colors.surface }]}>
          <SettingsRow
            icon='at-outline'
            label='Change username'
            sublabel={profile?.username ? `@${profile.username}` : undefined}
            onPress={() => {
              setUsernameState('idle')
              setUsernameModal(true)
            }}
            colors={colors}
          />
          <View style={[s.separator, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon='pencil-outline'
            label='Change bio'
            sublabel={profile?.bio ?? 'No bio yet'}
            onPress={() => setBioModal(true)}
            colors={colors}
          />
          <View style={[s.separator, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon='bookmark-outline'
            label='Saved activities'
            onPress={() => router.push('/saved-activities' as any)}
            colors={colors}
          />
          <View style={[s.separator, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon='ban-outline'
            label='Blocked users'
            onPress={() => setBlockedModal(true)}
            colors={colors}
          />
        </View>

        {/* ── Appearance ── */}
        <SectionHeader title='Appearance' colors={colors} />
        <View style={[s.group, { backgroundColor: colors.surface }]}>
          {(['light', 'dark', 'automatic'] as ThemePreference[]).map(
            (opt, i, arr) => (
              <React.Fragment key={opt}>
                <TouchableOpacity
                  style={[s.row, { backgroundColor: colors.surface }]}
                  onPress={() => setPreference(opt)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      s.rowIcon,
                      { backgroundColor: colors.primary + '18' },
                    ]}
                  >
                    <Ionicons
                      name={
                        opt === 'light'
                          ? 'sunny-outline'
                          : opt === 'dark'
                            ? 'moon-outline'
                            : 'phone-portrait-outline'
                      }
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <Text
                    style={[typography.label, { color: colors.text, flex: 1 }]}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </Text>
                  {preference === opt && (
                    <Ionicons
                      name='checkmark-circle'
                      size={20}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
                {i < arr.length - 1 && (
                  <View
                    style={[s.separator, { backgroundColor: colors.border }]}
                  />
                )}
              </React.Fragment>
            )
          )}
        </View>

        {/* ── Account ── */}
        <SectionHeader title='Account' colors={colors} />
        <View style={[s.group, { backgroundColor: colors.surface }]}>
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

        {/* ── About ── */}
        <SectionHeader title='About' colors={colors} />
        <View style={[s.group, { backgroundColor: colors.surface }]}>
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

        {/* ── Sign out ── */}
        <View style={{ height: spacing.md }} />
        <View style={[s.group, { backgroundColor: colors.surface }]}>
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

      {/* ── Modals ── */}
      <EditModal
        visible={usernameModal}
        title='Change Username'
        value={profile?.username ?? ''}
        placeholder='Enter new username'
        onClose={() => setUsernameModal(false)}
        onSave={onSaveUsername}
        saving={usernameSaving}
        hint={!usernameError ? usernameHint : undefined}
        error={usernameError}
      />
      <EditModal
        visible={bioModal}
        title='Change Bio'
        value={profile?.bio ?? ''}
        placeholder='Tell people about yourself…'
        multiline
        onClose={() => setBioModal(false)}
        onSave={onSaveBio}
        saving={bioSaving}
      />
      <BlockedUsersModal
        visible={blockedModal}
        userId={user!.id}
        onClose={() => setBlockedModal(false)}
      />
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 32,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: spacing.md, paddingBottom: spacing.xxxl },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    marginLeft: 4,
  },
  group: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
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
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.md + 34 + spacing.md,
  },
  // ── Modal ──
  modalSafe: { flex: 1 },
  modalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalInputWrap: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalInput: { fontSize: 16, minHeight: 44 },
  modalSaveBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  // ── Blocked users modal ──
  blockSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  blockSearchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  blockAvatar: { width: 52, height: 52, borderRadius: 26 },
  unblockBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
})
