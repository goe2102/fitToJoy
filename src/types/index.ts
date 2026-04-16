// ─── Profile ──────────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  username: string
  email: string
  bio: string | null
  avatar_url: string | null
  birthday: string | null
  is_private: boolean
  is_verified: boolean
  onboarding_complete: boolean
  expo_push_token: string | null
  average_rating: number | null
  rating_count: number
  updated_at: string
}

export interface ProfileStats {
  follower_count: number
  following_count: number
  activity_count: number
  finished_count: number
}

// ─── Follow ───────────────────────────────────────────────────────────────────

export type FollowStatus = 'none' | 'pending' | 'accepted'

export interface Follow {
  follower_id: string
  following_id: string
  status: 'pending' | 'accepted'
  created_at: string
}

// ─── Block ────────────────────────────────────────────────────────────────────

export interface Block {
  blocker_id: string
  blocked_id: string
  created_at: string
}

// ─── Report ───────────────────────────────────────────────────────────────────

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'fake' | 'other'

export interface Report {
  id: string
  reporter_id: string
  reported_id: string
  reason: ReportReason
  description: string | null
  created_at: string
}

// ─── Activity ─────────────────────────────────────────────────────────────────

export type ActivityStatus = 'active' | 'cancelled' | 'expired' | 'finished'
export type RecurrenceType = 'weekly' | 'biweekly' | 'monthly'
export type { ActivityCategory } from '@/constants/categories'

export interface Activity {
  id: string
  host_id: string
  title: string
  description: string | null
  latitude: number
  longitude: number
  date: string
  start_time: string
  duration_minutes: number
  is_public: boolean
  max_participants: number | null
  cover_image_url: string | null
  price: number | null
  min_age: number | null
  max_age: number | null
  join_cutoff_minutes: number | null
  is_outdoor: boolean
  category: import('@/constants/categories').ActivityCategory
  tags: string[]
  status: ActivityStatus
  is_recurring: boolean
  recurrence: RecurrenceType | null
  parent_id: string | null
  created_at: string
  updated_at: string
  // joined via query
  host?: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'is_verified'>
  participant_count?: number
}

// ─── Participant ──────────────────────────────────────────────────────────────

export type ParticipantStatus = 'pending' | 'approved' | 'joined' | 'left' | 'kicked' | 'waitlisted'

export interface Participant {
  activity_id: string
  user_id: string
  status: ParticipantStatus
  checked_in: boolean
  created_at: string
  profile?: Pick<Profile, 'id' | 'username' | 'avatar_url'>
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  read: boolean
  created_at: string
}

export interface Conversation {
  id: string
  participant_1: string
  participant_2: string
  last_message_at: string | null
  created_at: string
  // joined
  other_profile?: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'is_verified'>
  last_message?: Pick<Message, 'content' | 'sender_id' | 'created_at' | 'read'> | null
  unread_count?: number
  muted?: boolean
  cleared_at?: string | null   // timestamp: only messages after this are visible to current user
}

// ─── Group Chat ───────────────────────────────────────────────────────────────

export interface GroupMessage {
  id: string
  chat_id: string
  sender_id: string
  content: string
  created_at: string
  sender?: Pick<Profile, 'id' | 'username' | 'avatar_url'>
}

export interface ActivityChat {
  id: string
  activity_id: string
  created_at: string
  activity?: {
    id: string
    title: string
    host_id: string
    cover_image_url?: string | null
    date?: string
    start_time?: string
    duration_minutes?: number
    status?: string
  }
  last_message?: Pick<GroupMessage, 'content' | 'sender_id' | 'created_at'> | null
  unread_count?: number
  muted?: boolean
}

// ─── Notification ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'follow_request'
  | 'follow_accepted'
  | 'new_follower'
  | 'join_request'
  | 'joined_activity'
  | 'join_approved'
  | 'join_denied'
  | 'activity_updated'
  | 'activity_cancelled'
  | 'kicked_from_activity'
  | 'new_message'
  | 'new_group_message'
  | 'activity_started'
  | 'waitlist_promoted'
  | 'next_session_scheduled'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  payload: Record<string, unknown>
  read: boolean
  created_at: string
}

// ─── Rating ───────────────────────────────────────────────────────────────────

export interface Rating {
  id: string
  activity_id: string
  rater_id: string
  ratee_id: string
  rating: number
  review_text: string | null
  created_at: string
}
