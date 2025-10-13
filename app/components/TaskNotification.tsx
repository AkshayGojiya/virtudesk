'use client'

import React, { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CheckCircle, Clock, AlertCircle, X, Calendar, User, Bell, BellRing } from 'lucide-react'
import { getUserRoomTasks, updateTaskAssignmentStatus, type TaskWithAssignments } from '@/app/actions/Task'

interface TaskNotificationProps {
  roomId?: string
  onTaskUpdate?: () => void
}

export default function TaskNotification({ roomId, onTaskUpdate }: TaskNotificationProps) {
  const { user } = useUser()
  const [newTasks, setNewTasks] = useState<TaskWithAssignments[]>([])
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date>(new Date())
  const [showNotificationBell, setShowNotificationBell] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)
  const [sideNotification, setSideNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null)

  useEffect(() => {
    if (!user?.id) return

    // Check for new tasks every 30 seconds
    const interval = setInterval(checkForNewTasks, 30000)
    
    // Initial check
    checkForNewTasks()

    return () => clearInterval(interval)
  }, [user?.id, roomId])

  const checkForNewTasks = async () => {
    if (!user?.id || !roomId) return

    try {
      const tasks = await getUserRoomTasks(roomId, user.id)

      // Filter tasks assigned to current user that were created after last check
      const newlyAssignedTasks = tasks.filter(task => {
        const taskCreatedAfterLastCheck = new Date(task.created_at) > lastChecked
        return taskCreatedAfterLastCheck
      })

      if (newlyAssignedTasks.length > 0) {
        setNewTasks(newlyAssignedTasks)
        setNotificationCount(newlyAssignedTasks.length)
        setShowNotificationBell(true)
        
        // Auto-open notification after 2 seconds
        setTimeout(() => {
          setIsNotificationOpen(true)
        }, 2000)
      }

      setLastChecked(new Date())
    } catch (error) {
      console.error('Error checking for new tasks:', error)
    }
  }

  const handleUpdateStatus = async (taskId: string, status: 'pending' | 'in_progress' | 'completed') => {
    if (!user?.id) return

    try {
      await updateTaskAssignmentStatus(taskId, user.id, status)
      showSideNotification('Task status updated', 'success')
      
      // Remove the task from notifications
      setNewTasks(prev => prev.filter(task => task.id !== taskId))
      
      // Call the update callback if provided
      if (onTaskUpdate) {
        onTaskUpdate()
      }
    } catch (error) {
      console.error('Error updating task status:', error)
      showSideNotification('Failed to update task status', 'error')
    }
  }

  const handleDismissNotification = () => {
    setIsNotificationOpen(false)
    setNewTasks([])
    setShowNotificationBell(false)
    setNotificationCount(0)
  }

  const handleBellClick = () => {
    setIsNotificationOpen(true)
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'in_progress': return <Clock className="w-4 h-4" />
      case 'pending': return <AlertCircle className="w-4 h-4" />
      default: return <AlertCircle className="w-4 h-4" />
    }
  }

  const showSideNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setSideNotification({ message, type })
    setTimeout(() => setSideNotification(null), 3000)
  }

  return (
    <>
      {/* Notification Bell */}
      {showNotificationBell && (
        <div className="fixed top-4 right-4 z-50">
          <Button
            onClick={handleBellClick}
            className="relative bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg animate-pulse"
          >
            <BellRing className="w-6 h-6" />
            {notificationCount > 0 && (
              <Badge className="absolute -top-2 -right-2 bg-red-500 text-white text-xs min-w-[20px] h-5 flex items-center justify-center">
                {notificationCount}
              </Badge>
            )}
          </Button>
        </div>
      )}

      {/* Enhanced Notification Dialog */}
      <Dialog open={isNotificationOpen} onOpenChange={setIsNotificationOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BellRing className="w-5 h-5 text-blue-600" />
              New Task Assignment{newTasks.length > 1 ? 's' : ''}
            </DialogTitle>
            <DialogDescription>
              You have been assigned {newTasks.length} new task{newTasks.length > 1 ? 's' : ''} in this room
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {newTasks.map((task) => (
              <Card key={task.id} className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm text-gray-900">{task.title}</h4>
                          <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </Badge>
                        </div>
                        
                        {task.description && (
                          <p className="text-xs text-gray-600 mb-2">{task.description}</p>
                        )}
                        
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          {task.due_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Created: {new Date(task.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge className="text-xs bg-yellow-100 text-yellow-800">
                        {getStatusIcon('pending')}
                        <span className="ml-1">New Assignment</span>
                      </Badge>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(task.id, 'in_progress')}
                          className="h-7 px-3 text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          <Clock className="w-3 h-3 mr-1" />
                          Start
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(task.id, 'completed')}
                          className="h-7 px-3 text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100 transition-colors"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Complete
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <Button variant="outline" onClick={handleDismissNotification}>
              Dismiss All
            </Button>
            <Button onClick={handleDismissNotification} className="bg-blue-600 hover:bg-blue-700">
              View in Tasks Tab
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Side Notification Toast */}
      {sideNotification && (
        <div className={`fixed top-4 left-4 z-50 p-3 rounded-lg shadow-lg transition-all duration-300 ${
          sideNotification.type === 'success' ? 'bg-green-500 text-white' :
          sideNotification.type === 'error' ? 'bg-red-500 text-white' :
          'bg-blue-500 text-white'
        }`}>
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <span className="text-sm">{sideNotification.message}</span>
            <button 
              onClick={() => setSideNotification(null)}
              className="ml-2 hover:opacity-70"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  )
}
