'use client';

import React, { useState } from 'react';
import { Sliders, Save, CheckCircle, AlertCircle, User as UserIcon } from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface UserSettingsTabProps {
  currentUser: any;
  areasList: string[];
  onUpdateUser?: (updated: any) => void;
}

export default function UserSettingsTab({ currentUser, areasList, onUpdateUser }: UserSettingsTabProps) {
  // Preferences form state
  const [username, setUsername] = useState(currentUser?.username || '');
  const [preferredShift, setPreferredShift] = useState(currentUser?.preferred_shift || 'Day Shift');
  const [numAreas, setNumAreas] = useState<number>(currentUser?.number_of_areas !== undefined ? Number(currentUser.number_of_areas) : 2);

  // Parse preferred areas into array of 4 items for columns 1, 2, 3, 4
  const parsePrefAreas = (prefStr: string): string[] => {
    const raw = (prefStr || '').split(',').map((s: string) => s.trim());
    return [
      raw[0] || (areasList[0] || 'CMN'),
      raw[1] || '',
      raw[2] || '',
      raw[3] || ''
    ];
  };

  const [columnAreas, setColumnAreas] = useState<string[]>(() => parsePrefAreas(currentUser?.preferred_areas));

  const handleSetColumnArea = (colIdx: number, area: string) => {
    setColumnAreas(prev => {
      const next = [...prev];
      next[colIdx] = area;
      return next;
    });
  };

  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefMsg, setPrefMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrefs(true);
    setPrefMsg(null);

    const finalPrefAreas = columnAreas.slice(0, numAreas).join(',');

    try {
      const res = await fetch(apiUrl('/api/user/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_preferences',
          user_id: currentUser?.id,
          username: username.trim(),
          preferred_shift: preferredShift,
          number_of_areas: numAreas,
          preferred_areas: finalPrefAreas
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
            preferred_areas: finalPrefAreas
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
                Number of Area Columns in Entry UI ({numAreas} {numAreas === 1 ? 'Column' : 'Columns'})
              </label>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {[1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNumAreas(n)}
                    className={`py-2 rounded-xl text-xs font-bold transition border cursor-pointer active:scale-95 ${
                      numAreas === n
                        ? 'btn-orange shadow-md border-transparent'
                        : 'bg-white/60 text-slate-700 border-slate-200 hover:bg-white'
                    }`}
                  >
                    {n} {n === 1 ? 'Column' : 'Columns'}
                  </button>
                ))}
              </div>
            </div>

            {/* Preferred Work Areas */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-bold text-slate-700">
                  {numAreas === 1 ? 'Preferred Work Area' : 'Preferred Work Area per Column'}
                </label>
                <span className="text-[10px] font-semibold text-slate-500">
                  {numAreas === 1 ? 'Choose default area for entry' : `Configure default area for each of your ${numAreas} columns`}
                </span>
              </div>

              {numAreas === 1 ? (
                /* Single Column UI */
                <div className="p-4 rounded-2xl bg-white/70 border border-slate-200/90 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />
                      Column 1 (Area 1)
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-[#FF6B00] border border-orange-200">
                      Default: {columnAreas[0] || 'CMN'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {areasList.map(area => {
                      const isSelected = (columnAreas[0] || 'CMN') === area;
                      return (
                        <button
                          key={area}
                          type="button"
                          onClick={() => handleSetColumnArea(0, area)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition border cursor-pointer active:scale-95 ${
                            isSelected
                              ? 'bg-gradient-to-r from-[#FF6B00] to-[#E05B00] text-white border-transparent shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-orange-50/50 hover:border-orange-200'
                          }`}
                        >
                          {area}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Multi-Column Grid UI */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Array.from({ length: numAreas }).map((_, colIdx) => {
                    const selectedArea = columnAreas[colIdx] || '';
                    return (
                      <div
                        key={colIdx}
                        className="p-3.5 rounded-2xl bg-white/70 border border-slate-200/90 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />
                            Column {colIdx + 1} (Area {colIdx + 1})
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            selectedArea 
                              ? 'bg-orange-50 text-[#FF6B00] border border-orange-200' 
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {selectedArea ? `Default: ${selectedArea}` : 'None'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {colIdx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleSetColumnArea(colIdx, '')}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition border cursor-pointer active:scale-95 ${
                                !selectedArea
                                  ? 'bg-slate-800 text-white border-transparent shadow-xs'
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              None
                            </button>
                          )}
                          {areasList.map(area => {
                            const isSelected = selectedArea === area;
                            return (
                              <button
                                key={area}
                                type="button"
                                onClick={() => handleSetColumnArea(colIdx, area)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition border cursor-pointer active:scale-95 ${
                                  isSelected
                                    ? 'bg-[#FF6B00] text-white border-transparent shadow-xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-orange-50/50 hover:border-orange-200'
                                }`}
                              >
                                {area}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
