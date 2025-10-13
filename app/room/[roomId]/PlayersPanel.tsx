'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useParams } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getAllPlayers, getSelfId } from '@/game/realtime/PlayerRealtime'
import { Users2, MessageSquareText, Video, CheckSquare } from "lucide-react"
import TextChat from './TextChat'
import TasksPanel from './TasksPanel'

type PlayerInfo = { id: string; name?: string; character?: string; avatar?: string }

export default function PlayersPanel() {
	const [players, setPlayers] = useState<PlayerInfo[]>([])
	const [activeTab, setActiveTab] = useState<'participants' | 'chat' | 'tasks'>('participants')
	const selfId = getSelfId()
	const { user } = useUser()
	const params = useParams()
	const roomId = params.roomId as string

	const refresh = useCallback(() => {
		const all = getAllPlayers()
		const filtered = all.filter((p) => p.id)
		setPlayers(filtered)
	}, [])

	useEffect(() => {
		refresh()
		const t = setInterval(refresh, 1000)
		return () => clearInterval(t)
	}, [refresh])

	// Show max 5 avatars, collapse extras into "+N" avatar
	const maxVisible = 5
	const visiblePlayers = useMemo(() => players.slice(0, maxVisible), [players])
	const extraCount = useMemo(() => Math.max(0, players.length - maxVisible), [players])

// Call button intentionally does nothing for now
const onCall = useCallback(() => {}, [])

	return (
		<>
		<div className="absolute top-1/2 right-4 -translate-y-1/2 z-50 pointer-events-auto">
			<div className="relative w-[360px] max-w-[80vw]">
				{/* Glass crystal background container */}
				<div className="absolute inset-0 bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20" />

				{/* Panel container */}
				<div className={`relative overflow-hidden h-[50vh] opacity-100`}>
					<div className="flex flex-col p-3">
						{/* Removed top mini-avatars preview for simpler UI */}
						<div className="hidden">
							{visiblePlayers.map((p) => {
								const isCurrentUser = p.id === selfId
								const displayName = p.name || p.id
								return (
									<TooltipProvider key={p.id}>
										<Tooltip>
											<TooltipTrigger asChild>
												<div className="relative flex-shrink-0">
													{isCurrentUser && (
														<div className="absolute -inset-1 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 rounded-full opacity-60 blur-sm" />
													)}
													<Avatar className="h-10 w-10 cursor-pointer transition-all duration-200 hover:scale-110 hover:shadow-lg hover:shadow-blue-500/25 relative z-10">
														<AvatarImage src={p.avatar || (isCurrentUser ? user?.imageUrl : undefined)} alt={displayName} className="object-cover" />
														<AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 border border-slate-300/50">
															{isCurrentUser ? (user?.fullName?.split(' ').map(word => word[0]).join('') || 'U') : displayName.charAt(0).toUpperCase()}
														</AvatarFallback>
													</Avatar>
												</div>
											</TooltipTrigger>
											<TooltipContent side="bottom" className="bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 text-white px-3 py-2 rounded-lg shadow-xl">
												<div className="text-center">
													<p className="font-medium text-sm">{displayName}</p>
													{isCurrentUser && (<p className="text-xs text-slate-400 mt-1">You</p>)}
												</div>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								)
							})}

							{/* "+N" avatar for extra participants */}
							{extraCount > 0 && (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Avatar className="h-10 w-10 cursor-pointer transition-all duration-200 hover:scale-110 hover:shadow-lg hover:shadow-purple-500/25 flex-shrink-0">
												<AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-purple-100 to-purple-200 text-purple-700 border border-purple-300/50">+{extraCount}</AvatarFallback>
											</Avatar>
										</TooltipTrigger>
										<TooltipContent side="bottom" className="bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 text-white px-3 py-2 rounded-lg shadow-xl">
											<p className="font-medium text-sm">{extraCount} more participant{extraCount > 1 ? 's' : ''}</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)}
						</div>

						{/* Tabs */}
						<div className="mt-0 mb-2 grid grid-cols-3 gap-2">
							<button onClick={() => setActiveTab('participants')} className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition ${activeTab === 'participants' ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
								<Users2 className="w-4 h-4" />
								<span className="text-sm font-medium">Participants</span>
							</button>
							<button onClick={() => setActiveTab('chat')} className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition ${activeTab === 'chat' ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
								<MessageSquareText className="w-4 h-4" />
								<span className="text-sm font-medium">Chat</span>
							</button>
							<button onClick={() => setActiveTab('tasks')} className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition ${activeTab === 'tasks' ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
								<CheckSquare className="w-4 h-4" />
								<span className="text-sm font-medium">Tasks</span>
							</button>
						</div>

						{/* Content */}
						<div className="bg-white border border-slate-200 rounded-md overflow-hidden flex flex-col h-[calc(50vh-72px)] p-2">
							{/* Participants pane (kept mounted) */}
							<div className={`${activeTab === 'participants' ? 'flex' : 'hidden'} flex-col flex-1 overflow-y-auto divide-y divide-slate-200 px-1`}>
								{players.map((p) => {
									const displayName = p.name || p.id
									const isCurrentUser = p.id === selfId
									return (
										<div key={p.id} className="flex items-center gap-3 px-3 py-2">
											<Avatar className="h-8 w-8">
												<AvatarImage src={p.avatar || (isCurrentUser ? user?.imageUrl : undefined)} alt={displayName} />
												<AvatarFallback className="text-xs font-medium">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
											</Avatar>
											<div className="min-w-0 flex-1">
												<p className="text-sm text-slate-700 truncate">{displayName}{isCurrentUser ? ' (You)' : ''}</p>
											</div>
											<div>
												<button
													onClick={onCall}
													disabled={isCurrentUser}
													className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold border shadow-sm transition transform active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-0 ${isCurrentUser ? 'opacity-60 cursor-not-allowed border-slate-200 text-slate-400 bg-slate-50' : 'cursor-pointer border-violet-400 text-violet-900 bg-gradient-to-r from-violet-50 to-violet-100 hover:from-violet-100 hover:to-violet-200 hover:border-violet-500 shadow-violet-100/60 focus:ring-violet-300/40'}`}
												>
													<Video className="w-3.5 h-3.5" />
													<span>Call</span>
												</button>
											</div>
										</div>
									)
								})}
							</div>

							{/* Chat pane (kept mounted) */}
							<div className={`${activeTab === 'chat' ? 'flex' : 'hidden'} flex-1 overflow-hidden`}>
								<TextChat embedded title="Room Chat" variant="solid" className="h-full w-full" />
							</div>

							{/* Tasks pane (kept mounted) */}
							<div className={`${activeTab === 'tasks' ? 'flex' : 'hidden'} flex-1 overflow-hidden`}>
								<ScrollArea className="flex-1">
									<TasksPanel roomId={roomId} />
								</ScrollArea>
							</div>
						</div>
					</div>
				</div>

				{/* Custom scrollbar styles */}
				<style jsx>{`
					.scrollbar-hide {
						-ms-overflow-style: none;
						scrollbar-width: none;
					}
					.scrollbar-hide::-webkit-scrollbar {
						display: none;
					}
				`}</style>
			</div>
		</div>

		</>
	)
}