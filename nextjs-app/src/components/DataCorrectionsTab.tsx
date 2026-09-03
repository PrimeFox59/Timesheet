'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, 
  Save, 
  Trash2, 
  Copy, 
  RotateCcw, 
  FileSpreadsheet, 
  Download, 
  RefreshCw,
  AlertCircle,
  ShieldAlert
} from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { useToast } from '@/components/Toast';

interface PresensiRow {
  id: number;
  user_id: string;
  username: string;
  date: string;
  day: string;
  working_hours: number;
  hours: number;
  overtime_hours: number;
  overtime: number;
  area1: string;
  area2: string;
  area3?: string;
  area4?: string;
  shift: string;
  remark: string;
  timestamp?: string;
}

interface DataCorrectionsTabProps {
  currentUser: any;
  usersList: any[];
  areasList: string[];
}

export default function DataCorrectionsTab({
  currentUser,
  usersList,
  areasList
}: DataCorrectionsTabProps) {
  const toast = useToast();

  const [records, setRecords] = useState<PresensiRow[]>([]);
  const [initialRecords, setInitialRecords] = useState<Record<number, PresensiRow>>({});
  const [modifiedRows, setModifiedRows] = useState<Record<number, PresensiRow>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [onlyModified, setOnlyModified] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<PresensiRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch records
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedUserFilter && selectedUserFilter !== 'ALL') {
        params.append('userId', selectedUserFilter);
      }
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(apiUrl(`/api/timesheet?${params.toString()}`));
      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        const rows: PresensiRow[] = data.data;
        setRecords(rows);
        const map: Record<number, PresensiRow> = {};
        rows.forEach(r => { map[r.id] = { ...r }; });
        setInitialRecords(map);
        setModifiedRows({});
      }
    } catch (err) {
      console.error('Failed to load timesheet records for corrections:', err);
      toast.error('Failed to load timesheet records from server');
    } finally {
      setLoading(false);
    }
  }, [selectedUserFilter, startDate, endDate]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Listen to realtime timesheet_updated events
  useEffect(() => {
    const handleTimesheetUpdate = () => {
      // Don't auto-overwrite if user currently has unsaved edits
      if (Object.keys(modifiedRows).length === 0) {
        fetchRecords();
      }
    };
    window.addEventListener('timesheet_updated', handleTimesheetUpdate);
    return () => window.removeEventListener('timesheet_updated', handleTimesheetUpdate);
  }, [fetchRecords, modifiedRows]);

  // Cell change handler
  const handleCellChange = (id: number, field: keyof PresensiRow, value: any) => {
    setRecords(prev => prev.map(row => {
      if (row.id !== id) return row;
      const updated = { ...row, [field]: value };
      
      // Track modified state
      const initial = initialRecords[id];
      const isDifferent = initial && (
        String(updated.working_hours) !== String(initial.working_hours) ||
        String(updated.overtime_hours) !== String(initial.overtime_hours) ||
        String(updated.area1) !== String(initial.area1) ||
        String(updated.area2) !== String(initial.area2) ||
        String(updated.shift) !== String(initial.shift) ||
        String(updated.remark) !== String(initial.remark)
      );

      setModifiedRows(prevMod => {
        const copy = { ...prevMod };
        if (isDifferent) {
          copy[id] = updated;
        } else {
          delete copy[id];
        }
        return copy;
      });

      return updated;
    }));
  };

  // Revert single row or all
  const handleRevertRow = (id: number) => {
    const original = initialRecords[id];
    if (!original) return;
    setRecords(prev => prev.map(r => (r.id === id ? { ...original } : r)));
    setModifiedRows(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const handleRevertAll = () => {
    setRecords(prev => prev.map(r => (initialRecords[r.id] ? { ...initialRecords[r.id] } : r)));
    setModifiedRows({});
    toast.info('All unsaved edits have been reverted.');
  };

  // Batch Save modified rows
  const handleSaveChanges = async () => {
    const rowsToSave = Object.values(modifiedRows);
    if (rowsToSave.length === 0) {
      toast.info('No changes to save.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(apiUrl('/api/timesheet'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: rowsToSave,
          adminId: currentUser?.id || 'superuser',
          adminName: currentUser?.username || 'Superuser'
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Saved ${rowsToSave.length} records successfully!`);
        // Update initialRecords snapshot
        const newInitials = { ...initialRecords };
        rowsToSave.forEach(r => {
          newInitials[r.id] = { ...r };
        });
        setInitialRecords(newInitials);
        setModifiedRows({});
      } else {
        toast.error(data.error || 'Failed to save changes');
      }
    } catch (err) {
      toast.error('Network error saving changes');
    } finally {
      setSaving(false);
    }
  };

  // Delete row handler
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const params = new URLSearchParams({
        id: String(deleteTarget.id),
        adminId: currentUser?.id || 'superuser',
        adminName: currentUser?.username || 'Superuser'
      });

      const res = await fetch(apiUrl(`/api/timesheet?${params.toString()}`), {
        method: 'DELETE'
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`Deleted timesheet record for ${deleteTarget.username} (${deleteTarget.date})`);
        setRecords(prev => prev.filter(r => r.id !== deleteTarget.id));
        setModifiedRows(prev => {
          const copy = { ...prev };
          delete copy[deleteTarget.id];
          return copy;
        });
        setDeleteTarget(null);
      } else {
        toast.error(data.error || 'Failed to delete record');
      }
    } catch (err) {
      toast.error('Network error deleting record');
    } finally {
      setDeleting(false);
    }
  };

  // Copy row to clipboard (Excel TSV format)
  const handleCopyRow = (row: PresensiRow) => {
    const tsv = [
      row.user_id,
      row.username,
      row.date,
      row.day,
      row.working_hours,
      row.overtime_hours,
      row.area1,
      row.area2,
      row.shift,
      row.remark
    ].join('\t');

    navigator.clipboard.writeText(tsv).then(() => {
      toast.success(`Copied row for ${row.username} (${row.date}) to clipboard! Ready to paste in Excel.`);
    });
  };

  // Export filtered rows to CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      toast.warning('No records to export');
      return;
    }
    const headers = ['ID', 'User ID', 'Username', 'Date', 'Day', 'Working Hours', 'Overtime', 'Area 1', 'Area 2', 'Shift', 'Remarks'];
    const csvRows = [headers.join(',')];

    filteredRecords.forEach(r => {
      const values = [
        r.id,
        `"${r.user_id}"`,
        `"${r.username}"`,
        r.date,
        r.day,
        r.working_hours,
        r.overtime_hours,
        `"${r.area1 || ''}"`,
        `"${r.area2 || ''}"`,
        `"${r.shift}"`,
        `"${(r.remark || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(values.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Timesheet_Corrections_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV exported successfully');
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (onlyModified && !modifiedRows[r.id]) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = 
          r.user_id.toLowerCase().includes(q) ||
          r.username.toLowerCase().includes(q) ||
          r.date.includes(q) ||
          r.day.toLowerCase().includes(q) ||
          (r.area1 || '').toLowerCase().includes(q) ||
          (r.area2 || '').toLowerCase().includes(q) ||
          (r.remark || '').toLowerCase().includes(q) ||
          (r.shift || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [records, searchQuery, onlyModified, modifiedRows]);

  const modifiedCount = Object.keys(modifiedRows).length;

  return (
    <div className="space-y-4 animate-smooth-fade">
      
      {/* 👑 SUPERUSER HEADER & TOOLBAR 👑 */}
      <div className="glass-card rounded-2xl p-5 border border-amber-500/30 bg-white/95 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-900 border border-amber-500/40 text-[10px] font-mono font-black uppercase tracking-wider">
                Superuser Only
              </span>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                Excel Timesheet Master Editor & Corrections
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Direct spreadsheet grid: Edit numbers or remarks directly in cells, copy cell values with one click, or delete invalid submissions from other team members.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {modifiedCount > 0 && (
              <button
                type="button"
                onClick={handleRevertAll}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Discard all pending modifications"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Discard</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={saving || modifiedCount === 0}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all ${
                modifiedCount > 0
                  ? 'btn-orange cursor-pointer scale-105 shadow-orange-500/30 animate-pulse'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              title="Save all modified records to database"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : `Save Changes (${modifiedCount})`}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition flex items-center gap-1.5 cursor-pointer"
              title="Export displayed records to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              type="button"
              onClick={fetchRecords}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center justify-center cursor-pointer"
              title="Refresh records"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#FF6B00]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search user, date, remark, area..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs glass-input font-medium"
            />
          </div>

          {/* User Select Filter */}
          <div className="relative">
            <select
              value={selectedUserFilter}
              onChange={e => setSelectedUserFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs glass-input font-medium appearance-none cursor-pointer"
            >
              <option value="ALL">All Users ({usersList?.length || 0} members)</option>
              {usersList?.map(u => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.id})
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs glass-input font-medium"
              title="Start Date"
            />
          </div>

          {/* End Date */}
          <div>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs glass-input font-medium"
              title="End Date"
            />
          </div>

        </div>

        {/* Quick Date Shortcuts & Stats */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-medium text-[11px]">Quick Date:</span>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                const mon = new Date(now.setDate(diff)).toISOString().substring(0, 10);
                const sun = new Date(now.setDate(diff + 6)).toISOString().substring(0, 10);
                setStartDate(mon);
                setEndDate(sun);
              }}
              className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold"
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().substring(0, 10);
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().substring(0, 10);
                setStartDate(firstDay);
                setEndDate(lastDay);
              }}
              className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().substring(0, 10);
                const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().substring(0, 10);
                setStartDate(firstDay);
                setEndDate(lastDay);
              }}
              className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold"
            >
              Last Month
            </button>
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSelectedUserFilter('ALL');
                setSearchQuery('');
                setOnlyModified(false);
              }}
              className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-semibold"
            >
              Reset Filters
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyModified}
                onChange={e => setOnlyModified(e.target.checked)}
                className="rounded text-[#FF6B00] focus:ring-[#FF6B00]"
              />
              <span>Show Only Modified ({modifiedCount})</span>
            </label>

            <span className="text-[11px] font-bold text-slate-500">
              Showing <strong>{filteredRecords.length}</strong> records
            </span>
          </div>
        </div>

      </div>

      {/* 📊 SPREADSHEET EXCEL-LIKE GRID 📊 */}
      <div className="glass-card rounded-2xl p-4 bg-white/95 border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[640px] overflow-y-auto rounded-xl border border-slate-200 shadow-inner">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-slate-100 font-semibold uppercase text-[10px] tracking-wider sticky top-0 z-20 select-none shadow-sm">
              <tr>
                <th className="px-3 py-3 w-12 text-center border-r border-slate-800">#</th>
                <th className="px-3 py-3 w-40 border-r border-slate-800">User / Member</th>
                <th className="px-3 py-3 w-28 border-r border-slate-800">Date</th>
                <th className="px-3 py-3 w-24 border-r border-slate-800">Day</th>
                <th className="px-3 py-3 w-20 text-center border-r border-slate-800">Hours (0-24)</th>
                <th className="px-3 py-3 w-20 text-center border-r border-slate-800">Overtime</th>
                <th className="px-3 py-3 w-28 border-r border-slate-800">Area 1</th>
                <th className="px-3 py-3 w-28 border-r border-slate-800">Area 2</th>
                <th className="px-3 py-3 w-32 border-r border-slate-800">Shift</th>
                <th className="px-3 py-3 min-w-[200px] border-r border-slate-800">Remarks / Description</th>
                <th className="px-3 py-3 w-28 text-center sticky right-0 bg-slate-900 z-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#FF6B00] mb-2" />
                    <span>Loading timesheet records from server...</span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-6 h-6 mx-auto text-slate-300 mb-2" />
                    <span>No timesheet records match your filter criteria.</span>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((row, idx) => {
                  const isModified = Boolean(modifiedRows[row.id]);

                  return (
                    <tr 
                      key={row.id} 
                      className={`hover:bg-slate-50/80 transition-colors group ${
                        isModified ? 'bg-amber-50/70' : (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')
                      }`}
                    >
                      {/* Row Index & Modified Indicator */}
                      <td className="px-2 py-1 text-center font-mono text-[10px] text-slate-400 border-r border-slate-200 relative">
                        {isModified && (
                          <span 
                            className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" 
                            title="Unsaved changes in this row"
                          />
                        )}
                        <span>{idx + 1}</span>
                      </td>

                      {/* User Info */}
                      <td className="px-3 py-1 font-semibold text-slate-900 border-r border-slate-200">
                        <div className="flex flex-col">
                          <span className="truncate max-w-[140px] text-xs" title={row.username}>
                            {row.username}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 uppercase">
                            {row.user_id}
                          </span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-2 py-1 font-mono text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {row.date}
                      </td>

                      {/* Day Name */}
                      <td className="px-2 py-1 text-xs font-medium text-slate-600 border-r border-slate-200">
                        <span className={row.day === 'Sunday' ? 'text-rose-600 font-bold' : ''}>
                          {row.day}
                        </span>
                      </td>

                      {/* Working Hours Cell (Excel-like Editable) */}
                      <td className="p-0 border-r border-slate-200">
                        <input
                          type="number"
                          min="0"
                          max="24"
                          step="0.5"
                          value={row.working_hours}
                          onChange={e => handleCellChange(row.id, 'working_hours', Number(e.target.value))}
                          onFocus={e => e.target.select()}
                          className={`w-full text-center py-2 px-2 text-xs font-mono font-bold bg-transparent outline-none transition select-all focus:bg-white focus:ring-2 focus:ring-[#FF6B00]/40 ${
                            isModified ? 'text-amber-950 font-black' : 'text-slate-800'
                          }`}
                          title="Click to edit or Ctrl+C to copy"
                        />
                      </td>

                      {/* Overtime Cell (Excel-like Editable) */}
                      <td className="p-0 border-r border-slate-200">
                        <input
                          type="number"
                          min="0"
                          max="24"
                          step="0.5"
                          value={row.overtime_hours}
                          onChange={e => handleCellChange(row.id, 'overtime_hours', Number(e.target.value))}
                          onFocus={e => e.target.select()}
                          className="w-full text-center py-2 px-2 text-xs font-mono font-bold text-[#FF6B00] bg-transparent outline-none transition select-all focus:bg-white focus:ring-2 focus:ring-[#FF6B00]/40"
                          title="Click to edit or Ctrl+C to copy"
                        />
                      </td>

                      {/* Area 1 Selector */}
                      <td className="p-0 border-r border-slate-200">
                        <select
                          value={row.area1 || 'CMN'}
                          onChange={e => handleCellChange(row.id, 'area1', e.target.value)}
                          className="w-full py-2 px-2 text-xs font-mono bg-transparent outline-none transition cursor-pointer focus:bg-white focus:ring-2 focus:ring-[#FF6B00]/40"
                        >
                          {areasList.map(a => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                      </td>

                      {/* Area 2 Selector */}
                      <td className="p-0 border-r border-slate-200">
                        <select
                          value={row.area2 || ''}
                          onChange={e => handleCellChange(row.id, 'area2', e.target.value)}
                          className="w-full py-2 px-2 text-xs font-mono bg-transparent outline-none transition cursor-pointer focus:bg-white focus:ring-2 focus:ring-[#FF6B00]/40"
                        >
                          <option value="">(None)</option>
                          {areasList.map(a => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                      </td>

                      {/* Shift Selector */}
                      <td className="p-0 border-r border-slate-200">
                        <select
                          value={row.shift || 'Day Shift'}
                          onChange={e => handleCellChange(row.id, 'shift', e.target.value)}
                          className="w-full py-2 px-2 text-xs bg-transparent outline-none transition cursor-pointer focus:bg-white focus:ring-2 focus:ring-[#FF6B00]/40"
                        >
                          <option value="Day Shift">Day Shift</option>
                          <option value="Night Shift">Night Shift</option>
                        </select>
                      </td>

                      {/* Remarks Cell (Excel-like Editable) */}
                      <td className="p-0 border-r border-slate-200">
                        <input
                          type="text"
                          value={row.remark || ''}
                          onChange={e => handleCellChange(row.id, 'remark', e.target.value)}
                          onFocus={e => e.target.select()}
                          placeholder="Activity description / remarks..."
                          className="w-full py-2 px-3 text-xs bg-transparent outline-none transition select-all focus:bg-white focus:ring-2 focus:ring-[#FF6B00]/40"
                          title="Click to edit or Ctrl+C to copy"
                        />
                      </td>

                      {/* Action Buttons (Copy / Revert / Delete) */}
                      <td className="px-2 py-1 text-center sticky right-0 bg-white group-hover:bg-slate-50 transition-colors z-10">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyRow(row)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200/80 transition cursor-pointer"
                            title="Copy row data to clipboard"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {isModified && (
                            <button
                              type="button"
                              onClick={() => handleRevertRow(row.id)}
                              className="p-1.5 rounded-lg text-amber-600 hover:text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                              title="Revert changes for this row"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(row)}
                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                            title="Delete this timesheet entry"
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

        {/* Footer info bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Excel Mode: Select any cell to edit or copy (`Ctrl+C`). Changes stay marked in yellow until you click <strong>Save Changes</strong>.</span>
          </div>

          <div>
            Total Hours in View:{' '}
            <strong className="text-slate-900 font-bold">
              {filteredRecords.reduce((sum, r) => sum + (Number(r.working_hours) || 0), 0)} hrs
            </strong>{' '}
            | Overtime:{' '}
            <strong className="text-[#FF6B00] font-bold">
              {filteredRecords.reduce((sum, r) => sum + (Number(r.overtime_hours) || 0), 0)} hrs
            </strong>
          </div>
        </div>

      </div>

      {/* ⚠️ CONFIRM DELETE MODAL ⚠️ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black text-slate-900">
                  Delete Timesheet Record?
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Are you sure you want to permanently delete this timesheet entry for{' '}
                  <strong className="text-slate-900">{deleteTarget.username}</strong> on{' '}
                  <strong className="text-slate-900">{deleteTarget.date} ({deleteTarget.day})</strong>?
                </p>
                <div className="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700">
                  Hours: {deleteTarget.working_hours}h | Overtime: {deleteTarget.overtime_hours}h | Area: {deleteTarget.area1} | Remarks: &quot;{deleteTarget.remark || 'None'}&quot;
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
