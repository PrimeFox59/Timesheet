'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, Calendar, Clock, User, MapPin, RefreshCw, BarChart2, Layers } from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface ActivityLogTabProps {
  currentUser: any;
  usersList: any[];
  areasList: string[];
}

export default function ActivityLogTab({ currentUser, usersList, areasList }: ActivityLogTabProps) {
  // Calculate current week running: Monday to Sunday (matching TimesheetEntryTab)
  const getInitialDates = () => {
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    
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

  const [selectedUser, setSelectedUser] = useState('All');
  const [selectedShift, setSelectedShift] = useState('All');
  const [selectedArea, setSelectedArea] = useState('All');
  const [limit, setLimit] = useState<number>(100);

  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalEntries: 0, totalHours: 0, totalOvertime: 0, uniqueUsers: 0 });
  const [loading, setLoading] = useState(false);

  const fetchLogs = async (customLimit?: number) => {
    setLoading(true);
    try {
      const activeLimit = customLimit || limit;
      const query = new URLSearchParams();
      if (startDate) query.append('startDate', startDate);
      if (endDate) query.append('endDate', endDate);
      if (selectedUser) query.append('username', selectedUser);
      if (selectedShift) query.append('shift', selectedShift);
      if (selectedArea) query.append('area', selectedArea);
      query.append('limit', String(activeLimit));

      const res = await fetch(apiUrl(`/api/activity-log?${query.toString()}`));
      const data = await res.json();

      if (data.success) {
        setRecords(data.data || []);
        setSummary(data.summary || { totalEntries: 0, totalHours: 0, totalOvertime: 0, uniqueUsers: 0 });
      }
    } catch (e) {
      console.error("Failed to fetch activity logs", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleLoadMore = () => {
    const newLimit = limit + 100;
    setLimit(newLimit);
    fetchLogs(newLimit);
  };

  const handleClearDates = () => {
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="space-y-6 animate-smooth-fade">
      
      {/* Header & KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF6B00] flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Records</div>
            <div className="text-xl font-black text-slate-900">{summary.totalEntries}</div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Hours</div>
            <div className="text-xl font-black text-slate-900">{summary.totalHours} hrs</div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Overtime</div>
            <div className="text-xl font-black text-slate-900">{summary.totalOvertime} hrs</div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Users</div>
            <div className="text-xl font-black text-slate-900">{summary.uniqueUsers}</div>
          </div>
        </div>

      </div>

      {/* Filter Bar */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-[#FF6B00]" />
            Activity Log Filters
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearDates}
              className="text-[11px] px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold transition"
            >
              Clear Date Filter
            </button>
            <button
              onClick={() => fetchLogs()}
              disabled={loading}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Apply Filters</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl text-xs glass-input font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl text-xs glass-input font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">User</label>
            <select
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl text-xs glass-input font-medium"
            >
              <option value="All">All Users</option>
              {usersList.map(u => (
                <option key={u.id} value={u.username}>{u.username}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Shift</label>
            <select
              value={selectedShift}
              onChange={e => setSelectedShift(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl text-xs glass-input font-medium"
            >
              <option value="All">All Shifts</option>
              <option value="Day Shift">Day Shift</option>
              <option value="Night Shift">Night Shift</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Area</label>
            <select
              value={selectedArea}
              onChange={e => setSelectedArea(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl text-xs glass-input font-medium"
            >
              <option value="All">All Areas</option>
              {areasList.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Activity Records Table */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-sm border border-white/80 space-y-4">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-900/90 text-slate-100 font-semibold uppercase text-[10px] tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Day</th>
                <th className="px-4 py-3 text-center">Reg Hours</th>
                <th className="px-4 py-3 text-center">Overtime</th>
                <th className="px-4 py-3">Area Allocations</th>
                <th className="px-4 py-3">Shift</th>
                <th className="px-4 py-3">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">Loading activity records...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">No activity records found matching filters.</td>
                </tr>
              ) : (
                records.map((r, idx) => {
                  const areasJoined = [r.area1, r.area2, r.area3, r.area4].filter(Boolean).join(', ');
                  return (
                    <tr key={r.id || idx} className="hover:bg-white/60 transition">
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{r.user_id}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">{r.username}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px]">{r.date}</td>
                      <td className="px-4 py-2.5 text-slate-500">{r.day}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-slate-900">{r.hours}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-[#FF6B00]">{r.overtime || 0}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-md bg-orange-100/80 text-orange-950 text-[10px] font-semibold border border-orange-200">
                          {areasJoined || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{r.shift}</td>
                      <td className="px-4 py-2.5 text-slate-500 italic max-w-xs truncate">{r.remark || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Load More Footer */}
        {records.length >= limit && (
          <div className="p-3 border-t border-slate-200/80 text-center">
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="text-xs px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Showing {records.length} records. Load 100 More Records</span>
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
