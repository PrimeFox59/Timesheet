'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiUrl } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { 
  ShieldAlert, 
  Sliders, 
  ScanFace, 
  FileCheck, 
  BarChart3, 
  ShieldCheck, 
  Server, 
  Radio, 
  CalendarClock, 
  Clock, 
  RefreshCw, 
  Sparkles, 
  Cpu, 
  Layers,
  FolderKanban,
  MessageSquare,
  FileSpreadsheet,
  Zap,
  Users,
  History,
  CheckCircle2,
  Compass
} from 'lucide-react';

interface SuperuserTabProps {
  currentUser: any;
  onSettingsChanged?: (newSettings: Record<string, boolean | string>) => void;
}

interface FeatureToggleItem {
  key: string;
  title: string;
  desc: string;
  icon: any;
  category: 'navigation_modules' | 'ai_auth' | 'collaboration' | 'analytics_export' | 'rules';
}

const FEATURE_CONFIGS: FeatureToggleItem[] = [
  // CATEGORY 1: CORE NAVIGATION MODULES
  {
    key: 'menu_timesheet',
    title: 'Timesheet Core Module',
    desc: 'Primary portal for daily work hours logging, date range selector, and activity records.',
    icon: Clock,
    category: 'navigation_modules'
  },
  {
    key: 'menu_project_manager',
    title: 'Project Manager Module',
    desc: 'Commissioning project portfolio, Gantt timeline tracking, project list, and task assignment.',
    icon: FolderKanban,
    category: 'navigation_modules'
  },
  {
    key: 'menu_codex',
    title: 'Codex Executive Module',
    desc: 'Director & supervisor review portal, overtime verification, and cryptographic signature approval.',
    icon: FileCheck,
    category: 'navigation_modules'
  },
  {
    key: 'menu_user_management',
    title: 'User Management & Directory',
    desc: 'Master employee directory, area code configurations, password resets, and user preferences.',
    icon: Users,
    category: 'navigation_modules'
  },
  {
    key: 'menu_audit_log',
    title: 'System Security Audit Trail',
    desc: 'Privileged immutable system security audit log and login/action tracking history.',
    icon: ShieldCheck,
    category: 'navigation_modules'
  },
  {
    key: 'menu_database',
    title: 'Database Management & Migration',
    desc: 'Excel & Google Sheets migration tool, database backup downloads, and factory reset utilities.',
    icon: Server,
    category: 'navigation_modules'
  },

  // CATEGORY 2: AI BIOMETRICS & AUTHENTICATION
  {
    key: 'enable_face_login',
    title: 'AI Face ID Login Biometrics',
    desc: 'Enable or disable AI facial recognition biometric login scanner on the sign-in portal.',
    icon: ScanFace,
    category: 'ai_auth'
  },
  {
    key: 'enable_face_registration',
    title: 'AI Face ID Registration',
    desc: 'Allow employees to scan and enroll 128-d neural biometric face descriptors in profile settings.',
    icon: Sparkles,
    category: 'ai_auth'
  },

  // CATEGORY 3: REAL-TIME COLLABORATION & PRESENCE
  {
    key: 'feature_realtime_chat',
    title: 'Real-time Team Live Chat',
    desc: 'Floating team messaging widget with direct messages, channel chats, and file attachments.',
    icon: MessageSquare,
    category: 'collaboration'
  },
  {
    key: 'feature_online_users',
    title: 'Live Online Presence Sidebar',
    desc: 'Compact active presence widget showing online team members and instant-chat shortcuts.',
    icon: Radio,
    category: 'collaboration'
  },
  {
    key: 'enable_realtime_socket',
    title: 'SSE Live Stream & Presence Sync',
    desc: 'Server-Sent Events (SSE) live streaming for instant multi-user presence and state synchronization.',
    icon: Zap,
    category: 'collaboration'
  },

  // CATEGORY 4: ENTERPRISE FEATURES & ANALYTICS
  {
    key: 'enable_workhour_analytics',
    title: 'Work Hour Analytics Dashboard',
    desc: 'Interactive workforce productivity charts, annual trends, and commissioning area breakdowns.',
    icon: BarChart3,
    category: 'analytics_export'
  },
  {
    key: 'feature_excel_export',
    title: 'Metso Excel Template Export',
    desc: 'Allow users to export and download the official formatted Metso Timesheet Excel workbook.',
    icon: FileSpreadsheet,
    category: 'analytics_export'
  },
  {
    key: 'feature_gantt_chart',
    title: 'Interactive Gantt Timeline Engine',
    desc: 'Visual Gantt timeline for project scheduling, milestone tracking, and task delegation.',
    icon: Layers,
    category: 'analytics_export'
  },
  {
    key: 'feature_activity_log',
    title: 'Submission Activity History',
    desc: 'Detailed history log of all past timesheet submissions with date filtering & summaries.',
    icon: History,
    category: 'analytics_export'
  },

  // CATEGORY 5: OPERATIONAL & GOVERNANCE RULES
  {
    key: 'enable_retroactive_entry',
    title: 'Retroactive Timesheet Entry',
    desc: 'Allow team members to submit or revise timesheet entries for past dates.',
    icon: CalendarClock,
    category: 'rules'
  },
  {
    key: 'allow_overtime_entry',
    title: 'Overtime Hours Entry',
    desc: 'Allow employees to record additional overtime hours beyond the standard 8-hour shift.',
    icon: Clock,
    category: 'rules'
  }
];

