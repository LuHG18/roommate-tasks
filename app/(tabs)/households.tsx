import { supabase } from '@/lib/supabaseClient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { 
  Alert, 
  Button, 
  FlatList, 
  Text, 
  TextInput, 
  View, 
  StyleSheet, 
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  useColorScheme,
  Appearance,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HouseholdWithStats {
  id: string;
  name: string;
  member_count: number;
  task_count: number;
}

export default function HouseholdsScreen() {
  const router = useRouter();
  const [households, setHouseholds] = useState<HouseholdWithStats[]>([]);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [newHouseholdDescription, setNewHouseholdDescription] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Get logged in user
  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        router.replace('/(auth)');
        return;
      }

      setUserId(session.user.id);
    };

    getSession();
  }, []);

  // Fetch households the user is in
  useEffect(() => {
    if (!userId) return;

    const fetchHouseholds = async () => {
      console.log('Fetching households for user:', userId);
      
      const { data, error } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId);

      console.log('Fetch household memberships result:', { data, error });

      if (error) {
        console.error('Error fetching household memberships:', error);
        Alert.alert('Error fetching households', error.message);
        return;
      }

      if (!data || data.length === 0) {
        setHouseholds([]);
        return;
      }

      // Get household details
      const householdIds = data.map(item => item.household_id);
      const { data: householdsData, error: householdsError } = await supabase
        .from('households')
        .select('id, name')
        .in('id', householdIds);

      if (householdsError) {
        console.error('Error fetching households:', householdsError);
        Alert.alert('Error fetching households', householdsError.message);
        return;
      }

      // Get detailed stats for each household
      const householdsWithStats = await Promise.all(
        (householdsData || []).map(async (household) => {
          const householdId = household.id;
          
          // Get member count
          const { count: memberCount } = await supabase
            .from('household_members')
            .select('*', { count: 'exact', head: true })
            .eq('household_id', householdId)
            .eq('is_active', true);

          // Get task count
          const { count: taskCount } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('household_id', householdId);

          return {
            id: householdId,
            name: household.name ?? 'Unnamed',
            member_count: memberCount || 0,
            task_count: taskCount || 0,
          };
        })
      );

      console.log('Formatted households with stats:', householdsWithStats);
      
      // Log household names for debugging
      const householdNames = householdsWithStats.map(h => h.name);
      console.log(`📋 User ${userId} matches with ${householdsWithStats.length} households:`, householdNames);
      
      setHouseholds(householdsWithStats);
    };

    fetchHouseholds();
    
    // Polling to detect when user gets added to new households
    const pollInterval = setInterval(() => {
      if (userId) {
        console.log('🔄 Polling for household membership updates...');
        fetchHouseholds();
      }
    }, 2000); // Poll every 2 seconds

    // Cleanup interval on unmount
    return () => clearInterval(pollInterval);
  }, [userId]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        onRefresh();
      }
    }, [userId])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    if (userId) {
      // Re-fetch households with updated stats
      const { data, error } = await supabase
        .from('household_members')
        .select(`
          household_id, 
          households(
            id,
            name
          )
        `)
        .eq('user_id', userId);

      if (!error && data) {
        const householdsWithStats = await Promise.all(
          data.map(async (item) => {
            const householdId = item.household_id;
            
            const { count: memberCount } = await supabase
              .from('household_members')
              .select('*', { count: 'exact', head: true })
              .eq('household_id', householdId)
              .eq('is_active', true);

            const { count: taskCount } = await supabase
              .from('tasks')
              .select('*', { count: 'exact', head: true })
              .eq('household_id', householdId);

            return {
              id: householdId,
              name: (item.households as any)?.name ?? 'Unnamed',
              member_count: memberCount || 0,
              task_count: taskCount || 0,
            };
          })
        );
        setHouseholds(householdsWithStats);
      }
    }
    setRefreshing(false);
  };

  const createHousehold = async () => {
    if (!newHouseholdName.trim()) {
      Alert.alert('Error', 'Please enter a household name');
      return;
    }

    // Get userId from session if it's null
    let currentUserId = userId;
    if (!currentUserId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }
      currentUserId = session.user.id;
      setUserId(currentUserId);
    }

    console.log('Creating household:', { name: newHouseholdName, userId: currentUserId, userIdType: typeof currentUserId });

    try {
      // First, ensure the user exists in the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name')
        .eq('id', currentUserId)
        .single();

      console.log('User lookup result:', { userData, userError });

      if (userError && userError.code === 'PGRST116') {
        // User doesn't exist, create them
        console.log('User not found, creating user...');
        const { data: session } = await supabase.auth.getSession();
        console.log('Session data:', session);
        
        if (session.session?.user) {
          const { data: newUser, error: createUserError } = await supabase
            .from('users')
            .insert({
              id: currentUserId,
              email: session.session?.user.email || '',
              name: session.session?.user.user_metadata?.full_name || session.session?.user.email?.split('@')[0] || 'User',
            })
            .select()
            .single();

          console.log('User creation result:', { newUser, createUserError });

          if (createUserError) {
            console.error('User creation error:', createUserError);
            Alert.alert('Error', 'Failed to create user profile: ' + createUserError.message);
            return;
          }
        } else {
          console.error('No session found');
          Alert.alert('Error', 'No active session found');
          return;
        }
      } else if (userError) {
        console.error('User lookup error:', userError);
        Alert.alert('Error', 'Failed to verify user: ' + userError.message);
        return;
      }

      const { data, error } = await supabase
        .from('households')
        .insert({ 
          name: newHouseholdName, 
          description: newHouseholdDescription.trim() || null,
          created_by: currentUserId 
        })
        .select()
        .single();

      console.log('Household creation result:', { data, error });

      if (error) {
        console.error('Household creation error:', error);
        Alert.alert('Error creating household', error.message);
        return;
      }

      if (!data) {
        Alert.alert('Error', 'No data returned from household creation');
        return;
    }

    console.log('Adding user to household_members:', { 
        household_id: data.id, 
        user_id: currentUserId, 
        name: userData?.name || 'User' 
      });

      // Add current user to household_members
      const { data: memberData, error: memberError } = await supabase
        .from('household_members')
        .insert({ 
          household_id: data.id, 
          user_id: currentUserId,
          name: userData?.name || 'User'
        })
        .select();

      console.log('Member creation result:', { memberData, memberError });

      if (memberError) {
        console.error('Member creation error:', memberError);
        Alert.alert('Error joining household', memberError?.message || 'Unknown error');
        return;
      }

      console.log('Household created successfully:', data);
      setNewHouseholdName('');
      setNewHouseholdDescription('');
      
      // Add the new household with initial stats (1 member, 0 tasks)
      setHouseholds((prev) => [...prev, { 
        id: data.id, 
        name: data.name,
        member_count: 1, // The creator is automatically added as a member
        task_count: 0    // New household starts with no tasks
      }]);
      Alert.alert('Success', 'Household created successfully!');
    } catch (err) {
      console.error('Unexpected error:', err);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#1C1C1E" : "#f8f9fa"} />
      
      {/* Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>Your Households</Text>
        <Text style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}>Manage your shared living spaces</Text>
      </View>

      {/* Households List */}
      <View style={styles.listContainer}>
        <FlatList
          data={households}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={isDark ? "#5AC8FA" : "#4A90E2"}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.householdCard, isDark && styles.householdCardDark]}
              onPress={() => router.push(`/households/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={[styles.householdIcon, isDark && styles.householdIconDark]}>
                <Ionicons name="home" size={24} color={isDark ? "#5AC8FA" : "#4A90E2"} />
              </View>
              <View style={styles.householdInfo}>
                <Text style={[styles.householdName, isDark && styles.householdNameDark]}>
                  {item.name}
                </Text>
                <Text style={[styles.householdSubtext, isDark && styles.householdSubtextDark]}>
                  Tap to view details
                </Text>
                <View style={styles.householdStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="people" size={14} color={isDark ? "#8E8E93" : "#8E8E93"} />
                    <Text style={[styles.statText, isDark && styles.statTextDark]}>
                      {item.member_count} {item.member_count === 1 ? 'member' : 'members'}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="list" size={14} color={isDark ? "#34C759" : "#34C759"} />
                    <Text style={[styles.statText, isDark && styles.statTextDark]}>
                      {item.task_count} {item.task_count === 1 ? 'task' : 'tasks'}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.householdActions}>
                <Ionicons name="chevron-forward" size={20} color={isDark ? "#8E8E93" : "#C7C7CC"} />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="home-outline" size={64} color={isDark ? "#48484A" : "#C7C7CC"} />
              <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>No households yet</Text>
              <Text style={[styles.emptySubtitle, isDark && styles.emptySubtitleDark]}>Create your first household to get started</Text>
            </View>
          }
        />
      </View>

      {/* Create New Household Section */}
      <View style={[styles.createSection, isDark && styles.createSectionDark]}>
        <View style={styles.createHeader}>
          <Ionicons name="add-circle" size={20} color={isDark ? "#5AC8FA" : "#4A90E2"} />
          <Text style={[styles.createTitle, isDark && styles.createTitleDark]}>Create New Household</Text>
        </View>
        
        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Enter household name"
            placeholderTextColor={isDark ? "#8E8E93" : "#8E8E93"}
            value={newHouseholdName}
            onChangeText={setNewHouseholdName}
            style={[styles.textInput, isDark && styles.textInputDark]}
          />
          <TextInput
            placeholder="Enter description (optional)"
            placeholderTextColor={isDark ? "#8E8E93" : "#8E8E93"}
            value={newHouseholdDescription}
            onChangeText={setNewHouseholdDescription}
            style={[styles.textInput, styles.descriptionInput, isDark && styles.textInputDark]}
            multiline
            numberOfLines={2}
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.createButton, !newHouseholdName.trim() && styles.createButtonDisabled]}
              onPress={createHousehold}
              disabled={!newHouseholdName.trim()}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text style={styles.createButtonText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerDark: {
    backgroundColor: '#1C1C1E',
    borderBottomColor: '#38383A',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  headerTitleDark: {
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '400',
  },
  headerSubtitleDark: {
    color: '#8E8E93',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingVertical: 16,
  },
  householdCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  householdCardDark: {
    backgroundColor: '#1C1C1E',
    borderColor: '#38383A',
    shadowOpacity: 0.3,
  },
  householdIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    shadowColor: '#4A90E2',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  householdIconDark: {
    backgroundColor: '#2C2C2E',
  },
  householdInfo: {
    flex: 1,
  },
  householdName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  householdNameDark: {
    color: '#FFFFFF',
  },
  householdSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  householdSubtextDark: {
    color: '#8E8E93',
  },
  householdStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  statTextDark: {
    color: '#8E8E93',
  },
  householdActions: {
    paddingLeft: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyTitleDark: {
    color: '#FFFFFF',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptySubtitleDark: {
    color: '#8E8E93',
  },
  createSection: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  createSectionDark: {
    backgroundColor: '#1C1C1E',
    borderColor: '#38383A',
    shadowOpacity: 0.3,
  },
  createHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  createTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 8,
  },
  createTitleDark: {
    color: '#FFFFFF',
  },
  inputContainer: {
    gap: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  textInput: {
    flex: 1,
    height: 52,
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  descriptionInput: {
    marginTop: 8,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  textInputDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#38383A',
    color: '#FFFFFF',
  },
  createButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 16,
    paddingHorizontal: 24,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'flex-end',
    shadowColor: '#4A90E2',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonDisabled: {
    backgroundColor: '#C7C7CC',
    shadowOpacity: 0,
    elevation: 0,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
