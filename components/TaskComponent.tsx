import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
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

interface TaskComponentProps {
  task: Task;
  onPress: () => void;
  isDark?: boolean;
}

export default function TaskComponent({ task, onPress, isDark = false }: TaskComponentProps) {
  const getStatusColor = () => {
    return task.status ? (isDark ? "#34C759" : "#34C759") : (isDark ? "#FF9500" : "#FF9500");
  };

  const getStatusIcon = () => {
    return task.status ? "checkmark-circle" : "time";
  };

  const getStatusText = () => {
    return task.status ? "Completed" : "Pending";
  };

  const getPriorityColor = () => {
    switch (task.priority) {
      case 'high': return isDark ? "#FF453A" : "#FF3B30";
      case 'medium': return isDark ? "#FF9500" : "#FF9500";
      case 'low': return isDark ? "#34C759" : "#34C759";
      default: return isDark ? "#8E8E93" : "#8E8E93";
    }
  };

  const getPriorityIcon = () => {
    switch (task.priority) {
      case 'high': return "alert-circle";
      case 'medium': return "remove-circle";
      case 'low': return "checkmark-circle";
      default: return "remove-circle";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <TouchableOpacity 
      style={[styles.taskCard, isDark && styles.taskCardDark]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.taskHeader}>
        <View style={styles.taskTitleContainer}>
          <Text style={[styles.taskTitle, isDark && styles.taskTitleDark]} numberOfLines={1}>
            {task.title}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
            <Ionicons name={getStatusIcon()} size={12} color="white" />
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={isDark ? "#8E8E93" : "#C7C7CC"} />
      </View>

      {task.details && (
        <Text style={[styles.taskDetails, isDark && styles.taskDetailsDark]} numberOfLines={2}>
          {task.details}
        </Text>
      )}

      <View style={styles.taskFooter}>
        <View style={styles.taskMeta}>
          <Ionicons name="calendar" size={12} color={isDark ? "#8E8E93" : "#8E8E93"} />
          <Text style={[styles.taskDate, isDark && styles.taskDateDark]}>
            {formatDate(task.created_at)}
          </Text>
        </View>
        
        <View style={styles.taskMeta}>
          <Ionicons name={getPriorityIcon()} size={12} color={getPriorityColor()} />
          <Text style={[styles.taskPriority, { color: getPriorityColor() }]}>
            {task.priority}
          </Text>
        </View>
        
        {task.assignee && (
          <View style={styles.taskMeta}>
            <Ionicons name="person" size={12} color={isDark ? "#8E8E93" : "#8E8E93"} />
            <Text style={[styles.taskAssignee, isDark && styles.taskAssigneeDark]}>
              Assigned
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  taskCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  taskCardDark: {
    backgroundColor: '#1C1C1E',
    borderColor: '#38383A',
    shadowOpacity: 0.3,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  taskTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    flex: 1,
  },
  taskTitleDark: {
    color: '#FFFFFF',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  taskDetails: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
    marginBottom: 12,
  },
  taskDetailsDark: {
    color: '#8E8E93',
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  taskDateDark: {
    color: '#8E8E93',
  },
  taskAssignee: {
    fontSize: 12,
    color: '#8E8E93',
  },
  taskAssigneeDark: {
    color: '#8E8E93',
  },
  taskPriority: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
});
