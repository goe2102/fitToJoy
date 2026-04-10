import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput as RNTextInput,
  InteractionManager,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { useUnread } from '@/context/UnreadContext'
import { groupChatService } from '@/services/groupChatService'
import { chatService } from '@/services/chatService'
import { supabase } from '../../lib/supabase'
import { radius, spacing, typography, type AppColors } from '@/constants/theme'
import type { GroupMessage } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function SmallAvatar({ uri, size = 30, colors }: { uri?: string | null; size?: number; colors: AppColors }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit='cover' />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name='person' size={size * 0.5} color={colors.textMuted} />
    </View>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

const BR = 20
const TAIL = 5

function GroupBubble({
  message,
  isMine,
  showSender,
  isLastInGroup,
  colors,
}: {
  message: GroupMessage
  isMine: boolean
  showSender: boolean      // first consecutive from this sender — show avatar/name
  isLastInGroup: boolean   // last consecutive from this sender — show tail + time
  colors: AppColors
}) {
  return (
    <View style={[
      groupBubbleS.row,
      isMine ? groupBubbleS.rowMine : groupBubbleS.rowTheirs,
      { marginTop: showSender ? 14 : 2 },
    ]}>
      {/* Left avatar slot (theirs only) */}
      {!isMine && (
        <View style={{ width: 34, alignSelf: 'flex-end', paddingBottom: isLastInGroup ? 18 : 0 }}>
          {showSender && (
            <TouchableOpacity onPress={() => message.sender?.id && InteractionManager.runAfterInteractions(() => router.push(`/profile/${message.sender!.id}` as any))}>
              <SmallAvatar uri={message.sender?.avatar_url} size={30} colors={colors} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={[groupBubbleS.wrapper, isMine ? groupBubbleS.wrapperMine : groupBubbleS.wrapperTheirs]}>
        {!isMine && showSender && message.sender && (
          <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 3, marginLeft: 2 }}>
            @{message.sender.username}
          </Text>
        )}
        <View style={[
          groupBubbleS.bubble,
          {
            borderTopLeftRadius: BR,
            borderTopRightRadius: BR,
            borderBottomLeftRadius: isMine ? BR : (isLastInGroup ? TAIL : BR),
            borderBottomRightRadius: isMine ? (isLastInGroup ? TAIL : BR) : BR,
          },
          isMine
            ? { backgroundColor: colors.primary }
            : { backgroundColor: colors.surfaceElevated },
        ]}>
          <Text style={[groupBubbleS.text, { color: isMine ? '#FFFFFF' : colors.text }]}>
            {message.content}
          </Text>
        </View>
        {isLastInGroup && (
          <Text style={[groupBubbleS.time, { color: colors.textMuted }]}>
            {formatTime(message.created_at)}
          </Text>
        )}
      </View>
    </View>
  )
}

const groupBubbleS = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: spacing.sm, gap: spacing.xs },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start', alignItems: 'flex-end' },
  wrapper: { maxWidth: '72%' },
  wrapperMine: { alignItems: 'flex-end' },
  wrapperTheirs: { alignItems: 'flex-start' },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  text: { fontSize: 15, lineHeight: 22 },
  time: { fontSize: 11, marginTop: 4, marginHorizontal: 4 },
})

// ─── Members Modal ────────────────────────────────────────────────────────────

