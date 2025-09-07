import { useState } from 'react'
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native'
import { supabase } from '../../lib/supabaseClient'

export default function AuthScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email })

    if (error) {
      Alert.alert('Login error', error.message)
    } else {
      Alert.alert('Check your email', 'We sent you a magic link to log in.')
    }

    setLoading(false)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Roommate Task App</Text>
      <Text style={styles.label}>Sign in with your email</Text>
      <TextInput
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />
      <Button title={loading ? 'Sending...' : 'Send Magic Link'} onPress={handleLogin} disabled={loading} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 100,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    marginBottom: 12,
  },
  input: {
    height: 48,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
})
