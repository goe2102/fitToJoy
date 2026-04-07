import { Colors } from '@/constants/theme'
import { useAuth } from '@/context/AuthContext'
import { useGlobalStyles } from '@/hooks/useGlobalStyles'
import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  useColorScheme,
} from 'react-native'

export default function LoginScreen() {
  const globalStyles = useGlobalStyles()
  const theme = useColorScheme() ?? 'light'
  const { sendPhoneCode, verifyCode } = useAuth()

  // State to track the user's input and which step they are on
  const [phoneNumber, setPhoneNumber] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [isCodeSent, setIsCodeSent] = useState(false)

  const handleSendCode = async () => {
    // Basic validation
    if (phoneNumber.length < 10) {
      alert('Please enter a valid phone number')
      return
    }

    await sendPhoneCode(phoneNumber)
    setIsCodeSent(true)
  }

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      alert('Code must be 6 digits')
      return
    }

    await verifyCode(verificationCode)
  }
  return (
    <View style={[globalStyles.container, { justifyContent: 'center' }]}>
      <View style={globalStyles.card}>
        <Text style={globalStyles.title}>
          {isCodeSent ? 'Enter Code' : 'Welcome Back'}
        </Text>
        <Text style={globalStyles.body}>
          {isCodeSent
            ? `We sent a 6-digit code to ${phoneNumber}`
            : 'Enter your phone number to sign in or create an account.'}
        </Text>

        {!isCodeSent ? (
          // STEP 1: Phone Number Input
          <>
            <TextInput
              style={{
                marginTop: 24,
                padding: 16,
                borderColor: Colors[theme].border,
                borderWidth: 1,
                borderRadius: 8,
                color: Colors[theme].text,
                fontSize: 16,
              }}
              placeholder='+1 555 555 5555'
              placeholderTextColor={Colors[theme].icon}
              keyboardType='phone-pad'
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />
            <TouchableOpacity
              style={{
                marginTop: 16,
                padding: 16,
                backgroundColor: Colors[theme].tint,
                borderRadius: 8,
                alignItems: 'center',
              }}
              onPress={handleSendCode}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                Send Code
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          // STEP 2: Verification Code Input
          <>
            <TextInput
              style={{
                marginTop: 24,
                padding: 16,
                borderColor: Colors[theme].border,
                borderWidth: 1,
                borderRadius: 8,
                color: Colors[theme].text,
                fontSize: 16,
                textAlign: 'center',
                letterSpacing: 8,
              }}
              placeholder='123456'
              placeholderTextColor={Colors[theme].icon}
              keyboardType='number-pad'
              maxLength={6}
              value={verificationCode}
              onChangeText={setVerificationCode}
            />
            <TouchableOpacity
              style={{
                marginTop: 16,
                padding: 16,
                backgroundColor: Colors[theme].tint,
                borderRadius: 8,
                alignItems: 'center',
              }}
              onPress={handleVerifyCode}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                Verify & Log In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: 16, alignItems: 'center' }}
              onPress={() => setIsCodeSent(false)}
            >
              <Text style={{ color: Colors[theme].icon }}>
                Wrong number? Go back.
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  )
}
