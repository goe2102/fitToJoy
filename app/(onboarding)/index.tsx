import React, { useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native'
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
    focusAreas: [] as string[],
  })

  const isLast = currentIndex === ONBOARDING_SLIDES.length - 1

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
    await completeOnboarding({
      name: (values.name as string) ?? '',
      goal: (values.goal as string) ?? '',
      fitnessLevel: (values.fitnessLevel as string) ?? '',
      weeklyWorkouts: (values.weeklyWorkouts as number) ?? 3,
      focusAreas: (values.focusAreas as string[]) ?? [],
    } satisfies OnboardingData)
    setSaving(false)
  }

  const updateValue = (key: string, val: unknown) => {
    setValues((prev) => ({ ...prev, [key]: val }))
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${((currentIndex + 1) / ONBOARDING_SLIDES.length) * 100}%`,
            },
          ]}
        />
      </View>

      {/* Dots */}
      <View style={styles.dots}>
        {ONBOARDING_SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === currentIndex && styles.dotActive]}
          />
        ))}
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
              {item.render(values[item.key], (val: unknown) =>
                updateValue(item.key, val)
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

      {/* Navigation */}
      <View style={styles.nav}>
        {currentIndex > 0 ? (
          <TouchableOpacity style={styles.backBtn} onPress={goPrev}>
            <Text style={styles.backBtnText}>← Zurück</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
        <Button
          title={isLast ? "Los geht's 🚀" : 'Weiter'}
          onPress={goNext}
          loading={saving}
          style={styles.nextBtn}
        />
      </View>

      <Text style={styles.stepCounter}>
        {currentIndex + 1} / {ONBOARDING_SLIDES.length}
      </Text>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  progressTrack: {
    height: 3,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  dotActive: { width: 20, backgroundColor: colors.primary },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
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
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  backBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  backBtnText: { ...typography.body, color: colors.textSecondary },
  nextBtn: { flex: 1 },
  stepCounter: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingBottom: spacing.md,
  },
})