function MembersModal({
  visible,
  onClose,
  activityId,
  hostId,
  currentUserId,
  colors,
}: {
  visible: boolean
  onClose: () => void
  activityId: string
  hostId: string
  currentUserId: string
  colors: AppColors
}) {
  const insets = useSafeAreaInsets()
  const [participants, setParticipants] = useState<any[]>([])
  const [host, setHost] = useState<any>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible) return
    ;(async () => {
      setLoading(true)
      const [partRes, hostRes] = await Promise.all([
        groupChatService.getParticipants(activityId),
        supabase.from('profiles').select('id, username, avatar_url').eq('id', hostId).single(),
      ])
      setParticipants(partRes.data)
      setHost(hostRes.data)
      setLoading(false)
    })()
  }, [visible, activityId, hostId])

  const allMembers = [
    ...(host ? [{ profile: host, role: 'Host' }] : []),
    ...participants.map((p) => ({ profile: p.profile, role: 'Member' })),
  ]

  const filtered = query.trim()
    ? allMembers.filter((m) => m.profile?.username?.toLowerCase().includes(query.toLowerCase()))
    : allMembers

  const startDM = async (otherId: string) => {
    onClose()
    const { data: convId } = await chatService.getOrCreateConversation(currentUserId, otherId)
    if (convId) InteractionManager.runAfterInteractions(() => router.push(`/chat/${convId}` as any))
  }

  return (
    <Modal visible={visible} animationType='slide' presentationStyle='pageSheet' onRequestClose={onClose}>
      <View style={[membS.container, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
        {/* Header */}
        <View style={[membS.header, { borderBottomColor: colors.border }]}>
          <Text style={[typography.h3, { color: colors.text, flex: 1 }]}>Members ({allMembers.length})</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name='close' size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[membS.searchBar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Ionicons name='search' size={16} color={colors.textMuted} />
          <RNTextInput
            style={[membS.searchInput, { color: colors.text }]}
            placeholder='Search members…'
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name='close-circle' size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(m) => m.profile?.id ?? m.role}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
            renderItem={({ item }) => {
              const isMe = item.profile?.id === currentUserId
              return (
                <View style={[membS.row, { borderBottomColor: colors.border }]}>
                  <TouchableOpacity
                    onPress={() => {
                      if (!item.profile?.id) return
                      onClose()
                      InteractionManager.runAfterInteractions(() =>
                        router.push(`/profile/${item.profile!.id}` as any)
                      )
                    }}
                    activeOpacity={0.7}
                  >
                    <SmallAvatar uri={item.profile?.avatar_url} size={44} colors={colors} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.label, { color: colors.text }]}>
                      @{item.profile?.username ?? '—'}
                    </Text>
                    <Text style={[typography.caption, { color: item.role === 'Host' ? colors.primary : colors.textMuted }]}>
                      {item.role}{isMe ? ' · You' : ''}
                    </Text>
                  </View>
                  {!isMe && (
                    <TouchableOpacity
                      style={[membS.dmBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                      onPress={() => item.profile?.id && startDM(item.profile.id)}
                    >
                      <Ionicons name='chatbubble-outline' size={14} color={colors.primary} />
                      <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>DM</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            }}
            ListEmptyComponent={
              <Text style={[typography.bodySmall, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
                No members found
              </Text>
            }
          />
        )}
      </View>
    </Modal>
  )
}

const membS = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    margin: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1,
  },
  searchInput: { flex: 1, ...typography.body, padding: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1,
  },
  dmBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1,
  },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function GroupChatScreen() {
  const colors = useColors()
  const { user } = useAuth()
  const { refreshMessages } = useUnread()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [chatInfo, setChatInfo] = useState<{ activityTitle: string; activityId: string; hostId: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [muted, setMuted] = useState(false)
  const [membersVisible, setMembersVisible] = useState(false)
  const listRef = useRef<FlatList>(null)

  const load = useCallback(async () => {
    if (!id || !user) return
    setLoading(true)

    const [msgRes, infoRes, mutedVal] = await Promise.all([
      groupChatService.getMessages(id),
      supabase
        .from('activity_chats')
        .select('activity_id, activity:activities!activity_chats_activity_id_fkey(id, title, host_id)')
        .eq('id', id)
        .single(),
      groupChatService.getMuted(id, user.id),
    ])

    setMessages(msgRes.data)
    setMuted(mutedVal)

    const act = Array.isArray(infoRes.data?.activity) ? infoRes.data.activity[0] : infoRes.data?.activity
    if (act) {
      setChatInfo({
        activityTitle: act.title,
        activityId: act.id,
        hostId: act.host_id,
      })
    }

    setLoading(false)
    await groupChatService.markRead(id, user.id)
    refreshMessages()
  }, [id, user])

  useEffect(() => { load() }, [load])

  // Realtime
  useEffect(() => {
    if (!id) return
    const channel = groupChatService.subscribeToMessages(id, (msg) => {
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])
      if (msg.sender_id !== user?.id) {
        groupChatService.markRead(id, user!.id)
        refreshMessages()
      }
    })
    return () => { channel.unsubscribe() }
  }, [id, user?.id])

  // Scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
    }
  }, [messages.length])

  const toggleMute = async () => {
    if (!id || !user) return
    const next = !muted
    setMuted(next)
    await groupChatService.setMuted(id, user.id, next)
  }

  const onSend = async () => {
    const content = text.trim()
    if (!content || !user || !id || sending) return
    setText('')
    setSending(true)
    const { data, error } = await groupChatService.sendMessage(id, user.id, content)
    setSending(false)
    if (data && !error) {
      setMessages((prev) => prev.some((m) => m.id === data.id) ? prev : [...prev, data])
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.surface }]} edges={['top']}>
      <KeyboardAvoidingView
        style={[{ flex: 1 }, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Header ── */}
        <View style={[s.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={14} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name='chevron-back' size={26} color={colors.text} />
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <View style={[s.groupIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name='people' size={16} color={colors.primary} />
            </View>
            <Text style={[typography.label, { color: colors.text, flex: 1 }]} numberOfLines={1}>
              {chatInfo?.activityTitle ?? 'Group Chat'}
            </Text>
          </View>

          <View style={s.headerActions}>
            {/* Members */}
            <TouchableOpacity onPress={() => setMembersVisible(true)} hitSlop={12} style={s.headerBtn}>
              <Ionicons name='people-outline' size={22} color={colors.text} />
            </TouchableOpacity>
            {/* Mute toggle */}
            <TouchableOpacity onPress={toggleMute} hitSlop={12} style={s.headerBtn}>
              <Ionicons
                name={muted ? 'notifications-off-outline' : 'notifications-outline'}
                size={22}
                color={muted ? colors.textMuted : colors.text}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Messages ── */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={s.list}
          renderItem={({ item, index }) => {
            const prev = messages[index - 1]
            const next = messages[index + 1]
            const showSender = !prev || prev.sender_id !== item.sender_id
            const isLastInGroup = !next || next.sender_id !== item.sender_id
            return (
              <GroupBubble
                message={item}
                isMine={item.sender_id === user?.id}
                showSender={showSender}
                isLastInGroup={isLastInGroup}
                colors={colors}
              />
            )
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name='chatbubbles-outline' size={40} color={colors.textMuted} />
              <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' }]}>
                No messages yet.{'\n'}Start the conversation!
              </Text>
            </View>
          }
        />

        {/* Muted banner */}
        {muted && (
          <View style={[s.mutedBanner, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name='notifications-off-outline' size={13} color={colors.textMuted} />
            <Text style={[typography.caption, { color: colors.textMuted }]}>Notifications muted</Text>
          </View>
        )}

        {/* ── Input bar ── */}
        <View style={[s.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            style={[s.input, { backgroundColor: colors.surfaceElevated, color: colors.text }]}
            placeholder='Message…'
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.surfaceElevated }]}
            onPress={onSend}
            disabled={!text.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size='small' color={text.trim() ? '#fff' : colors.textMuted} />
              : <Ionicons name='arrow-up' size={20} color={text.trim() ? '#fff' : colors.textMuted} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {chatInfo && user && (
        <MembersModal
          visible={membersVisible}
          onClose={() => setMembersVisible(false)}
          activityId={chatInfo.activityId}
          hostId={chatInfo.hostId}
          currentUserId={user.id}
          colors={colors}
        />
      )}
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.sm,
  },
  headerCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  groupIcon: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  headerBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.sm, paddingBottom: spacing.lg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  mutedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 5,
  },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1, borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    maxHeight: 120,
    fontSize: 15, lineHeight: 20,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
})
