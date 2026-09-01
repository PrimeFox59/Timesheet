'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiUrl } from '@/lib/api';
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
  Check, 
  AlertCircle, 
  RefreshCw, 
  Sparkles,
  Lock,
  Cpu,
  Layers
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
  category: 'ai_auth' | 'modules' | 'rules';
}

const FEATURE_CONFIGS: FeatureToggleItem[] = [
  {
    key: 'enable_face_login',
    title: 'AI Face ID Login Biometrics',
    desc: 'Aktifkan / nonaktifkan tombol dan pemindai login biometrik wajah di halaman login.',
    icon: ScanFace,
    category: 'ai_auth'
  },
  {
    key: 'enable_face_registration',
    title: 'AI Face ID Registration',
    desc: 'Izinkan pengguna memindai dan mendaftarkan 128-d neural biometric wajah di pengaturan profil.',
    icon: Sparkles,
    category: 'ai_auth'
  },
  {
    key: 'enable_codex_approval',
    title: 'Modul Codex & Digital Signature',
    desc: 'Aktifkan sistem persetujuan lembur & penandatanganan digital sertifikat Codex.',
    icon: FileCheck,
    category: 'modules'
  },
  {
    key: 'enable_workhour_analytics',
    title: 'Dashboard Analitik Jam Kerja',
    desc: 'Aktifkan visualisasi chart analitik produktivitas dan jam kerja tim.',
    icon: BarChart3,
    category: 'modules'
  },
  {
    key: 'enable_audit_log',
    title: 'System Security Audit Trail',
    desc: 'Catat dan tampilkan jejak audit keamanan seluruh aksi pengguna dalam sistem.',
    icon: ShieldCheck,
    category: 'modules'
  },
  {
    key: 'enable_database_migration',
    title: 'Database Backup & Excel Migration',
    desc: 'Aktifkan alat download backup database, reset, dan migrasi Google Sheets/Excel.',
    icon: Server,
    category: 'modules'
  },
  {
    key: 'enable_realtime_socket',
    title: 'Real-time Live Stream & Presence Sync',
    desc: 'Aktifkan koneksi SSE (Server-Sent Events) untuk sinkronisasi instan multi-user.',
    icon: Radio,
    category: 'rules'
  },
  {
    key: 'enable_retroactive_entry',
    title: 'Input Absensi Tanggal Mundur',
    desc: 'Izinkan pengguna menginput atau mengoreksi data timesheet untuk tanggal yang telah lewat.',
    icon: CalendarClock,
    category: 'rules'
  },
  {
    key: 'allow_overtime_entry',
    title: 'Pengisian Jam Lembur (Overtime)',
    desc: 'Izinkan pengguna menambahkan jam lembur di atas jam kerja standar 8 jam.',
    icon: Clock,
    category: 'rules'
  }
];

