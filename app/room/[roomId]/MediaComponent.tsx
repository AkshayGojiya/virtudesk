'use client'
import React, { useState,useEffect,useCallback,useRef, Ref, RefObject, CSSProperties } from "react";
import {createOffer, setSTREAM,setMediaElement, MediaComponentTtype,RTCEventEmitter,getMyId,nullifySTREAM,destroyRealtime,setMODE, 
    startMeeting, joinMeeting, leaveMeeting, setMeetingParticipants} from "../../../game/realtime/PlayerRealtime"
import { useAuth } from '@clerk/nextjs';
import LeaveRoomButton from './LeaveRoomButton';
import { Button } from "@/components/ui/button";
import { set } from "react-hook-form";
import { CollaborativeWhiteboardProps } from "@/components/CollaborativeWhiteboard";
type Constraints = {
    audio:boolean,
    video:boolean
}
const CSS:CSSProperties={
    position:"absolute",top:"50%",left:"50%",
    backgroundColor:"black",
    width:"90%",height:"80%",
    display:"flex",
    transform:"translate(-50%,-50%)"
}
const videoCss:CSSProperties={height:"360px",width:"480px",backgroundColor:"red"}
type propType={
    handleOpenWhiteboard:()=>void,
    set:React.Dispatch<React.SetStateAction<boolean>>,
    children:React.ReactNode,
    isWhiteboardOpen:boolean

}
export default function  MediaComponent(props:propType){
    
    const [stream,setStream] = useState<MediaStream|undefined>(undefined);
    const [participants,setParticipants]=useState<MediaComponentTtype[]>([] as MediaComponentTtype[])
    const [mode,setModeState]=useState<string>('proximity') // proximity | 1:1 | meeting
    const [showNotification, setShowNotification] = useState(false);
    const [meetingInvite, setMeetingInvite] = useState<any>(null);
    const [inMeeting, setInMeeting] = useState(false);
    const [myVideoStream, setMyVideoStream] = useState<MediaStream | null>(null);
    const [meetingParticipants, setMeetingParticipantsState] = useState<MediaComponentTtype[]>([]);
    
    const { orgRole } = useAuth();
    const getUserRole = (): string => {
        if (!orgRole) return 'member';
        return orgRole.replace('org:', '');
    };
    const [userRole,setUserRole]=useState<string>(getUserRole()) // admin | team_manager | member
   
    
    const requestMedia= useCallback(async (a:boolean=true,v:boolean=false)=>{

        const myStream =await  navigator.mediaDevices.getUserMedia({audio:a,video:v})
        
        setStream(myStream);
        setSTREAM(myStream)
        
    },[])
   

   useEffect(()=>{
    setMODE(mode)
   },[mode])
    
        useEffect(()=>{
            setMediaElement(setParticipants,mode)
            if(!stream){
                 requestMedia(true,false);
                console.log("mediacomponent mounted");
            }
        return ()=>{
            stream?.getTracks().forEach((track) => {
                    track.stop();
                    console.log("goneeee")
            });
            RTCEventEmitter.removeAllListeners("onTrack in meeting")
            RTCEventEmitter.removeAllListeners("onclose in meeting")
             RTCEventEmitter.removeAllListeners("onTrack in proximity")
            RTCEventEmitter.removeAllListeners("onclose in proximity")
            setParticipants([])
            console.log("mediacomponent unmounted")
            nullifySTREAM()
            destroyRealtime().then(()=>{console.log("destroyrealtime complete")})
        }
    },[])
    
    useEffect(() => {
        const role = getUserRole();
        setUserRole(role);
        console.log("orgRole:", orgRole, "userRole:", role);
    }, [orgRole]);
    
    // Handle meeting invite notifications
    useEffect(() => {
        const handleMeetingInvite = (event: CustomEvent) => {
            console.log("Received meeting invite event:", event.detail);
            setMeetingInvite(event.detail);
            setShowNotification(true);
        };

        window.addEventListener('meeting-invite', handleMeetingInvite as EventListener);
        
        return () => {
            window.removeEventListener('meeting-invite', handleMeetingInvite as EventListener);
        };
    }, []);
    
    const handleStartMeeting = useCallback(async () => {
        await startMeeting(setStream);
        setInMeeting(true);
        props.set(true)
        setModeState('meeting');
        setMODE('meeting');
    }, []);
    
    const handleAcceptMeeting = useCallback(async () => {
        await joinMeeting(setStream);
        setInMeeting(true);
        props.set(true)
        setModeState('meeting');
        setMODE('meeting');
        setShowNotification(false);
        setMeetingInvite(null);
    }, []);
    
    const handleRejectMeeting = useCallback(() => {
        setShowNotification(false);
        setMeetingInvite(null);
    }, []);
    
    const handleLeaveMeeting = useCallback(() => {
        // Just leave the room, no need to switch back to proximity
        destroyRealtime();
        window.location.href = '/dashboard';
    }, []);


    // Get my video stream when in meeting
    useEffect(() => {
        if (inMeeting && stream) {
            setMyVideoStream(stream);
            // Set my video using document method
            const myVideo = document.getElementById('myVideo') as HTMLVideoElement;
            if (myVideo) {
                const myOwnStream=new MediaStream()
                myVideo.srcObject = myOwnStream;
                stream.getTracks().forEach((t)=>{
                    myOwnStream.addTrack(t);
                })
            
                myVideo.play().catch(console.error);
            }
        } else {
            setMyVideoStream(null);
        }
    }, [inMeeting, stream]);

    // Handle meeting participants when in meeting mode
    useEffect(() => {
        if (inMeeting) {
            setMediaElement(setMeetingParticipantsState,mode);
            setMeetingParticipants(meetingParticipants);
        } else {
            setMeetingParticipantsState([]);
        }
    }, [inMeeting]);

    // Handle remote video streams using document methods
    useEffect(() => {
        meetingParticipants.forEach((participant) => {
            const videoElement = document.getElementById(`meetingVideo${participant.from}`) as HTMLVideoElement;
            const remoteStream = new MediaStream()
            if (videoElement && participant.track) {

                videoElement.srcObject = remoteStream;
                participant.track.getTracks().forEach((t)=>{
                    remoteStream.addTrack(t);
                })
                videoElement.volume=1
                videoElement.play().catch(console.error);
            }
        });
    }, [meetingParticipants]);

   useEffect(()=>{
      participants.map((participant,index)=>{
        const el:HTMLMediaElement=document.getElementById(`PeerAudio${participant.from}`)as HTMLMediaElement;
             
                const remoteStream = new MediaStream()
                el.srcObject=remoteStream
                participant.track.getTracks().forEach((t)=>{
                    remoteStream.addTrack(t);
                })
                el.volume=1
                if(el){
                    el.play().catch(()=>{console.error("not playing")})
                }

            })
   },[participants])
      
   

    
    return<>
    {props.isWhiteboardOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1002 }}>
            {props.children}
        </div>
    )}
        {/* Meeting Component - Full screen when in meeting */}
        {inMeeting && (
            <div className="fixed top-0 left-0 w-full h-full z-[100] pointer-events-auto bg-gray-900">
                <div className="flex flex-col h-full">
                    {/* Meeting Header */}
                    <div className="flex justify-between items-center p-4 bg-gray-800 border-b border-gray-700">
                        <div>
                            <h2 className="text-lg font-semibold text-white">Meeting in Progress</h2>
                            <p className="text-sm text-gray-300">{meetingParticipants.length + 1} participants</p>
                        </div>
                        {/* <Button
                                  onClick={props.handleOpenWhiteboard}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-4 py-2 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 transition"
                                  size="sm"
                                >
                                  Open Whiteboard
                                </Button> */}
                        <LeaveRoomButton />
                    </div>
                    
                    {/* Meeting Content - Video Grid */}
                    <div className="flex-1 p-4 overflow-y-auto">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 h-full">
                            {/* My Video */}
                            
                            {mode==="meeting" && (
                                <div className="relative bg-gray-800 rounded-lg overflow-hidden">
                                    <video
                                        id="myVideo"
                                        autoPlay
                                        playsInline
                                        
                                        className="w-full h-full object-cover -scale-x-100"
                                    />
                                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                                        You
                                    </div>
                                </div>
                            )}
                            
                            {/* Remote Videos */}
                            {meetingParticipants.map((participant) => (
                                <div key={participant.from} className="relative bg-gray-800 rounded-lg overflow-hidden">
                                    <video
                                        id={`meetingVideo${participant.from}`}
                                        autoPlay
                                        playsInline
                                        className="w-full h-full object-cover -scale-x-100"
                                    />
                                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                                        {participant.from}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        {/* Start Meeting Button - Only for admin/manager when not in meeting */}
        {(userRole === "admin" || userRole === "team_manager") && !inMeeting && (
            <button 
                className="absolute bottom-20 right-4 z-50 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg transition-colors duration-200 font-medium"
                onClick={handleStartMeeting}
            >
                Start Meeting
            </button>
        )}
        
        {/* Meeting Notification - Only show when not in meeting */}
        {!inMeeting && showNotification && meetingInvite && (
            <div className="fixed top-4 left-4 z-50 pointer-events-auto">
                <div className="bg-white rounded-lg shadow-xl p-4 max-w-sm w-full border border-gray-200">
                    <div className="flex items-center mb-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900">Meeting Invitation</h3>
                        </div>
                    </div>
                    
                    <div className="mb-4">
                        <p className="text-sm text-gray-700">
                            You've been invited to join a meeting.
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleAcceptMeeting}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                        >
                            Accept
                        </button>
                        <button
                            onClick={handleRejectMeeting}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                        >
                            Reject
                        </button>
                    </div>
                </div>
            </div>
        )}
        
        {/* Proximity Chat Audio Elements - Only show when not in meeting */}
        {!inMeeting && participants.map((participant, index) => {
            if (participant.from === getMyId()) return;
            return (
                <audio
                    key={participant.from}
                    id={`PeerAudio${participant.from}`}
                    autoPlay
                    playsInline
                    className="hidden"
                />
            );
            })}
    </>
    
}