'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  MessageSquare, 
  X, 
  Send, 
  Users, 
  User, 
  Hash, 
  Minimize2, 
  Maximize2, 
  Smile, 
  Sparkles, 
  Radio, 
  Check, 
  CheckCheck,
  Search,
  ChevronDown,
  Paperclip,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  FileArchive,
  Download,
  Loader2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface ChatMessage {
  id: number | string;
  client_msg_id?: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  recipient_id: string;
  message: string;
  read_by: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  timestamp: string;
  created_at: string;
}

interface RecentChatItem {
  id: string;
  name: string;
  role: string;
  last_message: string;
  last_sender_id?: string;
  last_sender_name?: string;
  timestamp: string;
  unread_count: number;
  is_online: boolean;
  type: 'direct' | 'channel';
}

interface RealtimeChatWidgetProps {
  currentUser: any;
  usersList?: any[];
  connected: boolean;
  onNewMessageIncoming?: (msg: ChatMessage) => void;
}

export default function RealtimeChatWidget({
  currentUser,
  usersList = [],
  connected,
  onNewMessageIncoming
}: RealtimeChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeChannel, setActiveChannel] = useState<'ALL' | string>('ALL'); // 'ALL' = general, or user.id
  const [activeTab, setActiveTab] = useState<'channels' | 'direct'>('channels');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestSenderName, setLatestSenderName] = useState('');
  const [latestMessageText, setLatestMessageText] = useState('');
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [dropdownTab, setDropdownTab] = useState<'recent' | 'contacts'>('recent');
  const [recentChats, setRecentChats] = useState<RecentChatItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // File Upload State (Max 10MB)
  const [selectedFile, setSelectedFile] = useState<{
    file: File;
    previewUrl?: string;
    isImage: boolean;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewModalImage, setPreviewModalImage] = useState<{ url: string; downloadUrl?: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Typewriter Looping Effect State for Callout
  const [typewriterText, setTypewriterText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch recent conversations
  const fetchRecentChats = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(apiUrl(`/api/chat/recent?userId=${encodeURIComponent(currentUser.id)}`));
      const data = await res.json();
      if (data.success && Array.isArray(data.recentChats)) {
        setRecentChats(data.recentChats);
      }
    } catch (e) {
      console.error('Failed to fetch recent chats:', e);
    }
  };

  useEffect(() => {
    setMounted(true);

    const handleOpenDirectChat = (e: any) => {
      const { targetUserId } = e.detail || {};
      if (targetUserId) {
        setActiveChannel(targetUserId);
        setActiveTab('channels');
        setIsOpen(true);
        setIsMinimized(false);
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 150);
        fetchRecentChats();
      }
    };

    window.addEventListener('open_direct_chat' as any, handleOpenDirectChat);
    return () => window.removeEventListener('open_direct_chat' as any, handleOpenDirectChat);
  }, []);

  // Fetch initial unread count and messages
  const fetchMessagesAndUnread = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(apiUrl(`/api/chat/messages?userId=${encodeURIComponent(currentUser.id)}&recipientId=${encodeURIComponent(activeChannel)}&limit=100`));
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        setMessages(data.messages);
        setUnreadCount(data.unreadCount || 0);
        if (data.latestUnreadSender) setLatestSenderName(data.latestUnreadSender);
        if (data.latestUnreadText) setLatestMessageText(data.latestUnreadText);
      }
    } catch (err) {
      console.error('Failed to fetch chat messages:', err);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      fetchMessagesAndUnread();
      fetchRecentChats();
    }
  }, [activeChannel, currentUser?.id, isOpen]);

  // Mark channel messages as read
  useEffect(() => {
    if (isOpen && currentUser?.id && activeChannel) {
      fetch(apiUrl('/api/chat/read'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id, recipient_id: activeChannel })
      }).catch(console.error);
    }
  }, [isOpen, activeChannel, currentUser?.id]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  // Handle incoming real-time SSE chat messages
  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(apiUrl('/api/realtime/stream'));

      eventSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          const { event, data } = payload;

          if (event === 'chat_message' && data) {
            const incomingMsg: ChatMessage = data;

            // If message is for current active conversation, append it
            const isForCurrentChannel = 
              (activeChannel === 'ALL' && incomingMsg.recipient_id === 'ALL') ||
              (activeChannel === incomingMsg.sender_id && incomingMsg.recipient_id === currentUser?.id) ||
              (activeChannel === incomingMsg.recipient_id && incomingMsg.sender_id === currentUser?.id);

            if (isForCurrentChannel) {
              setMessages((prev) => {
                // If message with this real database ID already exists, ignore
                if (prev.some((m) => m.id === incomingMsg.id)) return prev;

                // If this is our own message and we have a temporary message matching client_msg_id
                if (incomingMsg.client_msg_id) {
                  const matchIdx = prev.findIndex((m) => m.client_msg_id === incomingMsg.client_msg_id || m.id === (incomingMsg.client_msg_id as any));
                  if (matchIdx !== -1) {
                    const updated = [...prev];
                    updated[matchIdx] = incomingMsg;
                    return updated;
                  }
                }

                // Fallback check: if sender is currentUser and matches a temporary message
                const fallbackIdx = prev.findIndex((m) => 
                  m.sender_id === incomingMsg.sender_id && 
                  m.message === incomingMsg.message && 
                  (String(m.id).startsWith('temp_') || typeof m.id === 'string' || Number(m.id) > 1000000000000)
                );
                if (fallbackIdx !== -1) {
                  const updated = [...prev];
                  updated[fallbackIdx] = incomingMsg;
                  return updated;
                }

                return [...prev, incomingMsg];
              });
            }

            // Handle unread if chat is closed or in different channel
            if (incomingMsg.sender_id !== currentUser?.id) {
              if (!isOpen || !isForCurrentChannel) {
                setUnreadCount((prev) => prev + 1);
                setLatestSenderName(incomingMsg.sender_name);
                setLatestMessageText(incomingMsg.message || (incomingMsg.file_name ? `📎 ${incomingMsg.file_name}` : 'Sent an attachment'));
                if (onNewMessageIncoming) onNewMessageIncoming(incomingMsg);
              }
            }
          } else if (event === 'chat_cleared' || (event === 'user_updated' && data?.action === 'reset')) {
            setMessages([]);
            setUnreadCount(0);
            setLatestSenderName('');
            setLatestMessageText('');
          } else if (event === 'chat_read') {
            // Update read receipts
            fetchMessagesAndUnread();
          }
        } catch (err) {
          // Ignore keepalive
        }
      };
    } catch (err) {
      console.error('SSE chat listener error:', err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [activeChannel, currentUser?.id, isOpen]);

  // TYPEWRITER LOOPING EFFECT FOR CALLOUT
  useEffect(() => {
    if (unreadCount === 0 || isOpen) {
      setTypewriterText('');
      return;
    }

    const fullMessage = `${unreadCount} message from ${latestSenderName || 'Team'}: "${latestMessageText || 'New Message'}"`;
    let currentIndex = 0;
    let isDeleting = false;
    let timeoutId: NodeJS.Timeout;

    const tick = () => {
      if (!isDeleting) {
        // Typing forward
        currentIndex++;
        setTypewriterText(fullMessage.substring(0, currentIndex));

        if (currentIndex >= fullMessage.length) {
          // Hold at full text for 2.8 seconds
          timeoutId = setTimeout(() => {
            isDeleting = true;
            tick();
          }, 2800);
          return;
        }
        timeoutId = setTimeout(tick, 45); // Typing speed
      } else {
        // Deleting backward for looping
        currentIndex--;
        setTypewriterText(fullMessage.substring(0, currentIndex));

        if (currentIndex <= 0) {
          isDeleting = false;
          // Pause before restarting loop
          timeoutId = setTimeout(tick, 400);
          return;
        }
        timeoutId = setTimeout(tick, 20); // Faster delete speed
      }
    };

    timeoutId = setTimeout(tick, 200);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [unreadCount, latestSenderName, latestMessageText, isOpen]);

  // File Selection Handler (Max 10MB)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      setUploadError(`File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed is 10MB.`);
      setTimeout(() => setUploadError(null), 4000);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadError(null);
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
    const previewUrl = isImage ? URL.createObjectURL(file) : undefined;

    setSelectedFile({ file, previewUrl, isImage });
    if (inputRef.current) inputRef.current.focus();
  };

  const clearSelectedFile = () => {
    if (selectedFile?.previewUrl) {
      URL.revokeObjectURL(selectedFile.previewUrl);
    }
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Send message handler (Supports text, photo, file)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !selectedFile) || !currentUser?.id || isUploading) return;

    const textToSend = inputText.trim();
    setInputText('');

    let uploadedFileInfo: { url: string; file_name: string; file_size: number; file_type: string } | null = null;

    if (selectedFile) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile.file);

        const uploadRes = await fetch(apiUrl('/api/chat/upload'), {
          method: 'POST',
          body: formData
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.success) {
          setUploadError(uploadData.error || 'Failed to upload attachment');
          setIsUploading(false);
          return;
        }

        uploadedFileInfo = {
          url: uploadData.url,
          file_name: uploadData.file_name,
          file_size: uploadData.file_size,
          file_type: uploadData.file_type
        };
      } catch (err) {
        console.error('File upload failed:', err);
        setUploadError('Network error uploading attachment');
        setIsUploading(false);
        return;
      } finally {
        clearSelectedFile();
        setIsUploading(false);
      }
    }

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    // Optimistic UI Message
    const tempMsg: ChatMessage = {
      id: tempId,
      client_msg_id: tempId,
      sender_id: currentUser.id,
      sender_name: currentUser.username || currentUser.id,
      sender_role: currentUser.role || 'Member',
      recipient_id: activeChannel,
      message: textToSend,
      read_by: JSON.stringify([currentUser.id]),
      file_url: uploadedFileInfo?.url || '',
      file_name: uploadedFileInfo?.file_name || '',
      file_size: uploadedFileInfo?.file_size || 0,
      file_type: uploadedFileInfo?.file_type || '',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };

    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await fetch(apiUrl('/api/chat/messages'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_msg_id: tempId,
          sender_id: currentUser.id,
          sender_name: currentUser.username || currentUser.id,
          sender_role: currentUser.role || 'Member',
          recipient_id: activeChannel,
          message: textToSend,
          file_url: uploadedFileInfo?.url || '',
          file_name: uploadedFileInfo?.file_name || '',
          file_size: uploadedFileInfo?.file_size || 0,
          file_type: uploadedFileInfo?.file_type || ''
        })
      });
      const data = await res.json();
      if (data.success && data.message) {
        setMessages((prev) => 
          prev.map((m) => (m.client_msg_id === tempId || m.id === tempId ? data.message : m))
        );
      }
    } catch (err) {
      console.error('Failed to send chat message:', err);
    }
  };

  const getRecipientDisplayName = () => {
    if (activeChannel === 'ALL') return '#commissioning-general';
    const targetUser = usersList.find((u) => u.id === activeChannel);
    return targetUser ? `@${targetUser.username}` : `@${activeChannel}`;
  };

  const getFileDownloadUrl = (fileUrl?: string, fileName?: string) => {
    if (!fileUrl) return '';
    if (fileUrl.startsWith('/api/chat/download')) {
      return apiUrl(fileUrl);
    }
    const cleanFileName = fileUrl.replace(/^\/uploads\/chat\//, '').replace(/^\/uploads\//, '');
    return apiUrl(`/api/chat/download?file=${encodeURIComponent(cleanFileName)}&name=${encodeURIComponent(fileName || cleanFileName)}`);
  };

  const getFileInlinePreviewUrl = (fileUrl?: string, fileName?: string) => {
    if (!fileUrl) return '';
    if (fileUrl.startsWith('/api/chat/download')) {
      const sep = fileUrl.includes('?') ? '&' : '?';
      return apiUrl(`${fileUrl}${sep}view=1`);
    }
    const cleanFileName = fileUrl.replace(/^\/uploads\/chat\//, '').replace(/^\/uploads\//, '');
    return apiUrl(`/api/chat/download?file=${encodeURIComponent(cleanFileName)}&name=${encodeURIComponent(fileName || cleanFileName)}&view=1`);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType?: string, fileName?: string) => {
    const ext = (fileName || '').split('.').pop()?.toLowerCase();
    if (fileType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
      return ImageIcon;
    }
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) {
      return FileText;
    }
    if (['xls', 'xlsx', 'csv'].includes(ext || '')) {
      return FileSpreadsheet;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) {
      return FileArchive;
    }
    return Paperclip;
  };

  if (!currentUser || !mounted) return null;

  return createPortal(
    <div className="fixed bottom-5 right-5 z-[9999] pointer-events-auto flex flex-col items-end">
      
      {/* 🔴 TYPEWRITER CALLOUT BUBBLE 🔴 */}
      {unreadCount > 0 && !isOpen && typewriterText && (
        <div 
          onClick={() => setIsOpen(true)}
          className="mb-3 cursor-pointer group relative animate-in fade-in slide-in-from-bottom-2 duration-200 select-none max-w-xs"
        >
          {/* Glowing Animated Ring */}
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#FF6B00] via-amber-400 to-[#FF6B00] opacity-80 blur-xs group-hover:opacity-100 animate-pulse transition duration-200" />
          
          <div className="relative px-3.5 py-2 rounded-xl bg-slate-900/95 backdrop-blur-md border border-[#FF6B00]/60 text-white text-xs shadow-2xl shadow-orange-950/60 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FF6B00] animate-ping shrink-0" />
            <div className="font-sans text-[11px] leading-tight font-medium text-slate-100 min-w-0">
              <span className="font-mono">{typewriterText}</span>
              <span className="inline-block w-1 h-3 bg-[#FF6B00] ml-1 animate-pulse align-middle" />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setUnreadCount(0);
                setTypewriterText('');
              }}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white shrink-0 ml-1"
              title="Dismiss notification"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 🟢 FLOATING ACTION BUTTON (FAB) 🟢 */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
            setUnreadCount(0);
          }}
          className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-[#FF6B00] via-[#FF7A1A] to-[#FF5500] hover:from-[#FF7A1A] hover:to-[#FF6B00] text-white shadow-xl shadow-orange-600/40 hover:shadow-orange-600/60 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 group focus:outline-none focus:ring-4 focus:ring-orange-400/30"
          title="Open Commissioning Chat"
        >
          {/* Live Status Pulse Beacon */}
          <span className="absolute top-0 right-0 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-900"></span>
          </span>

          <MessageSquare className="w-6 h-6 text-white transition-transform group-hover:scale-110" />

          {/* Unread Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -left-1 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black border-2 border-slate-900 shadow-md animate-bounce">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* 🚀 MODERN CHAT POP-UP MODAL 🚀 */}
      {isOpen && (
        <div
          className={`w-[92vw] sm:w-[410px] bg-slate-950/95 backdrop-blur-xl border border-slate-800/90 rounded-3xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden text-slate-100 origin-bottom-right transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isMinimized 
              ? 'h-14 rounded-2xl shadow-lg' 
              : 'h-[570px] max-h-[85vh]'
          }`}
          style={{
            animation: 'chatModalSpring 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-800 border-b border-slate-800/90 flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF6B00] to-amber-500 flex items-center justify-center text-white font-bold shadow-md shadow-orange-950/60 shrink-0">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-black text-white tracking-wider truncate uppercase font-sans">
                    METSO DISPATCH CHAT
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                </div>
                <p className="text-[10px] font-mono text-orange-400/90 truncate">
                  {getRecipientDisplayName()}
                </p>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition"
                title="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Channel / Direct Navigation Tabs */}
              <div className="px-3.5 pt-2.5 pb-2 bg-slate-900/60 border-b border-slate-800/80 flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    setActiveChannel('ALL');
                    setActiveTab('channels');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeChannel === 'ALL'
                      ? 'bg-[#FF6B00] text-white shadow-md shadow-orange-950/40'
                      : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5" />
                  <span>#general</span>
                </button>

                {/* Modern Custom Direct Messages Dropdown with Recent Chats */}
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserDropdownOpen(!isUserDropdownOpen);
                      fetchRecentChats();
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-between gap-1.5 cursor-pointer shadow-xs ${
                      activeChannel !== 'ALL'
                        ? 'bg-orange-500/20 text-orange-400 border-orange-500/50 shadow-orange-950/30'
                        : 'bg-slate-900/90 text-slate-300 border-slate-750 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <Users className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                      <span className="truncate">
                        {activeChannel !== 'ALL' ? getRecipientDisplayName() : 'Direct Messages'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {recentChats.some(c => c.unread_count > 0) && activeChannel === 'ALL' && (
                        <span className="w-2 h-2 rounded-full bg-[#FF6B00] animate-pulse" />
                      )}
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isUserDropdownOpen ? 'rotate-180 text-orange-400' : ''}`} />
                    </div>
                  </button>

                  {/* Dropdown Menu Popover */}
                  {isUserDropdownOpen && (
                    <>
                      {/* Click outside backdrop */}
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsUserDropdownOpen(false)} 
                      />

                      <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/90 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
                        
                        {/* Dual Tabs: Recent Chats vs All Contacts */}
                        <div className="flex border-b border-slate-800 bg-slate-950/90 p-1 gap-1">
                          <button
                            type="button"
                            onClick={() => setDropdownTab('recent')}
                            className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              dropdownTab === 'recent'
                                ? 'bg-orange-500/20 text-[#FF6B00] border border-orange-500/40 shadow-xs'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>Recent Chats</span>
                            {recentChats.length > 0 && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
                                {recentChats.length}
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDropdownTab('contacts')}
                            className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              dropdownTab === 'contacts'
                                ? 'bg-orange-500/20 text-[#FF6B00] border border-orange-500/40 shadow-xs'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                            }`}
                          >
                            <Users className="w-3 h-3" />
                            <span>All Contacts</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
                              {usersList.filter(u => u.id !== currentUser?.id).length}
                            </span>
                          </button>
                        </div>

                        {/* Search Input */}
                        <div className="p-2 border-b border-slate-800/80 bg-slate-950/60">
                          <div className="relative">
                            <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder={dropdownTab === 'recent' ? "Search recent chat..." : "Search colleague..."}
                              value={searchUserQuery}
                              onChange={(e) => setSearchUserQuery(e.target.value)}
                              className="w-full pl-7 pr-2 py-1 text-[11px] bg-slate-900 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#FF6B00] transition"
                              autoFocus
                            />
                          </div>
                        </div>

                        {/* Dropdown Content Area */}
                        <div className="max-h-56 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                          
                          {/* TAB 1: RECENT CHATS */}
                          {dropdownTab === 'recent' && (
                            <>
                              {/* Public Team Channel Quick Option */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveChannel('ALL');
                                  setActiveTab('channels');
                                  setIsUserDropdownOpen(false);
                                  setSearchUserQuery('');
                                }}
                                className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer border ${
                                  activeChannel === 'ALL'
                                    ? 'bg-orange-500/20 border-orange-500/30 text-orange-300 font-bold'
                                    : 'bg-slate-900/40 border-transparent hover:bg-slate-800/70 text-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-[#FF6B00] flex items-center justify-center font-bold text-xs shrink-0">
                                    <Hash className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold truncate leading-tight">#general (Team)</div>
                                    <div className="text-[9px] text-slate-400">Public Channel</div>
                                  </div>
                                </div>
                                {activeChannel === 'ALL' && <Check className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />}
                              </button>

                              {/* Recent Conversations List */}
                              {recentChats
                                .filter((rc) => {
                                  if (!searchUserQuery.trim()) return true;
                                  const q = searchUserQuery.toLowerCase();
                                  return (
                                    rc.name.toLowerCase().includes(q) ||
                                    rc.id.toLowerCase().includes(q) ||
                                    rc.role.toLowerCase().includes(q) ||
                                    rc.last_message.toLowerCase().includes(q)
                                  );
                                })
                                .length === 0 ? (
                                <div className="py-6 text-center text-slate-500 text-[11px] space-y-1">
                                  <Clock className="w-5 h-5 mx-auto text-slate-600 mb-1 opacity-70" />
                                  <p className="font-semibold text-slate-300">No recent direct chats</p>
                                  <p className="text-[10px] text-slate-500">Select "All Contacts" to start a direct message!</p>
                                </div>
                              ) : (
                                recentChats
                                  .filter((rc) => {
                                    if (!searchUserQuery.trim()) return true;
                                    const q = searchUserQuery.toLowerCase();
                                    return (
                                      rc.name.toLowerCase().includes(q) ||
                                      rc.id.toLowerCase().includes(q) ||
                                      rc.role.toLowerCase().includes(q) ||
                                      rc.last_message.toLowerCase().includes(q)
                                    );
                                  })
                                  .map((rc) => {
                                    const isSelected = activeChannel === rc.id;
                                    return (
                                      <button
                                        key={rc.id}
                                        type="button"
                                        onClick={() => {
                                          setActiveChannel(rc.id);
                                          setActiveTab('direct');
                                          setIsUserDropdownOpen(false);
                                          setSearchUserQuery('');
                                        }}
                                        className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer border ${
                                          isSelected
                                            ? 'bg-orange-500/20 border-orange-500/30 text-orange-300 font-bold'
                                            : 'bg-slate-900/40 border-transparent hover:bg-slate-800/70 text-slate-300'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                          {/* Avatar with Online Dot */}
                                          <div className="relative shrink-0">
                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FF6B00]/30 to-amber-500/30 text-[#FF6B00] border border-orange-500/40 flex items-center justify-center font-bold text-xs">
                                              {rc.name ? rc.name.charAt(0).toUpperCase() : 'U'}
                                            </div>
                                            {rc.is_online && (
                                              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-slate-900" title="Online" />
                                            )}
                                          </div>

                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-1">
                                              <span className="text-xs font-bold text-slate-100 truncate leading-tight">
                                                {rc.name}
                                              </span>
                                              <span className="text-[9px] font-mono text-slate-500 shrink-0">
                                                {rc.timestamp ? rc.timestamp.substring(11, 16) : ''}
                                              </span>
                                            </div>
                                            <div className="flex items-center justify-between gap-1 mt-0.5">
                                              <p className="text-[10px] text-slate-400 truncate max-w-[170px] leading-tight">
                                                {rc.last_sender_id === currentUser?.id ? 'You: ' : ''}{rc.last_message}
                                              </p>
                                              {rc.unread_count > 0 && (
                                                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-[#FF6B00] text-white shadow-xs shrink-0">
                                                  {rc.unread_count}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-[#FF6B00] shrink-0 ml-1.5" />}
                                      </button>
                                    );
                                  })
                              )}
                            </>
                          )}

                          {/* TAB 2: ALL CONTACTS */}
                          {dropdownTab === 'contacts' && (
                            <>
                              {usersList
                                .filter((u) => u.id !== currentUser?.id)
                                .filter((u) => {
                                  if (!searchUserQuery.trim()) return true;
                                  const q = searchUserQuery.toLowerCase();
                                  return (
                                    u.username?.toLowerCase().includes(q) ||
                                    u.id?.toLowerCase().includes(q) ||
                                    (u.role || '').toLowerCase().includes(q)
                                  );
                                })
                                .length === 0 ? (
                                <div className="py-4 text-center text-slate-500 text-[10px]">
                                  No colleagues found
                                </div>
                              ) : (
                                usersList
                                  .filter((u) => u.id !== currentUser?.id)
                                  .filter((u) => {
                                    if (!searchUserQuery.trim()) return true;
                                    const q = searchUserQuery.toLowerCase();
                                    return (
                                      u.username?.toLowerCase().includes(q) ||
                                      u.id?.toLowerCase().includes(q) ||
                                      (u.role || '').toLowerCase().includes(q)
                                    );
                                  })
                                  .map((u) => {
                                    const isSelected = activeChannel === u.id;
                                    return (
                                      <button
                                        key={u.id}
                                        type="button"
                                        onClick={() => {
                                          setActiveChannel(u.id);
                                          setActiveTab('direct');
                                          setIsUserDropdownOpen(false);
                                          setSearchUserQuery('');
                                        }}
                                        className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer border ${
                                          isSelected
                                            ? 'bg-orange-500/20 border-orange-500/30 text-orange-300 font-bold'
                                            : 'bg-slate-900/40 border-transparent hover:bg-slate-800/70 text-slate-300'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500/30 to-amber-500/30 text-[#FF6B00] border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0">
                                            {u.username ? u.username.charAt(0).toUpperCase() : 'U'}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="text-xs font-bold text-slate-200 truncate leading-tight flex items-center gap-1.5">
                                              <span>{u.username}</span>
                                              <span className="text-[9px] font-mono font-normal text-slate-400">({u.id})</span>
                                            </div>
                                            <div className="text-[9px] text-slate-400 truncate mt-0.5">
                                              {u.role || 'Member'}
                                            </div>
                                          </div>
                                        </div>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-[#FF6B00] shrink-0 ml-1.5" />}
                                      </button>
                                    );
                                  })
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Message Feed Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-gradient-to-b from-slate-950 via-slate-950/95 to-slate-900/90">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2 select-none">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-orange-400 shadow-inner">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-300">
                      No messages in this channel yet.
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-xs">
                      Start the conversation with your commissioning team in real-time!
                    </p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isMe = msg.sender_id === currentUser?.id;
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const showSenderHeader = !prevMsg || prevMsg.sender_id !== msg.sender_id;

                    const isImg = msg.file_url && (msg.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(msg.file_name || msg.file_url));

                    return (
                      <div
                        key={msg.id || index}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1 animate-in fade-in slide-in-from-bottom-1 duration-150`}
                      >
                        {showSenderHeader && !isMe && (
                          <div className="flex items-center gap-1.5 px-1">
                            <span className="text-[11px] font-bold text-slate-200">
                              {msg.sender_name}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-md bg-slate-800/80 border border-slate-700 text-orange-300">
                              {msg.sender_role}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {msg.timestamp?.substring(11, 16) || ''}
                            </span>
                          </div>
                        )}

                        <div
                          className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-md transition-all ${
                            isMe
                              ? 'bg-gradient-to-r from-[#FF6B00] via-[#FF7A1A] to-[#E05A00] text-white rounded-br-xs shadow-orange-950/40'
                              : 'bg-slate-900/90 backdrop-blur-md text-slate-100 border border-slate-800/80 rounded-bl-xs shadow-slate-950/50'
                          }`}
                        >
                          {/* Attached Photo Display */}
                          {isImg && (
                            <div className="mb-2 relative group/img overflow-hidden rounded-xl bg-black/30 border border-white/15">
                              <img
                                src={getFileInlinePreviewUrl(msg.file_url, msg.file_name)}
                                alt={msg.file_name || 'Attached Photo'}
                                className="max-h-52 w-full object-cover rounded-xl cursor-pointer hover:scale-[1.02] transition-transform duration-200"
                                onClick={() => setPreviewModalImage({ 
                                  url: getFileInlinePreviewUrl(msg.file_url, msg.file_name), 
                                  downloadUrl: getFileDownloadUrl(msg.file_url, msg.file_name), 
                                  name: msg.file_name || 'photo.png' 
                                })}
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-end justify-between p-2">
                                <span className="text-[10px] text-white truncate max-w-[70%] font-medium drop-shadow-md">{msg.file_name}</span>
                                <a
                                  href={getFileDownloadUrl(msg.file_url, msg.file_name)}
                                  download={msg.file_name || 'photo.png'}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 rounded-lg bg-black/60 hover:bg-[#FF6B00] text-white transition drop-shadow-md cursor-pointer"
                                  title="Download Photo"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                          )}

                          {/* Attached Document/File Display */}
                          {msg.file_url && !isImg && (
                            <div className={`mb-2 p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                              isMe 
                                ? 'bg-black/25 border-white/20 text-white' 
                                : 'bg-slate-950/80 border-slate-700/80 text-slate-100'
                            }`}>
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-300 border border-orange-500/30 flex items-center justify-center shrink-0">
                                  {React.createElement(getFileIcon(msg.file_type, msg.file_name), { className: 'w-4 h-4' })}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold truncate leading-tight">{msg.file_name || 'Attachment'}</div>
                                  <div className="text-[10px] opacity-75 font-mono mt-0.5">{formatFileSize(msg.file_size)}</div>
                                </div>
                              </div>
                              <a
                                href={getFileDownloadUrl(msg.file_url, msg.file_name)}
                                download={msg.file_name || 'attachment'}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg bg-white/15 hover:bg-[#FF6B00] text-white transition shrink-0 cursor-pointer"
                                title="Download File"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          )}

                          {/* Message Text */}
                          {msg.message && <p className="font-sans text-[12px] whitespace-pre-wrap">{msg.message}</p>}

                          <div
                            className={`text-[9px] font-mono mt-1 flex items-center justify-end gap-1 ${
                              isMe ? 'text-orange-100' : 'text-slate-400'
                            }`}
                          >
                            <span>{msg.timestamp?.substring(11, 16) || ''}</span>
                            {isMe && <CheckCheck className="w-3 h-3 text-orange-200" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Reactions Bar (Neat Wrapping, Zero Horizontal Scrollbar) */}
              <div className="px-3 py-1.5 bg-slate-900/80 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5 overflow-hidden">
                {['👍 Noted', '🚀 On Site', '✅ Task Done', '⏱️ Timesheet Submitted', '⚠️ Hold Point'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setInputText(tag);
                      if (inputRef.current) inputRef.current.focus();
                    }}
                    className="px-2 py-0.5 rounded-lg bg-slate-950/70 hover:bg-orange-500/20 text-slate-400 hover:text-orange-200 text-[10px] font-medium border border-slate-800 hover:border-orange-500/40 transition-all active:scale-95 cursor-pointer"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* Selected File / Photo Staging Preview Box */}
              {selectedFile && (
                <div className="px-3 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2 animate-in fade-in slide-in-from-bottom-1">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {selectedFile.isImage && selectedFile.previewUrl ? (
                      <img
                        src={selectedFile.previewUrl}
                        alt="Preview"
                        className="w-10 h-10 object-cover rounded-lg border border-orange-500/40 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center text-orange-400 shrink-0">
                        {React.createElement(getFileIcon(selectedFile.file.type, selectedFile.file.name), { className: 'w-5 h-5' })}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-200 truncate">{selectedFile.file.name}</div>
                      <div className="text-[10px] text-orange-400 font-mono">
                        {formatFileSize(selectedFile.file.size)} • Ready to send
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={clearSelectedFile}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition"
                    title="Remove attachment"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Upload Error Banner */}
              {uploadError && (
                <div className="px-3 py-1.5 bg-rose-950/80 border-t border-rose-800 text-rose-200 text-[11px] flex items-center gap-1.5 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                  <span className="truncate">{uploadError}</span>
                </div>
              )}

              {/* Input Area with Paperclip Attachment Button */}
              <form onSubmit={handleSendMessage} className="p-3 bg-slate-900/95 border-t border-slate-800 flex items-center gap-2">
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.rar,.7z,.txt"
                />

                {/* Attachment Icon Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="p-2 rounded-xl text-slate-400 hover:text-[#FF6B00] hover:bg-slate-800/90 transition flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
                  title="Attach Photo or File (Max 10MB)"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <input
                  ref={inputRef}
                  type="text"
                  placeholder={selectedFile ? "Add a caption (optional)..." : `Message ${getRecipientDisplayName()}...`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isUploading}
                  className="flex-1 bg-slate-950/90 border border-slate-700/80 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]/40 transition-all shadow-inner disabled:opacity-50"
                />

                <button
                  type="submit"
                  disabled={(!inputText.trim() && !selectedFile) || isUploading}
                  className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF6B00] to-[#D05600] text-white flex items-center justify-center shrink-0 disabled:opacity-35 hover:opacity-100 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-orange-950/50 cursor-pointer"
                  title={isUploading ? "Uploading..." : "Send Message"}
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* 🖼️ IMAGE LIGHTBOX MODAL 🖼️ */}
      {previewModalImage && (
        <div 
          className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-150 select-none"
          onClick={() => setPreviewModalImage(null)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10" onClick={(e) => e.stopPropagation()}>
            <a
              href={previewModalImage.downloadUrl || previewModalImage.url}
              download={previewModalImage.name}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-full bg-white/15 hover:bg-[#FF6B00] text-white transition shadow-lg flex items-center gap-1.5 text-xs font-bold"
              title="Download Full Image"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </a>
            <button
              onClick={() => setPreviewModalImage(null)}
              className="p-2 rounded-full bg-white/15 hover:bg-rose-600 text-white transition shadow-lg"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <img
            src={previewModalImage.url}
            alt={previewModalImage.name}
            className="max-w-[92vw] max-h-[82vh] object-contain rounded-2xl shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          />

          <div className="mt-3 text-xs font-mono text-slate-300 font-medium bg-black/60 px-4 py-1.5 rounded-full border border-white/10 max-w-sm truncate">
            {previewModalImage.name}
          </div>
        </div>
      )}

    </div>,
    document.body
  );
}
