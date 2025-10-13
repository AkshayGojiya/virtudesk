'use client'

import React, { useState, useEffect } from 'react'
import { useOrganization, useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Calendar,
  User,
  MessageSquare,
  Bell,
  Target,
  TrendingUp
} from 'lucide-react'
import { 
  getUserTasks,
  updateTaskAssignmentStatus, 
  addTaskComment,
  type TaskWithAssignments
} from '@/app/actions/Task'

export default function EmployeeTaskDashboard() {
  const { organization } = useOrganization()
  const { user } = useUser()
  const [tasks, setTasks] = useState<TaskWithAssignments[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignments | null>(null)
  const [newComment, setNewComment] = useState('')

  // Side notification system
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null)

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  useEffect(() => {
    if (organization?.id && user?.id) {
      fetchTasks()
    }
  }, [organization?.id, user?.id])

  const fetchTasks = async () => {
    if (!organization?.id || !user?.id) return
    
    try {
      setIsLoading(true)
      console.log('Fetching employee tasks for:', { orgId: organization.id, userId: user.id })
      const fetchedTasks = await getUserTasks(user.id, organization.id)
      console.log('Employee tasks fetched:', fetchedTasks)
      setTasks(fetchedTasks)
    } catch (error) {
      console.error('Error fetching employee tasks:', error)
      showNotification('Failed to fetch your tasks', 'error')
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

  const getMyAssignment = (task: TaskWithAssignments) => {
    return task.assignments.find(assignment => assignment.assigned_to === user?.id)
  }

  // Calculate task statistics for employee
  const taskStats = {
    total: tasks.length,
    pending: tasks.filter(task => {
      const myAssignment = getMyAssignment(task)
      return myAssignment?.status === 'pending'
    }).length,
    inProgress: tasks.filter(task => {
      const myAssignment = getMyAssignment(task)
      return myAssignment?.status === 'in_progress'
    }).length,
    completed: tasks.filter(task => {
      const myAssignment = getMyAssignment(task)
      return myAssignment?.status === 'completed'
    }).length,
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => (
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
      {/* Header */}
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold">My Tasks</h2>
        <Badge className="bg-blue-100 text-blue-800">
          <User className="w-3 h-3 mr-1" />
          Employee
        </Badge>
      </div>

      {/* Employee Task Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-blue-700">My Tasks</p>
                <p className="text-3xl font-bold text-blue-900">{taskStats.total}</p>
                <p className="text-xs text-blue-600">Assigned to me</p>
              </div>
              <div className="h-12 w-12 bg-blue-200 rounded-full flex items-center justify-center">
                <Target className="h-6 w-6 text-blue-700" />
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
                <p className="text-3xl font-bold text-yellow-900">{taskStats.pending}</p>
                <p className="text-xs text-yellow-600">Need to start</p>
              </div>
              <div className="h-12 w-12 bg-yellow-200 rounded-full flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-700" />
              </div>
            </div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-200 rounded-full -translate-y-10 translate-x-10 opacity-20"></div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-green-700">Completed</p>
                <p className="text-3xl font-bold text-green-900">{taskStats.completed}</p>
                <p className="text-xs text-green-600">Finished tasks</p>
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
      {taskStats.total > 0 && (
        <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">My Progress</h3>
              <Badge className="bg-gray-200 text-gray-700">
                {Math.round((taskStats.completed / taskStats.total) * 100)}% Complete
              </Badge>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Completion Rate</span>
                <span className="font-medium text-gray-800">{taskStats.completed} / {taskStats.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${(taskStats.completed / taskStats.total) * 100}%` }}
                ></div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <div className="text-lg font-bold text-yellow-600">{taskStats.pending}</div>
                  <div className="text-xs text-gray-600">Pending</div>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-bold text-indigo-600">{taskStats.inProgress}</div>
                  <div className="text-xs text-gray-600">Active</div>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-bold text-green-600">{taskStats.completed}</div>
                  <div className="text-xs text-gray-600">Done</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your Assigned Tasks</h3>
        
        {tasks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks assigned</h3>
              <p className="text-gray-600">You don't have any tasks assigned to you yet</p>
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => {
            const myAssignment = getMyAssignment(task)
            const isCompleted = myAssignment?.status === 'completed'
            
            return (
              <Card key={task.id} className={`transition-all ${isCompleted ? 'opacity-75' : ''}`}>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {/* Task Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-lg font-semibold">{task.title}</h4>
                          <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </Badge>
                        </div>
                        
                        {task.description && (
                          <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                        )}
                        
                        <div className="flex items-center gap-3 text-sm text-gray-500">
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
                      </div>
                    </div>

                    {/* Status Section */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-sm ${getStatusColor(myAssignment?.status || 'pending')}`}>
                          {getStatusIcon(myAssignment?.status || 'pending')}
                          <span className="ml-1 capitalize">{(myAssignment?.status || 'pending').replace('_', ' ')}</span>
                        </Badge>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        {myAssignment?.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(task.id, 'in_progress')}
                              className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                            >
                              <Clock className="w-4 h-4 mr-1" />
                              Start
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(task.id, 'completed')}
                              className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Complete
                            </Button>
                          </>
                        )}
                        
                        {myAssignment?.status === 'in_progress' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStatus(task.id, 'completed')}
                            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Complete
                          </Button>
                        )}
                        
                        {myAssignment?.status === 'completed' && (
                          <div className="text-sm text-green-600 font-medium">
                            ✓ Completed
                          </div>
                        )}
                        
                        <Dialog open={isCommentDialogOpen && selectedTask?.id === task.id} onOpenChange={(open) => {
                          setIsCommentDialogOpen(open)
                          if (open) setSelectedTask(task)
                        }}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <MessageSquare className="w-4 h-4" />
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
                        <div className="text-sm font-medium text-gray-600">Recent Comments:</div>
                        <ScrollArea className="max-h-20">
                          <div className="space-y-1">
                            {task.comments.slice(-2).map((comment) => (
                              <div key={comment.id} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
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
