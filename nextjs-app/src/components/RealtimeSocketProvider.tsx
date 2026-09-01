'use client';

import React, { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

interface RealtimeSocketProviderProps {
  onTimesheetUpdated?: () => void;
  onUsersUpdated?: () => void;
  onAreasUpdated?: () => void;
}

export default function RealtimeSocketProvider({
  onTimesheetUpdated,
  onUsersUpdated,
  onAreasUpdated
}: RealtimeSocketProviderProps) {
  const [connected, setConnected] = useState(false);
  const [liveToast, setLiveToast] = useState<{ title: string; desc: string } | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource('/api/realtime/stream');

      eventSource.onopen = () => {
        console.log('[Realtime Socket] Connected to internal stream.');
        setConnected(true);
      };

      eventSource.onerror = () => {
        setConnected(false);
      };

      eventSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          const { event, data } = payload;

          if (event === 'timesheet_updated') {
            showNotification(
              '⚡ Timesheet Realtime Update',
              `Timesheet records updated in realtime!`
            );
            if (onTimesheetUpdated) onTimesheetUpdated();
          } else if (event === 'user_updated') {
            showNotification(
              '👥 User Directory Updated',
              `User account ${data?.id || ''} was updated.`
            );
            if (onUsersUpdated) onUsersUpdated();
          } else if (event === 'area_updated') {
            showNotification(
              '🌐 Master Work Areas Updated',
              `Work area ${data?.name || ''} was modified.`
            );
            if (onAreasUpdated) onAreasUpdated();
          }
        } catch (err) {
          // Ignore keepalive or parse error
        }
      };

    } catch (err) {
      console.error('[Realtime Socket] EventSource error', err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const showNotification = (title: string, desc: string) => {
    setLiveToast({ title, desc });
    setTimeout(() => {
      setLiveToast(null);
    }, 4000);
  };

  return (
    <>
      {/* Floating Live Realtime Notification Banner */}
      {liveToast && (
        <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-slate-900/95 text-white backdrop-blur-2xl border border-orange-500/40 rounded-2xl p-4 shadow-2xl shadow-orange-950/50 max-w-sm flex items-start gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#FF6B00] to-[#D05600] text-white shrink-0 mt-0.5 shadow-md">
              <Zap className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <h4 className="text-xs font-black tracking-wider text-orange-400 uppercase font-mono">
                {liveToast.title}
              </h4>
              <p className="text-xs text-slate-200 mt-0.5 font-medium leading-snug">
                {liveToast.desc}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
