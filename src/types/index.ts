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
  updated_at: string
}

export interface ProfileStats {
  follower_count: number
  following_count: number
  activity_count: number
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

// ─── Activity ─────────────────────────────────────────────────────────────────

export type ActivityStatus = 'active' | 'cancelled' | 'expired'

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
  status: ActivityStatus
  created_at: string
  updated_at: string
  // joined via query
  host?: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'is_verified'>
  participant_count?: number
}

// ─── Participant ──────────────────────────────────────────────────────────────

export type ParticipantStatus = 'pending' | 'approved' | 'joined' | 'left' | 'kicked'

export interface Participant {
  activity_id: string
  user_id: string
  status: ParticipantStatus
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
}

// ─── Notification ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'follow_request'
  | 'follow_accepted'
  | 'join_request'
  | 'join_approved'
  | 'join_denied'
  | 'activity_updated'
  | 'activity_cancelled'
  | 'kicked_from_activity'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  payload: Record<string, unknown>
  read: boolean
  created_at: string
}
