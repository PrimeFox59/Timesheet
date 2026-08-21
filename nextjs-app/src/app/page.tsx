'use client';

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
import ProfileSettingsModal from '@/components/ProfileSettingsModal';
import { apiUrl } from '@/lib/api';
import { Clock, Layers, ShieldCheck, Database, Sliders, Users, Server, LogIn, Lock, User as UserIcon, AlertCircle, FileCheck, BarChart3 } from 'lucide-react';


export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Navigation categories: 'timesheet' | 'user_management' | 'codex' | 'audit_log' | 'database'
  const [activeCategory, setActiveCategory] = useState<string>('timesheet');
  // Sub-tabs: 'timesheet_entry' | 'activity_log' | 'user_directory' | 'master_edit' | 'user_settings' | 'codex_monitoring' | 'workhour_analytics' | 'audit_log' | 'database_migration'
  const [activeSubTab, setActiveSubTab] = useState<string>('timesheet_entry');

  // Custom setters that automatically persist active category and sub-tab to localStorage
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

  // Master lists (Default area list: GCP, SAP, ER, SM, SC, CMN, ET)
  const [areasList, setAreasList] = useState<string[]>(['GCP', 'SAP', 'ER', 'SM', 'SC', 'CMN', 'ET']);
  const [usersList, setUsersList] = useState<any[]>([]);

  // Login form state
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

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

  // Restore user session AND last opened menu/tab from localStorage on initial page load (F5 refresh support)
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('metso_user_session');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.id) {
          setUser(parsed);
        }
      }

      const savedCategory = localStorage.getItem('metso_active_category');
      const savedSubTab = localStorage.getItem('metso_active_subtab');

      if (savedCategory) {
        setActiveCategory(savedCategory);
      }
      if (savedSubTab) {
        setActiveSubTab(savedSubTab);
      }
    } catch (e) {
      console.error("Error restoring user session & active tab", e);
    } finally {
      setIsInitializing(false);
    }

    fetchMasterAreas();
    fetchMasterUsers();
  }, [fetchMasterAreas, fetchMasterUsers]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);

    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: loginId.trim(), password: loginPassword })
      });


      const data = await res.json();

      if (data.success && data.user) {
        setUser(data.user);
        localStorage.setItem('metso_user_session', JSON.stringify(data.user));
        
        // Restore last saved tab or default to timesheet_entry
        const savedCategory = localStorage.getItem('metso_active_category') || 'timesheet';
        const savedSubTab = localStorage.getItem('metso_active_subtab') || 'timesheet_entry';

        setActiveCategory(savedCategory);
        setActiveSubTab(savedSubTab);
      } else {
        setLoginError(data.error || 'Invalid credentials');
      }
    } catch (err: any) {
      setLoginError('Network error logging in');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('metso_user_session');
    setLoginId('');
    setLoginPassword('');
    changeCategory('timesheet');
    changeSubTab('timesheet_entry');
  };

  const handleUpdateUserSession = (updatedUser: any) => {
    setUser(updatedUser);
    localStorage.setItem('metso_user_session', JSON.stringify(updatedUser));
  };

  // Role permissions: superuser has 100% open access to all features!
  const isSuperUser = user?.role === 'superuser' || user?.role?.toLowerCase() === 'superuser';
  const isSiteAdmin = user?.role === 'Site Admin' || isSuperUser;
  const isDirector = user?.role?.includes('Director') || isSiteAdmin;

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
    <div className="min-h-screen flex flex-col">
      
      <Navbar
        user={user}
        onLogout={handleLogout}
        onOpenProfileSettings={() => setShowProfileModal(true)}
      />

      {/* Realtime Socket RTC Provider (In-app SSE stream) */}
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
        <Sidebar
          user={user}
          activeCategory={activeCategory}
          setActiveCategory={changeCategory}
          activeSubTab={activeSubTab}
          setActiveSubTab={changeSubTab}
        />
      )}

      <main className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 transition-all duration-300 ${
        user ? 'pl-20 sm:pl-24' : ''
      }`}>
        
        {!user ? (
          /* LOGIN SCREEN */
          <div className="max-w-md mx-auto my-12 animate-in fade-in zoom-in-95 duration-200">
            <div className="glass-card rounded-3xl p-8 space-y-6 shadow-2xl relative overflow-hidden">
              
              <div className="text-center py-2">
                <img
                  src={apiUrl("/logo.png")}
                  alt="Metso"
                  className="h-16 max-w-[280px] mx-auto object-contain drop-shadow-md"
                />
              </div>

              {loginError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-[#FF6B00]" />
                    User ID
                  </label>
                  <input
                    type="text"
                    value={loginId}
                    onChange={e => setLoginId(e.target.value)}
                    placeholder="Enter your User ID"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs glass-input font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#FF6B00]" />
                    Password
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs glass-input font-medium"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loggingIn}
                  className="w-full py-3 rounded-xl text-xs font-extrabold btn-orange shadow-lg flex items-center justify-center gap-2 mt-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{loggingIn ? 'Authenticating...' : 'Sign In'}</span>
                </button>
              </form>


            </div>
          </div>
        ) : (
          /* LOGGED IN DASHBOARD */
          <div className="space-y-6">
            
            {/* Sub-Tab Navigation Header Pills */}
            <div className="glass-card rounded-2xl p-2 flex flex-wrap gap-2 shadow-sm border border-white/80">
              
              {activeCategory === 'timesheet' && (
                <>
                  <button
                    onClick={() => changeSubTab('timesheet_entry')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                      activeSubTab === 'timesheet_entry' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>Input Timesheet</span>
                  </button>

                  <button
                    onClick={() => changeSubTab('activity_log')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                      activeSubTab === 'activity_log' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>Activity Log</span>
                  </button>

                  <button
                    onClick={() => changeSubTab('user_settings')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                      activeSubTab === 'user_settings' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                    }`}
                  >
                    <Sliders className="w-4 h-4" />
                    <span>User Settings</span>
                  </button>
                </>
              )}

              {activeCategory === 'user_management' && (
                <>
                  <button
                    onClick={() => changeSubTab('user_directory')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                      activeSubTab === 'user_directory' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>User Directory</span>
                  </button>

                  {isSiteAdmin && (
                    <button
                      onClick={() => changeSubTab('master_edit')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                        activeSubTab === 'master_edit' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                      }`}
                    >
                      <Database className="w-4 h-4" />
                      <span>Master Edit</span>
                    </button>
                  )}

                  <button
                    onClick={() => changeSubTab('user_settings')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                      activeSubTab === 'user_settings' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                    }`}
                  >
                    <Sliders className="w-4 h-4" />
                    <span>User Settings</span>
                  </button>
                </>
              )}

              {activeCategory === 'codex' && isDirector && (
                <>
                  <button
                    onClick={() => changeSubTab('codex_monitoring')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                      activeSubTab === 'codex_monitoring' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                    }`}
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>Codex Monitoring &amp; Approval</span>
                  </button>

                  <button
                    onClick={() => changeSubTab('workhour_analytics')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                      activeSubTab === 'workhour_analytics' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Work Hour Analytics Dashboard</span>
                  </button>
                </>
              )}

              {activeCategory === 'audit_log' && isDirector && (
                <button
                  onClick={() => changeSubTab('audit_log')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
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
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                    activeSubTab === 'database_migration' ? 'btn-orange shadow scale-[1.02]' : 'text-slate-600 hover:bg-white/60'
                  }`}
                >
                  <Server className="w-4 h-4" />
                  <span>Database &amp; Excel Migration</span>
                </button>
              )}

            </div>

            {/* Smooth Animated Tab Content Container */}
            <div key={activeSubTab} className="animate-in fade-in zoom-in-95 duration-200 ease-out">
              {activeSubTab === 'timesheet_entry' && (
                <TimesheetEntryTab user={user} areasList={areasList} />
              )}

              {activeSubTab === 'activity_log' && (
                <ActivityLogTab currentUser={user} usersList={usersList} areasList={areasList} />
              )}

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

              {activeSubTab === 'codex_monitoring' && isDirector && (
                <CodexTab currentUser={user} usersList={usersList} />
              )}

              {activeSubTab === 'workhour_analytics' && isDirector && (
                <WorkhourAnalyticsTab currentUser={user} />
              )}

              {activeSubTab === 'audit_log' && isDirector && (
                <AuditLogTab currentUser={user} />
              )}

              {activeSubTab === 'database_migration' && isDirector && (
                <DatabaseManagementTab
                  currentUser={user}
                  onRefreshAll={async () => {
                    await fetchMasterAreas();
                    await fetchMasterUsers();
                    const primeSession = {
                      id: 'prime',
                      username: 'Prime Admin',
                      role: 'superuser',
                      grade: 'A',
                      preferred_areas: 'CMN',
                      preferred_shift: 'Day Shift',
                      number_of_areas: 2
                    };
                    handleUpdateUserSession(primeSession);
                  }}
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
        <div className="text-[11px] text-slate-500 font-medium">Developed by Galih &amp; Iqlima</div>
      </footer>



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
