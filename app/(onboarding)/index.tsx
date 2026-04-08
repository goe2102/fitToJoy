import React, { useRef, useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import {
  useOnboarding,
  OnboardingData,
} from '../../src/context/OnboardingContext'
import { Button } from '../../src/components/ui'
import { colors, spacing, typography, radius } from '../../src/constants/theme'
import { ONBOARDING_SLIDES } from './slides'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export default function OnboardingScreen() {
  const { completeOnboarding } = useOnboarding()
  const flatListRef = useRef<FlatList>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState<Record<string, unknown>>({
    username: '',
    birthday: '',
    focusAreas: [] as string[],
  })

  // State to track Supabase username check
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle')

  const isLast = currentIndex === ONBOARDING_SLIDES.length - 1

  // Debounced Username Availability Check
  useEffect(() => {
    const username = (values.username as string)?.trim().toLowerCase()
    if (!username) {
      setUsernameStatus('idle')
      return
    }
    if (username.length < 3) {
      setUsernameStatus('invalid')
      return
    }

    setUsernameStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', username)
          .maybeSingle()

        if (data) {
          setUsernameStatus('taken')
        } else {
          setUsernameStatus('available')
        }
      } catch (error) {
        setUsernameStatus('idle')
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [values.username])

  // Strict Validation to disable the "Next" button
  const isNextDisabled = () => {
    const currentSlide = ONBOARDING_SLIDES[currentIndex]

    // 1. Check Username
    if (currentSlide.key === 'username') {
      return usernameStatus !== 'available'
    }

    // 2. Check Birthday (Strict Date Validation)
    if (currentSlide.key === 'birthday') {
      const b = values.birthday as string
      if (!b || b.length !== 10) return true

      const [d, m, y] = b.split('.').map(Number)
      const date = new Date(y, m - 1, d)

      // Ensures exact calendar match (blocks "31.02") and reasonable years
      const isValidDate =
        date.getFullYear() === y &&
        date.getMonth() === m - 1 &&
        date.getDate() === d &&
        y >= 1900 &&
        y <= new Date().getFullYear()

      return !isValidDate
    }

    // 3. Fallback check for empty arrays/strings on other slides
    const val = values[currentSlide.key]
    if (Array.isArray(val) && val.length === 0) return true
    if (!val && val !== 0) return true

    return false
  }

  const goNext = () => {
    if (isLast) {
      handleFinish()
      return
    }
    const next = currentIndex + 1
    flatListRef.current?.scrollToIndex({ index: next, animated: true })
    setCurrentIndex(next)
  }

  const goPrev = () => {
    if (currentIndex === 0) return
    const prev = currentIndex - 1
    flatListRef.current?.scrollToIndex({ index: prev, animated: true })
    setCurrentIndex(prev)
  }

  const handleFinish = async () => {
    setSaving(true)
    // IMPORTANT: Make sure to update your OnboardingData type in OnboardingContext
    // to include username and birthday to save them to your database!

    const avatarData = values.avatar as
      | { base64: string; uri: string }
      | undefined

    await completeOnboarding({
      username: (values.username as string) ?? '',
      birthday: (values.birthday as string) ?? '',
      avatarBase64: avatarData?.base64,
    } as unknown as OnboardingData)
    setSaving(false)
  }

  const updateValue = (key: string, val: unknown) => {
    setValues((prev) => ({ ...prev, [key]: val }))
  }

  // Pass down dynamic states to slides if they need it
  const slideExtraState = { usernameStatus }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Top Header Navigation & Progress */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={goPrev}
          disabled={currentIndex === 0}
        >
          {currentIndex > 0 ? <Text style={styles.backBtnText}>←</Text> : null}
        </TouchableOpacity>

        {/* Segmented Progress View */}
        <View style={styles.progressContainer}>
          {ONBOARDING_SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressSegment,
                i <= currentIndex && styles.progressSegmentActive,
              ]}
            />
          ))}
        </View>

        <View style={styles.headerSpacer} />
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={ONBOARDING_SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={styles.emojiCircle}>
              <Text style={styles.slideEmoji}>{item.emoji}</Text>
            </View>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
            <View style={styles.slideContent}>
              {item.render(
                values[item.key],
                (val: unknown) => updateValue(item.key, val),
                slideExtraState
              )}
            </View>
          </View>
        )}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Bottom Action Area */}
      <View style={styles.bottomContainer}>
        <Button
          title={isLast ? "Los geht's 🚀" : 'Nächster Schritt'}
          onPress={goNext}
          loading={saving}
          disabled={isNextDisabled()}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backBtnText: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  headerSpacer: {
    width: 40,
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  progressSegmentActive: {
    backgroundColor: colors.primary,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  emojiCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  slideEmoji: { fontSize: 36 },
  slideTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  slideSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  slideContent: { width: '100%' },
  bottomContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
})
