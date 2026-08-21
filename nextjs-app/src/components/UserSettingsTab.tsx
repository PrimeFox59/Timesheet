'use client';

import React, { useState } from 'react';
import { Sliders, Save, CheckCircle, AlertCircle, User as UserIcon } from 'lucide-react';

interface UserSettingsTabProps {
  currentUser: any;
  areasList: string[];
  onUpdateUser?: (updated: any) => void;
}

export default function UserSettingsTab({ currentUser, areasList, onUpdateUser }: UserSettingsTabProps) {
  // Preferences form state
  const [username, setUsername] = useState(currentUser?.username || '');
  const [preferredShift, setPreferredShift] = useState(currentUser?.preferred_shift || 'Day Shift');
  const [numAreas, setNumAreas] = useState<number>(currentUser?.number_of_areas || 2);
  const [preferredArea, setPreferredArea] = useState(currentUser?.preferred_areas || 'CMN');

  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefMsg, setPrefMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrefs(true);
    setPrefMsg(null);

    try {
      const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_preferences',
          user_id: currentUser?.id,
          username: username.trim(),
          preferred_shift: preferredShift,
          number_of_areas: numAreas,
          preferred_areas: preferredArea
        })
      });

      const data = await res.json();

      if (data.success) {
        setPrefMsg({ type: 'success', text: 'Work preferences updated successfully!' });
        if (onUpdateUser) {
          onUpdateUser({
            username: username.trim(),
            preferred_shift: preferredShift,
            number_of_areas: numAreas,
            preferred_areas: preferredArea
          });
        }
      } else {
        setPrefMsg({ type: 'error', text: data.error || 'Failed to save preferences' });
      }
    } catch (err: any) {
      setPrefMsg({ type: 'error', text: 'Network error saving preferences' });
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="space-y-6 animate-smooth-fade">
      
      {/* Header Banner */}
      <div className="glass-card rounded-2xl p-6 shadow-sm border border-white/80">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Sliders className="w-5 h-5 text-[#FF6B00]" />
          User Profile Settings
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Customize your personal preferences, preferred shift, area allocations, and grid layout.
        </p>
      </div>

      {/* Main Form Container */}
      <div className="max-w-2xl mx-auto">
        <div className="glass-card rounded-3xl p-6 space-y-5 border border-white/80 shadow-md">
          
          <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
            <UserIcon className="w-4 h-4 text-[#FF6B00]" />
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Work Preferences & UI Layout
            </h3>
          </div>

          {prefMsg && (
            <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              prefMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {prefMsg.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{prefMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleSavePreferences} className="space-y-4 text-xs">
            
            {/* Username */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-3.5 py-2.5 rounded-xl glass-input font-medium"
                required
              />
            </div>

            {/* Preferred Shift */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Preferred Shift</label>
              <select
                value={preferredShift}
                onChange={e => setPreferredShift(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl glass-input font-semibold"
              >
                <option value="Day Shift">Day Shift</option>
                <option value="Night Shift">Night Shift</option>
              </select>
            </div>

            {/* Number of Area Columns */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Number of Area Columns in Entry UI ({numAreas} Columns)
              </label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {[2, 3, 4].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNumAreas(n)}
                    className={`py-2 rounded-xl text-xs font-bold transition border ${
                      numAreas === n
                        ? 'btn-orange shadow-md border-transparent'
                        : 'bg-white/60 text-slate-700 border-slate-200 hover:bg-white'
                    }`}
                  >
                    {n} Columns
                  </button>
                ))}
              </div>
            </div>

            {/* Preferred Work Areas */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Preferred Work Areas</label>
              <div className="flex flex-wrap gap-2">
                {areasList.map(area => {
                  const isSelected = preferredArea === area;
                  return (
                    <button
                      key={area}
                      type="button"
                      onClick={() => setPreferredArea(area)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition border ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#FF6B00] to-[#E05B00] text-white border-transparent shadow-sm'
                          : 'bg-white/60 text-slate-700 border-slate-200 hover:bg-white'
                      }`}
                    >
                      {area}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={savingPrefs}
                className="w-full py-3 rounded-xl text-xs font-extrabold btn-orange shadow-lg flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{savingPrefs ? 'Saving...' : 'Save Preferences'}</span>
              </button>
            </div>

          </form>

        </div>
      </div>

    </div>
  );
}
