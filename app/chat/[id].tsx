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
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useColors } from '@/hooks/useColors'
import { useAuth } from '@/context/AuthContext'
import { useUnread } from '@/context/UnreadContext'
import { chatService } from '@/services/chatService'
import { radius, spacing, typography, type AppColors } from '@/constants/theme'
import type { Message, Conversation } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMessageTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

const BR = 20   // standard corner radius
const TAIL = 5  // tail corner radius (bottom of last bubble in group)

function MessageBubble({
  message,
  isMine,
  isGrouped,
  isLastInGroup,
  colors,
}: {
  message: Message
  isMine: boolean
  isGrouped: boolean      // same sender as the message above — reduce top spacing
  isLastInGroup: boolean  // last consecutive message from this sender — show tail + time
  colors: AppColors
}) {
  return (
    <View style={{
      marginTop: isGrouped ? 2 : 14,
      paddingHorizontal: spacing.md,
      alignItems: isMine ? 'flex-end' : 'flex-start',
    }}>
      <View style={[
        styles.bubble,
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
        <Text style={[styles.bubbleText, { color: isMine ? '#FFFFFF' : colors.text }]}>
          {message.content}
        </Text>
      </View>

      {isLastInGroup && (
        <View style={[styles.meta, isMine ? styles.metaMine : styles.metaTheirs]}>
          <Text style={[styles.time, { color: colors.textMuted }]}>
            {formatMessageTime(message.created_at)}
            {isMine && `  ${message.read ? '✓✓' : '✓'}`}
          </Text>
        </View>
      )}
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const colors = useColors()
  const { user } = useAuth()
  const { refreshMessages } = useUnread()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [messages, setMessages] = useState<Message[]>([])
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<FlatList>(null)

  const otherProfile = conversation?.other_profile

  const load = useCallback(async () => {
    if (!id || !user) return
    setLoading(true)
    const convs = await chatService.getConversations(user.id)
    const conv = convs.data.find((c) => c.id === id) ?? null
    setConversation(conv)
    const { data } = await chatService.getMessages(id, conv?.cleared_at)
    setMessages(data)
    setLoading(false)
    await chatService.markMessagesRead(id, user.id)
    refreshMessages()
  }, [id, user])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!id) return
    const channel = chatService.subscribeToMessages(id, (msg) => {
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])
      if (msg.sender_id !== user?.id) {
        chatService.markMessagesRead(id, user!.id)
        refreshMessages()
      }
    })
    return () => { channel.unsubscribe() }
  }, [id, user])

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
    }
  }, [messages.length])

  const onSend = async () => {
    const content = text.trim()
    if (!content || !user || !id || sending) return
    setText('')
    setSending(true)
    const { data } = await chatService.sendMessage(id, user.id, content)
    setSending(false)
    if (data) setMessages((prev) => [...prev, data])
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={['top', 'bottom']}>
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={14} style={styles.backBtn}>
            <Ionicons name='chevron-back' size={26} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerProfile}
            onPress={() => otherProfile?.id && router.push(`/profile/${otherProfile.id}` as any)}
            activeOpacity={0.75}
          >
            {otherProfile?.avatar_url
              ? <Image source={{ uri: otherProfile.avatar_url }} style={styles.headerAvatar} contentFit='cover' />
              : (
                <View style={[styles.headerAvatar, { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name='person' size={20} color={colors.textMuted} />
                </View>
              )
            }
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
                {otherProfile?.username ?? '—'}
                {otherProfile?.is_verified ? ' ✓' : ''}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={{ width: 40 }} />
        </View>

        {/* ── Messages ── */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => {
            const prev = messages[index - 1]
            const next = messages[index + 1]
            const isGrouped = !!prev && prev.sender_id === item.sender_id
            const isLastInGroup = !next || next.sender_id !== item.sender_id
            return (
              <MessageBubble
                message={item}
                isMine={item.sender_id === user?.id}
                isGrouped={isGrouped}
                isLastInGroup={isLastInGroup}
                colors={colors}
              />
            )
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              {otherProfile?.avatar_url
                ? <Image source={{ uri: otherProfile.avatar_url }} style={styles.emptyAvatar} contentFit='cover' />
                : (
                  <View style={[styles.emptyAvatar, { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name='person' size={28} color={colors.textMuted} />
                  </View>
                )
              }
              <Text style={[styles.emptyName, { color: colors.text }]}>
                @{otherProfile?.username ?? '—'}
              </Text>
              <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                Say hi to get the conversation started!
              </Text>
            </View>
          }
        />

        {/* ── Input bar ── */}
        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceElevated, color: colors.text }]}
            placeholder='Message…'
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
            returnKeyType='default'
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.surfaceElevated }]}
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
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerName: { fontSize: 16, fontWeight: '600' },

  list: { paddingTop: spacing.md, paddingBottom: spacing.lg },

  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  meta: { flexDirection: 'row', marginTop: 4, paddingHorizontal: 4 },
  metaMine: { justifyContent: 'flex-end' },
  metaTheirs: { justifyContent: 'flex-start' },
  time: { fontSize: 11 },

  empty: { flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: spacing.xl },
  emptyAvatar: { width: 72, height: 72, borderRadius: 36, marginBottom: spacing.md },
  emptyName: { fontSize: 17, fontWeight: '600', marginBottom: 6 },
  emptyHint: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    maxHeight: 120,
    fontSize: 15,
    lineHeight: 20,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
