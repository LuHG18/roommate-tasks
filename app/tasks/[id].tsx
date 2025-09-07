import { supabase } from '@/lib/supabaseClient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { 
  Alert, 
  Text, 
  TextInput, 
  View, 
  StyleSheet, 
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  useColorScheme,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

interface Household {
  id: string;
  name: string;
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [task, setTask] = useState<Task | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

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

  // Fetch task data
  const fetchTaskData = async () => {
    if (!id) return;

    try {
      // Fetch task details
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();

      if (taskError) {
        console.error('Error fetching task:', taskError);
        Alert.alert('Error', 'Failed to load task details');
        return;
      }

      setTask(taskData);
      setEditTitle(taskData.title);
      setEditDetails(taskData.details || '');

      // Fetch household details
      const { data: householdData, error: householdError } = await supabase
        .from('households')
        .select('id, name')
        .eq('id', taskData.household_id)
        .single();

      if (householdError) {
        console.error('Error fetching household:', householdError);
      } else {
        setHousehold(householdData);
      }

    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskData();
  }, [id]);

  const toggleTaskStatus = async () => {
    if (!task) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: !task.status })
        .eq('id', task.id);

      if (error) {
        console.error('Error updating task status:', error);
        Alert.alert('Error', 'Failed to update task status');
        return;
      }

      setTask(prev => prev ? { ...prev, status: !prev.status } : null);
    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const saveTask = async () => {
    if (!task || !editTitle.trim()) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          title: editTitle,
          details: editDetails
        })
        .eq('id', task.id);

      if (error) {
        console.error('Error updating task:', error);
        Alert.alert('Error', 'Failed to update task');
        return;
      }

      setTask(prev => prev ? { 
        ...prev, 
        title: editTitle,
        details: editDetails
      } : null);
      setEditing(false);
      Alert.alert('Success', 'Task updated successfully!');
    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const deleteTask = async () => {
    if (!task) return;

    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', task.id);

              if (error) {
                console.error('Error deleting task:', error);
                Alert.alert('Error', 'Failed to delete task');
                return;
              }

              router.back();
            } catch (error) {
              console.error('Unexpected error:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? "#5AC8FA" : "#4A90E2"} />
          <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
            Loading task...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!task) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={isDark ? "#FF453A" : "#FF3B30"} />
          <Text style={[styles.errorTitle, isDark && styles.errorTitleDark]}>
            Task not found
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
            Task Details
          </Text>
          {household && (
            <Text style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}>
              {household.name}
            </Text>
          )}
        </View>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => setEditing(!editing)}
        >
          <Ionicons 
            name={editing ? "close" : "create"} 
            size={24} 
            color={isDark ? "#5AC8FA" : "#4A90E2"} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Section */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="checkmark-circle" size={20} color={isDark ? "#5AC8FA" : "#4A90E2"} />
            <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
              Status
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.statusButton, task.status && styles.statusButtonCompleted]}
            onPress={toggleTaskStatus}
            activeOpacity={0.8}
          >
            <Ionicons 
              name={task.status ? "checkmark-circle" : "time"} 
              size={24} 
              color={task.status ? "white" : (isDark ? "#FF9500" : "#FF9500")} 
            />
            <Text style={[styles.statusText, task.status && styles.statusTextCompleted]}>
              {task.status ? "Completed" : "Pending"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Task Content Section */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={20} color={isDark ? "#5AC8FA" : "#4A90E2"} />
            <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
              Task Details
            </Text>
          </View>
          
          {editing ? (
            <View style={styles.editForm}>
              <TextInput
                placeholder="Task title"
                placeholderTextColor={isDark ? "#8E8E93" : "#8E8E93"}
                value={editTitle}
                onChangeText={setEditTitle}
                style={[styles.editInput, isDark && styles.editInputDark]}
              />
              <TextInput
                placeholder="Task details"
                placeholderTextColor={isDark ? "#8E8E93" : "#8E8E93"}
                value={editDetails}
                onChangeText={setEditDetails}
                style={[styles.editInput, isDark && styles.editInputDark, styles.editTextArea]}
                multiline
                numberOfLines={4}
              />
              <View style={styles.editActions}>
                <TouchableOpacity 
                  style={[styles.saveButton, !editTitle.trim() && styles.saveButtonDisabled]}
                  onPress={saveTask}
                  disabled={!editTitle.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => {
                    setEditing(false);
                    setEditTitle(task.title);
                    setEditDetails(task.details || '');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cancelButtonText, isDark && styles.cancelButtonTextDark]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.taskContent}>
              <Text style={[styles.taskTitle, isDark && styles.taskTitleDark]}>
                {task.title}
              </Text>
              {task.details && (
                <Text style={[styles.taskDetails, isDark && styles.taskDetailsDark]}>
                  {task.details}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Task Info Section */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle" size={20} color={isDark ? "#5AC8FA" : "#4A90E2"} />
            <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
              Task Information
            </Text>
          </View>
          
          <View style={styles.infoItem}>
            <Ionicons name="calendar" size={16} color={isDark ? "#8E8E93" : "#8E8E93"} />
            <Text style={[styles.infoLabel, isDark && styles.infoLabelDark]}>Created:</Text>
            <Text style={[styles.infoValue, isDark && styles.infoValueDark]}>
              {formatDate(task.created_at)}
            </Text>
          </View>
          
          {task.assignee && (
            <View style={styles.infoItem}>
              <Ionicons name="person" size={16} color={isDark ? "#8E8E93" : "#8E8E93"} />
              <Text style={[styles.infoLabel, isDark && styles.infoLabelDark]}>Assigned to:</Text>
              <Text style={[styles.infoValue, isDark && styles.infoValueDark]}>
                User ID: {task.assignee}
              </Text>
            </View>
          )}
        </View>

        {/* Actions Section */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="settings" size={20} color={isDark ? "#5AC8FA" : "#4A90E2"} />
            <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
              Actions
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]}
            onPress={deleteTask}
            activeOpacity={0.8}
          >
            <Ionicons name="trash" size={20} color="white" />
            <Text style={styles.actionButtonText}>Delete Task</Text>
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
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 2,
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
  editButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    backgroundColor: 'white',
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
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  statusButtonCompleted: {
    backgroundColor: '#34C759',
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  statusTextCompleted: {
    color: 'white',
  },
  editForm: {
    gap: 16,
  },
  editInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  editInputDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#38383A',
    color: '#FFFFFF',
  },
  editTextArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#1C1C1E',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonTextDark: {
    color: '#FFFFFF',
  },
  taskContent: {
    gap: 12,
  },
  taskTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    lineHeight: 28,
  },
  taskTitleDark: {
    color: '#FFFFFF',
  },
  taskDetails: {
    fontSize: 16,
    color: '#8E8E93',
    lineHeight: 22,
  },
  taskDetailsDark: {
    color: '#8E8E93',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    minWidth: 80,
  },
  infoLabelDark: {
    color: '#8E8E93',
  },
  infoValue: {
    fontSize: 14,
    color: '#1C1C1E',
    flex: 1,
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
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
