'use client';

import React, { useState } from 'react';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Camera, 
  Check, 
  AlertCircle, 
  Shield, 
  KeyRound, 
  Save, 
  Trash2, 
  ScanFace,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { useToast } from '@/components/Toast';
import FaceIdLoginModal, { UserSessionData } from './FaceIdLoginModal';

export interface UserProfileData {
  id: string;
  username: string;
  role: string;
  grade?: string;
  preferred_areas?: string;
  preferred_shift?: string;
  number_of_areas?: number;
  phone?: string;
  email?: string;
  avatar?: string;
  face_descriptor?: string;
  face_photo?: string;
  face_registered_at?: string;
}

interface ProfileSettingsModalProps {
  user: UserProfileData;
  onClose: () => void;
  onUpdateUser: (updatedUser: UserProfileData) => void;
}

export default function ProfileSettingsModal({ user, onClose, onUpdateUser }: ProfileSettingsModalProps) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'face_id'>('profile');
  const [showFaceRegisterModal, setShowFaceRegisterModal] = useState(false);

  // Check if face is registered
  const hasRegisteredFace = Boolean(
    user?.face_descriptor &&
    user.face_descriptor !== '' &&
    user.face_descriptor !== '[]'
  );

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

  // Handle Delete Face ID
  const handleDeleteFaceId = async () => {
    if (!confirm('Are you sure you want to delete your registered Face ID biometric data?')) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(apiUrl('/api/user/face-delete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      });

      const data = await res.json();
      if (data.success && data.user) {
        onUpdateUser(data.user);
        toast.success('Face ID biometric data removed successfully.', 'Face ID Removed');
      } else {
        toast.error(data.message || 'Failed to remove Face ID', 'Error');
      }
    } catch (err: any) {
      toast.error('Error removing Face ID data: ' + err.message, 'Error');
    } finally {
      setLoading(false);
    }
  };

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
    };
    reader.readAsDataURL(file);
  };

  // Handle Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch(apiUrl('/api/user/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          action: 'update_profile',
          new_username: username,
          email,
          phone,
          avatar
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to update profile');
      }

      onUpdateUser(data.user);
      toast.success('Your profile has been updated successfully!', 'Profile Saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating profile';
      toast.error(msg, 'Failed to Save Profile');
    } finally {
      setLoading(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!oldPassword || !newPassword) {
      toast.warning('Please provide both your current password and new password.', 'Incomplete Form');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New password and confirm password do not match.', 'Password Mismatch');
      return;
    }

    if (newPassword.length < 3) {
      toast.warning('New password must be at least 3 characters.', 'Password Too Short');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(apiUrl('/api/user/settings'), {
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
        throw new Error(data.error || 'Failed to update password');
      }

      if (data.user) {
        onUpdateUser(data.user);
      }

      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Account password updated successfully!', 'Password Updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error changing password';
      toast.error(msg, 'Password Change Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="glass-card max-w-md w-full rounded-3xl p-6 space-y-5 shadow-2xl bg-white/95 border border-white/80 relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-orange-100/80 text-[#FF6B00]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-800 tracking-tight">Profile Settings</h3>
              <p className="text-xs text-slate-500 font-medium">Manage your personal information &amp; account security</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1.5 p-1 bg-slate-100/80 rounded-2xl">
          <button
            type="button"
            onClick={() => { setActiveTab('profile'); setError(null); setSuccessMsg(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile Info</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('security'); setError(null); setSuccessMsg(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'security'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Password</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('face_id'); setError(null); setSuccessMsg(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'face_id'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ScanFace className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>AI Face ID</span>
            {hasRegisteredFace ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Active" />
            ) : (
              <span className="text-[9px] px-1 py-0.2 rounded bg-orange-100 text-[#FF6B00] font-mono shrink-0">New</span>
            )}
          </button>
        </div>

        {/* Alert Messages */}
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

        {/* TAB 1: PROFILE INFO & PICTURE */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            
            {/* Avatar Upload Section */}
            <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80">
              <div className="relative group shrink-0">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-[#FF6B00] text-white flex items-center justify-center font-black text-lg border-2 border-white shadow-md">
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
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
                <h4 className="text-xs font-bold text-slate-800">Avatar Photo</h4>
                <p className="text-[11px] text-slate-500">Upload a profile picture for your account identity.</p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <label className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold hover:bg-slate-50 cursor-pointer shadow-2xs">
                    Upload Photo
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
                      className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-[11px] font-bold hover:bg-rose-100 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Readonly Metadata Badges */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">User ID</span>
                <p className="text-xs font-black text-slate-700 mt-0.5">{user.id}</p>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Role &amp; Grade</span>
                <p className="text-xs font-black text-slate-700 mt-0.5">
                  <span className="capitalize">{user.role}</span> {user.grade && `(${user.grade})`}
                </p>
              </div>
            </div>

            {/* Input Fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name / Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs glass-input font-medium text-slate-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email@company.com"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs glass-input font-medium text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phone / WhatsApp
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+62 812 3456 789"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs glass-input font-medium text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200/80">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl btn-orange text-white text-xs font-black hover:scale-[1.02] active:scale-[0.98] transition flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{loading ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </div>

          </form>
        )}

        {/* TAB 2: CHANGE PASSWORD */}
        {activeTab === 'security' && (
          <form onSubmit={handleChangePassword} className="space-y-3.5">
            
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Current Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-3.5 h-3.5" />
                </div>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs glass-input font-medium text-slate-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimum 3 characters"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs glass-input font-medium text-slate-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3.5 py-2 rounded-xl text-xs glass-input font-medium text-slate-900"
                required
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200/80">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-black hover:bg-slate-800 transition flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{loading ? 'Changing...' : 'Update Password'}</span>
              </button>
            </div>

          </form>
        )}

        {/* TAB 3: FACE ID AI */}
        {activeTab === 'face_id' && (
          <div className="space-y-4">
            
            <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-[#FF6B00] border border-orange-500/30 flex items-center justify-center">
                    <ScanFace className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Face ID Biometric Login</span>
                      <Sparkles className="w-3 h-3 text-[#FF6B00]" />
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Neural network 68-point facial landmark verification via TensorFlow.
                    </p>
                  </div>
                </div>

                {hasRegisteredFace ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center gap-1 shrink-0">
                    <Check className="w-3 h-3" />
                    <span>Active</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-400 shrink-0">
                    Not Registered
                  </span>
                )}
              </div>

              {/* Details & Actions */}
              {hasRegisteredFace ? (
                <div className="pt-2 border-t border-slate-800/80 space-y-3">
                  <div className="flex items-center gap-3 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                    {user?.face_photo ? (
                      <img 
                        src={user.face_photo} 
                        alt="Registered Face" 
                        className="w-12 h-12 rounded-xl object-cover border border-orange-500/40 shadow-sm"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-orange-500/20 text-[#FF6B00] border border-orange-500/30 flex items-center justify-center font-bold">
                        <ScanFace className="w-6 h-6" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-200">Face ID Registered</div>
                      <div className="text-[10px] text-slate-400">
                        {user?.face_registered_at 
                          ? `Registered on: ${user.face_registered_at.substring(0, 10)}`
                          : '128-d Biometric Vector Active'}
                      </div>
                      <div className="text-[9px] font-mono text-emerald-400 mt-0.5">
                        ✓ Ready for passwordless sign in
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowFaceRegisterModal(true)}
                      className="flex-1 py-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-[#FF6B00] border border-orange-500/30 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Rescan Face</span>
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleDeleteFaceId}
                      className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      title="Delete Face ID"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-800/80 space-y-3">
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Your face is not yet enrolled. Register your AI biometric Face ID for instant login without typing passwords.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowFaceRegisterModal(true)}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#E05600] text-white text-xs font-black hover:from-[#E05600] hover:to-[#C04600] transition flex items-center justify-center gap-2 shadow-lg shadow-orange-950/40 cursor-pointer active:scale-98"
                  >
                    <ScanFace className="w-4 h-4" />
                    <span>Enroll AI Face ID Now</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200/80">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        )}

      </div>

      {/* AI Face ID Registration Modal */}
      {showFaceRegisterModal && (
        <FaceIdLoginModal
          isOpen={showFaceRegisterModal}
          mode="register"
          userId={user?.id}
          onClose={() => setShowFaceRegisterModal(false)}
          onSuccess={(res: UserSessionData | any) => {
            setShowFaceRegisterModal(false);
            if (res) {
              toast.success('AI Face ID biometrics scanned and saved successfully!', 'Face ID Enrolled');
              onUpdateUser({
                ...user,
                ...res,
                face_descriptor: res.face_descriptor || user.face_descriptor,
                face_photo: res.face_photo || user.face_photo,
                face_registered_at: res.face_registered_at || user.face_registered_at
              });
            }
          }}
        />
      )}
    </div>
  );
}
