export type ActivityCategory =
  | 'social'
  | 'nightlife'
  | 'food_drinks'
  | 'sports'
  | 'outdoors'
  | 'arts'
  | 'gaming'
  | 'other'

export interface CategoryMeta {
  id: ActivityCategory
  label: string
  icon: string   // Ionicons name
  color: string
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'social',      label: 'Social',        icon: 'people-outline',           color: '#3B82F6' },
  { id: 'nightlife',   label: 'Nightlife',     icon: 'moon-outline',             color: '#7C3AED' },
  { id: 'food_drinks', label: 'Food & Drinks', icon: 'restaurant-outline',       color: '#F59E0B' },
  { id: 'sports',      label: 'Sports',        icon: 'fitness-outline',          color: '#10B981' },
  { id: 'outdoors',    label: 'Outdoors',      icon: 'leaf-outline',             color: '#84CC16' },
  { id: 'arts',        label: 'Arts',          icon: 'color-palette-outline',    color: '#EC4899' },
  { id: 'gaming',      label: 'Gaming',        icon: 'game-controller-outline',  color: '#6366F1' },
  { id: 'other',       label: 'Other',         icon: 'apps-outline',             color: '#9CA3AF' },
]

export const CATEGORY_MAP: Record<ActivityCategory, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c])
) as Record<ActivityCategory, CategoryMeta>

export function getCategoryMeta(id: ActivityCategory | null | undefined): CategoryMeta {
  return (id && CATEGORY_MAP[id]) || CATEGORY_MAP['other']
}
