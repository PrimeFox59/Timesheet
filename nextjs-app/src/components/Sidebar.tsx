'use client';

import React, { useState } from 'react';
import { Clock, Users, ShieldCheck, Layers, Database, Sliders, Server, FileCheck, BarChart3, ShieldAlert } from 'lucide-react';

interface SidebarProps {
  user: any;
  activeCategory: string; // 'timesheet' | 'user_management' | 'codex' | 'audit_log' | 'database'
  setActiveCategory: (cat: string) => void;
  activeSubTab: string;
  setActiveSubTab: (sub: string) => void;
}

export default function Sidebar({
  user,
  activeCategory,
  setActiveCategory,
  activeSubTab,
  setActiveSubTab
}: SidebarProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const isSuperUser = user?.id?.toLowerCase() === 'prime' || user?.role?.toLowerCase() === 'superuser';
  const isSiteAdmin = user?.role === 'Site Admin' || user?.role?.toLowerCase()?.includes('admin') || isSuperUser;
  const isDirector = user?.role?.includes('Director') || user?.role?.toLowerCase()?.includes('director') || isSiteAdmin;

  const categories = [
    {
      id: 'timesheet',
      title: 'TIMESHEET',
      desc: 'Daily hours entry, activity log & user settings',
      icon: Clock,
      subTabs: [
        { id: 'timesheet_entry', label: 'Input Timesheet', icon: Clock },
        { id: 'activity_log', label: 'Activity Log', icon: Layers },
        { id: 'user_settings', label: 'User Settings', icon: Sliders }
      ]
    },
    ...(isDirector ? [{
      id: 'codex',
      title: 'CODEX',
      desc: 'Workhour analytics, monitoring & digital signature approval',
      icon: FileCheck,
      subTabs: [
        { id: 'codex_monitoring', label: 'Codex Monitoring & Approval', icon: FileCheck },
        { id: 'workhour_analytics', label: 'Work Hour Analytics Dashboard', icon: BarChart3 }
      ]
    }] : []),
    {
      id: 'user_management',
      title: 'USER_MANAGEMENT',
      desc: 'User directory, master edit & profile preferences',
      icon: Users,
      subTabs: [
        { id: 'user_directory', label: 'User Directory', icon: Users },
        ...(isSiteAdmin ? [{ id: 'master_edit', label: 'Master Edit', icon: Database }] : []),
        { id: 'user_settings', label: 'User Settings', icon: Sliders }
      ]
    },
    ...(isDirector ? [{
      id: 'audit_log',
      title: 'AUDIT_LOG',
      desc: 'Privileged system security audit trail',
      icon: ShieldCheck,
      subTabs: [
        { id: 'audit_log', label: 'System Audit Log', icon: ShieldCheck }
      ]
    }] : []),
    ...(isDirector ? [{
      id: 'database',
      title: 'DATABASE',
      desc: 'Database backup, restore & Google Sheets migration',
      icon: Server,
      subTabs: [
        { id: 'database_migration', label: 'Database & Migration', icon: Server }
      ]
    }] : []),
    ...(isSuperUser ? [{
      id: 'superuser',
      title: 'SUPERUSER',
      desc: 'Master system control, feature toggles & global configuration',
      icon: ShieldAlert,
      subTabs: [
        { id: 'superuser_panel', label: 'Superuser Feature Toggles', icon: ShieldAlert }
      ]
    }] : [])
  ];


  return (
    <aside className="fixed left-5 top-1/2 -translate-y-1/2 z-40 select-none">
      {/* Translucent White Glass Pill Container */}
      <div className="bg-white/80 backdrop-blur-md border border-white/90 rounded-full p-2 flex flex-col items-center gap-3 shadow-xl shadow-slate-900/10">
        
        {categories.map(cat => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          const isHovered = hoveredCategory === cat.id;

          return (
            <div 
              key={cat.id} 
              className="relative"
              onMouseEnter={() => setHoveredCategory(cat.id)}
              onMouseLeave={() => setHoveredCategory(null)}
            >
              
              {/* Circular Icon Button */}
              <button
                onClick={(e) => {
                  (e.currentTarget as HTMLButtonElement).blur();
                  setHoveredCategory(null);
                  setActiveCategory(cat.id);
                  if (cat.subTabs.length > 0) {
                    setActiveSubTab(cat.subTabs[0].id);
                  }
                }}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform duration-150 active:scale-95 ${
                  isActive
                    ? 'bg-[#FF6B00] text-white shadow-md shadow-orange-500/30 ring-2 ring-orange-400/30 scale-105'
                    : 'text-slate-600 bg-white/70 hover:bg-white hover:text-slate-900 hover:scale-105 shadow-2xs border border-slate-200/60'
                }`}
              >
                <Icon className="w-5 h-5" />
              </button>

              {/* Controlled Hover Popout Tooltip Card */}
              {isHovered && (
                <div className="absolute left-14 top-1/2 -translate-y-1/2 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-100 origin-left">
                  <div className="bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-xl border border-slate-700 shadow-xl min-w-[220px]">
                    
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />
                        <span className="font-mono font-black text-xs tracking-wider text-slate-100 uppercase">
                          {cat.title}
                        </span>
                      </div>

                      <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        [SELECT]
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 font-medium leading-tight">
                      {cat.desc}
                    </p>

                  </div>
                </div>
              )}

            </div>
          );
        })}

      </div>
    </aside>
  );
}
