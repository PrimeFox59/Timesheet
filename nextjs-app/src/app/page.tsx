'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import RealtimeSocketProvider from '@/components/RealtimeSocketProvider';
import TimesheetEntryTab from '@/components/TimesheetEntryTab';
import ActivityLogTab from '@/components/ActivityLogTab';
import AuditLogTab from '@/components/AuditLogTab';
import MasterEditTab from '@/components/MasterEditTab';
import UserSettingsTab from '@/components/UserSettingsTab';
import UserManagementTab from '@/components/UserManagementTab';
import DatabaseManagementTab from '@/components/DatabaseManagementTab';
import CodexTab from '@/components/CodexTab';
import WorkhourAnalyticsTab from '@/components/WorkhourAnalyticsTab';
import ProjectManagerTab from '@/components/ProjectManagerTab';
import RealtimeChatWidget from '@/components/RealtimeChatWidget';
import RightSidebarOnlineUsers from '@/components/RightSidebarOnlineUsers';
import InteractiveAppTour from '@/components/InteractiveAppTour';
import ProfileSettingsModal from '@/components/ProfileSettingsModal';
import FaceIdLoginModal from '@/components/FaceIdLoginModal';
import SuperuserTab from '@/components/SuperuserTab';
import { useToast } from '@/components/Toast';
import { apiUrl } from '@/lib/api';
import { 
  Clock, 
  Layers, 
  ShieldCheck, 
  Database, 
  Sliders, 
  Users, 
  Server, 
  LogIn, 
  Lock, 
  User as UserIcon, 
  AlertCircle, 
  FileCheck, 
  BarChart3, 
  ScanFace, 
  ShieldAlert, 
  FolderKanban, 
  CheckCircle2 
} from 'lucide-react';

