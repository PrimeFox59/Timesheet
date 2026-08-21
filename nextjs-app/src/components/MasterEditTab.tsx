'use client';

import React, { useState } from 'react';
import { Database, Plus, Trash2, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface MasterEditTabProps {
  currentUser: any;
  areasList: string[];
  usersList: any[];
  onRefreshAreas: () => void;
  onRefreshUsers: () => void;
}

export default function MasterEditTab({ currentUser, areasList, usersList, onRefreshAreas, onRefreshUsers }: MasterEditTabProps) {
  const [newAreaName, setNewAreaName] = useState('');
  const [areaToDelete, setAreaToDelete] = useState('');
  const [areaMsg, setAreaMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [selectedUserId, setSelectedUserId] = useState(usersList[0]?.id || '');
  const [newPassword, setNewPassword] = useState('');
  const [userMsg, setUserMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAddArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaName.trim()) return;

    setAreaMsg(null);
    try {
      const res = await fetch(apiUrl('/api/master/areas'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAreaName,
          admin_id: currentUser.id,
          admin_name: currentUser.username
        })
      });

      const data = await res.json();
      if (data.success) {
        setAreaMsg({ type: 'success', text: `Area '${newAreaName.trim().toUpperCase()}' added successfully!` });
        setNewAreaName('');
        onRefreshAreas();
      } else {
        setAreaMsg({ type: 'error', text: data.error || 'Failed to add area' });
      }
    } catch (err: any) {
      setAreaMsg({ type: 'error', text: 'Error adding area' });
    }
  };

  const handleDeleteArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaToDelete) return;

    if (!confirm(`Are you sure you want to delete area '${areaToDelete}'?`)) return;

    setAreaMsg(null);
    try {
      const res = await fetch(apiUrl('/api/master/areas'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: areaToDelete,
          admin_id: currentUser.id,
          admin_name: currentUser.username
        })
      });

      const data = await res.json();
      if (data.success) {
        setAreaMsg({ type: 'success', text: `Area '${areaToDelete}' deleted successfully!` });
        setAreaToDelete('');
        onRefreshAreas();
      } else {
        setAreaMsg({ type: 'error', text: data.error || 'Failed to delete area' });
      }
    } catch (err: any) {
      setAreaMsg({ type: 'error', text: 'Error deleting area' });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !newPassword) return;

    setUserMsg(null);
    try {
      const res = await fetch(apiUrl('/api/master/users'), {
        method: 'POST',

        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: selectedUserId,
          new_password: newPassword,
          admin_id: currentUser.id,
          admin_name: currentUser.username
        })
      });

      const data = await res.json();
      if (data.success) {
        setUserMsg({ type: 'success', text: data.message });
        setNewPassword('');
      } else {
        setUserMsg({ type: 'error', text: data.error || 'Failed to reset password' });
      }
    } catch (err: any) {
      setUserMsg({ type: 'error', text: 'Error resetting password' });
    }
  };

  return (
    <div className="space-y-6 animate-smooth-fade">
      
      {/* Header */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-5 h-5 text-[#FF6B00]" />
          Master Edit Management
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Restricted administrative controls to add/remove work areas and reset user credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Manage Work Areas Card */}
        <div className="glass-card rounded-2xl p-6 space-y-5">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#FF6B00]" />
            Manage Work Areas
          </h3>

          {areaMsg && (
            <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-semibold ${
              areaMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {areaMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
              <span>{areaMsg.text}</span>
            </div>
          )}

          {/* Form 1: Add New Area */}
          <form onSubmit={handleAddArea} className="space-y-3 p-4 rounded-xl bg-white/60 border border-white/80">
            <label className="block text-xs font-semibold text-slate-700">Add New Area Code</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newAreaName}
                onChange={e => setNewAreaName(e.target.value)}
                placeholder="e.g. CMN, ET, GCP"
                className="flex-1 px-3 py-1.5 rounded-xl text-xs glass-input font-medium"
                required
              />
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl text-xs font-bold btn-orange flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </form>

          {/* Form 2: Delete Existing Area */}
          <form onSubmit={handleDeleteArea} className="space-y-3 p-4 rounded-xl bg-white/60 border border-white/80">
            <label className="block text-xs font-semibold text-slate-700">Delete Existing Area</label>
            <div className="flex gap-2">
              <select
                value={areaToDelete}
                onChange={e => setAreaToDelete(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-xl text-xs glass-input font-medium"
              >
                <option value="">-- Select Area to Delete --</option>
                {areasList.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!areaToDelete}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1 transition shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </form>

          {/* Current Area List */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Active Area List</label>
            <div className="flex flex-wrap gap-1.5">
              {areasList.map(a => (
                <span key={a} className="px-2.5 py-1 rounded-lg bg-orange-100/90 text-orange-950 font-bold text-xs border border-orange-200">
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Manage User Passwords Card */}
        <div className="glass-card rounded-2xl p-6 space-y-5">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#FF6B00]" />
            Reset User Password
          </h3>

          {userMsg && (
            <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-semibold ${
              userMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {userMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
              <span>{userMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-4 p-4 rounded-xl bg-white/60 border border-white/80">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Target User</label>
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs glass-input font-medium"
                required
              >
                {usersList.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.username} ({u.id}) - {u.role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
              <input
                type="text"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-3 py-2 rounded-xl text-xs glass-input font-medium"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 rounded-xl text-xs font-bold btn-orange flex items-center justify-center gap-1.5 shadow-md"
            >
              <KeyRound className="w-4 h-4" />
              <span>Reset Password</span>
            </button>
          </form>

        </div>

      </div>

    </div>
  );
}
