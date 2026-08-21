'use client';

import { apiUrl } from '@/lib/api';

import React from 'react';
import { LogOut, User, Shield, Clock } from 'lucide-react';

interface NavbarProps {
  user: any;
  onLogout: () => void;
  onOpenProfileSettings?: () => void;
}

export default function Navbar({ user, onLogout, onOpenProfileSettings }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 glass-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-3 group cursor-pointer select-none">
          <img
            src={apiUrl('/logo.png')}
            alt="Timesheet METSO"
            className="h-10 w-auto object-contain group-hover:scale-105 transition-transform duration-200 drop-shadow-xs"
          />
        </div>


        {/* User Info & Actions */}
        {user && (
          <div className="flex items-center gap-4">
            <button
              onClick={onOpenProfileSettings}
              className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white border border-white/90 shadow-xs hover:shadow-md backdrop-blur-md transition-all active:scale-95 cursor-pointer text-left group"
              title="Click to open Profile Settings"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-[#FF6B00] text-white flex items-center justify-center font-black text-xs border border-white overflow-hidden shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                {user.avatar ? (
                  <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span>{user.username ? user.username.charAt(0).toUpperCase() : 'U'}</span>
                )}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 leading-tight group-hover:text-[#FF6B00] transition-colors">
                  {user.username}
                </span>
                <span className="text-[10px] text-orange-600 font-medium flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5" />
                  {user.role}
                </span>
              </div>
            </button>

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 text-white text-xs font-medium hover:bg-slate-800 transition-all shadow-sm hover:shadow"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        )}


      </div>
    </header>
  );
}
