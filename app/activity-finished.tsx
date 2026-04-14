import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '@/hooks/useColors'
import { spacing, typography, radius } from '@/constants/theme'

const { width: W } = Dimensions.get('window')
const CIRCLE = 100

export default function ActivityFinishedScreen() {
  const { title } = useLocalSearchParams<{ title: string }>()
  const colors = useColors()
  const insets = useSafeAreaInsets()

  // Animation values
  const circleScale  = useRef(new Animated.Value(0)).current
  const checkOpacity = useRef(new Animated.Value(0)).current
  const ring1Scale   = useRef(new Animated.Value(1)).current
  const ring1Opacity = useRef(new Animated.Value(0)).current
  const ring2Scale   = useRef(new Animated.Value(1)).current
  const ring2Opacity = useRef(new Animated.Value(0)).current
  const ring3Scale   = useRef(new Animated.Value(1)).current
  const ring3Opacity = useRef(new Animated.Value(0)).current
  const textOpacity  = useRef(new Animated.Value(0)).current
  const textTranslate = useRef(new Animated.Value(16)).current

  useEffect(() => {
    // 1) Circle pops in
    Animated.spring(circleScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 60,
      friction: 7,
    }).start()

    // 2) Check fades in right after
    Animated.sequence([
      Animated.delay(200),
      Animated.timing(checkOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()

    // 3) Three ripple rings, staggered
    const ring = (scale: Animated.Value, opacity: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.6, duration: 1, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(scale, { toValue: 2.8, duration: 900, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
          ]),
        ]),
      ])

    ring(ring1Scale, ring1Opacity, 150)
    ring(ring2Scale, ring2Opacity, 350)
    ring(ring3Scale, ring3Opacity, 550)

    // 4) Text slides up and fades in
    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(textTranslate, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
    ]).start()
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <StatusBar barStyle={colors.text === '#F2F2F8' ? 'light-content' : 'dark-content'} />

      {/* Ripple rings */}
      {([ring1Scale, ring2Scale, ring3Scale] as const).map((scale, i) => {
        const opacity = [ring1Opacity, ring2Opacity, ring3Opacity][i]
        return (
          <Animated.View
            key={i}
            pointerEvents='none'
            style={{
              position: 'absolute',
              width: CIRCLE,
              height: CIRCLE,
              borderRadius: CIRCLE / 2,
              borderWidth: 2,
              borderColor: colors.success,
              transform: [{ scale }],
              opacity,
            }}
          />
        )
      })}

      {/* Circle + checkmark */}
      <Animated.View style={{
        width: CIRCLE,
        height: CIRCLE,
        borderRadius: CIRCLE / 2,
        backgroundColor: colors.success,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: circleScale }],
        shadowColor: colors.success,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
        elevation: 12,
      }}>
        <Animated.View style={{ opacity: checkOpacity }}>
          <Ionicons name='checkmark' size={52} color='#fff' />
        </Animated.View>
      </Animated.View>

      {/* Text block */}
      <Animated.View style={{
        marginTop: spacing.xl + spacing.md,
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        opacity: textOpacity,
        transform: [{ translateY: textTranslate }],
      }}>
        <Text style={[typography.h2, { color: colors.text, textAlign: 'center', marginBottom: spacing.sm }]}>
          Activity Finished!
        </Text>
        {title ? (
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.sm }]}
            numberOfLines={2}>
            "{title}"
          </Text>
        ) : null}
        <Text style={[typography.bodySmall, { color: colors.textMuted, textAlign: 'center', lineHeight: 20 }]}>
          Participants who checked in can now rate you. Great job hosting!
        </Text>
      </Animated.View>

      {/* Done button */}
      <Animated.View style={{
        position: 'absolute',
        bottom: insets.bottom + spacing.xl,
        left: spacing.lg,
        right: spacing.lg,
        opacity: textOpacity,
      }}>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/profile' as any)}
          style={{
            backgroundColor: colors.success,
            borderRadius: radius.full,
            paddingVertical: spacing.md + 2,
            alignItems: 'center',
          }}
          activeOpacity={0.85}
        >
          <Text style={[typography.button, { color: '#fff' }]}>Done</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}
