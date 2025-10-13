// app/room/[roomId]/page.tsx
import { Suspense,useState,useCallback,useEffect } from 'react'
import PhaserMap from '@/game/PhaserMap'
import {LoaderTwo } from '@/components/ui/loader'
import LeaveRoomButton from './LeaveRoomButton'
import PlayersPanel from './PlayersPanel'
import MediaComponent from './MediaComponent';
import TaskNotification from '@/app/components/TaskNotification';

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
 

  return (
    <div className="w-full h-screen relative">
      <div className="absolute bottom-4 right-4 z-50 space-y-2 flex flex-col items-end">
        {/* Players toggle button should be above leave button, so it's in PlayersPanel. Keep leave below. */}
        <LeaveRoomButton />
        <MediaComponent />
      </div>
      <PlayersPanel />
      
      {/* Task Notifications */}
      <TaskNotification roomId={roomId} />
      
      {/** Chat is now inside the right panel under the Chat tab **/}
      <Suspense fallback={<div className="w-full h-screen flex items-center justify-center"><LoaderTwo/></div>}>
        <PhaserMap roomId={roomId} />
      </Suspense>
    </div>
  )
}