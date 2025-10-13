"use server";

import { createClient } from '@/utils/supabase/server';
import { auth } from '@clerk/nextjs/server';

// Types
export interface Task {
  id: string;
  org_id: string;
  room_id: string | null;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TaskAssignment {
  id: string;
  task_id: string;
  assigned_to: string;
  assigned_by: string;
  assigned_at: string;
  status: 'pending' | 'in_progress' | 'completed';
  completed_at: string | null;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  comment: string;
  created_at: string;
}

export interface TaskWithAssignments extends Task {
  assignments: TaskAssignment[];
  comments: TaskComment[];
  assigned_to_names?: string[];
}

export interface CreateTaskData {
  org_id: string;
  room_id?: string | null;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string | null;
  assigned_to: string[];
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string | null;
}

// Get all tasks for an organization
export const getTasks = async (org_id: string): Promise<TaskWithAssignments[]> => {
  const supabase = await createClient();

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select(`
      *,
      assignments:task_assignments(*),
      comments:task_comments(*)
    `)
    .eq('org_id', org_id)
    .order('created_at', { ascending: false });

  if (tasksError) throw tasksError;
  return tasks || [];
};

// Get tasks assigned to a specific user
export const getUserTasks = async (user_id: string, org_id: string): Promise<TaskWithAssignments[]> => {
  const supabase = await createClient();

  console.log('getUserTasks called with:', { user_id, org_id });

  // First, let's check if there are any assignments for this user
  const { data: assignments, error: assignmentsError } = await supabase
    .from('task_assignments')
    .select('*')
    .eq('assigned_to', user_id);

  console.log('User assignments:', { assignments, assignmentsError });

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select(`
      *,
      assignments:task_assignments!inner(*),
      comments:task_comments(*)
    `)
    .eq('org_id', org_id)
    .eq('task_assignments.assigned_to', user_id)
    .order('created_at', { ascending: false });

  console.log('getUserTasks result:', { tasks, tasksError });

  if (tasksError) throw tasksError;
  return tasks || [];
};

// Get tasks for a specific room
export const getRoomTasks = async (room_id: string): Promise<TaskWithAssignments[]> => {
  const supabase = await createClient();

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select(`
      *,
      assignments:task_assignments(*),
      comments:task_comments(*)
    `)
    .eq('room_id', room_id)
    .order('created_at', { ascending: false });

  if (tasksError) throw tasksError;
  return tasks || [];
};

// Get tasks assigned to current user in a room
export const getUserRoomTasks = async (room_id: string, user_id: string): Promise<TaskWithAssignments[]> => {
  const supabase = await createClient();

  // First get all tasks for the room
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select(`
      *,
      assignments:task_assignments(*),
      comments:task_comments(*)
    `)
    .eq('room_id', room_id)
    .order('created_at', { ascending: false });

  if (tasksError) throw tasksError;

  // Filter tasks that are assigned to the current user
  const userTasks = tasks?.filter(task => 
    task.assignments.some((assignment: TaskAssignment) => assignment.assigned_to === user_id)
  ) || [];

  return userTasks;
};

// Create a new task
export const createTask = async (taskData: CreateTaskData): Promise<Task> => {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const supabase = await createClient();

  console.log('createTask called with:', { taskData, userId });

  // Create the task
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert([{
      org_id: taskData.org_id,
      room_id: taskData.room_id,
      title: taskData.title,
      description: taskData.description,
      priority: taskData.priority || 'medium',
      due_date: taskData.due_date,
      created_by: userId,
    }])
    .select()
    .single();

  console.log('Task created:', { task, taskError });

  if (taskError) throw taskError;

  // Create task assignments
  if (taskData.assigned_to.length > 0) {
    const assignments = taskData.assigned_to.map(assigned_to => ({
      task_id: task.id,
      assigned_to,
      assigned_by: userId,
    }));

    console.log('Creating assignments:', assignments);

    const { data: assignmentData, error: assignmentError } = await supabase
      .from('task_assignments')
      .insert(assignments)
      .select();

    console.log('Assignment creation result:', { assignmentData, assignmentError });

    if (assignmentError) throw assignmentError;
    
    // Verify assignments were created
    const { data: verifyAssignments, error: verifyError } = await supabase
      .from('task_assignments')
      .select('*')
      .eq('task_id', task.id);
    
    console.log('Verification - Assignments for task:', { verifyAssignments, verifyError });
  }

  return task;
};

// Update a task
export const updateTask = async (taskId: string, updateData: UpdateTaskData): Promise<Task> => {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const supabase = await createClient();

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)
    .select()
    .single();

  if (taskError) throw taskError;
  return task;
};

// Delete a task
export const deleteTask = async (taskId: string): Promise<void> => {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const supabase = await createClient();

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) throw error;
};

