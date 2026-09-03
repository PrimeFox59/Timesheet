'use client';

import React, { useEffect, useState } from 'react';

interface RealtimeSocketProviderProps {
  onTimesheetUpdated?: () => void;
  onUsersUpdated?: () => void;
  onAreasUpdated?: () => void;
  onProjectsUpdated?: () => void;
  onSystemSettingsUpdated?: (settings: any) => void;
}

export default function RealtimeSocketProvider({
  onTimesheetUpdated,
  onUsersUpdated,
  onAreasUpdated,
  onProjectsUpdated,
  onSystemSettingsUpdated
}: RealtimeSocketProviderProps) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource('/api/realtime/stream');

      eventSource.onopen = () => {
        setConnected(true);
      };

      eventSource.onerror = () => {
        setConnected(false);
      };

      eventSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          const { event, data } = payload;
          if (!event || event === 'connected') return;

          // Always dispatch custom window event for decoupled reactive UI listening across any tab/component
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(event, { detail: data }));
            window.dispatchEvent(new CustomEvent('realtime_event', { detail: { event, data } }));
          }

          if (event === 'timesheet_updated') {
            if (onTimesheetUpdated) onTimesheetUpdated();
          } else if (event === 'user_updated') {
            if (onUsersUpdated) onUsersUpdated();
          } else if (event === 'area_updated') {
            if (onAreasUpdated) onAreasUpdated();
          } else if (event === 'project_updated' || event === 'task_updated') {
            if (onProjectsUpdated) onProjectsUpdated();
          } else if (event === 'system_settings_updated') {
            if (onSystemSettingsUpdated && data?.settings) onSystemSettingsUpdated(data.settings);
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
  }, [onTimesheetUpdated, onUsersUpdated, onAreasUpdated, onProjectsUpdated, onSystemSettingsUpdated]);

  return null;
}
