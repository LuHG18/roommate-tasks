import { supabase } from '@/lib/supabaseClient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { 
  Alert, 
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
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TaskComponent from '@/components/TaskComponent';

interface Household {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'member' | 'viewer';
  joined_at: string;
  is_active: boolean;
}

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
}

export default function HouseholdDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDetails, setNewTaskDetails] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

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

  // Fetch household data
  const fetchHouseholdData = async () => {
    if (!id || !userId) return;

    try {
      // Fetch household details
      const { data: householdData, error: householdError } = await supabase
        .from('households')
        .select('*')
        .eq('id', id)
        .single();

      if (householdError) {
        console.error('Error fetching household:', householdError);
        Alert.alert('Error', 'Failed to load household details');
        return;
      }

      setHousehold(householdData);

      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from('household_members')
        .select(`
          id,
          name,
          role,
          joined_at,
          is_active,
          users(email, avatar_url, phone)
        `)
        .eq('household_id', id)
        .eq('is_active', true);

      if (membersError) {
        console.error('Error fetching members:', membersError);
      } else {
        // Transform the data to match our interface
        const transformedMembers = membersData?.map(member => ({
          id: member.id,
          email: member.users?.email || 'Unknown',
          name: member.name,
          role: member.role || 'member',
          joined_at: member.joined_at || new Date().toISOString(),
          is_active: member.is_active ?? true
        })) || [];
        setMembers(transformedMembers);
      }

      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
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
          priority
        `)
        .eq('household_id', id)
        .order('created_at', { ascending: false });

      if (tasksError) {
        console.error('Error fetching tasks:', tasksError);
      } else {
        // Transform tasks to include default values for new columns
        const transformedTasks = tasksData?.map(task => ({
          ...task,
          created_by: task.created_by || '',
          updated_at: task.updated_at || task.created_at,
          due_date: task.due_date || null,
          priority: task.priority || 'medium'
        })) || [];
        setTasks(transformedTasks);
      }

    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHouseholdData();
  }, [id, userId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHouseholdData();
  };

  const createTask = async () => {
    if (!newTaskTitle.trim() || !id || !userId) return;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: newTaskTitle,
          details: newTaskDetails,
          household_id: id,
          status: false,
          assignee: null,
          created_by: userId,
          priority: 'medium'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating task:', error);
        Alert.alert('Error', 'Failed to create task');
        return;
      }

      setNewTaskTitle('');
      setNewTaskDetails('');
      setTasks(prev => [data, ...prev]);
      Alert.alert('Success', 'Task created successfully!');
    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    if (!userId || !id) {
      Alert.alert('Error', 'Unable to send invitation');
      return;
    }

    setInviting(true);
    try {
      // First, find the user by email
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', inviteEmail.trim())
        .single();

      if (!userData) {
        Alert.alert('Error', 'User with this email not found');
        setInviting(false);
        return;
      }

      // Check if user already exists in household
      const { data: existingMember } = await supabase
        .from('household_members')
        .select('id')
        .eq('household_id', id)
        .eq('user_id', userData.id)
        .single();

      if (existingMember) {
        Alert.alert('Error', 'This user is already a member of this household');
        setInviting(false);
        return;
      }

      // Check if invitation already exists
      const { data: existingInvite } = await supabase
        .from('household_invitations')
        .select('id')
        .eq('household_id', id)
        .eq('invitee_email', inviteEmail.trim())
        .eq('status', 'pending')
        .single();

      if (existingInvite) {
        Alert.alert('Error', 'An invitation has already been sent to this email');
        setInviting(false);
        return;
      }

      // Create invitation
      const { error } = await supabase
        .from('household_invitations')
        .insert({
          household_id: id,
          inviter_id: userId,
          invitee_email: inviteEmail.trim(),
          status: 'pending'
        });

      if (error) {
        console.error('Invitation error:', error);
        Alert.alert('Error sending invitation', error.message);
        return;
      }

      Alert.alert('Success', 'Invitation sent successfully!');
      setInviteEmail('');
      setShowInviteModal(false);
    } catch (err) {
      console.error('Unexpected error:', err);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setInviting(false);
    }
  };

  const renderTask = ({ item }: { item: Task }) => (
    <TaskComponent 
      task={item} 
      onPress={() => router.push(`/tasks/${item.id}`)}
      isDark={isDark}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? "#5AC8FA" : "#4A90E2"} />
          <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
            Loading household...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!household) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={isDark ? "#FF453A" : "#FF3B30"} />
          <Text style={[styles.errorTitle, isDark && styles.errorTitleDark]}>
            Household not found
          </Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#1C1C1E" : "#f8f9fa"} />
      
      {/* Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? "#FFFFFF" : "#1C1C1E"} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
            {household.name}
          </Text>
          <Text style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}>
            {members.length} members • {tasks.length} tasks
          </Text>
        </View>
      </View>

      {/* Members Section */}
      <View style={[styles.section, isDark && styles.sectionDark]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="people" size={20} color={isDark ? "#5AC8FA" : "#4A90E2"} />
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            Members ({members.length})
          </Text>
          <TouchableOpacity
            style={[styles.inviteButton, isDark && styles.inviteButtonDark]}
            onPress={() => setShowInviteModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="person-add" size={16} color={isDark ? "#5AC8FA" : "#4A90E2"} />
            <Text style={[styles.inviteButtonText, isDark && styles.inviteButtonTextDark]}>
              Invite
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.membersList}>
          {members.map((member, index) => (
            <View key={member.id} style={[styles.memberItem, isDark && styles.memberItemDark]}>
              <View style={[styles.memberAvatar, isDark && styles.memberAvatarDark]}>
                <Text style={[styles.memberInitial, isDark && styles.memberInitialDark]}>
                  {(member.name || member.email).charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, isDark && styles.memberNameDark]}>
                  {member.name || member.email}
                </Text>
                <View style={styles.memberMeta}>
                  <Text style={[styles.memberRole, isDark && styles.memberRoleDark]}>
                    {member.role}
                  </Text>
                  {member.name && (
                    <Text style={[styles.memberEmail, isDark && styles.memberEmailDark]}>
                      {member.email}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Create Task Section */}
      <View style={[styles.section, isDark && styles.sectionDark]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="add-circle" size={20} color={isDark ? "#5AC8FA" : "#4A90E2"} />
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            Create New Task
          </Text>
        </View>
        
        <View style={styles.createTaskForm}>
          <TextInput
            placeholder="Task title"
            placeholderTextColor={isDark ? "#8E8E93" : "#8E8E93"}
            value={newTaskTitle}
            onChangeText={setNewTaskTitle}
            style={[styles.taskInput, isDark && styles.taskInputDark]}
          />
          <TextInput
            placeholder="Details (optional)"
            placeholderTextColor={isDark ? "#8E8E93" : "#8E8E93"}
            value={newTaskDetails}
            onChangeText={setNewTaskDetails}
            style={[styles.taskInput, isDark && styles.taskInputDark]}
            multiline
            numberOfLines={2}
          />
          <TouchableOpacity 
            style={[styles.createTaskButton, !newTaskTitle.trim() && styles.createTaskButtonDisabled]}
            onPress={createTask}
            disabled={!newTaskTitle.trim()}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color="white" />
            <Text style={styles.createTaskButtonText}>Create Task</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tasks Section */}
      <View style={[styles.section, isDark && styles.sectionDark, { flex: 1 }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="list" size={20} color={isDark ? "#5AC8FA" : "#4A90E2"} />
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            Tasks ({tasks.length})
          </Text>
        </View>
        
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={renderTask}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={isDark ? "#5AC8FA" : "#4A90E2"}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyTasks}>
              <Ionicons name="checkmark-circle-outline" size={64} color={isDark ? "#48484A" : "#C7C7CC"} />
              <Text style={[styles.emptyTasksTitle, isDark && styles.emptyTasksTitleDark]}>
                No tasks yet
              </Text>
              <Text style={[styles.emptyTasksSubtitle, isDark && styles.emptyTasksSubtitleDark]}>
                Create your first task to get started
              </Text>
            </View>
          }
        />
      </View>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <View style={[styles.modalOverlay, isDark && styles.modalOverlayDark]}>
          <View style={[styles.modalContent, isDark && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>
                Invite Member
              </Text>
              <TouchableOpacity
                onPress={() => setShowInviteModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={isDark ? "#FFFFFF" : "#1C1C1E"} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={[styles.modalLabel, isDark && styles.modalLabelDark]}>
                Email Address
              </Text>
              <TextInput
                placeholder="Enter email address"
                placeholderTextColor={isDark ? "#8E8E93" : "#8E8E93"}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                style={[styles.modalInput, isDark && styles.modalInputDark]}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, isDark && styles.modalButtonCancelDark]}
                onPress={() => setShowInviteModal(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextCancel, isDark && styles.modalButtonTextCancelDark]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.modalButtonPrimary, 
                  !inviteEmail.trim() && styles.modalButtonDisabled,
                  isDark && styles.modalButtonPrimaryDark
                ]}
                onPress={inviteMember}
                disabled={!inviteEmail.trim() || inviting}
                activeOpacity={0.7}
              >
                {inviting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalButtonText}>
                    Send Invitation
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
    marginBottom: 24,
    textAlign: 'center',
  },
  errorTitleDark: {
    color: '#FFFFFF',
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#4A90E2',
    borderRadius: 12,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerDark: {
    backgroundColor: '#1C1C1E',
    borderBottomColor: '#38383A',
  },
  headerContent: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  headerTitleDark: {
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  headerSubtitleDark: {
    color: '#8E8E93',
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
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 8,
    flex: 1,
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  membersList: {
    gap: 12,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  memberItemDark: {
    backgroundColor: '#2C2C2E',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarDark: {
    backgroundColor: '#5AC8FA',
  },
  memberInitial: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  memberInitialDark: {
    color: 'white',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '600',
    marginBottom: 2,
  },
  memberNameDark: {
    color: '#FFFFFF',
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberRole: {
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: '500',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  memberRoleDark: {
    color: '#5AC8FA',
    backgroundColor: '#1A1A1A',
  },
  memberEmail: {
    fontSize: 12,
    color: '#8E8E93',
  },
  memberEmailDark: {
    color: '#8E8E93',
  },
  createTaskForm: {
    gap: 12,
  },
  taskInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  taskInputDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#38383A',
    color: '#FFFFFF',
  },
  createTaskButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    paddingVertical: 12,
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
  createTaskButtonDisabled: {
    backgroundColor: '#C7C7CC',
    shadowOpacity: 0,
    elevation: 0,
  },
  createTaskButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyTasks: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTasksTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyTasksTitleDark: {
    color: '#FFFFFF',
  },
  emptyTasksSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  emptyTasksSubtitleDark: {
    color: '#8E8E93',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  inviteButtonDark: {
    backgroundColor: '#1A1A1A',
  },
  inviteButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4A90E2',
  },
  inviteButtonTextDark: {
    color: '#5AC8FA',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalOverlayDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalContentDark: {
    backgroundColor: '#1C1C1E',
    shadowOpacity: 0.5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  modalTitleDark: {
    color: '#FFFFFF',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    marginBottom: 24,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  modalLabelDark: {
    color: '#FFFFFF',
  },
  modalInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  modalInputDark: {
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
    borderColor: '#38383A',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  modalButtonCancelDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#38383A',
  },
  modalButtonPrimary: {
    backgroundColor: '#4A90E2',
  },
  modalButtonPrimaryDark: {
    backgroundColor: '#5AC8FA',
  },
  modalButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  modalButtonTextCancel: {
    color: '#1C1C1E',
  },
  modalButtonTextCancelDark: {
    color: '#FFFFFF',
  },
});
