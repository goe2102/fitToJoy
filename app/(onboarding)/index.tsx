import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native'
import { useGlobalStyles } from '@/hooks/useGlobalStyles'
import { Colors } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useAuth } from '@/context/AuthContext'

// You can add as many steps to this array as you want!
const slides = [
  {
    id: 1,
    title: 'Welcome to FitToJoy',
    description: 'We are so glad you are here. Let us get your profile set up.',
  },
  {
    id: 2,
    title: 'Track Your Progress',
    description: 'We will help you keep track of your daily habits and goals.',
  },
  {
    id: 3,
    title: 'All Set!',
    description: 'You are ready to begin your journey.',
  },
]

export default function OnboardingScreen() {
  const globalStyles = useGlobalStyles()
  const theme = useColorScheme() ?? 'light'
  const { completeOnboarding } = useAuth()

  const [currentStep, setCurrentStep] = useState(0)

  const handleNext = async () => {
    if (currentStep === slides.length - 1) {
      await completeOnboarding() // This triggers the router to push to (tabs)
    } else {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const slide = slides[currentStep]

  return (
    <SafeAreaView
      style={[globalStyles.container, { justifyContent: 'space-between' }]}
    >
      {/* Top Progress Indicator */}
      <View
        style={[globalStyles.row, { justifyContent: 'center', marginTop: 24 }]}
      >
        {slides.map((_, index) => (
          <View
            key={index}
            style={{
              height: 8,
              width: index === currentStep ? 24 : 8,
              borderRadius: 4,
              marginHorizontal: 4,
              backgroundColor:
                index === currentStep
                  ? Colors[theme].tint
                  : Colors[theme].border,
            }}
          />
        ))}
      </View>

      {/* Slide Content */}
      <View style={globalStyles.card}>
        <Text style={[globalStyles.title, { textAlign: 'center' }]}>
          {slide.title}
        </Text>
        <Text
          style={[globalStyles.body, { textAlign: 'center', marginTop: 16 }]}
        >
          {slide.description}
        </Text>
      </View>

      {/* Bottom Button */}
      <TouchableOpacity
        style={{
          marginBottom: 24,
          padding: 16,
          backgroundColor: Colors[theme].tint,
          borderRadius: 8,
          alignItems: 'center',
        }}
        onPress={handleNext}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
          {currentStep === slides.length - 1 ? 'Get Started' : 'Next'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}
