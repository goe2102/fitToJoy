import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

function MessageBubble({
  message,
  isMine,
  colors,
}: {
  message: Message
  isMine: boolean
  colors: AppColors
}) {
  return (
    <View style={[bubbleStyles.wrapper, isMine ? bubbleStyles.wrapperMine : bubbleStyles.wrapperTheirs]}>
      <View
        style={[
          bubbleStyles.bubble,
          isMine
            ? { backgroundColor: colors.primary }
            : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
        ]}
      >
        <Text style={[bubbleStyles.text, { color: isMine ? colors.white : colors.text }]}>
          {message.content}
        </Text>
      </View>
      <Text style={[bubbleStyles.time, { color: colors.textMuted }]}>
        {formatMessageTime(message.created_at)}
        {isMine && (
          <Text> · {message.read ? '✓✓' : '✓'}</Text>
        )}
      </Text>
    </View>
  )
}

const bubbleStyles = StyleSheet.create({
  wrapper: { maxWidth: '75%', marginVertical: 2 },
  wrapperMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  wrapperTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
  },
  text: { ...typography.body, lineHeight: 22 },
  time: { ...typography.caption, marginTop: 3, marginHorizontal: 4 },
})

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

  // Load conversation + messages
  const load = useCallback(async () => {
    if (!id || !user) return
    setLoading(true)

    // Get conversation details (for the header)
    const convs = await chatService.getConversations(user.id)
    const conv = convs.data.find((c) => c.id === id) ?? null
    setConversation(conv)

    const { data } = await chatService.getMessages(id)
    setMessages(data)
    setLoading(false)

    // Mark as read
    await chatService.markMessagesRead(id, user.id)
    refreshMessages()
  }, [id, user])

  useEffect(() => { load() }, [load])

  // Real-time subscription
  useEffect(() => {
    if (!id) return
    const channel = chatService.subscribeToMessages(id, (msg) => {
      setMessages((prev) => [...prev, msg])
      if (msg.sender_id !== user?.id) {
        chatService.markMessagesRead(id, user!.id)
        refreshMessages()
      }
    })
    return () => { channel.unsubscribe() }
  }, [id, user])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages.length])

  const onSend = async () => {
    const content = text.trim()
    if (!content || !user || !id || sending) return
    setText('')
    setSending(true)
    const { data, error } = await chatService.sendMessage(id, user.id, content)
    setSending(false)
    if (data) setMessages((prev) => [...prev, data])
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name='arrow-back' size={24} color={colors.text} />
          </TouchableOpacity>

          {otherProfile?.avatar_url
            ? <Image source={{ uri: otherProfile.avatar_url }} style={styles.headerAvatar} contentFit='cover' />
            : (
              <View style={[styles.headerAvatar, { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name='person' size={16} color={colors.textMuted} />
              </View>
            )
          }

          <View style={{ flex: 1 }}>
            <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>
              @{otherProfile?.username ?? '—'}
              {otherProfile?.is_verified ? ' ✓' : ''}
            </Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isMine={item.sender_id === user?.id}
              colors={colors}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={[typography.bodySmall, { color: colors.textMuted, textAlign: 'center' }]}>
                No messages yet. Say hi!
              </Text>
            </View>
          }
        />

        {/* Input bar */}
        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border }]}
            placeholder='Message…'
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
            returnKeyType='default'
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: text.trim() ? colors.primary : colors.border },
            ]}
            onPress={onSend}
            disabled={!text.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size='small' color={colors.white} />
              : <Ionicons name='send' size={18} color={colors.white} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  messageList: {
    padding: spacing.md,
    gap: 2,
    paddingBottom: spacing.lg,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    maxHeight: 120,
    borderWidth: 1,
    ...typography.body,
    lineHeight: undefined,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
