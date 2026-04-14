import * as Notifications from 'expo-notifications'

const IDENTIFIER_PREFIX = 'activity-start-'

/** Schedule a local notification to fire at the exact activity start time. */
export async function scheduleStartNotification(
  activityId: string,
  activityTitle: string,
  date: string,      // YYYY-MM-DD
  startTime: string  // HH:MM
): Promise<void> {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, m] = startTime.split(':').map(Number)
  const fireDate = new Date(y, mo - 1, d, h, m, 0, 0)

  // Don't schedule if already in the past
  if (fireDate.getTime() <= Date.now()) return

  // Cancel any existing one for this activity first
  await cancelStartNotification(activityId)

  await Notifications.scheduleNotificationAsync({
    identifier: `${IDENTIFIER_PREFIX}${activityId}`,
    content: {
      title: 'Activity Starting Now 🏃',
      body: `"${activityTitle}" has started! Don't forget to check in`,
      data: { type: 'activity_started', activity_id: activityId },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
  })
}

/** Cancel a previously scheduled start notification for an activity. */
export async function cancelStartNotification(activityId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`${IDENTIFIER_PREFIX}${activityId}`)
  } catch {
    // Ignore if it doesn't exist
  }
}
