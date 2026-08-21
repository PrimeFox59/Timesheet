'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, Filter, CheckCircle2, XCircle } from 'lucide-react';

interface AuditLogTabProps {
  currentUser: any;
}

export default function AuditLogTab({ currentUser }: AuditLogTabProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedUser, setSelectedUser] = useState('All');
  const [selectedAction, setSelectedAction] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (startDate) query.append('startDate', startDate);
      if (endDate) query.append('endDate', endDate);
      if (selectedUser) query.append('user', selectedUser);
      if (selectedAction) query.append('action', selectedAction);
      if (selectedStatus) query.append('status', selectedStatus);

      const res = await fetch(`/api/audit-log?${query.toString()}`);
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch audit logs", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  return (
    <div className="space-y-6 animate-smooth-fade">
      
      {/* Header */}
      <div className="glass-card rounded-2xl p-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#FF6B00]" />
            System Audit Log
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Privileged audit trail tracking login events, timesheet submissions, password resets, and master edits.
          </p>
        </div>

        <button
          onClick={fetchAuditLogs}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Audit Logs</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-[#FF6B00]" />
          Filter Audit Entries
        </h3>

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
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Action Type</label>
            <select
              value={selectedAction}
              onChange={e => setSelectedAction(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl text-xs glass-input font-medium"
            >
              <option value="All">All Actions</option>
              <option value="Login">Login</option>
              <option value="Timesheet Submission">Timesheet Submission</option>
              <option value="Password Change">Password Change</option>
              <option value="Master Edit - Add Area">Master Edit - Add Area</option>
              <option value="Master Edit - Delete Area">Master Edit - Delete Area</option>
              <option value="Master Edit - Password Reset">Master Edit - Password Reset</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl text-xs glass-input font-medium"
            >
              <option value="All">All Statuses</option>
              <option value="Success">Success</option>
              <option value="Failed">Failed</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchAuditLogs}
              className="w-full py-1.5 rounded-xl text-xs font-bold btn-orange"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-sm border border-white/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-900/90 text-slate-100 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading audit trail...</td>
                </tr>
              ) : auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No audit log entries found.</td>
                </tr>
              ) : (
                auditLogs.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-white/60 transition">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">{item.timestamp}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">{item.user_id}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">{item.username}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[10px] font-semibold border border-slate-200">
                        {item.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-md">{item.description}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.status === 'Success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}>
                        {item.status === 'Success' ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-600" />}
                        <span>{item.status}</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
