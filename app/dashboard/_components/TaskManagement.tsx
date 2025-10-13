'use client'

import React, { useState, useEffect } from 'react'
import { useOrganization, useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Plus, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Calendar,
  User,
  MessageSquare,
  MoreHorizontal,
  Edit,
  Trash2,
  Shield,
  Bell
} from 'lucide-react'
import { 
  getAllTasksWithAssignees, 
  createTask, 
  updateTask, 
  deleteTask, 
  addTaskComment,
  getTaskStats,
  getOrganizationMembers,
  getTasksByUserRole,
  debugAllAssignments,
  debugAllTasks,
  type TaskWithAssignments,
  type CreateTaskData
} from '@/app/actions/Task'
import { getRooms } from '@/app/actions/Room'

interface TaskManagementProps {
  roomId?: string
}

export default function TaskManagement({ roomId }: TaskManagementProps) {
  const { organization } = useOrganization()
  const { user } = useUser()
  const [tasks, setTasks] = useState<TaskWithAssignments[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [organizationMembers, setOrganizationMembers] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, pending: 0, inProgress: 0, completed: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignments | null>(null)
  const [newComment, setNewComment] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [userRole, setUserRole] = useState<string>('')

  // Form state for creating tasks
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    due_date: '',
    assigned_to: [] as string[],
    room_id: roomId || '',
    selected_employee: '' // For dropdown selection
  })

  const orgId = organization?.id

  useEffect(() => {
    if (orgId) {
      fetchOrganizationMembers()
      fetchRooms()
      fetchStats()
    }
  }, [orgId])

  useEffect(() => {
    if (orgId && userRole) {
      fetchTasks()
    }
  }, [orgId, roomId, userRole])

  const fetchTasks = async () => {
    if (!orgId || !user?.id) return
    
    try {
      setIsLoading(true)
      let fetchedTasks: TaskWithAssignments[]
      
      // Use role-based task fetching
      fetchedTasks = await getTasksByUserRole(orgId, user.id, userRole)
      
      if (roomId) {
        // For room-specific tasks, filter client-side
        fetchedTasks = fetchedTasks.filter(task => task.room_id === roomId)
      }
      
      setTasks(fetchedTasks)
    } catch (error) {
      console.error('Error fetching tasks:', error)
      showNotification('Failed to fetch tasks', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchRooms = async () => {
    if (!orgId) return
    
    try {
      const fetchedRooms = await getRooms(orgId)
      setRooms(fetchedRooms)
    } catch (error) {
      console.error('Error fetching rooms:', error)
    }
  }

  const fetchStats = async () => {
    if (!orgId) return
    
    try {
      const fetchedStats = await getTaskStats(orgId)
      setStats(fetchedStats)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchOrganizationMembers = async () => {
    if (!orgId || !organization) return
    
    try {
      // Get real organization members from Clerk
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

  const handleCreateTask = async () => {
    if (!orgId || !newTask.title.trim()) {
      showNotification('Please fill in all required fields', 'error')
      return
    }

    if (!isAdmin) {
      showNotification('Only administrators can create tasks', 'error')
      return
    }

    if (newTask.assigned_to.length === 0) {
      showNotification('Please assign the task to at least one employee', 'error')
      return
    }

    console.log('TaskManagement - Creating task with data:', {
      newTask,
      orgId,
      user: user?.id,
      assigned_to: newTask.assigned_to
    })

    try {
      const taskData: CreateTaskData = {
        org_id: orgId,
        room_id: newTask.room_id || null,
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        due_date: newTask.due_date || null,
        assigned_to: newTask.assigned_to
      }

      console.log('TaskManagement - Task data being sent:', taskData)

      await createTask(taskData)
      showNotification('Task created successfully', 'success')
      setIsCreateDialogOpen(false)
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        due_date: '',
        assigned_to: [],
        room_id: roomId || '',
        selected_employee: ''
      })
      fetchTasks()
      fetchStats()
    } catch (error) {
      console.error('Error creating task:', error)
      showNotification('Failed to create task', 'error')
    }
  }

  const handleUpdateTaskStatus = async (taskId: string, status: 'pending' | 'in_progress' | 'completed' | 'cancelled') => {
    try {
      await updateTask(taskId, { status })
      showNotification('Task status updated', 'success')
      fetchTasks()
      fetchStats()
    } catch (error) {
      console.error('Error updating task:', error)
      showNotification('Failed to update task', 'error')
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
      fetchStats()
    } catch (error) {
      console.error('Error deleting task:', error)
      showNotification('Failed to delete task', 'error')
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

  // Side notification system
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null)

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  const handleDebugAssignments = async () => {
    try {
      await debugAllAssignments()
      showNotification('Check console for assignment debug info', 'info')
    } catch (error) {
      console.error('Debug assignments error:', error)
      showNotification('Debug failed', 'error')
    }
  }

  const handleDebugTasks = async () => {
    try {
      await debugAllTasks()
      showNotification('Check console for task debug info', 'info')
    } catch (error) {
      console.error('Debug tasks error:', error)
      showNotification('Debug failed', 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-blue-700">Total Tasks</p>
                <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
                <p className="text-xs text-blue-600">All tasks in organization</p>
              </div>
              <div className="h-12 w-12 bg-blue-200 rounded-full flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-blue-700" />
              </div>
            </div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-200 rounded-full -translate-y-10 translate-x-10 opacity-20"></div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-yellow-700">Pending</p>
                <p className="text-3xl font-bold text-yellow-900">{stats.pending}</p>
                <p className="text-xs text-yellow-600">Awaiting start</p>
              </div>
              <div className="h-12 w-12 bg-yellow-200 rounded-full flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-700" />
              </div>
            </div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-200 rounded-full -translate-y-10 translate-x-10 opacity-20"></div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-indigo-700">In Progress</p>
                <p className="text-3xl font-bold text-indigo-900">{stats.inProgress}</p>
                <p className="text-xs text-indigo-600">Currently active</p>
              </div>
              <div className="h-12 w-12 bg-indigo-200 rounded-full flex items-center justify-center">
                <Clock className="h-6 w-6 text-indigo-700" />
              </div>
            </div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-200 rounded-full -translate-y-10 translate-x-10 opacity-20"></div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-green-700">Completed</p>
                <p className="text-3xl font-bold text-green-900">{stats.completed}</p>
                <p className="text-xs text-green-600">Successfully finished</p>
              </div>
              <div className="h-12 w-12 bg-green-200 rounded-full flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-700" />
              </div>
            </div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-green-200 rounded-full -translate-y-10 translate-x-10 opacity-20"></div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview */}
      {stats.total > 0 && (
        <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Task Progress Overview</h3>
              <Badge className="bg-gray-200 text-gray-700">
                {Math.round((stats.completed / stats.total) * 100)}% Complete
              </Badge>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Completion Rate</span>
                <span className="font-medium text-gray-800">{stats.completed} / {stats.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                ></div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <div className="text-lg font-bold text-yellow-600">{stats.pending}</div>
                  <div className="text-xs text-gray-600">Pending</div>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-bold text-indigo-600">{stats.inProgress}</div>
                  <div className="text-xs text-gray-600">Active</div>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-bold text-green-600">{stats.completed}</div>
                  <div className="text-xs text-gray-600">Done</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">Tasks</h2>
            <Badge className={`text-xs ${isAdmin ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
              {isAdmin ? <Shield className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
              {isAdmin ? 'Manager' : 'Employee'}
            </Badge>
          </div>
          <p className="text-gray-600">
            {isAdmin ? 'Manage and track your organization\'s tasks' : 'View your assigned tasks'}
          </p>
          {isAdmin && (
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDebugTasks}
                className="text-xs"
              >
                Debug Tasks
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDebugAssignments}
                className="text-xs"
              >
                Debug Assignments
              </Button>
            </div>
          )}
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
                Create a new task for your organization
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
              
              {!roomId && (
                <div>
                  <label className="text-sm font-medium">Room (Optional)</label>
                  <select
                    value={newTask.room_id}
                    onChange={(e) => setNewTask({ ...newTask, room_id: e.target.value })}
                    className="mt-1 w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="">No specific room</option>
                    {rooms.map(room => (
                      <option key={room.id} value={room.id}>{room.title}</option>
                    ))}
                  </select>
                </div>
              )}
              
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
                      console.log('TaskManagement - Adding employee:', {
                        selected_employee: newTask.selected_employee,
                        current_assigned_to: newTask.assigned_to,
                        will_add: newTask.selected_employee && !newTask.assigned_to.includes(newTask.selected_employee)
                      })
                      
                      if (newTask.selected_employee && !newTask.assigned_to.includes(newTask.selected_employee)) {
                        const newAssignedTo = [...newTask.assigned_to, newTask.selected_employee]
                        console.log('TaskManagement - New assigned_to array:', newAssignedTo)
                        
                        setNewTask({
                          ...newTask,
                          assigned_to: newAssignedTo,
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
              <Button 
                onClick={handleCreateTask} 
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={newTask.assigned_to.length === 0}
              >
                Create Task {newTask.assigned_to.length > 0 && `(${newTask.assigned_to.length} assigned)`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        {tasks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
              <p className="text-gray-600">Create your first task to get started</p>
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => (
            <Card key={task.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{task.title}</h3>
                      <Badge className={getStatusColor(task.status)}>
                        {getStatusIcon(task.status)}
                        <span className="ml-1 capitalize">{task.status.replace('_', ' ')}</span>
                      </Badge>
                      <Badge className={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                    </div>
                    
                    {task.description && (
                      <p className="text-gray-600 mb-3">{task.description}</p>
                    )}
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>{task.assignments.length} assignment{task.assignments.length !== 1 ? 's' : ''}</span>
                        </div>
                        
                        {task.due_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-4 h-4" />
                          <span>{task.comments.length} comment{task.comments.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      
                      {/* Employee Assignments */}
                      {task.assignments.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-600">Assigned to:</div>
                          <div className="flex flex-wrap gap-1">
                            {task.assignments.map((assignment) => {
                              const assignedMember = organizationMembers.find(m => m.id === assignment.assigned_to)
                              const isMyAssignment = assignment.assigned_to === user?.id
                              const showAssignment = isAdmin || isMyAssignment // Managers see all, employees see only their own
                              
                              if (!showAssignment) return null
                              
                              return (
                                <div key={assignment.id} className="flex items-center gap-1">
                                  <Badge 
                                    className={`text-xs ${
                                      assignment.status === 'completed' ? 'bg-green-100 text-green-800' :
                                      assignment.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                      'bg-yellow-100 text-yellow-800'
                                    }`}
                                  >
                                    {assignedMember ? assignedMember.name : assignment.assigned_to}
                                    {isMyAssignment && ' (You)'}
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
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Dialog open={isCommentDialogOpen && selectedTask?.id === task.id} onOpenChange={(open) => {
                      setIsCommentDialogOpen(open)
                      if (open) setSelectedTask(task)
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Comment</DialogTitle>
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
                              rows={4}
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
                    
                    {/* Status control - only for admins or assigned users */}
                    {(isAdmin || task.assignments.some(a => a.assigned_to === user?.id)) && (
                      <div className="flex items-center gap-1">
                        <select
                          value={task.status}
                          onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as any)}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    )}
                    
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

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
