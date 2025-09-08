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
  RefreshControl,
  Modal
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
  user_id: string;
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
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState<'admin' | 'member' | 'viewer'>('member');
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
        .select('user_id, name, role, joined_at, is_active')
        .eq('household_id', id)
        .eq('is_active', true);

      if (membersError) {
        console.error('Error fetching members:', membersError);
        setMembers([]);
      } else if (membersData && membersData.length > 0) {
        // Get user details for all members
        const userIds = membersData.map(member => member.user_id);
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, email, avatar_url, phone')
          .in('id', userIds);

        if (usersError) {
          console.error('Error fetching user details:', usersError);
        }

        const transformedMembers = membersData.map(member => {
          const user = usersData?.find(u => u.id === member.user_id);
          return {
            user_id: member.user_id,
            email: user?.email || 'Unknown',
            name: member.name || user?.email || 'Unknown',
            role: member.role as 'admin' | 'member' | 'viewer',
            joined_at: member.joined_at,
            is_active: member.is_active,
          };
        });
        setMembers(transformedMembers);
      } else {
        setMembers([]);
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
    if (id && userId) {
      fetchHouseholdData();
    }
  }, [id, userId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHouseholdData();
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    if (!memberName.trim()) {
      Alert.alert('Error', 'Please enter a member name');
      return;
    }

    if (!userId || !id) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    setInviting(true);

    try {
      // Find the user by email in the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name')
        .eq('email', inviteEmail.trim())
        .single();

      if (userError || !userData) {
        Alert.alert('Error', 'User with this email not found. They need to create an account first.');
        setInviting(false);
        return;
      }

      // Check if user already exists in household_members
      const { data: existingMember } = await supabase
        .from('household_members')
        .select('user_id')
        .eq('household_id', id)
        .eq('user_id', userData.id)
        .single();

      if (existingMember) {
        Alert.alert('Error', 'User is already a member of this household');
        setInviting(false);
        return;
      }

      // Add user directly to household_members
      const { error: memberError } = await supabase
        .from('household_members')
        .insert({
          user_id: userData.id,
          household_id: id,
          name: memberName.trim(),
          role: memberRole,
          is_active: true
        });

      if (memberError) {
        console.error('Error adding member:', memberError);
        Alert.alert('Error', 'Failed to add member to household');
        setInviting(false);
        return;
      }

      Alert.alert('Success', `${memberName} has been added to the household!`);
      setInviteEmail('');
      setMemberName('');
      setMemberRole('member');
      setShowInviteModal(false);
      
      // Refresh household data to show new member
      fetchHouseholdData();
    } catch (err) {
      console.error('Unexpected error:', err);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setInviting(false);
    }
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
          assignee: selectedAssignee,
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
      setSelectedAssignee(null);
      setTasks(prev => [data, ...prev]);
      
      // Show notification if task was assigned to someone
      if (selectedAssignee) {
        const assigneeMember = members.find(m => m.user_id === selectedAssignee);
        const assigneeName = assigneeMember?.name || assigneeMember?.email || 'Unknown';
        Alert.alert(
          'Task Created & Assigned!', 
          `Task "${newTaskTitle}" has been assigned to ${assigneeName}. They will be notified.`,
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        Alert.alert('Success', 'Task created successfully!');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
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
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="people" size={20} color={isDark ? "#5AC8FA" : "#4A90E2"} />
            <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
              Members ({members.length})
            </Text>
          </View>
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
            <View key={member.user_id} style={[styles.memberItem, isDark && styles.memberItemDark]}>
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
          
          {/* Assignee Selection */}
          <View style={styles.assigneeSection}>
            <Text style={[styles.assigneeLabel, isDark && styles.assigneeLabelDark]}>
              Assign to:
            </Text>
            <View style={styles.assigneeOptions}>
              <TouchableOpacity
                style={[
                  styles.assigneeOption,
                  selectedAssignee === null && styles.assigneeOptionSelected,
                  isDark && styles.assigneeOptionDark
                ]}
                onPress={() => setSelectedAssignee(null)}
              >
                <Text style={[
                  styles.assigneeOptionText,
                  selectedAssignee === null && styles.assigneeOptionTextSelected,
                  isDark && styles.assigneeOptionTextDark
                ]}>
                  Unassigned
                </Text>
              </TouchableOpacity>
              
              {members.map((member) => (
                <TouchableOpacity
                  key={member.user_id}
                  style={[
                    styles.assigneeOption,
                    selectedAssignee === member.user_id && styles.assigneeOptionSelected,
                    isDark && styles.assigneeOptionDark
                  ]}
                  onPress={() => setSelectedAssignee(member.user_id)}
                >
                  <Text style={[
                    styles.assigneeOptionText,
                    selectedAssignee === member.user_id && styles.assigneeOptionTextSelected,
                    isDark && styles.assigneeOptionTextDark
                  ]}>
                    {member.name || member.email}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
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

      {/* Invitation Modal */}
      <Modal
        visible={showInviteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDark && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>
                Invite Member
              </Text>
              <TouchableOpacity
                onPress={() => setShowInviteModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={isDark ? "#FFFFFF" : "#1C1C1E"} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.modalDescription, isDark && styles.modalDescriptionDark]}>
              Add a new member to this household by entering their details.
            </Text>
            
            <TextInput
              placeholder="Enter email address"
              placeholderTextColor={isDark ? "#8E8E93" : "#8E8E93"}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              style={[styles.modalInput, isDark && styles.modalInputDark]}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <TextInput
              placeholder="Enter member name (how they appear in household)"
              placeholderTextColor={isDark ? "#8E8E93" : "#8E8E93"}
              value={memberName}
              onChangeText={setMemberName}
              style={[styles.modalInput, isDark && styles.modalInputDark, { marginTop: 15 }]}
              autoCapitalize="words"
            />
            
            <View style={styles.roleContainer}>
              <Text style={[styles.roleLabel, isDark && styles.roleLabelDark]}>
                Role:
              </Text>
              <View style={styles.roleButtons}>
                {(['viewer', 'member', 'admin'] as const).map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleButton,
                      memberRole === role && styles.roleButtonSelected,
                      isDark && styles.roleButtonDark,
                      memberRole === role && isDark && styles.roleButtonSelectedDark
                    ]}
                    onPress={() => setMemberRole(role)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.roleButtonText,
                      memberRole === role && styles.roleButtonTextSelected,
                      isDark && styles.roleButtonTextDark,
                      memberRole === role && isDark && styles.roleButtonTextSelectedDark
                    ]}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowInviteModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.sendButton,
                  (!inviteEmail.trim() || !memberName.trim() || inviting) && styles.sendButtonDisabled
                ]}
                onPress={inviteMember}
                disabled={!inviteEmail.trim() || !memberName.trim() || inviting}
                activeOpacity={0.7}
              >
                {inviting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.sendButtonText}>Add Member</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  assigneeSection: {
    marginTop: 12,
  },
  assigneeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  assigneeLabelDark: {
    color: '#FFFFFF',
  },
  assigneeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  assigneeOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#F2F2F7',
  },
  assigneeOptionDark: {
    borderColor: '#38383A',
    backgroundColor: '#2C2C2E',
  },
  assigneeOptionSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  assigneeOptionText: {
    fontSize: 14,
    color: '#1C1C1E',
  },
  assigneeOptionTextDark: {
    color: '#FFFFFF',
  },
  assigneeOptionTextSelected: {
    color: '#FFFFFF',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4A90E2',
    backgroundColor: 'transparent',
    gap: 4,
  },
  inviteButtonDark: {
    borderColor: '#5AC8FA',
  },
  inviteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A90E2',
  },
  inviteButtonTextDark: {
    color: '#5AC8FA',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalContentDark: {
    backgroundColor: '#1C1C1E',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  modalTitleDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  modalDescription: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 20,
    lineHeight: 22,
  },
  modalDescriptionDark: {
    color: '#8E8E93',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
    backgroundColor: '#F2F2F7',
    marginBottom: 24,
  },
  modalInputDark: {
    borderColor: '#38383A',
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
  },
  roleContainer: {
    marginBottom: 24,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  roleLabelDark: {
    color: '#FFFFFF',
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  roleButtonDark: {
    borderColor: '#38383A',
    backgroundColor: '#2C2C2E',
  },
  roleButtonSelected: {
    borderColor: '#4A90E2',
    backgroundColor: '#4A90E2',
  },
  roleButtonSelectedDark: {
    borderColor: '#5AC8FA',
    backgroundColor: '#5AC8FA',
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  roleButtonTextDark: {
    color: '#FFFFFF',
  },
  roleButtonTextSelected: {
    color: '#FFFFFF',
  },
  roleButtonTextSelectedDark: {
    color: '#1C1C1E',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  sendButton: {
    backgroundColor: '#4A90E2',
  },
  sendButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
