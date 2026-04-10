/**
 * Registers for Expo push notifications and saves the token to Supabase.
 */
import { useEffect } from 'react'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { savePushToken } from '@/services/pushService'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export function usePushNotifications(userId: string | undefined) {
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
}
