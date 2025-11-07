'use client';

import React, { Suspense, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import PhaserMap from '@/game/PhaserMap';
import { useAFK } from '@/hooks/useAFK';
import AFKBanner from '@/components/AFKBanner';
import AFKToast from '@/components/AFKToast';
import { LoaderTwo } from '@/components/ui/loader';
import LeaveRoomButton from './LeaveRoomButton';
import PlayersPanel from './PlayersPanel';
import MediaComponent from './MediaComponent';
import RoomTasksPanel from './TasksPanel';
import TaskAssignmentNotification from '@/components/TaskAssignmentNotification';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import type { CollaborativeWhiteboardProps } from '@/components/CollaborativeWhiteboard';
import { setWhiteboardOpen } from '@/game/whiteboardState';

const CollaborativeWhiteboard = dynamic(() => import('@/components/CollaborativeWhiteboard'), {
  ssr: false,
}) as React.ComponentType<CollaborativeWhiteboardProps>;

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const unwrappedParams = React.use(params);
  const roomId = unwrappedParams.roomId;
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const { user } = useUser();
  const dialogContentRef = useRef<HTMLDivElement>(null);

  // Install AFK detectors
  useAFK();
  const [inMeeting,setInMeeting]=useState(false)

  const handleOpenWhiteboard = () => {
    setIsWhiteboardOpen(true);
    setWhiteboardOpen(true);

    if (dialogContentRef.current) {
      dialogContentRef.current.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable full-screen mode:', err);
      });
    }
  };

  const handleCloseWhiteboard = () => {
    setIsWhiteboardOpen(false);
    setWhiteboardOpen(false);

    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => {
        console.error('Error attempting to exit full-screen mode:', err);
      });
    }
  };

  const userInfo = user
    ? {
        name: user.fullName || user.username || 'Anonymous',
        picture: user.imageUrl || '',
      }
    : undefined;

  if (!user || !userInfo) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <LoaderTwo />
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative">
      <AFKBanner />
      <AFKToast />
        <MediaComponent handleOpenWhiteboard={handleOpenWhiteboard} set={setInMeeting} isWhiteboardOpen={isWhiteboardOpen}>
          
        <CollaborativeWhiteboard
          isOpen={isWhiteboardOpen}
          onClose={handleCloseWhiteboard}
          roomId={roomId}
        />
    
        </MediaComponent>
      {/* <div className="absolute bottom-4 right-4 z-50 space-y-2 flex flex-col items-end">
        <LeaveRoomButton />
       
      </div> */}
        {inMeeting && <Button style={{position:"absolute",left:"50%",top:"2%",transform:"translate(-50%,-50%)",zIndex:"10000"}}
          onClick={handleOpenWhiteboard}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-4 py-2 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 transition"
          size="sm"
        >
          Open Whiteboard
        </Button>}

      <PlayersPanel />
	  <RoomTasksPanel roomId={roomId} />
	  <TaskAssignmentNotification />

      <Suspense
        fallback={
          <div className="w-full h-screen flex items-center justify-center">
            <LoaderTwo />
          </div>
        }
      >
        <PhaserMap roomId={roomId} />
      </Suspense>

	  
    </div>
  );
}
