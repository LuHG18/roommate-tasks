import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { 
  Alert, 
  Text, 
  View, 
  StyleSheet, 
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  useColorScheme,
  ScrollView,
  Image,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [uploading, setUploading] = useState(false);

  // Get current user profile
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profileData, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          // Create profile if it doesn't exist
          const { data: newProfile, error: createError } = await supabase
            .from('users')
            .insert({
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.full_name || null,
              avatar_url: session.user.user_metadata?.avatar_url || null,
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating profile:', createError);
            setProfile({
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.full_name || null,
              avatar_url: session.user.user_metadata?.avatar_url || null,
              created_at: new Date().toISOString(),
            });
          } else {
            setProfile(newProfile);
          }
        } else {
          setProfile(profileData);
        }
        setEditName(profileData?.name || '');
      }
      setLoading(false);
    };
    getCurrentUser();
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions to upload a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    if (!profile) return;

    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${profile.id}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) {
        throw updateError;
      }

      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      Alert.alert('Success', 'Profile picture updated!');
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ name: editName })
        .eq('id', profile.id);

      if (error) {
        throw error;
      }

      setProfile(prev => prev ? { ...prev, name: editName } : null);
      setEditing(false);
      Alert.alert('Success', 'Profile updated!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
              Alert.alert('Error', 'Failed to logout');
            } else {
              router.replace('/auth');
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? "#5AC8FA" : "#4A90E2"} />
          <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={isDark ? "#FF453A" : "#FF3B30"} />
          <Text style={[styles.errorTitle, isDark && styles.errorTitleDark]}>
            Profile not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#1C1C1E" : "#f8f9fa"} />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={[styles.profileHeader, isDark && styles.profileHeaderDark]}>
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={pickImage}
            disabled={uploading}
          >
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, isDark && styles.avatarPlaceholderDark]}>
                <Ionicons name="person" size={48} color={isDark ? "#8E8E93" : "#8E8E93"} />
              </View>
            )}
            <View style={[styles.avatarEditButton, isDark && styles.avatarEditButtonDark]}>
              {uploading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="camera" size={16} color="white" />
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.profileInfo}>
            {editing ? (
              <TextInput
                value={editName}
                onChangeText={setEditName}
                style={[styles.nameInput, isDark && styles.nameInputDark]}
                placeholder="Enter your name"
                placeholderTextColor={isDark ? "#8E8E93" : "#8E8E93"}
                autoFocus
              />
            ) : (
              <Text style={[styles.profileName, isDark && styles.profileNameDark]}>
                {profile.name || 'No name set'}
              </Text>
            )}
            <Text style={[styles.profileEmail, isDark && styles.profileEmailDark]}>
              {profile.email}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.editButton, isDark && styles.editButtonDark]}
            onPress={editing ? saveProfile : () => setEditing(true)}
          >
            <Ionicons 
              name={editing ? "checkmark" : "create"} 
              size={20} 
              color={isDark ? "#5AC8FA" : "#4A90E2"} 
            />
          </TouchableOpacity>
        </View>

        {/* Profile Details */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle" size={20} color={isDark ? "#5AC8FA" : "#4A90E2"} />
            <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
              Account Information
            </Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, isDark && styles.infoLabelDark]}>User ID:</Text>
            <Text style={[styles.infoValue, isDark && styles.infoValueDark]} numberOfLines={1}>
              {profile.id}
            </Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, isDark && styles.infoLabelDark]}>Member since:</Text>
            <Text style={[styles.infoValue, isDark && styles.infoValueDark]}>
              {formatDate(profile.created_at)}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="settings" size={20} color={isDark ? "#5AC8FA" : "#4A90E2"} />
            <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
              Account Actions
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.logoutButton]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out" size={20} color="white" />
            <Text style={styles.actionButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  loadingTextDark: {
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    textAlign: 'center',
  },
  errorTitleDark: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  profileHeaderDark: {
    backgroundColor: '#1C1C1E',
    shadowOpacity: 0.3,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderDark: {
    backgroundColor: '#2C2C2E',
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  avatarEditButtonDark: {
    backgroundColor: '#5AC8FA',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 20,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  profileNameDark: {
    color: '#FFFFFF',
  },
  profileEmail: {
    fontSize: 16,
    color: '#8E8E93',
  },
  profileEmailDark: {
    color: '#8E8E93',
  },
  nameInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  nameInputDark: {
    color: '#FFFFFF',
    backgroundColor: '#2C2C2E',
  },
  editButton: {
    padding: 8,
  },
  editButtonDark: {
    // Same as light mode
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionDark: {
    backgroundColor: '#1C1C1E',
    shadowOpacity: 0.3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 8,
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  infoLabelDark: {
    color: '#8E8E93',
  },
  infoValue: {
    fontSize: 14,
    color: '#1C1C1E',
    flex: 1,
    textAlign: 'right',
  },
  infoValueDark: {
    color: '#FFFFFF',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
