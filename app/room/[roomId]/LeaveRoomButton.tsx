'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { destroyRealtime } from '@/game/realtime/PlayerRealtime'
import { LogOut } from 'lucide-react'

export default function LeaveRoomButton() {
	const router = useRouter()
	const [isLeaving, setIsLeaving] = useState(false)

	const handleLeave = useCallback(async () => {
		if (isLeaving) return
		setIsLeaving(true)
		try {
			await destroyRealtime()
		} catch {
			// ignore
		} finally {
			// Navigating away will unmount Phaser and trigger its cleanup
			router.replace('/dashboard')
		}
	}, [isLeaving, router])

	return (
		
		<button
			onClick={handleLeave}
			disabled={isLeaving}
			className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition 
                bg-white border-slate-200 text-slate-600 hover:bg-slate-50
                disabled:opacity-50 disabled:cursor-not-allowed`}
		>
			<LogOut className="w-4 h-4" />
			<span className="text-sm font-medium">Leave Room</span>
		</button>
	)
}