export default function Home() {
  const toast = useToast();
  const [user, setUser] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showFaceIdModal, setShowFaceIdModal] = useState(false);
  const [showAppTour, setShowAppTour] = useState(false);

  // Navigation categories: 'timesheet' | 'project_manager' | 'codex' | 'user_management' | 'audit_log' | 'database' | 'superuser'
  const [activeCategory, setActiveCategory] = useState<string>('timesheet');
  // Sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<string>('timesheet_entry');

  const changeCategory = (cat: string) => {
    setActiveCategory(cat);
    try {
      localStorage.setItem('metso_active_category', cat);
    } catch (e) {}
  };

  const changeSubTab = (sub: string) => {
    setActiveSubTab(sub);
    try {
      localStorage.setItem('metso_active_subtab', sub);
    } catch (e) {}
  };

  // Master lists
  const [areasList, setAreasList] = useState<string[]>(['GCP', 'SAP', 'ER', 'SM', 'SC', 'CMN', 'ET']);
  const [usersList, setUsersList] = useState<any[]>([]);

  // Login form state
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [systemSettings, setSystemSettings] = useState<Record<string, boolean | string>>({
    menu_project_manager: true,
    feature_realtime_chat: true,
    feature_online_users: true,
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

  const fetchMasterAreas = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/master/areas'));
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        setAreasList(data.data.map((a: any) => a.name));
      }
    } catch (e) {
      console.error("Failed to fetch areas list", e);
    }
  }, []);

  const fetchMasterUsers = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/master/users'));
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setUsersList(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch users list", e);
    }
  }, []);

  const fetchSystemSettings = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/system/settings'));
      const data = await res.json();
      if (data.success && data.settings) {
        setSystemSettings(prev => ({ ...prev, ...data.settings }));
      }
    } catch (e) {
      console.error("Failed to fetch system settings", e);
    }
  }, []);

  // Check saved session on load
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('metso_user_session');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      const savedCat = localStorage.getItem('metso_active_category');
      if (savedCat) setActiveCategory(savedCat);
      const savedSub = localStorage.getItem('metso_active_subtab');
      if (savedSub) setActiveSubTab(savedSub);
    } catch (e) {}
    setIsInitializing(false);

    fetchMasterAreas();
    fetchMasterUsers();
    fetchSystemSettings();
  }, [fetchMasterAreas, fetchMasterUsers, fetchSystemSettings]);

  // Periodic heartbeat to track live presence
  useEffect(() => {
    if (!user?.id) return;
    const sendHeartbeat = async () => {
      try {
        await fetch(apiUrl('/api/realtime/heartbeat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        });
      } catch (e) {}
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginId.trim() || !loginPassword.trim()) {
      setLoginError('User ID and Password are required');
      return;
    }
    setLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: loginId.trim(), password: loginPassword })
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        try {
          localStorage.setItem('metso_user_session', JSON.stringify(data.user));
        } catch (e) {}
        toast.success(`Welcome back, ${data.user.username}!`);
      } else {
        setLoginError(data.message || data.error || 'Invalid credentials');
      }
    } catch (err: any) {
      setLoginError('Server connection failed');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    try {
      localStorage.removeItem('metso_user_session');
    } catch (e) {}
    toast.info('Logged out successfully');
  };

  const handleUpdateUserSession = (updatedUser: any) => {
    setUser(updatedUser);
    try {
      localStorage.setItem('metso_user_session', JSON.stringify(updatedUser));
    } catch (e) {}
    fetchMasterUsers();
  };

  const isSuperUser = user?.id?.toLowerCase() === 'prime' || user?.role?.toLowerCase() === 'superuser';
  const isSiteAdmin = user?.role === 'Site Admin' || user?.role?.toLowerCase()?.includes('admin') || isSuperUser;
  const isDirector = user?.role?.includes('Director') || user?.role?.toLowerCase()?.includes('director') || isSiteAdmin;

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <img
            src={apiUrl("/logo.png")}
            alt="Metso"
            className="h-16 w-auto mx-auto object-contain animate-pulse drop-shadow-xl"
          />
          <p className="text-xs font-bold text-slate-400 font-mono">Restoring session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative bg-slate-50">

      <Navbar
        user={user}
        onLogout={handleLogout}
        onOpenProfileSettings={() => setShowProfileModal(true)}
        onOpenAppTour={() => setShowAppTour(true)}
      />

      {/* Realtime Socket SSE Provider */}
      <RealtimeSocketProvider
        onTimesheetUpdated={() => {
          fetchMasterUsers();
        }}
        onUsersUpdated={() => {
          fetchMasterUsers();
        }}
        onAreasUpdated={() => {
          fetchMasterAreas();
        }}
      />

      {user && (
        <>
          <Sidebar
            user={user}
            systemSettings={systemSettings}
            activeCategory={activeCategory}
            setActiveCategory={changeCategory}
            activeSubTab={activeSubTab}
            setActiveSubTab={changeSubTab}
          />

          {/* Right Sidebar Live Online Users */}
          {(isSuperUser || systemSettings?.feature_online_users !== false) && (
            <RightSidebarOnlineUsers
              currentUser={user}
            />
          )}

          {/* Floating Realtime Chat Widget */}
          {(isSuperUser || systemSettings?.feature_realtime_chat !== false) && (
            <RealtimeChatWidget
              currentUser={user}
              usersList={usersList}
              connected={true}
            />
          )}

          {/* Interactive Walkthrough Tour */}
          <InteractiveAppTour
            user={user}
            isOpenManual={showAppTour}
            onCloseManual={() => setShowAppTour(false)}
            onNavigate={(cat, sub) => {
              changeCategory(cat);
              changeSubTab(sub);
            }}
            onOpenProfileSettings={() => setShowProfileModal(true)}
            onCloseProfileSettings={() => setShowProfileModal(false)}
          />
        </>
      )}

      <main className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 transition-all duration-300 ${
        user ? 'pl-20 sm:pl-24' : ''
      }`}>
        
        {!user ? (
          /* LOGIN SCREEN */
          <div className="max-w-md mx-auto my-12 animate-in fade-in zoom-in-95 duration-200">
            <div className="glass-card rounded-3xl p-8 space-y-6 shadow-2xl relative overflow-hidden">
              
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center p-3 bg-orange-50 rounded-2xl mb-1 shadow-xs border border-orange-100">
                  <Clock className="w-8 h-8 text-[#FF6B00]" />
                </div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">
                  Metso Commissioning
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Site Timesheet & Operations Platform
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="flex items-center gap-2 p-3 text-xs bg-red-50 text-red-600 rounded-xl border border-red-200 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    User ID
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      placeholder="e.g. prime or user ID"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] transition"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] transition"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loggingIn}
                  className="w-full btn-orange py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 active:scale-98 transition disabled:opacity-50 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{loggingIn ? 'Authenticating...' : 'Sign In'}</span>
                </button>
              </form>

              {/* AI Neural Face ID Biometrics Trigger */}
              {systemSettings?.enable_face_login !== false && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowFaceIdModal(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition active:scale-98 shadow-sm cursor-pointer"
                  >
                    <ScanFace className="w-4 h-4 text-orange-400" />
                    <span>Sign in with AI Face ID</span>
                  </button>
                </div>
              )}

            </div>
          </div>
        ) : (
          /* LOGGED IN WORKSPACE */
          <div className="space-y-6">

            {/* Sub-Tabs Floating Navigation Pill */}
            <div id="tour-subtabs" className="bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-white/90 shadow-sm inline-flex flex-wrap items-center gap-1.5 select-none">
              
              {activeCategory === 'timesheet' && (
                <>
                  <button
                    id="tour-subtab-timesheet"
                    onClick={() => changeSubTab('timesheet_entry')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeSubTab === 'timesheet_entry' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>Timesheet Entry</span>
                  </button>

                  {(isSuperUser || systemSettings?.feature_activity_log !== false) && (
                    <button
                      id="tour-subtab-activity"
                      onClick={() => changeSubTab('activity_log')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                        activeSubTab === 'activity_log' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      <span>Activity Log</span>
                    </button>
                  )}

                  <button
                    id="tour-subtab-settings"
                    onClick={() => changeSubTab('user_settings')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeSubTab === 'user_settings' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                    }`}
                  >
                    <Sliders className="w-4 h-4" />
                    <span>User Settings</span>
                  </button>
                </>
              )}

              {activeCategory === 'project_manager' && (
                <>
                  {(isSuperUser || systemSettings?.feature_gantt_chart !== false) && (
                    <button
                      onClick={() => changeSubTab('gantt_timeline')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                        activeSubTab === 'gantt_timeline' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                      }`}
                    >
                      <FolderKanban className="w-4 h-4" />
                      <span>Gantt Chart Timeline</span>
                    </button>
                  )}

                  <button
                    onClick={() => changeSubTab('project_list')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeSubTab === 'project_list' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>Project List</span>
                  </button>

                  <button
                    onClick={() => changeSubTab('task_delegation')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeSubTab === 'task_delegation' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Task Delegation</span>
                  </button>
                </>
              )}

              {activeCategory === 'codex' && isDirector && (
                <>
                  <button
                    onClick={() => changeSubTab('codex_monitoring')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeSubTab === 'codex_monitoring' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                    }`}
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>Codex Monitoring & Approval</span>
                  </button>

                  {(isSuperUser || systemSettings?.enable_workhour_analytics !== false) && (
                    <button
                      onClick={() => changeSubTab('workhour_analytics')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                        activeSubTab === 'workhour_analytics' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                      }`}
                    >
                      <BarChart3 className="w-4 h-4" />
                      <span>Work Hour Analytics Dashboard</span>
                    </button>
                  )}
                </>
              )}

              {activeCategory === 'user_management' && (
                <>
                  <button
                    onClick={() => changeSubTab('user_directory')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeSubTab === 'user_directory' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>User Directory</span>
                  </button>

                  {isSiteAdmin && (
                    <button
                      onClick={() => changeSubTab('master_edit')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                        activeSubTab === 'master_edit' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                      }`}
                    >
                      <Database className="w-4 h-4" />
                      <span>Master Edit</span>
                    </button>
                  )}

                  <button
                    onClick={() => changeSubTab('user_settings')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeSubTab === 'user_settings' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                    }`}
                  >
                    <Sliders className="w-4 h-4" />
                    <span>User Settings</span>
                  </button>
                </>
              )}

              {activeCategory === 'audit_log' && isDirector && (
                <button
                  onClick={() => changeSubTab('audit_log')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeSubTab === 'audit_log' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Audit Log</span>
                </button>
              )}

              {activeCategory === 'database' && isDirector && (
                <button
                  onClick={() => changeSubTab('database_migration')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeSubTab === 'database_migration' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                  }`}
                >
                  <Server className="w-4 h-4" />
                  <span>Database &amp; Excel Migration</span>
                </button>
              )}

              {activeCategory === 'superuser' && isSuperUser && (
                <button
                  onClick={() => changeSubTab('superuser_panel')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeSubTab === 'superuser_panel' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Superuser Feature Toggles</span>
                </button>
              )}

            </div>

            {/* Tab Content Container */}
            <div key={activeSubTab} className="animate-in fade-in zoom-in-95 duration-200 ease-out">
              
              {/* TIMESHEET TABS */}
              {activeSubTab === 'timesheet_entry' && (
                <TimesheetEntryTab user={user} areasList={areasList} systemSettings={systemSettings} />
              )}

              {activeSubTab === 'activity_log' && (
                <ActivityLogTab currentUser={user} usersList={usersList} areasList={areasList} />
              )}

              {/* PROJECT MANAGER TAB */}
              {activeCategory === 'project_manager' && (
                <ProjectManagerTab
                  currentUser={user}
                  usersList={usersList}
                  areasList={areasList}
                  activeSubTab={activeSubTab}
                />
              )}

              {/* USER MANAGEMENT TABS */}
              {activeSubTab === 'user_directory' && (
                <UserManagementTab
                  usersList={usersList}
                  currentUser={user}
                  onRefreshUsers={fetchMasterUsers}
                />
              )}

              {activeSubTab === 'master_edit' && isSiteAdmin && (
                <MasterEditTab
                  currentUser={user}
                  areasList={areasList}
                  usersList={usersList}
                  onRefreshAreas={fetchMasterAreas}
                  onRefreshUsers={fetchMasterUsers}
                />
              )}

              {activeSubTab === 'user_settings' && (
                <UserSettingsTab
                  currentUser={user}
                  areasList={areasList}
                  onUpdateUser={(updated) => handleUpdateUserSession({ ...user, ...updated })}
                />
              )}

              {/* CODEX TABS */}
              {activeSubTab === 'codex_monitoring' && isDirector && (
                <CodexTab currentUser={user} usersList={usersList} />
              )}

              {activeSubTab === 'workhour_analytics' && isDirector && (
                <WorkhourAnalyticsTab currentUser={user} />
              )}

              {/* AUDIT LOG TAB */}
              {activeSubTab === 'audit_log' && isDirector && (
                <AuditLogTab currentUser={user} />
              )}

              {/* DATABASE TAB */}
              {activeSubTab === 'database_migration' && isDirector && (
                <DatabaseManagementTab
                  currentUser={user}
                  onRefreshAll={async () => {
                    await fetchMasterAreas();
                    await fetchMasterUsers();
                  }}
                />
              )}

              {/* SUPERUSER TAB */}
              {activeSubTab === 'superuser_panel' && isSuperUser && (
                <SuperuserTab
                  currentUser={user}
                  onSettingsChanged={setSystemSettings}
                />
              )}

            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs border-t border-slate-200/50 mt-auto space-y-1 select-none">
        <div className="font-bold text-slate-700">
          Powered by{' '}
          <a
            href="https://primeprojectx.net/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FF6B00] hover:underline hover:text-[#D05600] transition"
          >
            PT Prime Infinity Systems
          </a>
        </div>
        <div className="text-[11px] text-slate-500 font-medium">
          Developed by{' '}
          <a
            href="https://www.linkedin.com/in/galihprime/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 hover:text-[#FF6B00] hover:underline transition font-semibold"
          >
            Galih
          </a>
          {' & '}
          <a
            href="https://www.linkedin.com/in/iqlimanurhayati/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 hover:text-[#FF6B00] hover:underline transition font-semibold"
          >
            Iqlima
          </a>
        </div>
      </footer>

      {/* Face ID Login Modal */}
      {showFaceIdModal && (
        <FaceIdLoginModal
          isOpen={showFaceIdModal}
          mode="login"
          onClose={() => setShowFaceIdModal(false)}
          onSuccess={(loggedInUser: any) => {
            setUser(loggedInUser);
            try {
              localStorage.setItem('metso_user_session', JSON.stringify(loggedInUser));
            } catch (e) {}
            setShowFaceIdModal(false);
            toast.success(`Face ID verified. Welcome, ${loggedInUser.username}!`);
          }}
        />
      )}

      {/* User Profile Settings Modal */}
      {showProfileModal && user && (
        <ProfileSettingsModal
          user={user}
          onClose={() => setShowProfileModal(false)}
          onUpdateUser={handleUpdateUserSession}
        />
      )}

    </div>
  );
}
