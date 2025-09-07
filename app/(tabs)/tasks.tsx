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
import TaskComponent from '@/components/TaskComponent';

interface Task {
  id: string;
  household_id: string;
  title: string;
  details: string;
  status: boolean;
  assignee: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  household_name: string;
}

interface FilterOption {
  id: string;
  label: string;
  value: string;
}

export default function MyTasksScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  const filterOptions: FilterOption[] = [
    { id: 'all', label: 'All Tasks', value: 'all' },
    { id: 'my-created', label: 'Created by Me', value: 'my-created' },
    { id: 'assigned-to-me', label: 'Assigned to Me', value: 'assigned-to-me' },
    { id: 'pending', label: 'Pending', value: 'pending' },
    { id: 'completed', label: 'Completed', value: 'completed' },
    { id: 'high-priority', label: 'High Priority', value: 'high-priority' },
  ];

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

  // Fetch tasks
  const fetchTasks = async () => {
    if (!userId) return;

    try {
      // Get all households the user is a member of
      const { data: householdMemberships } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('id', userId)
        .eq('is_active', true);

      if (!householdMemberships) return;

      const householdIds = householdMemberships.map(m => m.household_id);

      // Fetch all tasks from user's households
      const { data: tasksData, error } = await supabase
        .from('tasks')
        .select(`
          id,
          household_id,
          title,
          details,
          status,
          assignee,
          created_by,
          created_at,
          updated_at,
          due_date,
          priority,
          households(name)
        `)
        .in('household_id', householdIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tasks:', error);
        Alert.alert('Error', 'Failed to load tasks');
        return;
      }

      const transformedTasks = tasksData?.map(task => ({
        ...task,
        household_name: task.households?.name || 'Unknown Household',
        created_by: task.created_by || '',
        updated_at: task.updated_at || task.created_at,
        due_date: task.due_date || null,
        priority: task.priority || 'medium'
      })) || [];

      setTasks(transformedTasks);
      setFilteredTasks(transformedTasks);
    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [userId]);

  // Filter and search tasks
  useEffect(() => {
    let filtered = [...tasks];

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.household_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    switch (selectedFilter) {
      case 'my-created':
        filtered = filtered.filter(task => task.created_by === userId);
        break;
      case 'assigned-to-me':
        filtered = filtered.filter(task => task.assignee === userId);
        break;
      case 'pending':
        filtered = filtered.filter(task => !task.status);
        break;
      case 'completed':
        filtered = filtered.filter(task => task.status);
        break;
      case 'high-priority':
        filtered = filtered.filter(task => task.priority === 'high');
        break;
      default:
        // 'all' - no additional filtering
        break;
    }

    setFilteredTasks(filtered);
  }, [tasks, searchQuery, selectedFilter, userId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const renderTask = ({ item }: { item: Task }) => (
    <View style={styles.taskWrapper}>
      <TaskComponent 
        task={item} 
        onPress={() => router.push(`/tasks/${item.id}`)}
        isDark={isDark}
      />
      <View style={[styles.householdBadge, isDark && styles.householdBadgeDark]}>
        <Ionicons name="home" size={12} color={isDark ? "#5AC8FA" : "#4A90E2"} />
        <Text style={[styles.householdBadgeText, isDark && styles.householdBadgeTextDark]}>
          {item.household_name}
        </Text>
      </View>
    </View>
  );

  const renderFilterButton = (filter: FilterOption) => (
    <TouchableOpacity
      key={filter.id}
      style={[
        styles.filterButton,
        selectedFilter === filter.value && styles.filterButtonActive,
        isDark && styles.filterButtonDark,
        selectedFilter === filter.value && isDark && styles.filterButtonActiveDark
      ]}
      onPress={() => setSelectedFilter(filter.value)}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.filterButtonText,
        selectedFilter === filter.value && styles.filterButtonTextActive,
        isDark && styles.filterButtonTextDark,
        selectedFilter === filter.value && isDark && styles.filterButtonTextActiveDark
      ]}>
        {filter.label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? "#5AC8FA" : "#4A90E2"} />
          <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
            Loading your tasks...
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
          placeholder="Search tasks..."
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

      {/* Filter Buttons */}
      <View style={styles.filtersContainer}>
        <FlatList
          data={filterOptions}
          renderItem={({ item }) => renderFilterButton(item)}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        />
      </View>

      {/* Tasks List */}
      <View style={styles.tasksContainer}>
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          renderItem={renderTask}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.tasksContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={isDark ? "#5AC8FA" : "#4A90E2"}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={64} color={isDark ? "#48484A" : "#C7C7CC"} />
              <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>
                {searchQuery ? 'No tasks found' : 'No tasks yet'}
              </Text>
              <Text style={[styles.emptySubtitle, isDark && styles.emptySubtitleDark]}>
                {searchQuery 
                  ? 'Try adjusting your search or filters'
                  : 'Tasks from your households will appear here'
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
  filtersContainer: {
    marginBottom: 8,
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterButtonDark: {
    backgroundColor: '#2C2C2E',
  },
  filterButtonActive: {
    backgroundColor: '#4A90E2',
  },
  filterButtonActiveDark: {
    backgroundColor: '#5AC8FA',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  filterButtonTextDark: {
    color: '#FFFFFF',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  filterButtonTextActiveDark: {
    color: 'white',
  },
  tasksContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  tasksContent: {
    paddingBottom: 20,
  },
  taskWrapper: {
    marginBottom: 12,
  },
  householdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  householdBadgeDark: {
    backgroundColor: '#1A1A1A',
  },
  householdBadgeText: {
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: '500',
  },
  householdBadgeTextDark: {
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
