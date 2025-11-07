"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, useOrganization, useUser } from "@clerk/nextjs";
import { getUserRoomTasks, getRoomTasks, type TaskWithAssignments, updateTaskAssignmentStatus, createTask, updateTask } from "@/app/actions/Tasks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, PlayCircle, Clock3, Tag, Users2 } from "lucide-react";
import { getAllPlayers } from "@/game/realtime/PlayerRealtime";

type Priority = 'low' | 'medium' | 'high' | 'urgent';

export default function RoomTasksPanel({ roomId }: { roomId: string; }) {
  const { orgId, orgRole } = useAuth();
  const { user } = useUser();
  const [tasks, setTasks] = useState<TaskWithAssignments[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { organization } = useOrganization();
  const [members, setMembers] = useState<Array<{ id: string; name: string; role: string }>>([]);

  const isAdmin = useMemo(() => orgRole === 'org:admin' || orgRole === 'admin', [orgRole]);

  const fetchTasks = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      if (isAdmin) {
        const data = await getRoomTasks(roomId);
        setTasks(data);
      } else if (user) {
        const data = await getUserRoomTasks(roomId, user.id);
        setTasks(data);
      }
    } finally {
      setLoading(false);
    }
  }, [roomId, isAdmin, user]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    const loadMembers = async () => {
      if (!organization || !organization.getMemberships) return;
      try {
        const list = await organization.getMemberships();
        const arr = (list?.data || [])
          .filter((m: any) => m.publicUserData?.userId)
          .map((m: any) => ({
            id: m.publicUserData.userId as string,
            name:
              (m.publicUserData.firstName && m.publicUserData.lastName)
                ? `${m.publicUserData.firstName} ${m.publicUserData.lastName}`
                : (m.publicUserData.identifier as string) || 'Member',
            role: m.role,
          }));
        setMembers(arr);
      } catch {}
    };
    void loadMembers();
  }, [organization]);

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 pointer-events-auto">
      <div className="relative w-[360px] max-w-[80vw]">
        <div className="absolute inset-0 bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20" />
        <div className={`relative overflow-hidden h-[50vh] opacity-100`}>
          <div className="flex flex-col p-3">
            <div className="mt-0 mb-2 grid grid-cols-2 gap-2">
              <button className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition bg-slate-100 border-slate-300 text-slate-800`}>
                <Users2 className="w-4 h-4" />
                <span className="text-sm font-medium">Tasks</span>
              </button>
              {isAdmin && (
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">New</Button>
                  </DialogTrigger>
                  <CreateRoomTaskDialog orgId={orgId || ''} roomId={roomId} members={members} onCreated={() => { setCreateOpen(false); fetchTasks(); }} />
                </Dialog>
              )}
            </div>
            <div className="bg-white border border-slate-200 rounded-md overflow-hidden flex flex-col h-[calc(50vh-72px)] p-2">
              <div className="px-1 pb-2 text-xs text-muted-foreground">{loading ? 'Loading…' : `${tasks.length} tasks`}</div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-slate-100 px-1">
                <div className="space-y-2 py-1 max-w-full">
                  {tasks.map((t) => (
                    <RoomTaskItem key={t.id} task={t} onUpdated={fetchTasks} isAdmin={isAdmin} members={members} />
                  ))}
                  {!loading && tasks.length === 0 && (
                    <Card className="p-4 text-center text-sm text-muted-foreground">No tasks yet.</Card>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoomTaskItem({ task, onUpdated, isAdmin, members }: { task: TaskWithAssignments; onUpdated: () => void; isAdmin: boolean; members: Array<{ id: string; name: string; role: string }>; }) {
  const { user } = useUser();
  const userAssignment = useMemo(() => task.assignments.find(a => a.assigned_to === user?.id), [task.assignments, user]);
  const canShowEmployeeActions = useMemo(() => !!userAssignment && !isAdmin && task.status !== 'completed', [userAssignment, isAdmin, task.status]);
  const [updating, setUpdating] = useState(false);
  const getMemberName = useCallback((userId: string) => {
    const member = members.find(m => m.id === userId);
    return member?.name ?? userId.slice(0, 8);
  }, [members]);

  const setStatus = async (status: 'pending' | 'in_progress' | 'completed') => {
    if (!user) return;
    setUpdating(true);
    try {
      await updateTaskAssignmentStatus(task.id, user.id, status);
      if (status === 'in_progress' && task.status !== 'in_progress') {
        await updateTask(task.id, { status: 'in_progress' });
      }
      onUpdated();
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card className="p-4 w-full overflow-hidden">
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="font-semibold truncate mr-2 text-sm break-words max-w-full">{task.title}</div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="secondary" className="text-xs"><Tag className="mr-1" size={14}/>{task.priority}</Badge>
              <Badge variant="outline" className="text-xs"><Clock3 className="mr-1" size={14}/>{task.status.replace('_',' ')}</Badge>
            </div>
          </div>
          {task.description && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words">{task.description}</div>
          )}
          {task.assignments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {task.assignments.map((a) => (
                <Badge key={a.id} variant="secondary" className="text-xs"><Users2 className="mr-1" size={12}/> {getMemberName(a.assigned_to)}</Badge>
              ))}
            </div>
          )}
          {task.due_date && (
            <div className="mt-2">
              <Badge variant="outline" className="text-xs">Due {new Date(task.due_date).toLocaleDateString()}</Badge>
            </div>
          )}
          {canShowEmployeeActions && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <TooltipProvider>
                {userAssignment?.status === 'pending' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="secondary" disabled={updating} onClick={() => setStatus('in_progress')} className="gap-1"><PlayCircle size={16}/> Start</Button>
                    </TooltipTrigger>
                    <TooltipContent>Set your assignment In Progress</TooltipContent>
                  </Tooltip>
                )}
                {userAssignment?.status === 'in_progress' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" disabled={updating} onClick={() => setStatus('completed')}><CheckCircle2 size={16}/> Completed</Button>
                    </TooltipTrigger>
                    <TooltipContent>Mark your assignment Completed</TooltipContent>
                  </Tooltip>
                )}
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function CreateRoomTaskDialog({ orgId, roomId, onCreated, members }: { orgId: string; roomId: string; onCreated: () => void; members: Array<{ id: string; name: string; role: string }> }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>('medium');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [participants, setParticipants] = useState<Array<{ id: string; name: string }>>([]);
  const [due, setDue] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const refreshParticipants = () => {
      const list = getAllPlayers();
      const mapped = list
        .filter((p) => !!p.id)
        .map((p) => {
          const match = members.find(m => m.id === p.id);
          const displayName = match?.name || p.name || p.id.slice(0, 8);
          const role = match?.role;
          return { id: p.id, name: displayName, role };
        })
        .filter((p) => {
          const member = members.find(m => m.id === p.id);
          return member ? (member.role !== 'org:admin' && member.role !== 'admin') : true;
        });
      const prepared = mapped.map(({ id, name }) => ({ id, name }));
      setParticipants(prepared);
      console.log("participants : ", prepared);
      setAssignees((prev) => prev.filter(id => prepared.some(p => p.id === id)));
    };

    refreshParticipants();
    const interval = setInterval(refreshParticipants, 1000);
    return () => clearInterval(interval);
  }, [members]);

  const onSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await createTask({ org_id: orgId, room_id: roomId, title: title.trim(), description: description.trim() || undefined, priority, assigned_to: assignees, due_date: due || null });
      onCreated();
      setTitle(""); setDescription(""); setPriority('medium'); setAssignees([]); setDue("");
    } finally { setSubmitting(false); }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create Room Task</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="flex gap-2">
          <select className="w-1/2 border rounded-md px-2 py-2 text-sm" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div>
          <div className="text-sm mb-1">Assign to participants</div>
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <Button key={p.id} type="button" size="sm" variant={assignees.includes(p.id) ? 'default' : 'outline'} onClick={() => setAssignees(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}>
                {p.name}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCreated}>Cancel</Button>
          <Button disabled={submitting || !title.trim()} onClick={onSubmit}>Create</Button>
        </div>
      </div>
    </DialogContent>
  );
}


