import { colors } from '@/constants/theme'
import { Tabs } from 'expo-router'
import { Text } from 'react-native'

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name='home'
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>🏠</Text>
          ),
        }}
      />
      <Tabs.Screen
        name='workout'
        options={{
          title: 'Training',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>💪</Text>
          ),
        }}
      />
      <Tabs.Screen
        name='profile'
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>👤</Text>
          ),
        }}
      />
    </Tabs>
  )
}
