'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Sparkles, CheckCircle2, AlertCircle, RefreshCw, FileSpreadsheet, Download } from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface TimesheetEntryTabProps {
  user: any;
  areasList: string[];
  systemSettings?: Record<string, boolean | string>;
}

interface DayRowState {
  dateStr: string;
  dayName: string;
  hours: number;
  overtime: number;
  areas: string[];
  shift: string;
  remark: string;
}

export default function TimesheetEntryTab({ user, areasList, systemSettings }: TimesheetEntryTabProps) {
  // Default date range matching Monday of current week to Sunday of current week
  const getInitialDates = () => {
    const today = new Date();
    // Monday = 0, Tuesday = 1, ..., Sunday = 6
    const dayOfWeek = (today.getDay() + 6) % 7;
    
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek);
    const sunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (6 - dayOfWeek));

    const formatYMD = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    return {
      start: formatYMD(monday),
      end: formatYMD(sunday)
    };
  };

  const initialDates = getInitialDates();
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);

  const numAreas = user?.number_of_areas || 2;
  const initialPrefAreas = (user?.preferred_areas || '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);

  const getInitialAreas = () => {
    const list: string[] = [];
    for (let i = 0; i < numAreas; i++) {
      if (i === 0) {
        list.push(initialPrefAreas[0] || areasList[0] || 'CMN');
      } else {
        list.push(initialPrefAreas[i] || '');
      }
    }
    return list;
  };

  const defaultShift = user?.preferred_shift || 'Day Shift';

  // Excel-like Grid Rows State
  const [rows, setRows] = useState<DayRowState[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch saved timesheet records from database and populate table grid
  useEffect(() => {
    if (!startDate || !endDate || !user?.id) return;

    let isMounted = true;
    setLoading(true);

    const loadTimesheetData = async () => {
      try {
        const res = await fetch(apiUrl(`/api/timesheet?userId=${encodeURIComponent(user.id)}&startDate=${startDate}&endDate=${endDate}`));
        const data = await res.json();

        const savedMap = new Map<string, any>();
        
        if (data.success && Array.isArray(data.data)) {
          data.data.forEach((rec: any) => {
            savedMap.set(rec.date, rec);
          });
        }

        const [sY, sM, sD] = startDate.split('-').map(Number);
        const [eY, eM, eD] = endDate.split('-').map(Number);

        const cur = new Date(sY, sM - 1, sD);
        const end = new Date(eY, eM - 1, eD);

        if (isNaN(cur.getTime()) || isNaN(end.getTime()) || cur > end) {
          if (isMounted) setRows([]);
          return;
        }

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const newRows: DayRowState[] = [];

        while (cur <= end) {
          const yyyy = cur.getFullYear();
          const mm = String(cur.getMonth() + 1).padStart(2, '0');
          const dd = String(cur.getDate()).padStart(2, '0');
          const dateStr = `${yyyy}-${mm}-${dd}`;
          const dayIndex = cur.getDay();
          const dayName = dayNames[dayIndex];

          const saved = savedMap.get(dateStr);

          if (saved) {
            // Populate from saved database record
            const savedAreas: string[] = [];
            const rawSaved = [saved.area1, saved.area2, saved.area3, saved.area4];
            for (let i = 0; i < numAreas; i++) {
              if (i === 0) {
                savedAreas.push(rawSaved[0] || initialPrefAreas[0] || areasList[0] || 'CMN');
              } else {
                savedAreas.push(rawSaved[i] || '');
              }
            }
            newRows.push({
              dateStr,
              dayName,
              hours: Number(saved.working_hours ?? saved.hours) || 0,
              overtime: Number(saved.overtime_hours ?? saved.overtime) || 0,
              areas: savedAreas,
              shift: saved.shift || defaultShift,
              remark: saved.remark || ''
            });
          } else {
            // Unfilled date defaults to 0 hours (as requested: unfilled defaults to 0)
            newRows.push({
              dateStr,
              dayName,
              hours: 0,
              overtime: 0,
              areas: getInitialAreas(),
              shift: defaultShift,
              remark: ''
            });
          }

          cur.setDate(cur.getDate() + 1);
        }

        if (isMounted) {
          setRows(newRows);
        }
      } catch (e) {
        console.error("Failed to load saved timesheet entries", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadTimesheetData();

    return () => {
      isMounted = false;
    };
  }, [startDate, endDate, user?.id, numAreas]);

  // Row edit handlers
  const handleCellChange = (index: number, field: keyof DayRowState, val: any) => {
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleRowAreaChange = (rowIndex: number, areaIndex: number, val: string) => {
    setRows(prev => {
      const next = [...prev];
      const areasCopy = [...next[rowIndex].areas];
      areasCopy[areaIndex] = val;
      next[rowIndex] = { ...next[rowIndex], areas: areasCopy };
      return next;
    });
  };

  // Quick action helper: Set 8h Mon-Fri
  const fillAllWeekdays8h = () => {
    setRows(prev => prev.map(r => ({
      ...r,
      hours: (r.dayName === 'Saturday' || r.dayName === 'Sunday') ? 0 : 8
    })));
  };

  const setAllShift = (targetShift: string) => {
    setRows(prev => prev.map(r => ({ ...r, shift: targetShift })));
  };

  // Export Metso v2 Template Excel
  const handleExportMetsoTemplate = () => {
    if (!startDate || !user?.id) return;
    const month = startDate.substring(0, 7); // YYYY-MM
    window.open(apiUrl(`/api/timesheet/export-template?userId=${encodeURIComponent(user.id)}&month=${encodeURIComponent(month)}`), '_blank');
  };

  // Calculations
  const totalRegHours = rows.reduce((acc, r) => acc + (Number(r.hours) || 0), 0);
  const totalOvertimeHours = rows.reduce((acc, r) => acc + (Number(r.overtime) || 0), 0);

  // Formatting date range label (e.g. 17-Aug-2026 ➔ 23-Aug-2026)
  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const dateObj = new Date(y, m - 1, d);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${String(d).padStart(2, '0')}-${months[dateObj.getMonth()]}-${y}`;
  };

  const handleSubmitTimesheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rows.length === 0) {
      setMessage({ type: 'error', text: 'Please select a valid date range with entries.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const entries = rows.map(r => ({
      date: r.dateStr,
      day: r.dayName,
      hours: Number(r.hours) || 0,
      overtime: Number(r.overtime) || 0,
      area1: r.areas[0] || '',
      area2: r.areas[1] || '',
      area3: r.areas[2] || '',
      area4: r.areas[3] || '',
      shift: r.shift,
      remark: r.remark
    }));

    try {
      const res = await fetch(apiUrl('/api/timesheet'), {
        method: 'POST',

        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          username: user.username,
          entries
        })
      });

      const data = await res.json();
      if (data.success) {
        setMessage({
          type: 'success',
          text: `Timesheet successfully submitted/saved!`
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to submit timesheet' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Network error submitting timesheet' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 animate-smooth-fade">
      
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-xs font-semibold ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Date Range Selection Bar */}
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 w-full">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#FF6B00]" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs glass-input font-medium"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#FF6B00]" />
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs glass-input font-medium"
                required
              />
            </div>
          </div>
        </div>

        {startDate && endDate && (
          <div className="text-xs font-bold text-slate-700 pt-1 flex items-center gap-2">
            <span className="text-slate-500 font-medium">Date Range:</span>
            <span className="px-2.5 py-1 rounded-lg bg-orange-100/80 text-orange-950 font-mono text-xs border border-orange-200">
              {formatDateLabel(startDate)} &rarr; {formatDateLabel(endDate)}
            </span>
            <span className="text-slate-400 font-normal">({rows.length} days)</span>
          </div>
        )}
      </div>

      {/* Main Excel-like Data Grid Table */}
      <form onSubmit={handleSubmitTimesheet} className="space-y-4">
        
        <div className="glass-card rounded-2xl p-5 space-y-4 overflow-hidden border border-white/80">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FF6B00]" />
                Enter Timesheet Details
              </h3>
              <p className="text-[11px] text-slate-500">
                Unfilled dates default to 0 hrs. Saved entries load automatically. Click Submit Timesheet when ready.
              </p>
            </div>

            {/* Quick Helper Actions */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={fillAllWeekdays8h}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-950 border border-orange-300 font-semibold transition shadow-xs"
              >
                Fill 8h Mon-Fri
              </button>
              <button
                type="button"
                onClick={() => setAllShift('Day Shift')}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-slate-700 border border-slate-200 font-medium transition shadow-xs"
              >
                All Day Shift
              </button>
              <button
                type="button"
                onClick={() => setAllShift('Night Shift')}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-slate-700 border border-slate-200 font-medium transition shadow-xs"
              >
                All Night Shift
              </button>
            </div>
          </div>

          {/* Interactive Excel Grid */}
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto rounded-xl border border-slate-200/80 shadow-inner">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-900/90 text-slate-100 font-semibold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-3 w-28">Date</th>
                  <th className="px-3 py-3 w-28">Day</th>
                  <th className="px-3 py-3 w-32 text-center">Working Hours</th>
                  <th className="px-3 py-3 w-32 text-center">Overtime Hours</th>
                  {Array.from({ length: numAreas }).map((_, idx) => (
                    <th key={idx} className="px-3 py-3 w-36">
                      Area {idx + 1}
                    </th>
                  ))}
                  <th className="px-3 py-3 w-36">Shift</th>
                  <th className="px-3 py-3 min-w-[200px]">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 font-medium bg-white/50">
                {loading ? (
                  <tr>
                    <td colSpan={6 + numAreas} className="px-4 py-8 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-[#FF6B00]" />
                        <span>Loading saved timesheet entries...</span>
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6 + numAreas} className="px-4 py-8 text-center text-slate-400">
                      No dates in range. Please select valid Start and End dates.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rIdx) => {
                    const isWeekend = row.dayName === 'Saturday' || row.dayName === 'Sunday';
                    return (
                      <tr
                        key={row.dateStr}
                        className={`hover:bg-orange-50/50 transition ${isWeekend ? 'bg-slate-100/50 text-slate-600' : ''}`}
                      >
                        {/* Date Cell */}
                        <td className="px-3 py-2 font-mono text-[11px] font-semibold text-slate-900 whitespace-nowrap">
                          {row.dateStr}
                        </td>

                        {/* Day Cell */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`text-[11px] ${isWeekend ? 'font-bold text-amber-700' : 'text-slate-700'}`}>
                            {row.dayName}
                          </span>
                        </td>

                        {/* Working Hours Input Cell */}
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="24"
                            value={row.hours}
                            onChange={e => handleCellChange(rIdx, 'hours', Number(e.target.value))}
                            className={`w-20 px-2 py-1 text-center font-bold rounded-lg border focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] ${
                              row.hours > 0 ? 'bg-white text-slate-900 border-slate-300' : 'bg-slate-50 text-slate-400 border-slate-200'
                            }`}
                          />
                        </td>

                        {/* Overtime Hours Input Cell */}
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="16"
                            value={row.overtime}
                            onChange={e => handleCellChange(rIdx, 'overtime', Number(e.target.value))}
                            className={`w-20 px-2 py-1 text-center font-bold rounded-lg border focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] ${
                              row.overtime > 0 ? 'bg-white text-[#FF6B00] border-orange-300' : 'bg-slate-50 text-slate-400 border-slate-200'
                            }`}
                          />
                        </td>

                        {/* Dynamic Area Columns Dropdowns */}
                        {Array.from({ length: numAreas }).map((_, aIdx) => (
                          <td key={aIdx} className="px-2 py-1.5">
                            <select
                              value={row.areas[aIdx] || (aIdx === 0 ? (areasList[0] || 'CMN') : '')}
                              onChange={e => handleRowAreaChange(rIdx, aIdx, e.target.value)}
                              className="w-full px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white/90 focus:border-[#FF6B00]"
                              required={aIdx === 0}
                            >
                              {aIdx > 0 && <option value="">-- None --</option>}
                              {areasList.map(a => (
                                <option key={a} value={a}>{a}</option>
                              ))}
                            </select>
                          </td>
                        ))}

                        {/* Shift Dropdown */}
                        <td className="px-2 py-1.5">
                          <select
                            value={row.shift}
                            onChange={e => handleCellChange(rIdx, 'shift', e.target.value)}
                            className="w-full px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white/90 focus:border-[#FF6B00]"
                          >
                            <option value="Day Shift">Day Shift</option>
                            <option value="Night Shift">Night Shift</option>
                          </select>
                        </td>

                        {/* Remarks Input Cell */}
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={row.remark}
                            onChange={e => handleCellChange(rIdx, 'remark', e.target.value)}
                            placeholder="Common, Commissioning, etc."
                            className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white/90 focus:border-[#FF6B00]"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Grid Summary Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-orange-50/80 border border-orange-200/80 text-xs font-semibold text-orange-950">
            <div className="flex items-center gap-4">
              <span>Total Days: <strong>{rows.length}</strong></span>
              <span>Reg Hours: <strong className="text-slate-900">{totalRegHours} hrs</strong></span>
              <span>Overtime: <strong className="text-[#FF6B00]">{totalOvertimeHours} hrs</strong></span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {(user?.id?.toLowerCase() === 'prime' || user?.role?.toLowerCase() === 'superuser' || systemSettings?.feature_excel_export !== false) && (
                <button
                  type="button"
                  onClick={handleExportMetsoTemplate}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow transition active:scale-95 cursor-pointer"
                  title="Download filled Metso Timesheet Excel matching Timesheet_Template_v2.xlsx"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export Metso Excel</span>
                </button>
              )}

              <button
                type="submit"
                disabled={submitting || rows.length === 0}
                className="px-6 py-2.5 rounded-xl text-xs font-bold btn-orange flex items-center gap-2 shadow-md w-full sm:w-auto justify-center transition active:scale-95 cursor-pointer"
              >
                {submitting ? (
                  <span>Submitting...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit Timesheet</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

      </form>

    </div>
  );
}
