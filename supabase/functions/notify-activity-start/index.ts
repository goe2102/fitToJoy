import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Called every minute by pg_cron.
 * Finds all activities that just started (status=active, start_notified=false,
 * and date+time <= now), sends a push to every participant + the host,
 * then marks start_notified=true so they're never sent twice.
 */
serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date()

  // ── 0. Auto-finish activities whose end time has passed ────────────────────
  {
    const { data: activeActivities } = await supabase
      .from('activities')
      .select('id, date, start_time, duration_minutes')
      .eq('status', 'active')

    const toFinish = (activeActivities ?? []).filter((a) => {
      const startDt = new Date(`${a.date}T${a.start_time}:00`)
      const endDt = new Date(startDt.getTime() + a.duration_minutes * 60_000)
      return endDt <= now
    }).map((a) => a.id)

    if (toFinish.length) {
      await supabase
        .from('activities')
        .update({ status: 'finished' })
        .in('id', toFinish)
      console.log(`[auto-finish] finished ${toFinish.length} activities`)
    }
  }

  // ── 1. Fetch all active, un-notified activities and filter by start time ───
  const { data: candidates, error } = await supabase
    .from('activities')
    .select('id, title, host_id, date, start_time')
    .eq('status', 'active')
    .eq('start_notified', false)

  if (error) {
    console.error('[notify-activity-start] fetch error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const activities = (candidates ?? []).filter((a) => {
    const startDt = new Date(`${a.date}T${a.start_time}:00`)
    return startDt <= now
  })

  if (!activities.length) {
    return new Response(JSON.stringify({ notified: 0 }), { status: 200 })
  }

  let totalNotified = 0

  for (const activity of activities) {
    // 2. Get all active participants (joined/approved)
    const { data: parts } = await supabase
      .from('participants')
      .select('user_id')
      .eq('activity_id', activity.id)
      .in('status', ['joined', 'approved'])

    // Collect unique user IDs: host + all participants
    const userIds = new Set<string>([activity.host_id])
    for (const p of parts ?? []) userIds.add(p.user_id)

    // 3. Fetch push tokens for all those users in one query
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, expo_push_token')
      .in('id', [...userIds])

    // 4. Send push to each user that has a token
    const messages = (profiles ?? [])
      .filter((p) => p.expo_push_token?.startsWith('ExponentPushToken'))
      .map((p) => ({
        to: p.expo_push_token,
        title: 'Activity Starting Now 🏃',
        body: `"${activity.title}" has started!`,
        sound: 'default',
        priority: 'high',
        channelId: 'default',
        data: {
          type: 'activity_started',
          activity_id: activity.id,
          activity_title: activity.title,
        },
      }))

    if (messages.length > 0) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages), // Expo accepts batch arrays
      })
      totalNotified += messages.length
    }

    // 5. Mark as notified so we never send again
    await supabase
      .from('activities')
      .update({ start_notified: true })
      .eq('id', activity.id)
  }

  console.log(`[notify-activity-start] notified ${totalNotified} users across ${activities.length} activities`)
  return new Response(JSON.stringify({ notified: totalNotified, activities: activities.length }), { status: 200 })
})
