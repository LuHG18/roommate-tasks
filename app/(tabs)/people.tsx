import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { 
  Alert, 
  FlatList, 
  Text, 
  View, 
  StyleSheet, 
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  useColorScheme,
  RefreshControl,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Person {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  shared_households: string[];
  household_count: number;
  friend_status: 'none' | 'pending' | 'accepted' | 'blocked';
  is_friend: boolean;
}

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  sender_name: string;
  sender_email: string;
  sender_avatar: string | null;
}

export default function PeopleScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [people, setPeople] = useState<Person[]>([]);
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
      }
    };
    getCurrentUser();
  }, []);

  // Fetch people
  const fetchPeople = async () => {
    if (!userId) return;

    try {
      // Get all households the user is a member of
      const { data: userHouseholds } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('id', userId)
        .eq('is_active', true);

      if (!userHouseholds) return;

      const householdIds = userHouseholds.map(h => h.household_id);

      // Get all members from these households
      const { data: allMembers, error: membersError } = await supabase
        .from('household_members')
        .select(`
          id,
          household_id,
          profiles(
            id,
            email,
            full_name,
            avatar_url
          )
        `)
        .in('household_id', householdIds)
        .eq('is_active', true);

      if (membersError) {
        console.error('Error fetching members:', membersError);
        Alert.alert('Error', 'Failed to load people');
        return;
      }

      // Group people by their ID and count shared households
      const peopleMap = new Map<string, Person>();

      allMembers?.forEach(member => {
        const personId = member.id;
        const profile = member.profiles;

        if (personId === userId) return; // Skip current user

        if (peopleMap.has(personId)) {
          // Add this household to shared households
          const existingPerson = peopleMap.get(personId)!;
          existingPerson.shared_households.push(member.household_id);
          existingPerson.household_count = existingPerson.shared_households.length;
        } else {
          // Create new person entry
          peopleMap.set(personId, {
            id: personId,
            email: profile?.email || 'Unknown',
            full_name: profile?.full_name || null,
            avatar_url: profile?.avatar_url || null,
            shared_households: [member.household_id],
            household_count: 1,
          });
        }
      });

      const peopleList = Array.from(peopleMap.values());
      setPeople(peopleList);
      setFilteredPeople(peopleList);
    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPeople();
  }, [userId]);

  // Filter people based on search
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = people.filter(person =>
        (person.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
        person.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredPeople(filtered);
    } else {
      setFilteredPeople(people);
    }
  }, [people, searchQuery]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPeople();
  };

  const handlePersonPress = (person: Person) => {
    // Navigate to person detail (we'll create this later)
    Alert.alert(
      person.full_name || person.email,
      `You share ${person.household_count} household${person.household_count === 1 ? '' : 's'} with this person.`,
      [
        { text: 'OK', style: 'default' }
      ]
    );
  };

  const renderPerson = ({ item }: { item: Person }) => (
    <TouchableOpacity 
      style={[styles.personCard, isDark && styles.personCardDark]}
      onPress={() => handlePersonPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.personInfo}>
        <View style={[styles.avatar, isDark && styles.avatarDark]}>
          {item.avatar_url ? (
            <Text style={[styles.avatarText, isDark && styles.avatarTextDark]}>
              {(item.full_name || item.email).charAt(0).toUpperCase()}
            </Text>
          ) : (
            <Ionicons name="person" size={24} color={isDark ? "#8E8E93" : "#8E8E93"} />
          )}
        </View>
        
        <View style={styles.personDetails}>
          <Text style={[styles.personName, isDark && styles.personNameDark]}>
            {item.full_name || item.email}
          </Text>
          {item.full_name && (
            <Text style={[styles.personEmail, isDark && styles.personEmailDark]}>
              {item.email}
            </Text>
          )}
          <View style={styles.householdInfo}>
            <Ionicons name="home" size={14} color={isDark ? "#5AC8FA" : "#4A90E2"} />
            <Text style={[styles.householdText, isDark && styles.householdTextDark]}>
              {item.household_count} shared household{item.household_count === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
      </View>
      
      <Ionicons name="chevron-forward" size={20} color={isDark ? "#8E8E93" : "#C7C7CC"} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? "#5AC8FA" : "#4A90E2"} />
          <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
            Loading people...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#1C1C1E" : "#f8f9fa"} />
      
      {/* Search Bar */}
      <View style={[styles.searchContainer, isDark && styles.searchContainerDark]}>
        <Ionicons name="search" size={20} color={isDark ? "#8E8E93" : "#8E8E93"} />
        <TextInput
          placeholder="Search people..."
          placeholderTextColor={isDark ? "#8E8E93" : "#8E8E93"}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[styles.searchInput, isDark && styles.searchInputDark]}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={isDark ? "#8E8E93" : "#8E8E93"} />
          </TouchableOpacity>
        )}
      </View>

      {/* People List */}
      <View style={styles.peopleContainer}>
        <FlatList
          data={filteredPeople}
          keyExtractor={(item) => item.id}
          renderItem={renderPerson}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.peopleContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={isDark ? "#5AC8FA" : "#4A90E2"}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={isDark ? "#48484A" : "#C7C7CC"} />
              <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>
                {searchQuery ? 'No people found' : 'No people yet'}
              </Text>
              <Text style={[styles.emptySubtitle, isDark && styles.emptySubtitleDark]}>
                {searchQuery 
                  ? 'Try adjusting your search'
                  : 'People you share households with will appear here'
                }
              </Text>
            </View>
          }
        />
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchContainerDark: {
    backgroundColor: '#1C1C1E',
    shadowOpacity: 0.3,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#1C1C1E',
  },
  searchInputDark: {
    color: '#FFFFFF',
  },
  peopleContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  peopleContent: {
    paddingBottom: 20,
  },
  personCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  personCardDark: {
    backgroundColor: '#1C1C1E',
    shadowOpacity: 0.3,
  },
  personInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarDark: {
    backgroundColor: '#5AC8FA',
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  avatarTextDark: {
    color: 'white',
  },
  personDetails: {
    flex: 1,
  },
  personName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  personNameDark: {
    color: '#FFFFFF',
  },
  personEmail: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  personEmailDark: {
    color: '#8E8E93',
  },
  householdInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  householdText: {
    fontSize: 13,
    color: '#4A90E2',
    fontWeight: '500',
  },
  householdTextDark: {
    color: '#5AC8FA',
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
});
