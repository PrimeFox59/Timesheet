'use client';

import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronLeft, 
  MessageSquare
} from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface UserItem {
  id: string;
  username: string;
  role: string;
  is_online?: boolean;
  last_active?: string;
}

interface RightSidebarOnlineUsersProps {
  currentUser: any;
  onOpenDirectChat?: (targetUserId: string, targetUserName: string) => void;
}

export default function RightSidebarOnlineUsers({
  currentUser,
  onOpenDirectChat
}: RightSidebarOnlineUsersProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [users, setUsers] = useState<UserItem[]>([]);

  // Fetch actual online users
  const fetchOnlineUsers = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(apiUrl(`/api/users/online?currentUserId=${encodeURIComponent(currentUser.id)}`));
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
      }
    } catch {
      // Ignore
    }
  };

  // Heartbeat sender
  const sendHeartbeat = async () => {
    if (!currentUser?.id) return;
    try {
      await fetch(apiUrl('/api/realtime/heartbeat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id })
      });
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchOnlineUsers();
    sendHeartbeat();

    const timer = setInterval(() => {
      sendHeartbeat();
      fetchOnlineUsers();
    }, 15000);

    return () => clearInterval(timer);
  }, [currentUser?.id]);

  // Listen to SSE presence updates and window broadcast events
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(apiUrl('/api/realtime/stream'));
      eventSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.event === 'presence_updated' || payload.event === 'user_updated') {
            fetchOnlineUsers();
          }
        } catch {}
      };
    } catch {}

    const handleWindowPresence = () => {
      fetchOnlineUsers();
    };

    window.addEventListener('presence_updated', handleWindowPresence);

    return () => {
      if (eventSource) eventSource.close();
      window.removeEventListener('presence_updated', handleWindowPresence);
    };
  }, []);

  if (!currentUser) return null;

  const handleStartChat = (targetUserId: string, targetUserName: string) => {
    if (onOpenDirectChat) {
      onOpenDirectChat(targetUserId, targetUserName);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open_direct_chat', { detail: { targetUserId, targetUserName } }));
    }
  };

  return (
    <aside id="tour-online-presence" aria-label="Online Team" className="fixed right-5 top-1/2 -translate-y-1/2 z-40 pointer-events-auto select-none transition-all duration-150">
      
      {/* 🟢 ULTRA COMPACT COLLAPSED PILL 🟢 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 dark:bg-black/20 backdrop-blur-sm border border-slate-300/30 dark:border-white/10 shadow-xs hover:bg-white/30 transition-all text-[10px] font-bold text-slate-700 dark:text-slate-200"
          title="Show online users"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span><strong className="text-[#FF6B00]">{users.length}</strong> Online</span>
          <ChevronLeft className="w-2.5 h-2.5 text-slate-400 group-hover:text-[#FF6B00]" />
        </button>
      )}

      {/* 🚀 ULTRA COMPACT & TRANSPARENT ONLINE CARD (PILL-WIDTH MATCH) 🚀 */}
      {isOpen && (
        <div className="w-28 sm:w-32 bg-white/20 dark:bg-slate-950/20 backdrop-blur-sm border border-slate-300/30 dark:border-white/10 rounded-xl shadow-xs flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-1 duration-150">
          
          {/* Header */}
          <div className="px-2 py-1 bg-transparent border-b border-slate-200/30 dark:border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-[9px] font-extrabold tracking-wider text-slate-800 dark:text-slate-200 uppercase font-sans">
                ONLINE
              </span>
              <span className="px-1 py-0.1 bg-[#FF6B00]/15 text-[#FF6B00] text-[8px] font-black rounded-full">
                {users.length}
              </span>
            </div>

            {/* Minimize toggle */}
            <button
              onClick={() => setIsOpen(false)}
              className="p-0.5 hover:bg-white/30 dark:hover:bg-slate-800/30 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-all"
              title="Minimize"
            >
              <ChevronRight className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* User List: Max 10 Rows, scrollable if > 10 */}
          <div className="max-h-[260px] overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
            {users.length === 0 ? (
              <div className="text-center py-2 text-[9px] text-slate-400">
                Offline
              </div>
            ) : (
              users.map((u) => {
                const isMe = u.id === currentUser?.id;

                return (
                  <div
                    key={u.id}
                    onClick={() => handleStartChat(u.id, u.username)}
                    className="group px-1.5 py-1 rounded-lg flex items-center justify-between gap-1 hover:bg-orange-500/15 dark:hover:bg-orange-500/20 cursor-pointer transition-all active:scale-[0.97]"
                    title={`Click to chat with ${u.username}`}
                  >
                    {/* Status Dot + Name */}
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-[10px] font-semibold text-slate-800 dark:text-slate-100 group-hover:text-[#FF6B00] transition-colors truncate leading-tight">
                        {u.username}
                      </span>
                    </div>

                    {/* Chat Action Icon (for other users) */}
                    {!isMe && (
                      <MessageSquare className="w-2 h-2 text-slate-400 group-hover:text-[#FF6B00] shrink-0 opacity-60 group-hover:opacity-100" />
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

    </aside>
  );
}
