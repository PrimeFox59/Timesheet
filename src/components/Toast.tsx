'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  isExiting?: boolean;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [activeToast, setActiveToast] = useState<ToastItem | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const removeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastToastRef = useRef<{ message: string; timestamp: number } | null>(null);

  const clearTimers = () => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
  };

  const dismissToast = useCallback((immediate: boolean = false) => {
    if (immediate) {
      clearTimers();
      setActiveToast(null);
      return;
    }
    // Start graceful fade out
    setActiveToast(prev => prev ? { ...prev, isExiting: true } : null);
    removeTimerRef.current = setTimeout(() => {
      setActiveToast(null);
    }, 450);
  }, []);

  const showToast = useCallback((
    message: string,
    type: ToastType = 'info',
    title?: string,
    duration: number = 5000 // Tampil selama 5 detik penuh sebelum fade out
  ) => {
    if (!message) return;

    // Anti-duplikasi (cegah notifikasi ganda): jika pesan identik dipicu dalam 3 detik, abaikan
    const now = Date.now();
    if (
      lastToastRef.current &&
      lastToastRef.current.message === message &&
      now - lastToastRef.current.timestamp < 3000
    ) {
      return;
    }
    lastToastRef.current = { message, timestamp: now };

    clearTimers();
    const id = Math.random().toString(36).substring(2, 9) + Date.now();
    const newToast: ToastItem = { id, type, title, message, duration, isExiting: false };

    // Pastikan tidak ada toast yang tumpuk: hanya 1 toast aktif yang tampil
    setActiveToast(newToast);

    // Tampil 5 detik penuh, lalu fade out secara mulus
    if (duration > 0) {
      exitTimerRef.current = setTimeout(() => {
        setActiveToast(prev => (prev && prev.id === id ? { ...prev, isExiting: true } : prev));
        removeTimerRef.current = setTimeout(() => {
          setActiveToast(prev => (prev && prev.id === id ? null : prev));
        }, 450); // Durasi transisi fade out
      }, duration);
    }
  }, []);

  const success = useCallback((message: string, title?: string) => showToast(message, 'success', title || 'Success'), [showToast]);
  const error = useCallback((message: string, title?: string) => showToast(message, 'error', title || 'Error'), [showToast]);
  const info = useCallback((message: string, title?: string) => showToast(message, 'info', title || 'Information'), [showToast]);
  const warning = useCallback((message: string, title?: string) => showToast(message, 'warning', title || 'Warning'), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}

      {/* Floating Single Toast Notification Container - Never Stacks/Overlaps */}
      {activeToast && (
        <div className="fixed top-5 right-5 z-[999999] max-w-sm w-full pointer-events-none px-3 select-none">
          <div
            key={activeToast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl backdrop-blur-xl border transform transition-all duration-400 ease-in-out ${
              activeToast.isExiting
                ? 'opacity-0 -translate-y-4 scale-95'
                : 'opacity-100 translate-y-0 scale-100 animate-in slide-in-from-top-4 fade-in'
            } ${
              activeToast.type === 'success'
                ? 'bg-slate-900/95 border-emerald-500/50 text-white shadow-emerald-950/40'
                : activeToast.type === 'error'
                ? 'bg-slate-900/95 border-rose-500/50 text-white shadow-rose-950/40'
                : activeToast.type === 'warning'
                ? 'bg-slate-900/95 border-amber-500/50 text-white shadow-amber-950/40'
                : 'bg-slate-900/95 border-orange-500/50 text-white shadow-orange-950/40'
            }`}
          >
            {/* Icon */}
            <div className="shrink-0 mt-0.5">
              {activeToast.type === 'success' && (
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
              {activeToast.type === 'error' && (
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <AlertCircle className="w-5 h-5" />
                </div>
              )}
              {activeToast.type === 'warning' && (
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}
              {activeToast.type === 'info' && (
                <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-[#FF6B00]">
                  <Info className="w-5 h-5" />
                </div>
              )}
            </div>

            {/* Text Body */}
            <div className="flex-1 min-w-0">
              {activeToast.title && (
                <h5 className="text-xs font-extrabold text-white leading-tight mb-0.5">
                  {activeToast.title}
                </h5>
              )}
              <p className="text-[11px] font-medium text-slate-300 leading-relaxed break-words">
                {activeToast.message}
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={() => dismissToast(false)}
              className="shrink-0 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer"
              title="Close notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

