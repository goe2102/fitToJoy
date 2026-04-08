import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { notificationService } from '@/services/notificationService'
import { chatService } from '@/services/chatService'

interface UnreadContextType {
  notificationCount: number
  messageCount: number
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
    const c = await chatService.getUnreadMessageCount(user.id)
    setMessageCount(c)
  }, [user])

  useEffect(() => {
    refreshNotifications()
    refreshMessages()
  }, [refreshNotifications, refreshMessages])

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
