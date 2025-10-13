'use client'

import React, { useState, useEffect } from 'react'
import { useUser, useOrganization } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Calendar,
  User,
  MessageSquare,
  Plus,
  Check,
  X,
  Bell,
  Shield,
  Trash2
} from 'lucide-react'
import { 
  getUserRoomTasks, 
  getUserTasks,
  updateTaskAssignmentStatus, 
  addTaskComment,
  getTasksByUserRole,
  createTask,
  deleteTask,
  updateTask,
  createTestTaskWithAssignment,
  type TaskWithAssignments,
  type CreateTaskData
} from '@/app/actions/Task'

interface TasksPanelProps {
  roomId: string
}

export default function TasksPanel({ roomId }: TasksPanelProps) {
  const { user } = useUser()
  const { organization } = useOrganization()
  const [tasks, setTasks] = useState<TaskWithAssignments[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignments | null>(null)
  const [newComment, setNewComment] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [organizationMembers, setOrganizationMembers] = useState<any[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    due_date: '',
    assigned_to: [] as string[],
    selected_employee: ''
  })

  // Side notification system
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null)

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  useEffect(() => {
    if (organization && user?.id) {
      fetchOrganizationMembers()
    }
  }, [organization, user?.id])

  useEffect(() => {
    if (userRole && organization?.id) {
      fetchTasks()
    }
  }, [roomId, user?.id, userRole, organization?.id])

  const fetchOrganizationMembers = async () => {
    if (!organization) return
    
    try {
      const memberships = await organization.getMemberships()
      if (memberships) {
        const members = memberships.data.map((membership: any) => {
          const publicUserData = membership.publicUserData
          return {
            id: publicUserData.userId,
            name: `${publicUserData.firstName || ''} ${publicUserData.lastName || ''}`.trim() || publicUserData.identifier,
            email: publicUserData.identifier,
            role: membership.role,
            membership: membership
          }
        })
        setOrganizationMembers(members)
        
        // Check if current user is admin and set role
        const currentMembership = memberships.data.find((m: any) => m.publicUserData.userId === user?.id)
        const role = currentMembership?.role || 'org:member'
        setUserRole(role)
        setIsAdmin(role === 'org:admin' || role === 'admin')
      }
    } catch (error) {
      console.error('Error fetching organization members:', error)
    }
  }

  const fetchTasks = async () => {
    if (!user?.id || !organization?.id) return
    
    try {
      setIsLoading(true)
      console.log('Fetching tasks for room:', roomId, 'user:', user.id, 'role:', userRole)
      
      let fetchedTasks: TaskWithAssignments[] = []
      
      if (isAdmin) {
        // For admins, get all tasks and filter by room
        fetchedTasks = await getTasksByUserRole(organization.id, user.id, userRole)
        fetchedTasks = fetchedTasks.filter(task => task.room_id === roomId)
      } else {
        // For employees, get only their assigned tasks in this room
        const userTasks = await getUserTasks(user.id, organization.id)
        fetchedTasks = userTasks.filter((task: TaskWithAssignments) => task.room_id === roomId)
      }
      
      console.log('Fetched tasks for room:', fetchedTasks)
      setTasks(fetchedTasks)
    } catch (error) {
      console.error('Error fetching tasks:', error)
      showNotification('Failed to fetch tasks', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateStatus = async (taskId: string, status: 'pending' | 'in_progress' | 'completed') => {
    if (!user?.id) return

    try {
      await updateTaskAssignmentStatus(taskId, user.id, status)
      showNotification('Task status updated', 'success')
      fetchTasks()
    } catch (error) {
      console.error('Error updating task status:', error)
      showNotification('Failed to update task status', 'error')
    }
  }

  const handleCreateTask = async () => {
    if (!organization?.id || !newTask.title.trim()) {
      showNotification('Please fill in all required fields', 'error')
      return
    }

    if (!isAdmin) {
      showNotification('Only administrators can create tasks', 'error')
      return
    }

    try {
      const taskData: CreateTaskData = {
        org_id: organization.id,
        room_id: roomId,
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        due_date: newTask.due_date || null,
        assigned_to: newTask.assigned_to
      }

      await createTask(taskData)
      showNotification('Task created successfully', 'success')
      setIsCreateDialogOpen(false)
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        due_date: '',
        assigned_to: [],
        selected_employee: ''
      })
      fetchTasks()
    } catch (error) {
      console.error('Error creating task:', error)
      showNotification('Failed to create task', 'error')
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    if (!isAdmin) {
      showNotification('Only administrators can delete tasks', 'error')
      return
    }

    try {
      await deleteTask(taskId)
      showNotification('Task deleted successfully', 'success')
      fetchTasks()
    } catch (error) {
      console.error('Error deleting task:', error)
      showNotification('Failed to delete task', 'error')
    }
  }

  const handleUpdateTaskStatus = async (taskId: string, status: 'pending' | 'in_progress' | 'completed' | 'cancelled') => {
    if (!isAdmin) {
      showNotification('Only administrators can update task status', 'error')
      return
    }

    try {
      await updateTask(taskId, { status })
      showNotification('Task status updated', 'success')
      fetchTasks()
    } catch (error) {
      console.error('Error updating task:', error)
      showNotification('Failed to update task', 'error')
    }
  }

  const handleAddComment = async () => {
    if (!selectedTask || !newComment.trim()) return

    try {
      await addTaskComment(selectedTask.id, newComment)
      showNotification('Comment added successfully', 'success')
      setNewComment('')
      setIsCommentDialogOpen(false)
      fetchTasks()
    } catch (error) {
      console.error('Error adding comment:', error)
      showNotification('Failed to add comment', 'error')
    }
  }

  // const handleCreateTestTask = async () => {
  //   if (!organization?.id || !user?.id) return

  //   try {
  //     await createTestTaskWithAssignment(organization.id, roomId, user.id)
  //     showNotification('Test task created successfully', 'success')
  //     fetchTasks()
  //   } catch (error) {
  //     console.error('Error creating test task:', error)
  //     showNotification('Failed to create test task', 'error')
  //   }
  // }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'in_progress': return <Clock className="w-4 h-4" />
      case 'pending': return <AlertCircle className="w-4 h-4" />
      default: return <AlertCircle className="w-4 h-4" />
    }
  }

  const isAssignedToMe = (task: TaskWithAssignments) => {
    return task.assignments.some(assignment => assignment.assigned_to === user?.id)
  }

  const getMyAssignment = (task: TaskWithAssignments) => {
    return task.assignments.find(assignment => assignment.assigned_to === user?.id)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array(3).fill(0).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with Create Button for Managers */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Tasks</h3>
          <Badge className={`text-xs ${isAdmin ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
            {isAdmin ? <Shield className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
            {isAdmin ? 'Manager' : 'Employee'}
          </Badge>
        </div>
        
        {isAdmin && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>
                  Create a new task for this room
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Title *</label>
                  <Input
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Enter task title"
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Enter task description"
                    className="mt-1 w-full p-3 border border-gray-300 rounded-md resize-none"
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Priority</label>
                    <select
                      value={newTask.priority}
                      onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                      className="mt-1 w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Due Date</label>
                    <Input
                      type="datetime-local"
                      value={newTask.due_date}
                      onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Assign to Employee</label>
                  <div className="mt-1 flex gap-2">
                    <select
                      value={newTask.selected_employee}
                      onChange={(e) => setNewTask({ ...newTask, selected_employee: e.target.value })}
                      className="flex-1 p-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Select an employee</option>
                      {organizationMembers
                        .filter(member => member.id !== user?.id) // Exclude current user
                        .map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name} ({member.email})
                          </option>
                        ))}
                    </select>
                    <Button
                      type="button"
                      onClick={() => {
                        if (newTask.selected_employee && !newTask.assigned_to.includes(newTask.selected_employee)) {
                          setNewTask({
                            ...newTask,
                            assigned_to: [...newTask.assigned_to, newTask.selected_employee],
                            selected_employee: ''
                          })
                        }
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      Add
                    </Button>
                  </div>
                  {newTask.assigned_to.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="text-xs font-medium text-gray-600">Assigned to:</div>
                      <div className="flex flex-wrap gap-1">
                        {newTask.assigned_to.map((assigneeId, index) => {
                          const member = organizationMembers.find(m => m.id === assigneeId)
                          return (
                            <Badge key={index} className="bg-blue-100 text-blue-800">
                              {member ? member.name : assigneeId}
                              <button
                                type="button"
                                onClick={() => {
                                  setNewTask({
                                    ...newTask,
                                    assigned_to: newTask.assigned_to.filter((_, i) => i !== index)
                                  })
                                }}
                                className="ml-1 text-blue-600 hover:text-blue-800"
                              >
                                ×
                              </button>
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTask} className="bg-indigo-600 hover:bg-indigo-700">
                  Create Task
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Tasks List */}
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              {isAdmin ? 'No tasks in this room' : 'No tasks assigned'}
            </h3>
            <p className="text-xs text-gray-600">
              {isAdmin ? 'Create your first task for this room' : 'You don\'t have any tasks assigned in this room'}
            </p>
            {/* {!isAdmin && (
              <Button 
                onClick={handleCreateTestTask}
                className="mt-3 bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                Create Test Task (Debug)
              </Button>
            )} */}
          </CardContent>
        </Card>
      ) : (
        tasks.map((task) => {
          const myAssignment = getMyAssignment(task)
          const isCompleted = myAssignment?.status === 'completed'
          
          return (
            <Card key={task.id} className={`transition-all ${isCompleted ? 'opacity-75' : ''}`}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Task Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold">{task.title}</h4>
                        <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </Badge>
                        {isAdmin && (
                          <Badge className={`text-xs ${getStatusColor(task.status)}`}>
                            {getStatusIcon(task.status)}
                            <span className="ml-1 capitalize">{task.status.replace('_', ' ')}</span>
                          </Badge>
                        )}
                      </div>
                      
                      {task.description && (
                        <p className="text-xs text-gray-600 mb-2">{task.description}</p>
                      )}
                      
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {task.due_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(task.due_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          <span>{task.comments.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Task Assignments - Show different info based on role */}
                  {task.assignments.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-gray-600">
                        {isAdmin ? 'Assigned to:' : 'Your status:'}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {task.assignments.map((assignment) => {
                          const assignedMember = organizationMembers.find(m => m.id === assignment.assigned_to)
                          const isMyAssignment = assignment.assigned_to === user?.id
                          
                          // For employees: only show their own assignment
                          // For managers: show all assignments
                          const shouldShow = isAdmin || isMyAssignment
                          
                          if (!shouldShow) return null
                          
                          return (
                            <div key={assignment.id} className="flex items-center gap-1">
                              <Badge 
                                className={`text-xs ${
                                  assignment.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  assignment.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {isAdmin ? (assignedMember ? assignedMember.name : assignment.assigned_to) : 'You'}
                                {isMyAssignment && isAdmin && ' (You)'}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                ({assignment.status.replace('_', ' ')})
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Status Section */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isAdmin ? (
                        // Managers see overall task status
                        <Badge className={`text-xs ${getStatusColor(task.status)}`}>
                          {getStatusIcon(task.status)}
                          <span className="ml-1 capitalize">{task.status.replace('_', ' ')}</span>
                        </Badge>
                      ) : (
                        // Employees see their assignment status
                        <Badge className={`text-xs ${getStatusColor(myAssignment?.status || 'pending')}`}>
                          {getStatusIcon(myAssignment?.status || 'pending')}
                          <span className="ml-1 capitalize">{(myAssignment?.status || 'pending').replace('_', ' ')}</span>
                        </Badge>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1">
                      {/* Employee actions - only for their assigned tasks */}
                      {!isAdmin && myAssignment && (
                        <>
                          {myAssignment.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateStatus(task.id, 'in_progress')}
                                className="h-6 px-2 text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                              >
                                <Clock className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateStatus(task.id, 'completed')}
                                className="h-6 px-2 text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                          
                          {myAssignment.status === 'in_progress' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(task.id, 'completed')}
                              className="h-6 px-2 text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                          )}
                          
                          {myAssignment.status === 'completed' && (
                            <div className="text-xs text-green-600 font-medium">
                              ✓ Completed
                            </div>
                          )}
                        </>
                      )}

                      {/* Manager actions */}
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <select
                            value={task.status}
                            onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as any)}
                            className="text-xs border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteTask(task.id)}
                            className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                      
                      {/* Comment button for everyone */}
                      <Dialog open={isCommentDialogOpen && selectedTask?.id === task.id} onOpenChange={(open) => {
                        setIsCommentDialogOpen(open)
                        if (open) setSelectedTask(task)
                      }}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="h-6 px-2 text-xs">
                            <MessageSquare className="w-3 h-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle className="text-lg">Add Comment</DialogTitle>
                            <DialogDescription>
                              Add a comment to "{task.title}"
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium">Comment</label>
                              <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Enter your comment"
                                className="mt-1 w-full p-3 border border-gray-300 rounded-md resize-none"
                                rows={3}
                              />
                            </div>
                          </div>
                          
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setIsCommentDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleAddComment} className="bg-indigo-600 hover:bg-indigo-700">
                              Add Comment
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  {/* Comments Preview */}
                  {task.comments.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-gray-600">Recent Comments:</div>
                      <ScrollArea className="max-h-20">
                        <div className="space-y-1">
                          {task.comments.slice(-2).map((comment) => (
                            <div key={comment.id} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                              <div className="font-medium">{comment.user_id === user?.id ? 'You' : 'Other'}</div>
                              <div>{comment.comment}</div>
                              <div className="text-xs text-gray-400">
                                {new Date(comment.created_at).toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })
      )}

      {/* Side Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
          notification.type === 'success' ? 'bg-green-500 text-white' :
          notification.type === 'error' ? 'bg-red-500 text-white' :
          'bg-blue-500 text-white'
        }`}>
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <span>{notification.message}</span>
            <button 
              onClick={() => setNotification(null)}
              className="ml-2 hover:opacity-70"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}