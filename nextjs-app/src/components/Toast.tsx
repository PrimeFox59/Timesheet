'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
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
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', title?: string, duration: number = 3500) => {
    const id = Math.random().toString(36).substring(2, 9) + Date.now();
    const newToast: ToastItem = { id, type, title, message, duration };

    setToasts(prev => [...prev.slice(-4), newToast]); // Max 5 toasts

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const success = useCallback((message: string, title?: string) => showToast(message, 'success', title || 'Berhasil'), [showToast]);
  const error = useCallback((message: string, title?: string) => showToast(message, 'error', title || 'Gagal'), [showToast]);
  const info = useCallback((message: string, title?: string) => showToast(message, 'info', title || 'Informasi'), [showToast]);
  const warning = useCallback((message: string, title?: string) => showToast(message, 'warning', title || 'Peringatan'), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}

      {/* Floating Toast Notification Container */}
      <div className="fixed top-5 right-5 z-[999999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 select-none">
        {toasts.map(toast => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all duration-300 animate-in slide-in-from-top-4 fade-in ${
                isSuccess
                  ? 'bg-slate-900/95 border-emerald-500/40 text-white shadow-emerald-950/20'
                  : isError
                  ? 'bg-slate-900/95 border-rose-500/40 text-white shadow-rose-950/20'
                  : isWarning
                  ? 'bg-slate-900/95 border-amber-500/40 text-white shadow-amber-950/20'
                  : 'bg-slate-900/95 border-slate-700 text-white shadow-slate-950/20'
              }`}
            >
              {/* Icon */}
              <div className="shrink-0 mt-0.5">
                {isSuccess && (
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                )}
                {isError && (
                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                )}
                {isWarning && (
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                )}
                {!isSuccess && !isError && !isWarning && (
                  <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-[#FF6B00]">
                    <Info className="w-5 h-5" />
                  </div>
                )}
              </div>

              {/* Text Body */}
              <div className="flex-1 min-w-0">
                {toast.title && (
                  <h5 className="text-xs font-extrabold text-white leading-tight mb-0.5">
                    {toast.title}
                  </h5>
                )}
                <p className="text-[11px] font-medium text-slate-300 leading-relaxed break-words">
                  {toast.message}
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
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