export default function SuperuserTab({ currentUser, onSettingsChanged }: SuperuserTabProps) {
  const toast = useToast();

  const [settings, setSettings] = useState<Record<string, boolean | string>>({
    menu_timesheet: true,
    menu_project_manager: true,
    menu_codex: true,
    menu_user_management: true,
    menu_audit_log: true,
    menu_database: true,
    enable_face_login: true,
    enable_face_registration: true,
    feature_realtime_chat: true,
    feature_online_users: true,
    enable_realtime_socket: true,
    enable_workhour_analytics: true,
    feature_excel_export: true,
    feature_gantt_chart: true,
    feature_activity_log: true,
    enable_retroactive_entry: true,
    allow_overtime_entry: true
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const fetchSettings = useCallback(async (isManualRefresh = false) => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/system/settings'));
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
        if (onSettingsChanged) onSettingsChanged(data.settings);
        if (isManualRefresh) {
          toast.success('System configurations synchronized from database.', 'Latest Status');
        }
      } else {
        toast.error(data.error || 'Failed to load system settings.', 'System Error');
      }
    } catch (err: any) {
      toast.error('Failed to connect to server to fetch system settings.', 'Connection Error');
    } finally {
      setLoading(false);
    }
  }, [onSettingsChanged, toast]);

  useEffect(() => {
    fetchSettings(false);
  }, [fetchSettings]);

  const handleToggle = async (key: string, currentValue: boolean, itemTitle: string) => {
    const nextVal = !currentValue;
    setUpdatingKey(key);

    // Optimistic UI update
    const updated = { ...settings, [key]: nextVal };
    setSettings(updated);

    try {
      const res = await fetch(apiUrl('/api/system/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          value: nextVal,
          admin_id: currentUser?.id || 'prime'
        })
      });

      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
        if (onSettingsChanged) onSettingsChanged(data.settings);
        
        const statusText = nextVal ? 'Enabled (ON)' : 'Disabled (OFF)';
        toast.success(`Feature "${itemTitle}" is now ${statusText}.`, 'Settings Saved');
      } else {
        // Rollback
        setSettings(settings);
        toast.error(data.error || 'Failed to save toggle state.', 'Save Failed');
      }
    } catch (err: any) {
      setSettings(settings);
      toast.error('Connection lost while saving settings.', 'Server Error');
    } finally {
      setUpdatingKey(null);
    }
  };

  const isSuperUser = currentUser?.id?.toLowerCase() === 'prime' || currentUser?.id?.toLowerCase() === 'com116' || currentUser?.role?.toLowerCase() === 'superuser';

  const categoryHeaders: Record<FeatureToggleItem['category'], { title: string; icon: any }> = {
    navigation_modules: {
      title: 'Core Navigation Modules & App Panels',
      icon: Compass
    },
    ai_auth: {
      title: 'AI Biometrics & Authentication Control',
      icon: Cpu
    },
    collaboration: {
      title: 'Real-time Collaboration & Live Presence',
      icon: MessageSquare
    },
    analytics_export: {
      title: 'Enterprise Features, Analytics & Data Export',
      icon: Layers
    },
    rules: {
      title: 'Operational & Timesheet Governance Rules',
      icon: Sliders
    }
  };

  const categoriesOrder: FeatureToggleItem['category'][] = [
    'navigation_modules',
    'ai_auth',
    'collaboration',
    'analytics_export',
    'rules'
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200 select-none">
      
      {/* Superuser Master Banner with High-Contrast Solid Slate Background */}
      <div className="rounded-3xl p-6 bg-slate-900 text-white border border-slate-800 shadow-xl relative overflow-hidden">
        
        {/* Ambient Glows */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-[#FF6B00] flex items-center justify-center text-white shadow-xl shadow-orange-950/50 border border-orange-400/40 shrink-0">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  Superuser Master Control Center
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/40 font-mono">
                  PRIME ONLY
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-1">
                Global governance center &amp; operational feature switches for all menus and features in the METSO Platform.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchSettings(true)}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold transition flex items-center gap-2 border border-slate-700 cursor-pointer shadow-sm active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feature Toggles Sections */}
      <div className="space-y-6">
        {categoriesOrder.map(catKey => {
          const items = FEATURE_CONFIGS.filter(f => f.category === catKey);
          if (items.length === 0) return null;
          const header = categoryHeaders[catKey];
          const HeaderIcon = header.icon;

          return (
            <div key={catKey} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className="w-6 h-6 rounded-lg bg-orange-500/10 text-[#FF6B00] flex items-center justify-center">
                  <HeaderIcon className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  {header.title}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map(item => {
                  const Icon = item.icon;
                  const isEnabled = settings[item.key] !== false;
                  const isUpdating = updatingKey === item.key;

                  return (
                    <div 
                      key={item.key}
                      className="rounded-2xl p-4.5 bg-white border border-slate-200 shadow-sm hover:shadow-md transition flex items-start justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          isEnabled ? 'bg-orange-50 text-[#FF6B00] border-orange-200' : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-xs font-black text-slate-900">{item.title}</div>
                          <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{item.desc}</p>
                          <div className="pt-1.5">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full font-mono ${
                              isEnabled ? 'bg-emerald-100 text-emerald-800 border border-emerald-300/60' : 'bg-slate-100 text-slate-600 border border-slate-300/60'
                            }`}>
                              {isEnabled ? '● Active (ON)' : '○ Disabled (OFF)'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Toggle Switch */}
                      <button
                        type="button"
                        disabled={isUpdating || !isSuperUser}
                        onClick={() => handleToggle(item.key, isEnabled, item.title)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isEnabled ? 'bg-[#FF6B00]' : 'bg-slate-300'
                        } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                        role="switch"
                        aria-checked={isEnabled}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            isEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
