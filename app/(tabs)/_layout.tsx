import React, { useEffect, useMemo, useRef } from 'react'
import { Animated, StyleSheet, View, Platform } from 'react-native'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '@/hooks/useColors'
import { usePendingRequests } from '@/hooks/usePendingRequests'
import { useUnread } from '@/context/UnreadContext'
import { type AppColors } from '@/constants/theme'

// ─── Tab config ──────────────────────────────────────────────────────────────

const TABS = [
  { name: 'index',   label: 'Map',     icon: 'map'         },
  { name: 'search',  label: 'Search',  icon: 'search'      },
  { name: 'chats',   label: 'Chats',   icon: 'chatbubble'  },
  { name: 'profile', label: 'Profile', icon: 'person'      },
] as const

// ─── Animated Tab Icon ───────────────────────────────────────────────────────

function TabIcon({
  focused,
  label,
  iconName,
  color,
  colors,
}: {
  focused: boolean
  label: string
  iconName: React.ComponentProps<typeof Ionicons>['name']
  color: string
  colors: AppColors
}) {
  const styles = useMemo(() => makeTabStyles(colors), [colors])

  const pillScale   = useRef(new Animated.Value(focused ? 1 : 0.7)).current
  const pillOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current
  const labelOpacity = useRef(new Animated.Value(focused ? 1 : 0.6)).current
  const iconTransY  = useRef(new Animated.Value(focused ? -2 : 0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(pillScale,    { toValue: focused ? 1 : 0.7, useNativeDriver: true, tension: 120, friction: 8 }),
      Animated.timing(pillOpacity,  { toValue: focused ? 1 : 0,   duration: 180, useNativeDriver: true }),
      Animated.timing(labelOpacity, { toValue: focused ? 1 : 0.6, duration: 160, useNativeDriver: true }),
      Animated.spring(iconTransY,   { toValue: focused ? -2 : 0,  useNativeDriver: true, tension: 140, friction: 8 }),
    ]).start()
  }, [focused])

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.pill,
          { opacity: pillOpacity, transform: [{ scaleX: pillScale }, { scaleY: pillScale }] },
        ]}
      />
      <Animated.View style={{ transform: [{ translateY: iconTransY }] }}>
        <Ionicons name={iconName} size={20} color={color} />
      </Animated.View>
      <Animated.Text numberOfLines={1} style={[styles.label, { color, opacity: labelOpacity }]}>
        {label}
      </Animated.Text>
    </View>
  )
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const colors = useColors()
  const styles = useMemo(() => makeBarStyles(colors), [colors])
  const { count: requestCount } = usePendingRequests()
  const { totalUnread } = useUnread()

  return (
    <Tabs
      screenOptions={({ route }) => {
        const tab = TABS.find((t) => t.name === route.name)
        const iconName = (tab?.icon ?? 'ellipse') as React.ComponentProps<typeof Ionicons>['name']
        const label = tab?.label ?? route.name

        return {
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              label={label}
              iconName={iconName}
              color={color}
              colors={colors}
            />
          ),
        }
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarBadge: tab.name === 'profile' && requestCount > 0
              ? requestCount
              : tab.name === 'chats' && totalUnread > 0
                ? totalUnread
                : undefined,
          }}
        />
      ))}
    </Tabs>
  )
}

// ─── Style factories ─────────────────────────────────────────────────────────

function makeBarStyles(colors: AppColors) {
  return StyleSheet.create({
    tabBar: {
      position: 'absolute',
      height: Platform.OS === 'ios' ? 84 : 72,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      elevation: 0,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: -1 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      backgroundColor: colors.surface,
      paddingBottom: Platform.OS === 'ios' ? 22 : 8,
      paddingTop: 8,
    },
  })
}

function makeTabStyles(colors: AppColors) {
  return StyleSheet.create({
    wrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 46,
      minWidth: 56,
      paddingHorizontal: 4,
      gap: 3,
    },
    pill: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.primary + '18',
      borderRadius: 22,
      marginHorizontal: -10,
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
  })
}
