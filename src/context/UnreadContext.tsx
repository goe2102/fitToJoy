import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { notificationService } from '@/services/notificationService'
import { chatService } from '@/services/chatService'
import { groupChatService } from '@/services/groupChatService'
import { supabase } from '../../lib/supabase'

interface UnreadContextType {
  notificationCount: number
  messageCount: number     // DMs + group chats combined
  totalUnread: number
  refreshNotifications: () => Promise<void>
  refreshMessages: () => Promise<void>
}

const UnreadContext = createContext<UnreadContextType | undefined>(undefined)

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [notificationCount, setNotificationCount] = useState(0)
  const [messageCount, setMessageCount] = useState(0)

  const refreshNotifications = useCallback(async () => {
    if (!user) return
    const c = await notificationService.getUnreadCount(user.id)
    setNotificationCount(c)
  }, [user])

  const refreshMessages = useCallback(async () => {
    if (!user) return
    const [dm, group] = await Promise.all([
      chatService.getUnreadConversationCount(user.id),
      groupChatService.getGroupUnreadCount(user.id),
    ])
    setMessageCount(dm + group)
  }, [user])

  useEffect(() => {
    refreshNotifications()
    refreshMessages()
  }, [refreshNotifications, refreshMessages])

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return

    const notifSub = supabase
      .channel(`ctx-notif:${user.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => refreshNotifications()
      )
      .subscribe()

    const msgSub = supabase
      .channel(`ctx-msg:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        () => refreshMessages()
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' },
        () => refreshMessages()
      )
      .subscribe()

    const groupSub = supabase
      .channel(`ctx-group:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' },
        () => refreshMessages()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'group_chat_members', filter: `user_id=eq.${user.id}` },
        () => refreshMessages()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(notifSub)
      supabase.removeChannel(msgSub)
      supabase.removeChannel(groupSub)
    }
  }, [user?.id, refreshNotifications, refreshMessages])

  return (
    <UnreadContext.Provider
      value={{
        notificationCount,
        messageCount,
        totalUnread: notificationCount + messageCount,
        refreshNotifications,
        refreshMessages,
      }}
    >
      {children}
    </UnreadContext.Provider>
  )
}

export function useUnread() {
  const ctx = useContext(UnreadContext)
  if (!ctx) throw new Error('useUnread must be used within UnreadProvider')
  return ctx
}