// Update task assignment status
export const updateTaskAssignmentStatus = async (
  taskId: string, 
  userId: string, 
  status: 'pending' | 'in_progress' | 'completed'
): Promise<TaskAssignment> => {
  const supabase = await createClient();

  const updateData: any = { status };
  if (status === 'completed') {
    updateData.completed_at = new Date().toISOString();
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from('task_assignments')
    .update(updateData)
    .eq('task_id', taskId)
    .eq('assigned_to', userId)
    .select()
    .single();

  if (assignmentError) throw assignmentError;

  // Update main task status if all assignments are completed
  if (status === 'completed') {
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select(`
        *,
        assignments:task_assignments(*)
      `)
      .eq('id', taskId)
      .single();

    if (!taskError && task) {
      const allCompleted = task.assignments.every((assignment: TaskAssignment) => 
        assignment.status === 'completed'
      );

      if (allCompleted) {
        await supabase
          .from('tasks')
          .update({ status: 'completed' })
          .eq('id', taskId);
      }
    }
  }

  return assignment;
};

// Add a comment to a task
export const addTaskComment = async (taskId: string, comment: string): Promise<TaskComment> => {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const supabase = await createClient();

  const { data: taskComment, error: commentError } = await supabase
    .from('task_comments')
    .insert([{
      task_id: taskId,
      user_id: userId,
      comment,
    }])
    .select()
    .single();

  if (commentError) throw commentError;
  return taskComment;
};

// Get task comments
export const getTaskComments = async (taskId: string): Promise<TaskComment[]> => {
  const supabase = await createClient();

  const { data: comments, error: commentsError } = await supabase
    .from('task_comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (commentsError) throw commentsError;
  return comments || [];
};

// Assign task to additional users
export const assignTaskToUsers = async (taskId: string, userIds: string[]): Promise<void> => {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const supabase = await createClient();

  const assignments = userIds.map(assigned_to => ({
    task_id: taskId,
    assigned_to,
    assigned_by: userId,
  }));

  const { error: assignmentError } = await supabase
    .from('task_assignments')
    .insert(assignments);

  if (assignmentError) throw assignmentError;
};

// Remove task assignment
export const removeTaskAssignment = async (taskId: string, userId: string): Promise<void> => {
  const { userId: currentUserId } = await auth();
  if (!currentUserId) throw new Error('Unauthorized');

  const supabase = await createClient();

  const { error } = await supabase
    .from('task_assignments')
    .delete()
    .eq('task_id', taskId)
    .eq('assigned_to', userId);

  if (error) throw error;
};

// Get all tasks with assignee details for admin
export const getAllTasksWithAssignees = async (org_id: string): Promise<TaskWithAssignments[]> => {
  const supabase = await createClient();

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select(`
      *,
      assignments:task_assignments(*),
      comments:task_comments(*)
    `)
    .eq('org_id', org_id)
    .order('created_at', { ascending: false });

  if (tasksError) throw tasksError;
  return tasks || [];
};

// Get tasks based on user role - managers see all, employees see only assigned
export const getTasksByUserRole = async (org_id: string, user_id: string, user_role: string): Promise<TaskWithAssignments[]> => {
  const supabase = await createClient();

  // If user is admin/manager, return all tasks
  if (user_role === 'org:admin' || user_role === 'admin') {
    return getAllTasksWithAssignees(org_id);
  }

  // If user is employee, return only tasks assigned to them
  return getUserTasks(user_id, org_id);
};

// Get organization members for dropdown
export const getOrganizationMembers = async (org_id: string) => {
  // This function is now handled in the component using Clerk's organization.getMemberships()
  // Return empty array as the actual implementation is in TaskManagement.tsx
  return [];
};

// Debug function to check all assignments in database
export const debugAllAssignments = async () => {
  const supabase = await createClient();
  
  const { data: allAssignments, error } = await supabase
    .from('task_assignments')
    .select('*');
  
  console.log('DEBUG - All assignments in database:', { allAssignments, error });
  return allAssignments;
};

// Debug function to check all tasks in database
export const debugAllTasks = async () => {
  const supabase = await createClient();
  
  const { data: allTasks, error } = await supabase
    .from('tasks')
    .select('*');
  
  console.log('DEBUG - All tasks in database:', { allTasks, error });
  return allTasks;
};

// Create a test task with assignment for debugging
export const createTestTaskWithAssignment = async (org_id: string, room_id: string, assignee_id: string) => {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const supabase = await createClient();

  console.log('Creating test task with assignment:', { org_id, room_id, assignee_id, userId });

  // Create the task
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert([{
      org_id: org_id,
      room_id: room_id,
      title: 'Test Task - Debug',
      description: 'This is a test task created for debugging purposes',
      priority: 'medium',
      created_by: userId,
    }])
    .select()
    .single();

  console.log('Test task created:', { task, taskError });

  if (taskError) throw taskError;

  // Create task assignment
  const { data: assignment, error: assignmentError } = await supabase
    .from('task_assignments')
    .insert([{
      task_id: task.id,
      assigned_to: assignee_id,
      assigned_by: userId,
    }])
    .select()
    .single();

  console.log('Test assignment created:', { assignment, assignmentError });

  if (assignmentError) throw assignmentError;

  return { task, assignment };
};

// Get task statistics for dashboard
export const getTaskStats = async (org_id: string) => {
  const supabase = await createClient();

  const { data: stats, error: statsError } = await supabase
    .from('tasks')
    .select('status')
    .eq('org_id', org_id);

  if (statsError) throw statsError;

  const totalTasks = stats.length;
  const pendingTasks = stats.filter(task => task.status === 'pending').length;
  const inProgressTasks = stats.filter(task => task.status === 'in_progress').length;
  const completedTasks = stats.filter(task => task.status === 'completed').length;

  return {
    total: totalTasks,
    pending: pendingTasks,
    inProgress: inProgressTasks,
    completed: completedTasks,
  };
};