export default function SuperuserTab({ currentUser, onSettingsChanged }: SuperuserTabProps) {
  const [settings, setSettings] = useState<Record<string, boolean | string>>({
    enable_face_login: true,
    enable_face_registration: true,
    enable_codex_approval: true,
    enable_workhour_analytics: true,
    enable_audit_log: true,
    enable_database_migration: true,
    enable_realtime_socket: true,
    enable_retroactive_entry: true,
    allow_overtime_entry: true
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/system/settings'));
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
        if (onSettingsChanged) onSettingsChanged(data.settings);
      }
    } catch (err: any) {
      setErrorNotice('Gagal mengambil pengaturan sistem.');
    } finally {
      setLoading(false);
    }
  }, [onSettingsChanged]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleToggle = async (key: string, currentValue: boolean) => {
    const nextVal = !currentValue;
    setUpdatingKey(key);
    setSuccessNotice(null);
    setErrorNotice(null);

    // Optimistic update
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
        setSuccessNotice(data.message || 'Pengaturan berhasil diperbarui!');
        setTimeout(() => setSuccessNotice(null), 3000);
      } else {
        // Rollback
        setSettings(settings);
        setErrorNotice(data.error || 'Gagal menyimpan perubahan.');
      }
    } catch (err: any) {
      setSettings(settings);
      setErrorNotice('Gagal menghubungi server.');
    } finally {
      setUpdatingKey(null);
    }
  };

  const isSuperUser = currentUser?.id?.toLowerCase() === 'prime' || currentUser?.role?.toLowerCase() === 'superuser';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Superuser Master Banner */}
      <div className="glass-card rounded-3xl p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white border border-slate-800 shadow-2xl relative overflow-hidden">
        
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-[#FF6B00] flex items-center justify-center text-white shadow-xl shadow-orange-950/50 border border-orange-400/40 shrink-0">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-white">
                  Superuser Master Control Center
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/40 font-mono">
                  PRIME ONLY
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Pusat kendali fitur global &amp; saklar on/off modul aplikasi Timesheet METSO.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchSettings}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>

        {/* Status notice */}
        {successNotice && (
          <div className="mt-4 p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}
        {errorNotice && (
          <div className="mt-4 p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorNotice}</span>
          </div>
        )}
      </div>

      {/* Feature Toggles Grid */}
      <div className="space-y-6">
        
        {/* Section 1: AI & Authentication */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Cpu className="w-4 h-4 text-[#FF6B00]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              AI Biometrics &amp; Authentication Control
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FEATURE_CONFIGS.filter(f => f.category === 'ai_auth').map(item => {
              const Icon = item.icon;
              const isEnabled = Boolean(settings[item.key]);
              const isUpdating = updatingKey === item.key;

              return (
                <div 
                  key={item.key}
                  className="glass-card rounded-2xl p-4.5 bg-white/95 border border-slate-200/80 shadow-sm hover:shadow-md transition flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      isEnabled ? 'bg-orange-50 text-[#FF6B00] border-orange-200' : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs font-extrabold text-slate-900">{item.title}</div>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                      <div className="pt-1">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full font-mono ${
                          isEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
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
                    onClick={() => handleToggle(item.key, isEnabled)}
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

        {/* Section 2: Enterprise Modules */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Layers className="w-4 h-4 text-[#FF6B00]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Enterprise Feature Modules
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FEATURE_CONFIGS.filter(f => f.category === 'modules').map(item => {
              const Icon = item.icon;
              const isEnabled = Boolean(settings[item.key]);
              const isUpdating = updatingKey === item.key;

              return (
                <div 
                  key={item.key}
                  className="glass-card rounded-2xl p-4.5 bg-white/95 border border-slate-200/80 shadow-sm hover:shadow-md transition flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      isEnabled ? 'bg-orange-50 text-[#FF6B00] border-orange-200' : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs font-extrabold text-slate-900">{item.title}</div>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                      <div className="pt-1">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full font-mono ${
                          isEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
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
                    onClick={() => handleToggle(item.key, isEnabled)}
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

        {/* Section 3: Operational & Governance Rules */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Sliders className="w-4 h-4 text-[#FF6B00]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Operational &amp; Timesheet Governance Rules
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FEATURE_CONFIGS.filter(f => f.category === 'rules').map(item => {
              const Icon = item.icon;
              const isEnabled = Boolean(settings[item.key]);
              const isUpdating = updatingKey === item.key;

              return (
                <div 
                  key={item.key}
                  className="glass-card rounded-2xl p-4.5 bg-white/95 border border-slate-200/80 shadow-sm hover:shadow-md transition flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      isEnabled ? 'bg-orange-50 text-[#FF6B00] border-orange-200' : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs font-extrabold text-slate-900">{item.title}</div>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                      <div className="pt-1">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full font-mono ${
                          isEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
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
                    onClick={() => handleToggle(item.key, isEnabled)}
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

      </div>

    </div>
  );
}
