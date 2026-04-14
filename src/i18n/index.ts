import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import en from './locales/en'
import de from './locales/de'

export const STORAGE_KEY = 'app_language'

export const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

// Synchronous init — starts with 'en', then async-loads the persisted choice.
i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    en: { translation: en },
    de: { translation: de },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

// Rehydrate persisted language without blocking startup.
AsyncStorage.getItem(STORAGE_KEY).then((lang) => {
  if (lang && lang !== i18n.language) {
    i18n.changeLanguage(lang)
  }
})

export async function setLanguage(code: LanguageCode): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, code)
  await i18n.changeLanguage(code)
}

export default i18n
