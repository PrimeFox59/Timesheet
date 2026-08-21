'use client';

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
          <div className="flex items-center gap-2">
            {/* Official Metso SVG Vector Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 115.4 31.6"
              className="h-7 w-auto fill-slate-900 group-hover:fill-[#FF6B00] transition-colors duration-200"
              aria-label="Metso Logo"
            >
              <path d="M15.4 21.3L5.4 0L0 0L0 31.2L5.2 31.2L5.2 10.6L13.1 27.4L17.7 27.4L25.6 10.6L25.6 31.2L30.9 31.2L30.9 0L25.5 0L15.4 21.3Z" />
              <path d="M84.8 17.1L81.1 16.4C79.3 16 78.5 15.3 78.5 14C78.5 12 80.8 11.3 82.8 11.3C84.7 11.3 86.7 11.8 88.5 13L90.9 9.2C88.8 7.9 86 7 82.7 7C77.8 7 73.5 9.4 73.5 14.4C73.5 18.1 75.6 20.2 79.9 21.1L83.6 21.8C85.4 22.2 86.1 23 86.1 24.4C86.1 26 84.8 27.1 82.3 27.1C80.5 27.1 78.3 26.6 75.9 24.4L73.2 28C75.3 30.3 78.7 31.5 82.3 31.5C87.2 31.5 91.3 29.1 91.3 24.1C91.2 20 88.9 17.9 84.8 17.1" />
              <path d="M44.8 7.1C38.4 7.1 34.4 12.9 34.4 19.2C34.4 26 38.2 31.5 45.3 31.5C48.5 31.5 51.9 30.3 54.3 28.2L51.9 24.4C50.2 25.9 48.2 26.9 45.5 26.9C42.2 26.9 39.8 24.3 39.5 21.5L55.1 21.5C55.1 20.7 55.2 19.9 55.2 19.1C55.2 11.4 51.4 7.1 44.8 7.1M39.6 17.2C39.9 13.2 42.6 11.5 44.8 11.5C48 11.5 49.9 13.5 50 17.1L50 17.2L39.6 17.2L39.6 17.2Z" />
              <path d="M63.6 23.8L63.6 12.1L70.3 12.1L70.3 7.5L63.6 7.5L63.6 1.90735e-06L58.5 1.90735e-06L58.5 24.7C58.5 28.9 61.1 31.5 65.3 31.5C67.7 31.5 69.7 30.9 71.3 30.1L70 25.8C67.5 27 63.5 27.5 63.6 23.8" />
              <path d="M104.5 7.1C97.4 7.1 93.6 12.4 93.6 19.3C93.6 26.2 97.4 31.6 104.5 31.6C111.6 31.6 115.4 26.3 115.4 19.3C115.4 12.3 111.5 7.1 104.5 7.1M104.5 26.7C100.8 26.7 98.8 24 98.8 19.2C98.8 15 100.3 11.8 104.5 11.8C108.2 11.8 110.2 14.3 110.2 19.2C110.2 24.2 108.2 26.7 104.5 26.7" />
            </svg>

            <div className="h-5 w-px bg-slate-200/80 mx-1"></div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-orange-50 border border-orange-200/60 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-[#FF6B00] animate-pulse" />
              <span className="text-[11px] font-black tracking-widest text-[#FF6B00] uppercase font-mono">
                TIMESHEET
              </span>
            </div>
          </div>
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
