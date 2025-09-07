import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function HouseholdsScreen() {
  const router = useRouter();
  const [households, setHouseholds] = useState<any[]>([]);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  // Get logged in user
  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        router.replace('/auth');
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
        .select('household_id, households(name)')
        .eq('id', userId); // 👈 changed from user_id to id

      console.log('Fetch households result:', { data, error });

      if (error) {
        console.error('Error fetching households:', error);
        Alert.alert('Error fetching households', error.message);
        return;
      }

      const formatted = data?.map((item) => ({
        id: item.household_id,
        name: item.households?.name ?? 'Unnamed',
      })) || [];

      console.log('Formatted households:', formatted);
      setHouseholds(formatted);
    };

    fetchHouseholds();
  }, [userId]);

  const createHousehold = async () => {
    if (!newHouseholdName.trim()) {
      Alert.alert('Error', 'Please enter a household name');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    console.log('Creating household:', { name: newHouseholdName, userId });

    try {
      const { data, error } = await supabase
        .from('households')
        .insert({ name: newHouseholdName, created_by: userId })
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

      console.log('Adding user to household_members:', { household_id: data.id, user_id: userId });

      // Add current user to household_members
      const { error: memberError } = await supabase
        .from('household_members')
        .insert({ household_id: data.id, user_id: userId });

      if (memberError) {
        console.error('Member creation error:', memberError);
        Alert.alert('Error joining household', memberError.message);
        return;
      }

      console.log('Household created successfully:', data);
      setNewHouseholdName('');
      setHouseholds((prev) => [...prev, { id: data.id, name: data.name }]);
      Alert.alert('Success', 'Household created successfully!');
    } catch (err) {
      console.error('Unexpected error:', err);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Households</Text>
        <Text style={styles.headerSubtitle}>Manage your shared living spaces</Text>
      </View>

      {/* Households List */}
      <View style={styles.listContainer}>
        <FlatList
          data={households}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.householdCard}
              onPress={() => router.push(`/households/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.householdIcon}>
                <Ionicons name="home" size={24} color="#4A90E2" />
              </View>
              <View style={styles.householdInfo}>
                <Text style={styles.householdName}>{item.name}</Text>
                <Text style={styles.householdSubtext}>Tap to view details</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="home-outline" size={64} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>No households yet</Text>
              <Text style={styles.emptySubtitle}>Create your first household to get started</Text>
            </View>
          }
        />
      </View>

      {/* Create New Household Section */}
      <View style={styles.createSection}>
        <View style={styles.createHeader}>
          <Ionicons name="add-circle" size={20} color="#4A90E2" />
          <Text style={styles.createTitle}>Create New Household</Text>
        </View>
        
        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Enter household name"
            placeholderTextColor="#8E8E93"
            value={newHouseholdName}
            onChangeText={setNewHouseholdName}
            style={styles.textInput}
          />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '400',
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
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
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
  householdIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  householdInfo: {
    flex: 1,
  },
  householdName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  householdSubtext: {
    fontSize: 14,
    color: '#8E8E93',
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
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  createSection: {
    backgroundColor: 'white',
    margin: 16,
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
  createHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  createTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  createButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    paddingHorizontal: 20,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
