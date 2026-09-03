'use client';

import React, { useState, useEffect } from 'react';
import { Users, Search, RefreshCw, Eye, EyeOff, Shield, Award, UserPlus, Edit2, Trash2, X, CheckCircle, AlertCircle } from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { useToast } from '@/components/Toast';

interface UserManagementTabProps {
  usersList: any[];
  currentUser: any;
  onRefreshUsers: () => void;
}

export default function UserManagementTab({ usersList, currentUser, onRefreshUsers }: UserManagementTabProps) {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(false);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState<any | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    id: '',
    username: '',
    password: 'Metso',
    role: 'Commissioning Engineer',
    grade: 'A',
    preferred_areas: 'CMN',
    preferred_shift: 'Day Shift',
    number_of_areas: 2
  });

  const availableRoles = [
    'Site Admin',
    'Commissioning Director',
    'Site Director',
    'Commissioning Lead Advisor',
    'Process Lead Advisor',
    'Equipment Expert',
    'Commissioning Engineer',
    'Electrical Advisor',
    'Automation Specialist',
    'Member'
  ];

  const availableAreas = ['GCP', 'SAP', 'ER', 'SM', 'SC', 'CMN', 'ET'];

  const handleRefresh = async () => {
    setLoading(true);
    await onRefreshUsers();
    setLoading(false);
  };

  // Realtime updates when users are added/modified/deleted
  useEffect(() => {
    const handleUserUpdated = () => {
      onRefreshUsers();
    };
    window.addEventListener('user_updated', handleUserUpdated);
    return () => window.removeEventListener('user_updated', handleUserUpdated);
  }, [onRefreshUsers]);

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Open Create Modal
  const openCreateModal = () => {
    setFormData({
      id: '',
      username: '',
      password: 'Metso',
      role: 'Commissioning Engineer',
      grade: 'A',
      preferred_areas: 'CMN',
      preferred_shift: 'Day Shift',
      number_of_areas: 2
    });
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (user: any) => {
    setFormData({
      id: user.id,
      username: user.username || '',
      password: user.password || 'Metso',
      role: user.role || 'Member',
      grade: user.grade || 'A',
      preferred_areas: user.preferred_areas || 'CMN',
      preferred_shift: user.preferred_shift || 'Day Shift',
      number_of_areas: user.number_of_areas || 2
    });
    setIsEditModalOpen(true);
  };

  // Submit Create User
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(apiUrl('/api/master/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...formData,
          admin_id: currentUser?.id,
          admin_name: currentUser?.username
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setIsAddModalOpen(false);
        await onRefreshUsers();
      } else {
        toast.error(data.error || 'Failed to create user');
      }
    } catch (err: any) {
      toast.error('Network error creating user');
    } finally {
      setLoading(false);
    }
  };

  // Submit Edit User
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(apiUrl('/api/master/users'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          admin_id: currentUser?.id,
          admin_name: currentUser?.username
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setIsEditModalOpen(false);
        await onRefreshUsers();
      } else {
        toast.error(data.error || 'Failed to update user');
      }
    } catch (err: any) {
      toast.error('Network error updating user');
    } finally {
      setLoading(false);
    }
  };

  // Confirm Delete User
  const handleDeleteConfirm = async () => {
    if (!deleteTargetUser) return;
    setLoading(true);

    try {
      const res = await fetch(apiUrl(`/api/master/users?id=${encodeURIComponent(deleteTargetUser.id)}`), {
        method: 'DELETE'
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setDeleteTargetUser(null);
        await onRefreshUsers();
      } else {
        toast.error(data.error || 'Failed to delete user');
      }
    } catch (err: any) {
      toast.error('Network error deleting user');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = usersList.filter(u => {
    const q = searchQuery.toLowerCase();
    return (
      (u.id && u.id.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q)) ||
      (u.grade && u.grade.toLowerCase().includes(q))
    );
  });

  const totalUsers = usersList.length;
  const adminCount = usersList.filter(u => u.role === 'Site Admin').length;
  const directorCount = usersList.filter(u => u.role?.includes('Director')).length;

  return (
    <div className="space-y-6 animate-smooth-fade">

      {/* Header & KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF6B00] flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Registered Users</div>
            <div className="text-xl font-black text-slate-900">{totalUsers}</div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Site Admins</div>
            <div className="text-xl font-black text-slate-900">{adminCount}</div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Directors / Leads</div>
            <div className="text-xl font-black text-slate-900">{directorCount}</div>
          </div>
        </div>

      </div>

      {/* Header & Search Bar + Add User Button */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#FF6B00]" />
              User Management Directory
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete list of application users. Add, edit, or remove user credentials & roles.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl btn-orange font-bold shadow transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add New User</span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by User ID, Username, Role, or Grade..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs glass-input font-medium"
          />
        </div>
      </div>

      {/* User Directory Data Table */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-sm border border-white/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-900/90 text-slate-100 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3 w-28">Id</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Password</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-center">Grade</th>
                <th className="px-4 py-3">Preferred Areas</th>
                <th className="px-4 py-3">Preferred Shift</th>
                <th className="px-4 py-3 text-center">Number of Areas</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 font-medium">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    No users found matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, idx) => {
                  const isVisible = showPasswords[u.id];
                  return (
                    <tr key={u.id || idx} className="hover:bg-white/60 transition">
                      
                      {/* ID */}
                      <td className="px-4 py-2.5 font-mono text-[11px] font-bold text-slate-900 whitespace-nowrap">
                        {u.id}
                      </td>

                      {/* Username */}
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {u.username}
                      </td>

                      {/* Password Cell with Toggle */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {isVisible ? u.password : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(u.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 transition"
                            title={isVisible ? 'Hide Password' : 'Show Password'}
                          >
                            {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-2.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          u.role === 'Site Admin' ? 'bg-orange-100 text-[#FF6B00] border border-orange-300' :
                          u.role?.includes('Director') ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {u.role}
                        </span>
                      </td>

                      {/* Grade */}
                      <td className="px-4 py-2.5 text-center font-bold text-slate-900">
                        {u.grade || 'A'}
                      </td>

                      {/* Preferred Areas */}
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-950 text-[10px] font-semibold border border-orange-200">
                          {u.preferred_areas || 'CMN'}
                        </span>
                      </td>

                      {/* Preferred Shift */}
                      <td className="px-4 py-2.5 text-slate-700">
                        {u.preferred_shift || 'Day Shift'}
                      </td>

                      {/* Number of Areas */}
                      <td className="px-4 py-2.5 text-center font-bold text-slate-900">
                        {u.number_of_areas || 2}
                      </td>

                      {/* Action Buttons */}
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition"
                            title="Edit User"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setDeleteTargetUser(u)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full rounded-3xl p-6 space-y-5 shadow-2xl border border-white relative animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#FF6B00]" />
                Add New Application User
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">User ID (e.g. COM201)</label>
                  <input
                    type="text"
                    value={formData.id}
                    onChange={e => setFormData({ ...formData, id: e.target.value })}
                    placeholder="e.g. COM201"
                    className="w-full px-3 py-2 rounded-xl glass-input font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Full name"
                    className="w-full px-3 py-2 rounded-xl glass-input font-medium"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Password</label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Password"
                    className="w-full px-3 py-2 rounded-xl glass-input font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl glass-input font-semibold"
                  >
                    {availableRoles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Grade</label>
                  <select
                    value={formData.grade}
                    onChange={e => setFormData({ ...formData, grade: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                  >
                    <option value="A">Grade A</option>
                    <option value="B">Grade B</option>
                    <option value="C">Grade C</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Preferred Area</label>
                  <select
                    value={formData.preferred_areas}
                    onChange={e => setFormData({ ...formData, preferred_areas: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl glass-input font-semibold"
                  >
                    {availableAreas.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Number of Areas</label>
                  <select
                    value={formData.number_of_areas}
                    onChange={e => setFormData({ ...formData, number_of_areas: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                  >
                    <option value={1}>1 Column</option>
                    <option value={2}>2 Columns</option>
                    <option value={3}>3 Columns</option>
                    <option value={4}>4 Columns</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Preferred Shift</label>
                <select
                  value={formData.preferred_shift}
                  onChange={e => setFormData({ ...formData, preferred_shift: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl glass-input font-medium"
                >
                  <option value="Day Shift">Day Shift</option>
                  <option value="Night Shift">Night Shift</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl btn-orange font-bold shadow transition"
                >
                  {loading ? 'Creating...' : 'Save New User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full rounded-3xl p-6 space-y-5 shadow-2xl border border-white relative animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                Edit User Details ({formData.id})
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">User ID</label>
                  <input
                    type="text"
                    value={formData.id}
                    disabled
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 text-slate-500 font-mono font-bold border border-slate-200 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl glass-input font-medium"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Password</label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl glass-input font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl glass-input font-semibold"
                  >
                    {availableRoles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Grade</label>
                  <select
                    value={formData.grade}
                    onChange={e => setFormData({ ...formData, grade: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                  >
                    <option value="A">Grade A</option>
                    <option value="B">Grade B</option>
                    <option value="C">Grade C</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Preferred Area</label>
                  <select
                    value={formData.preferred_areas}
                    onChange={e => setFormData({ ...formData, preferred_areas: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl glass-input font-semibold"
                  >
                    {availableAreas.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Number of Areas</label>
                  <select
                    value={formData.number_of_areas}
                    onChange={e => setFormData({ ...formData, number_of_areas: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                  >
                    <option value={1}>1 Column</option>
                    <option value={2}>2 Columns</option>
                    <option value={3}>3 Columns</option>
                    <option value={4}>4 Columns</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Preferred Shift</label>
                <select
                  value={formData.preferred_shift}
                  onChange={e => setFormData({ ...formData, preferred_shift: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl glass-input font-medium"
                >
                  <option value="Day Shift">Day Shift</option>
                  <option value="Night Shift">Night Shift</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold shadow hover:bg-blue-700 transition"
                >
                  {loading ? 'Updating...' : 'Update User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTargetUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-sm w-full rounded-3xl p-6 space-y-4 shadow-2xl border border-white relative animate-in fade-in zoom-in duration-200 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete User Account?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to permanently delete user <strong className="text-slate-900">{deleteTargetUser.username}</strong> ({deleteTargetUser.id})? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shadow hover:bg-rose-700 transition"
              >
                {loading ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
