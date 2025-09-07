import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/households');
      }
    };
    checkSession();
  }, []);

  const handleAuth = async () => {
    setLoading(true);

    const { error } = isSigningUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      Alert.alert(`${isSigningUp ? 'Sign Up' : 'Login'} error`, error.message);
    } else {
      if (isSigningUp) {
        Alert.alert('Sign up successful!', 'You can now log in.');
        setIsSigningUp(false); // stay on login screen
      } else {
        Alert.alert('Logged in!');
        router.replace('/households');
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Roommate Task App</Text>

      <TextInput
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      <TextInput
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        secureTextEntry
        style={styles.input}
      />

      <Button
        title={loading ? (isSigningUp ? 'Signing up...' : 'Logging in...') : isSigningUp ? 'Sign Up' : 'Log In'}
        onPress={handleAuth}
        disabled={loading}
      />

      <TouchableOpacity onPress={() => setIsSigningUp(!isSigningUp)} style={{ marginTop: 16 }}>
        <Text style={{ textAlign: 'center', color: 'blue' }}>
          {isSigningUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 16,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
});
