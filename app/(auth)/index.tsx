import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { 
  Alert, 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View, 
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useColorScheme
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Redirect if already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/(tabs)/households');
      }
    };
    checkSession();
  }, []);

  const handleAuth = async () => {
    setLoading(true);

    const { data, error } = isSigningUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      Alert.alert(`${isSigningUp ? 'Sign Up' : 'Login'} error`, error.message);
    } else {
      if (isSigningUp) {
        // Create user profile in users table
        if (data.user) {
          await supabase
            .from('users')
            .insert({
              id: data.user.id,
              email: data.user.email || '',
              name: data.user.email?.split('@')[0] || 'User',
            });
        }
        Alert.alert('Sign up successful!', 'You can now log in.');
        setIsSigningUp(false); // stay on login screen
      } else {
        // Ensure user exists in users table
        if (data.user) {
          const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('id', data.user.id)
            .single();

          if (!existingUser) {
            await supabase
              .from('users')
              .insert({
                id: data.user.id,
                email: data.user.email || '',
                name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
              });
          }
        }
        Alert.alert('Logged in!');
        router.replace('/(tabs)/households');
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#000000" : "#f8f9fa"} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.logoContainer, isDark && styles.logoContainerDark]}>
              <Ionicons name="home" size={48} color={isDark ? "#5AC8FA" : "#4A90E2"} />
            </View>
            <Text style={[styles.title, isDark && styles.titleDark]}>Roommate Tasks</Text>
            <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
              {isSigningUp ? 'Create your account' : 'Welcome back!'}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
              <Ionicons name="mail" size={20} color="#8E8E93" style={styles.inputIcon} />
              <TextInput
                placeholder="Enter your email"
                placeholderTextColor="#8E8E93"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.input, isDark && styles.inputDark]}
              />
            </View>

            <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
              <Ionicons name="lock-closed" size={20} color="#8E8E93" style={styles.inputIcon} />
              <TextInput
                placeholder="Enter your password"
                placeholderTextColor="#8E8E93"
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                secureTextEntry
                style={[styles.input, isDark && styles.inputDark]}
              />
            </View>

            <TouchableOpacity 
              style={[styles.authButton, loading && styles.authButtonDisabled]}
              onPress={handleAuth}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Ionicons 
                    name={isSigningUp ? "person-add" : "log-in"} 
                    size={20} 
                    color="white" 
                  />
                  <Text style={styles.authButtonText}>
                    {isSigningUp ? 'Sign Up' : 'Log In'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setIsSigningUp(!isSigningUp)} 
              style={styles.switchButton}
              activeOpacity={0.7}
            >
              <Text style={[styles.switchText, isDark && styles.switchTextDark]}>
                {isSigningUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={[styles.switchTextBold, isDark && styles.switchTextBoldDark]}>
                  {isSigningUp ? 'Log in' : 'Sign up'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#4A90E2',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  logoContainerDark: {
    backgroundColor: '#2C2C2E',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  subtitleDark: {
    color: '#8E8E93',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  inputContainerDark: {
    backgroundColor: '#1C1C1E',
    shadowOpacity: 0.3,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
  },
  inputDark: {
    color: '#FFFFFF',
  },
  authButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 16,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
    shadowColor: '#4A90E2',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  authButtonDisabled: {
    backgroundColor: '#C7C7CC',
    shadowOpacity: 0,
    elevation: 0,
  },
  authButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  switchText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  switchTextDark: {
    color: '#8E8E93',
  },
  switchTextBold: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  switchTextBoldDark: {
    color: '#5AC8FA',
  },
});
