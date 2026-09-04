'use client';

import React from 'react';
import { ShieldAlert, ArrowRight, X, AlertTriangle } from 'lucide-react';

interface DefaultPasswordNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DefaultPasswordNoticeModal({ isOpen, onClose }: DefaultPasswordNoticeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="glass-card max-w-md w-full rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl border border-white/90 relative animate-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/25 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-950 text-[10px] font-extrabold uppercase tracking-wider border border-orange-200">
              Security Notice
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-1 leading-tight">
              Default Password Alert
            </h3>
          </div>
        </div>

        {/* Body Message */}
        <div className="space-y-3 text-xs text-slate-600">
          <p className="leading-relaxed font-medium">
            All user account passwords are currently initialized to the default:
          </p>

          <div className="flex items-center justify-between p-3 rounded-xl bg-orange-50/80 border border-orange-200/90 font-mono">
            <span className="text-slate-500 text-[11px] font-sans font-medium">Default Password:</span>
            <span className="px-3 py-1 rounded-lg bg-white font-bold text-[#FF6B00] border border-orange-300 text-sm shadow-xs select-all">
              Metso
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2 text-amber-950">
            <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Action Required Upon Login:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-amber-900/90 font-medium pl-0.5">
              <li>Sign in using your <strong>User ID</strong> and password <code>Metso</code>.</li>
              <li>Click your <strong>Profile Icon</strong> at the top right of the dashboard.</li>
              <li>Go to <strong>Change Password</strong> and set your new private password.</li>
            </ol>
          </div>

          <p className="text-[11px] text-slate-400 font-medium italic">
            * This reminder will automatically stop appearing on this device once your password has been changed.
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 px-4 rounded-xl btn-orange font-bold text-xs shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
        >
          <span>I Understand &amp; Proceed to Login</span>
          <ArrowRight className="w-4 h-4" />
        </button>

      </div>
    </div>
  );
}