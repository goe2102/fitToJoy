export type HostBadge = {
  icon: string      // Ionicons name
  label: string
  color: string
  threshold: number
}

const BADGES: HostBadge[] = [
  { threshold: 1000, icon: 'trophy',       label: 'Legend',   color: '#FF6B00' },
  { threshold: 100,  icon: 'medal',        label: 'Pro Host', color: '#C0A000' },
  { threshold: 10,   icon: 'ribbon',       label: 'Regular',  color: '#5E9EFF' },
]

/** Returns all earned badges for a given finished-activity count. */
export function getEarnedBadges(finishedCount: number): HostBadge[] {
  return BADGES.filter((b) => finishedCount >= b.threshold)
}

/** Returns the single highest earned badge, or null. */
export function getTopBadge(finishedCount: number): HostBadge | null {
  return BADGES.find((b) => finishedCount >= b.threshold) ?? null
}

/** Returns the next badge to earn, or null if all earned. */
export function getNextBadge(finishedCount: number): (HostBadge & { remaining: number }) | null {
  const next = [...BADGES].reverse().find((b) => finishedCount < b.threshold)
  if (!next) return null
  return { ...next, remaining: next.threshold - finishedCount }
}
