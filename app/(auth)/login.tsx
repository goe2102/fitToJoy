import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  useColorScheme,
  Alert,
} from 'react-native'
import { Colors } from '@/constants/theme'
import { useAuth } from '@/context/AuthContext'
import { useGlobalStyles } from '@/hooks/useGlobalStyles'

export default function LoginScreen() {
  const globalStyles = useGlobalStyles()
  const theme = useColorScheme() ?? 'light'
  const { signIn, signUp } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)

  const handleAction = async () => {
    try {
      if (isRegistering) {
        await signUp(email, password)
        Alert.alert(
          'Success',
          'Verification email sent! Please check your inbox.'
        )
        setIsRegistering(false)
      } else {
        await signIn(email, password)
      }
    } catch (error: any) {
      Alert.alert('Error', error.message)
    }
  }

  return (
    <View style={[globalStyles.container, { justifyContent: 'center' }]}>
      <View style={globalStyles.card}>
        <Text style={globalStyles.title}>
          {isRegistering ? 'Create Account' : 'Welcome Back'}
        </Text>
        <Text style={globalStyles.body}>
          {isRegistering
            ? 'Sign up to get started.'
            : 'Sign in to your account.'}
        </Text>

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
          placeholder='Email address'
          placeholderTextColor={Colors[theme].icon}
          autoCapitalize='none'
          keyboardType='email-address'
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={{
            marginTop: 16,
            padding: 16,
            borderColor: Colors[theme].border,
            borderWidth: 1,
            borderRadius: 8,
            color: Colors[theme].text,
            fontSize: 16,
          }}
          placeholder='Password'
          placeholderTextColor={Colors[theme].icon}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={{
            marginTop: 24,
            padding: 16,
            backgroundColor: Colors[theme].tint,
            borderRadius: 8,
            alignItems: 'center',
          }}
          onPress={handleAction}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
            {isRegistering ? 'Sign Up' : 'Log In'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ marginTop: 16, alignItems: 'center' }}
          onPress={() => setIsRegistering(!isRegistering)}
        >
          <Text style={{ color: Colors[theme].icon }}>
            {isRegistering
              ? 'Already have an account? Log In'
              : "Don't have an account? Sign Up"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
