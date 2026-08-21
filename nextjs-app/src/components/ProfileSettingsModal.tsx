'use client';

import React, { useState } from 'react';
import { X, User, Mail, Phone, Lock, Camera, Check, AlertCircle, Shield, KeyRound, Save, Trash2 } from 'lucide-react';

interface ProfileSettingsModalProps {
  user: any;
  onClose: () => void;
  onUpdateUser: (updatedUser: any) => void;
}

export default function ProfileSettingsModal({ user, onClose, onUpdateUser }: ProfileSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // Profile Form State
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');

  // Password Form State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI Status State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Handle Profile Picture File Upload
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Image size exceeds 2MB limit. Please choose a smaller photo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setAvatar(dataUrl);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  // Handle Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          action: 'update_profile',
          new_username: username.trim(),
          email: email.trim(),
          phone: phone.trim(),
          avatar: avatar
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to update profile');
      }

      onUpdateUser(data.user);
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!oldPassword || !newPassword) {
      setError('Please fill in both current and new password');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match');
      return;
    }

    if (newPassword.length < 3) {
      setError('New password must be at least 3 characters long');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          action: 'change_password',
          old_password: oldPassword,
          new_password: newPassword
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to change password');
      }

      if (data.user) {
        onUpdateUser(data.user);
      }

      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMsg('Password changed successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error changing password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="glass-card max-w-md w-full rounded-3xl p-6 space-y-5 shadow-2xl bg-white/95 border border-white/80 relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-orange-100 border border-orange-200 text-[#FF6B00]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">User Profile Settings</h2>
              <p className="text-xs text-slate-500 font-medium">Edit personal info, photo &amp; password</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/60">
          <button
            onClick={() => { setActiveTab('profile'); setError(null); setSuccessMsg(null); }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>Data Diri &amp; Photo</span>
          </button>

          <button
            onClick={() => { setActiveTab('security'); setError(null); setSuccessMsg(null); }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'security'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>Ganti Password</span>
          </button>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1: DATA DIRI & PROFILE PICTURE */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            
            {/* Avatar Upload Section */}
            <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80">
              <div className="relative group shrink-0">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-[#FF6B00] text-white flex items-center justify-center font-black text-lg border-2 border-white shadow-md">
                  {avatar ? (
                    <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span>{username ? username.charAt(0).toUpperCase() : 'U'}</span>
                  )}
                </div>

                <label className="absolute bottom-0 right-0 p-1 rounded-full bg-slate-900 text-white hover:bg-[#FF6B00] transition cursor-pointer shadow-md">
                  <Camera className="w-3 h-3" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="space-y-0.5 flex-1">
                <h4 className="text-xs font-bold text-slate-800">Foto Profil</h4>
                <p className="text-[11px] text-slate-500">Upload foto profil (JPG/PNG max 2MB).</p>
                <div className="flex items-center gap-2 pt-1">
                  <label className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold hover:bg-slate-50 cursor-pointer shadow-2xs">
                    Upload Foto
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </label>
                  {avatar && (
                    <button
                      type="button"
                      onClick={() => setAvatar('')}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-[11px] font-bold hover:bg-rose-100 transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Readonly Metadata Badges */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-xl bg-slate-100/70 border border-slate-200/60">
                <span className="block text-[9px] font-bold text-slate-400 uppercase">User ID</span>
                <span className="text-xs font-mono font-black text-slate-900">{user?.id}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100/70 border border-slate-200/60">
                <span className="block text-[9px] font-bold text-slate-400 uppercase">Role</span>
                <span className="text-xs font-bold text-[#FF6B00] flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  {user?.role}
                </span>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#FF6B00]" />
                  Nama Lengkap / Display Name
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Nama Lengkap Anda"
                  className="w-full px-3.5 py-2 rounded-xl text-xs glass-input font-medium text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#FF6B00]" />
                  Alamat Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="contoh: user@metso.com"
                  className="w-full px-3.5 py-2 rounded-xl text-xs glass-input font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#FF6B00]" />
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="contoh: +62 812-3456-7890"
                  className="w-full px-3.5 py-2 rounded-xl text-xs glass-input font-medium text-slate-900"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200/80">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#E05600] text-white text-xs font-black hover:from-[#E05600] hover:to-[#C04600] transition flex items-center gap-1.5 shadow-md shadow-orange-500/20"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{loading ? 'Saving...' : 'Simpan Profil'}</span>
              </button>
            </div>

          </form>
        )}

        {/* TAB 2: GANTI PASSWORD */}
        {activeTab === 'security' && (
          <form onSubmit={handleChangePassword} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                Password Saat Ini (Password Lama)
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                placeholder="Masukkan password lama"
                className="w-full px-3.5 py-2 rounded-xl text-xs glass-input font-medium text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#FF6B00]" />
                Password Baru
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Masukkan password baru"
                className="w-full px-3.5 py-2 rounded-xl text-xs glass-input font-medium text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#FF6B00]" />
                Konfirmasi Password Baru
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="w-full px-3.5 py-2 rounded-xl text-xs glass-input font-medium text-slate-900"
                required
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200/80">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-black hover:bg-slate-800 transition flex items-center gap-1.5 shadow-md"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{loading ? 'Changing...' : 'Update Password'}</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
