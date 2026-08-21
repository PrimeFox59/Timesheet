'use client';

import React, { useState } from 'react';
import { Database, Upload, Download, CheckCircle, AlertCircle, FileSpreadsheet, ExternalLink, RefreshCw, Server, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';

interface DatabaseManagementTabProps {
  currentUser: any;
  onRefreshAll?: () => void;
}

export default function DatabaseManagementTab({ currentUser, onRefreshAll }: DatabaseManagementTabProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    success: boolean;
    message: string;
    stats?: { users: number; presensi: number; auditLogs: number; areas: number };
  } | null>(null);

  // Reset Modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string } | null>(null);

  const googleSheetUrl = 'https://docs.google.com/spreadsheets/d/1BwwoNx3t3MBrsOB3H9BSxnWbYCwChwgl4t1HrpFYWpA/edit?gid=0#gid=0';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setMigrationResult(null);
    }
  };

  const handleMigrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setMigrating(true);
    setMigrationResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/database/migrate', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (data.success) {
        setMigrationResult({
          success: true,
          message: data.message,
          stats: data.stats
        });
        setSelectedFile(null);
        if (onRefreshAll) onRefreshAll();
      } else {
        setMigrationResult({
          success: false,
          message: data.error || 'Migration failed'
        });
      }
    } catch (err: any) {
      setMigrationResult({
        success: false,
        message: 'Network error during migration upload'
      });
    } finally {
      setMigrating(false);
    }
  };

  const handleDownloadBackup = () => {
    window.open('/api/database/backup', '_blank');
  };

  const handleConfirmResetDatabase = async () => {
    setResetting(true);
    setResetResult(null);

    try {
      const res = await fetch('/api/database/reset', {
        method: 'POST'
      });

      const data = await res.json();

      if (data.success) {
        setResetResult({
          success: true,
          message: data.message
        });
        setIsResetModalOpen(false);
        if (onRefreshAll) onRefreshAll();
      } else {
        setResetResult({
          success: false,
          message: data.error || 'Failed to reset database'
        });
      }
    } catch (err: any) {
      setResetResult({
        success: false,
        message: 'Network error executing database reset'
      });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 animate-smooth-fade">
      
      {/* Header Banner */}
      <div className="glass-card rounded-2xl p-6 shadow-sm border border-white/80">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-5 h-5 text-[#FF6B00]" />
          Database Management & Migration Portal
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Seamlessly migrate data from Google Sheets/Excel spreadsheets, backup database, or reset to factory state.
        </p>
      </div>

      {resetResult && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2 shadow-md ${
          resetResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          {resetResult.success ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{resetResult.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Migration Card */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="glass-card rounded-3xl p-6 border border-white/80 shadow-md space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#FF6B00]" />
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                  Excel & Google Sheets Migration
                </h3>
              </div>

              <a
                href={googleSheetUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-orange-950 hover:text-orange-800 font-bold bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-200 transition"
              >
                <span>Open Google Sheet</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Instruction Steps */}
            <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200/80 space-y-2 text-xs text-slate-700">
              <span className="font-bold text-[#FF6B00] uppercase tracking-wider text-[11px] block">
                📋 Migration Instructions:
              </span>
              <ol className="list-decimal list-inside space-y-1 font-medium text-slate-600">
                <li>Buka link Google Spreadsheet acuan (Tombol <strong>Open Google Sheet</strong> di atas).</li>
                <li>Pilih menu <strong>File</strong> &rarr; <strong>Download</strong> &rarr; <strong>Microsoft Excel (.xlsx)</strong>.</li>
                <li>Upload file <code>.xlsx</code> yang terunduh pada form di bawah dan klik <strong>Run Excel Migration</strong>.</li>
              </ol>
            </div>

            {/* Migration Form */}
            <form onSubmit={handleMigrationSubmit} className="space-y-4">
              
              <div className="border-2 border-dashed border-slate-300 hover:border-[#FF6B00] rounded-2xl p-6 text-center transition bg-white/40">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  id="excel-file-upload"
                  className="hidden"
                />
                <label htmlFor="excel-file-upload" className="cursor-pointer block space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-orange-100 text-[#FF6B00] flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>

                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      {selectedFile ? selectedFile.name : 'Click to select or drag & drop Excel file (.xlsx, .xls)'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Supports sheets: user, presensi, audit_log, areas
                    </span>
                  </div>
                </label>
              </div>

              <button
                type="submit"
                disabled={!selectedFile || migrating}
                className={`w-full py-3 rounded-xl text-xs font-extrabold shadow-lg flex items-center justify-center gap-2 transition ${
                  selectedFile && !migrating ? 'btn-orange' : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${migrating ? 'animate-spin' : ''}`} />
                <span>{migrating ? 'Parsing & Migrating Excel Data...' : 'Run Excel Migration'}</span>
              </button>

            </form>

            {/* Result Toast */}
            {migrationResult && (
              <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
                migrationResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {migrationResult.success ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                  <span>{migrationResult.message}</span>
                </div>

                {migrationResult.stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200/80 font-mono text-[11px]">
                    <div className="p-2 bg-white/80 rounded-xl">
                      <span className="text-slate-500 block text-[10px]">Users</span>
                      <strong className="text-emerald-700 text-sm">{migrationResult.stats.users}</strong>
                    </div>
                    <div className="p-2 bg-white/80 rounded-xl">
                      <span className="text-slate-500 block text-[10px]">Timesheets</span>
                      <strong className="text-emerald-700 text-sm">{migrationResult.stats.presensi}</strong>
                    </div>
                    <div className="p-2 bg-white/80 rounded-xl">
                      <span className="text-slate-500 block text-[10px]">Audit Logs</span>
                      <strong className="text-emerald-700 text-sm">{migrationResult.stats.auditLogs}</strong>
                    </div>
                    <div className="p-2 bg-white/80 rounded-xl">
                      <span className="text-slate-500 block text-[10px]">Work Areas</span>
                      <strong className="text-emerald-700 text-sm">{migrationResult.stats.areas}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

        {/* Database Health, Backup Export & Factory Reset Cards */}
        <div className="space-y-6">
          
          {/* Backup Export */}
          <div className="glass-card rounded-3xl p-6 border border-white/80 shadow-md space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
              <Server className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                Database Backup
              </h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Export full SQLite database to a structured Excel spreadsheet file containing all user accounts, timesheets, work areas, and audit logs.
            </p>

            <button
              onClick={handleDownloadBackup}
              className="w-full py-3 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-lg flex items-center justify-center gap-2 transition"
            >
              <Download className="w-4 h-4" />
              <span>Export Database (.xlsx)</span>
            </button>
          </div>

          {/* Reset Database to Factory State */}
          <div className="glass-card rounded-3xl p-6 border border-rose-200/80 bg-rose-50/30 shadow-md space-y-4">
            <div className="flex items-center gap-2 border-b border-rose-200 pb-3 text-rose-700">
              <RotateCcw className="w-5 h-5" />
              <h3 className="text-sm font-extrabold uppercase tracking-wider">
                Reset Database
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Clear all timesheets and users, leaving only the default superuser account:
              <br />
              <code className="text-[11px] font-mono font-bold text-rose-900 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200 mt-1 inline-block">
                ID: prime &bull; Password: zzz
              </code>
            </p>

            <button
              onClick={() => setIsResetModalOpen(true)}
              className="w-full py-3 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-lg flex items-center justify-center gap-2 transition"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Database to Factory State</span>
            </button>
          </div>

          {/* Database Specs */}
          <div className="glass-card rounded-3xl p-6 border border-white/80 shadow-md space-y-3">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Default Superuser Specs:
            </h4>
            <ul className="text-xs text-slate-600 space-y-1.5 font-medium">
              <li className="flex justify-between">
                <span>User ID:</span>
                <strong className="font-mono text-slate-900">prime</strong>
              </li>
              <li className="flex justify-between">
                <span>Password:</span>
                <strong className="font-mono text-slate-900">zzz</strong>
              </li>
              <li className="flex justify-between">
                <span>Role:</span>
                <strong className="font-mono text-orange-600 font-bold">superuser (Full Open Access)</strong>
              </li>
            </ul>
          </div>

        </div>

      </div>

      {/* FACTORY RESET CONFIRMATION MODAL */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-3xl p-6 space-y-4 shadow-2xl border border-white relative animate-in fade-in zoom-in duration-200 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            
            <div>
              <h3 className="text-base font-bold text-slate-900">Confirm Factory Database Reset?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                This will permanently delete all existing user accounts, daily timesheet logs, and audit records in SQLite!
                <br /><br />
                It will leave only the default superuser account:
                <br />
                <strong className="font-mono text-rose-700 text-xs">ID: prime | Password: zzz (Role: superuser)</strong>
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetDatabase}
                disabled={resetting}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shadow hover:bg-rose-700 transition"
              >
                {resetting ? 'Resetting Database...' : 'Yes, Reset Database Now'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
