'use client'
import React, { useEffect, useRef, useState } from 'react';
import RoomCard from './_components/RoomCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrganization, useUser } from '@clerk/nextjs';
import { useRoomStore } from '@/app/stores/roomStore';
import CreateRoomBtn from './_components/CreateRoomBtn';
import SubscriptionManager from './_components/SubscriptionManager';
import TaskManagement from './_components/TaskManagement';
import EmployeeTaskDashboard from './_components/EmployeeTaskDashboard';

export type Rooms = {
  id: string;
  org_id: string;
  title: string;
  imageUrl: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

const page = () => {
  const { organization } = useOrganization();
  const { user } = useUser();
  const { rooms, isLoading, fetchRooms } = useRoomStore();
  const lastOrgIdRef = useRef<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>('');

  const orgId = organization?.id || null;

  useEffect(() => {
    if (!orgId) return;
    if (lastOrgIdRef.current === orgId) return; // skip duplicate fetches for same org
    lastOrgIdRef.current = orgId;
    fetchRooms(orgId);
    fetchUserRole();
  }, [orgId, user?.id, fetchRooms]);

  const fetchUserRole = async () => {
    if (!organization || !user?.id) return;
    
    try {
      console.log('Dashboard - Fetching user role for:', { userId: user.id, orgId: organization.id });
      const memberships = await organization.getMemberships();
      console.log('Dashboard - Memberships:', memberships);
      
      if (memberships) {
        // Find the current user's membership using the user ID
        const currentMembership = memberships.data.find((m: any) => {
          console.log('Dashboard - Checking membership:', { 
            membershipUserId: m.publicUserData.userId, 
            currentUserId: user.id,
            match: m.publicUserData.userId === user.id 
          });
          return m.publicUserData.userId === user.id;
        });
        
        console.log('Dashboard - Current membership:', currentMembership);
        const role = currentMembership?.role || 'org:member';
        console.log('Dashboard - Final role:', role, 'isAdmin:', role === 'org:admin' || role === 'admin');
        setUserRole(role);
        setIsAdmin(role === 'org:admin' || role === 'admin');
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  };

  if (isLoading && rooms.length === 0) {
    return (
      <div className="w-full flex justify-center">
        <div className="flex flex-wrap justify-start gap-5 w-full">
          {Array(10).fill(0).map((_, i) => (
            <Skeleton key={i} className="w-[300px] h-[200px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Task Management Section - Role Based */}
      <div className="w-full">
        {isAdmin ? (
          <TaskManagement />
        ) : userRole ? (
          <EmployeeTaskDashboard />
        ) : (
          // Default to TaskManagement if role detection fails (for debugging)
          <div>
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Role detection in progress... Showing TaskManagement by default.
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                User ID: {user?.id} | Role: {userRole} | IsAdmin: {isAdmin.toString()}
              </p>
            </div>
            <TaskManagement />
          </div>
        )}
      </div>
      
      {/* Rooms Section */}
      <div className="w-full">
        <div className="mb-4">
          <h2 className="text-2xl font-bold">Rooms</h2>
          <p className="text-gray-600">Manage your virtual workspaces</p>
        </div>
        <div className="w-full flex justify-center">
          <div className="flex flex-wrap justify-start gap-5 w-full">
            <CreateRoomBtn/>
            {rooms.map((room, index) => (
              <RoomCard
                key={room.id}
                id={room.id}
                imageUrl={room.imageUrl}
                title={room.title}
                created_at={room.created_at}
                author_name={room.author_name || ''}
                org={organization?.name || ''}
                index={index + 1}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default page;