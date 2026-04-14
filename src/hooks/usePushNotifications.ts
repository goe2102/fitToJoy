/**
 * Registers for Expo push notifications, saves the token, and handles
 * notification taps (foreground, background, and cold-start).
 */
import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { savePushToken } from '@/services/pushService'
import type { NotificationType } from '@/types'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

// ─── Navigation helper ────────────────────────────────────────────────────────

function navigateFromNotification(data: Record<string, any>) {
  const type = data?.type as NotificationType | undefined
  const activityId = data?.activity_id as string | undefined
  const conversationId = data?.conversation_id as string | undefined
  const chatId = data?.chat_id as string | undefined

  if (conversationId) {
    router.push(`/chat/${conversationId}` as any)
    return
  }
  if (chatId) {
    router.push(`/group-chat/${chatId}` as any)
    return
  }
  if (activityId) {
    router.push(`/activity/${activityId}` as any)
    return
  }
  // follow_request, follow_accepted, and anything else → notifications screen
  router.push('/notifications' as any)
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePushNotifications(userId: string | undefined) {
  const handledInitialRef = useRef(false)

  // ── Token registration ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return

    ;(async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync()
        let finalStatus = existingStatus

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync()
          finalStatus = status
        }

        if (finalStatus !== 'granted') {
          console.warn('[Push] Permission not granted:', finalStatus)
          return
        }

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
          })
        }

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          (Constants as any).easConfig?.projectId

        if (!projectId) {
          console.warn('[Push] No EAS projectId found in app.json extra.eas.projectId')
          return
        }

        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
        console.log('[Push] Token obtained:', token)
        await savePushToken(userId, token)
      } catch (err) {
        console.warn('[Push] Failed to register push token:', err)
      }
    })()
  }, [userId])

  // ── Cold-start: app was killed, user tapped a notification to open it ───────
  // Only run once we know the user is logged in (so routing works correctly).
  useEffect(() => {
    if (!userId || handledInitialRef.current) return
    handledInitialRef.current = true

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return
      navigateFromNotification(
        response.notification.request.content.data as Record<string, any>
      )
    })
  }, [userId])

  // ── Foreground / background tap listener ────────────────────────────────────
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromNotification(
        response.notification.request.content.data as Record<string, any>
      )
    })
    return () => sub.remove()
  }, [])
}
