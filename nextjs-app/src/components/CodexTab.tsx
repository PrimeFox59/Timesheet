'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FileCheck, Users, Clock, BarChart2, CheckCircle2, AlertCircle, 
  RefreshCw, Eye, PenTool, Upload, Trash2, Check, X, FileSpreadsheet, ShieldAlert, Zap, Bookmark,
  Search, ArrowUpDown, ArrowUp, ArrowDown, Filter
} from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface CodexTabProps {
  currentUser: any;
  usersList: any[];
}

type SortField = 'user_id' | 'username' | 'role' | 'total_entries' | 'total_hours' | 'total_overtime' | 'approval_status';

export default function CodexTab({ currentUser, usersList }: CodexTabProps) {
  const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  const [loading, setLoading] = useState(false);
  const [monitoringData, setMonitoringData] = useState<any[]>([]);
  const [kpi, setKpi] = useState({
    totalUsers: 0,
    submittedUsers: 0,
    approvedCount: 0,
    pendingCount: 0,
    grandTotalHours: 0,
    grandTotalOvertime: 0
  });

  // Table Filter and Sort States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sortField, setSortField] = useState<SortField>('user_id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Default Signature saved in localStorage
  const [defaultSignature, setDefaultSignature] = useState<string>('');
  const [showSetSignatureModal, setShowSetSignatureModal] = useState(false);

  // Bulk Approval modal & processing state
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal / Drawer state for inspecting user timesheet
  const [inspectUser, setInspectUser] = useState<any | null>(null);
  const [userTimesheetEntries, setUserTimesheetEntries] = useState<any[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Single Approval Modal state
  const [approveTarget, setApproveTarget] = useState<any | null>(null);
  const [signatureData, setSignatureData] = useState<string>('');
  const [signatureMode, setSignatureMode] = useState<'draw' | 'upload'>('draw');
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Canvas drawing ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const setSigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Restore default signature from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('metso_default_signature');
      if (saved) {
        setDefaultSignature(saved);
      }
    } catch (e) {}
  }, []);

  const fetchMonitoringData = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/codex/monitoring?month=${selectedMonth}`));
      const data = await res.json();

      if (data.success) {
        setMonitoringData(data.data || []);
        setKpi(data.kpi || {
          totalUsers: 0,
          submittedUsers: 0,
          approvedCount: 0,
          pendingCount: 0,
          grandTotalHours: 0,
          grandTotalOvertime: 0
        });
      }
    } catch (e) {
      console.error("Failed to fetch Codex monitoring data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
  }, [selectedMonth]);

  // Filtering and Sorting Computed Data
  const filteredAndSortedData = useMemo(() => {
    let result = [...monitoringData];

    // 1. Text Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r =>
        (r.user_id && r.user_id.toLowerCase().includes(q)) ||
        (r.username && r.username.toLowerCase().includes(q)) ||
        (r.role && r.role.toLowerCase().includes(q))
      );
    }

    // 2. Status Filter
    if (statusFilter !== 'All') {
      if (statusFilter === 'Submitted') {
        result = result.filter(r => r.total_entries > 0);
      } else {
        result = result.filter(r => r.approval_status === statusFilter);
      }
    }

    // 3. Sorting
    if (sortField) {
      result.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = (valB || '').toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [monitoringData, searchQuery, statusFilter, sortField, sortDirection]);

  // Toggle sort order when clicking column header
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Render Sort Indicator Icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-60 group-hover:opacity-100" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[#FF6B00]" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#FF6B00]" />
    );
  };

  // Inspect specific user's timesheet entries
  const handleInspectUser = async (userItem: any) => {
    setInspectUser(userItem);
    setLoadingEntries(true);
    try {
      const startDate = `${selectedMonth}-01`;
      const [y, m] = selectedMonth.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const endDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

      const res = await fetch(apiUrl(`/api/timesheet?userId=${encodeURIComponent(userItem.user_id)}&startDate=${startDate}&endDate=${endDate}`));
      const data = await res.json();
      if (data.success) {
        setUserTimesheetEntries(data.data || []);
      }
    } catch (e) {
      console.error("Failed to load user timesheet entries", e);
    } finally {
      setLoadingEntries(false);
    }
  };

  // Open Single Approval Modal
  const handleOpenApproveModal = async (userItem: any) => {
    setApproveTarget(userItem);
    setSignatureData(defaultSignature || '');
    setApprovalMessage(null);
    setSignatureMode('draw');

    try {
      const res = await fetch(apiUrl(`/api/codex/approve?userId=${encodeURIComponent(userItem.user_id)}&month=${selectedMonth}`));
      const data = await res.json();

      if (data.success && data.data?.signature_data) {
        setSignatureData(data.data.signature_data);
      }
    } catch (e) {}

    setTimeout(() => {
      clearCanvas(canvasRef.current);
    }, 100);
  };

  // HTML5 Canvas Helpers
  const clearCanvas = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, canvas.height - 30);
    ctx.lineTo(canvas.width - 20, canvas.height - 30);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const getCanvasCoords = (canvas: HTMLCanvasElement | null, e: any) => {
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const startDrawing = (canvas: HTMLCanvasElement | null, e: any) => {
    setIsDrawing(true);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const coords = getCanvasCoords(canvas, e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (canvas: HTMLCanvasElement | null, e: any) => {
    if (!isDrawing) return;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const coords = getCanvasCoords(canvas, e);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = (canvas: HTMLCanvasElement | null, setter: (val: string) => void) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvas) {
      setter(canvas.toDataURL('image/png'));
    }
  };

  const handleSignatureFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setter(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Save Default Signature
  const handleSaveDefaultSignature = (sig: string) => {
    if (!sig) return;
    setDefaultSignature(sig);
    try {
      localStorage.setItem('metso_default_signature', sig);
    } catch (e) {}
    setShowSetSignatureModal(false);
  };

  // Submit Single Approval
  const handleSubmitApproval = async (status: 'Approved' | 'Rejected') => {
    if (!approveTarget) return;

    let sigToUse = signatureData || defaultSignature;
    if (!sigToUse && canvasRef.current) {
      sigToUse = canvasRef.current.toDataURL('image/png');
    }

    if (status === 'Approved' && !sigToUse) {
      setApprovalMessage({ type: 'error', text: 'Please draw or upload a digital signature before approving.' });
      return;
    }

    setSubmittingApproval(true);
    setApprovalMessage(null);

    try {
      const res = await fetch(apiUrl('/api/codex/approve'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: approveTarget.user_id,
          month: selectedMonth,
          status,
          approver_id: currentUser.id,
          approver_name: currentUser.username,
          signature_data: sigToUse || 'N/A'
        })
      });

      const data = await res.json();
      if (data.success) {
        setApprovalMessage({ type: 'success', text: data.message });
        setTimeout(() => {
          setApproveTarget(null);
          fetchMonitoringData();
        }, 1200);
      } else {
        setApprovalMessage({ type: 'error', text: data.error || 'Failed to submit approval.' });
      }
    } catch (e) {
      setApprovalMessage({ type: 'error', text: 'Network error submitting approval.' });
    } finally {
      setSubmittingApproval(false);
    }
  };

  // Submit BULK APPROVAL ALL
  const handleExecuteBulkApproveAll = async () => {
    let sigToUse = defaultSignature || signatureData;
    if (!sigToUse && canvasRef.current) {
      sigToUse = canvasRef.current.toDataURL('image/png');
    }

    if (!sigToUse) {
      setBulkMessage({ type: 'error', text: 'Please draw or upload a digital signature first.' });
      return;
    }

    setBulkSubmitting(true);
    setBulkMessage(null);

    const targetUserIds = filteredAndSortedData.map(u => u.user_id);

    try {
      const res = await fetch(apiUrl('/api/codex/approve-all'), {
        method: 'POST',

        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          approver_id: currentUser.id,
          approver_name: currentUser.username,
          signature_data: sigToUse,
          target_user_ids: targetUserIds
        })
      });

      const data = await res.json();
      if (data.success) {
        handleSaveDefaultSignature(sigToUse);
        setBulkMessage({ type: 'success', text: data.message });

        setTimeout(() => {
          setShowBulkApproveModal(false);
          setBulkMessage(null);
          fetchMonitoringData();
        }, 1200);
      } else {
        setBulkMessage({ type: 'error', text: data.error || 'Bulk approval failed.' });
      }
    } catch (e) {
      setBulkMessage({ type: 'error', text: 'Network error executing bulk approval.' });
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Export Metso Excel Template for User
  const handleExportUserExcel = (userId: string) => {
    window.open(apiUrl(`/api/timesheet/export-template?userId=${encodeURIComponent(userId)}&month=${encodeURIComponent(selectedMonth)}`), '_blank');
  };

  return (
    <div className="space-y-6 animate-smooth-fade">
      
      {/* Header & Controls */}
      <div className="glass-card rounded-2xl p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-[#FF6B00]" />
            CODEX Monitoring &amp; Digital Approval
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Monitor employee workhours, inspect submitted timesheets, set signature &amp; execute bulk digital approvals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-white/80 border border-slate-200/80 rounded-xl px-3 h-9 shadow-xs">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Target Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={fetchMonitoringData}
            disabled={loading}
            className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            title="Refresh Monitoring Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => {
              setShowSetSignatureModal(true);
              setTimeout(() => clearCanvas(setSigCanvasRef.current), 100);
            }}
            className="h-9 px-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/80 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            title="Set default digital signature"
          >
            <Bookmark className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>{defaultSignature ? 'Update Default Sign' : 'Set Default Sign'}</span>
          </button>

          {/* BULK APPROVE ALL BUTTON */}
          <button
            onClick={() => {
              setShowBulkApproveModal(true);
              setBulkMessage(null);
              if (!defaultSignature) {
                setTimeout(() => clearCanvas(canvasRef.current), 100);
              }
            }}
            className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#E05600] hover:from-[#E05600] hover:to-[#C04600] text-white text-xs font-black shadow-md shadow-orange-500/20 transition flex items-center gap-2 scale-100 hover:scale-[1.02] active:scale-95"
            title="Approve all employee timesheets at once with digital signature"
          >
            <Zap className="w-4 h-4 text-amber-300 fill-amber-300 animate-pulse" />
            <span>Approve All ({filteredAndSortedData.length})</span>
          </button>
        </div>
      </div>

      {/* KPI Monitoring Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-orange-100 text-[#FF6B00] flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Submissions Rate</div>
            <div className="text-xl font-black text-slate-900">
              {kpi.submittedUsers} / {kpi.totalUsers} <span className="text-xs text-slate-400 font-medium">({kpi.totalUsers > 0 ? Math.round((kpi.submittedUsers / kpi.totalUsers) * 100) : 0}%)</span>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Approved Timesheets</div>
            <div className="text-xl font-black text-emerald-600">{kpi.approvedCount}</div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pending Approval</div>
            <div className="text-xl font-black text-amber-600">{kpi.pendingCount}</div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Workhours</div>
            <div className="text-xl font-black text-slate-900">{kpi.grandTotalHours} hrs <span className="text-xs text-[#FF6B00] font-bold">({kpi.grandTotalOvertime} OT)</span></div>
          </div>
        </div>

      </div>

      {/* SEARCH AND FILTER BAR */}
      <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Employee ID, Username, or Role..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs glass-input font-medium text-slate-800"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#FF6B00]" />
          <span className="text-xs font-bold text-slate-700">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs glass-input font-bold text-slate-800"
          >
            <option value="All">All Employees ({monitoringData.length})</option>
            <option value="Submitted">Submitted Entries Only ({kpi.submittedUsers})</option>
            <option value="Approved">Approved Only ({kpi.approvedCount})</option>
            <option value="Pending">Pending Approval ({kpi.pendingCount})</option>
            <option value="Unsubmitted">Unsubmitted Only</option>
          </select>
        </div>
      </div>

      {/* Employee Monitoring Table */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-sm border border-white/80">
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto rounded-2xl">
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            <thead className="bg-slate-900 text-slate-100 font-semibold uppercase text-[10px] tracking-wider sticky top-0 z-30 select-none shadow-md border-b border-slate-700/80">
              <tr>
                <th
                  onClick={() => handleSort('user_id')}
                  className="bg-slate-900 px-4 py-3.5 cursor-pointer hover:bg-slate-800 transition group first:rounded-tl-2xl"
                  title="Click to sort by Employee ID"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span>Employee ID</span>
                    {renderSortIcon('user_id')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('username')}
                  className="bg-slate-900 px-4 py-3.5 cursor-pointer hover:bg-slate-800 transition group"
                  title="Click to sort by Username"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span>Username</span>
                    {renderSortIcon('username')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('role')}
                  className="bg-slate-900 px-4 py-3.5 cursor-pointer hover:bg-slate-800 transition group"
                  title="Click to sort by Role"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span>Role</span>
                    {renderSortIcon('role')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('total_entries')}
                  className="bg-slate-900 px-4 py-3.5 text-center cursor-pointer hover:bg-slate-800 transition group"
                  title="Click to sort by Entries"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Entries</span>
                    {renderSortIcon('total_entries')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('total_hours')}
                  className="bg-slate-900 px-4 py-3.5 text-center cursor-pointer hover:bg-slate-800 transition group"
                  title="Click to sort by Reg Hours"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Reg Hours</span>
                    {renderSortIcon('total_hours')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('total_overtime')}
                  className="bg-slate-900 px-4 py-3.5 text-center cursor-pointer hover:bg-slate-800 transition group"
                  title="Click to sort by Overtime"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Overtime</span>
                    {renderSortIcon('total_overtime')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('approval_status')}
                  className="bg-slate-900 px-4 py-3.5 cursor-pointer hover:bg-slate-800 transition group"
                  title="Click to sort by Approval Status"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span>Approval Status</span>
                    {renderSortIcon('approval_status')}
                  </div>
                </th>

                <th className="bg-slate-900 px-6 py-3.5 text-right last:rounded-tr-2xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 font-medium bg-white/40">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">Loading Codex monitoring data...</td>
                </tr>
              ) : filteredAndSortedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">No matching employees found.</td>
                </tr>
              ) : (
                filteredAndSortedData.map((item) => {
                  return (
                    <tr key={item.user_id} className="hover:bg-white/60 transition">
                      <td className="px-4 py-3 font-mono text-[11px] font-bold text-slate-900">{item.user_id}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{item.username}</td>
                      <td className="px-4 py-3 text-slate-500">{item.role}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-700">{item.total_entries} days</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-900">{item.total_hours} hrs</td>
                      <td className="px-4 py-3 text-center font-bold text-[#FF6B00]">{item.total_overtime} hrs</td>

                      {/* Approval Status Badge */}
                      <td className="px-4 py-3">
                        {item.approval_status === 'Approved' ? (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Approved
                          </span>
                        ) : item.approval_status === 'Pending' ? (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300 flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Pending Approval
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-medium border border-slate-200 flex items-center gap-1 w-fit">
                            Unsubmitted
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Inspect Icon Button */}
                          <button
                            onClick={() => handleInspectUser(item)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all duration-150 active:scale-95 shadow-2xs"
                            title="Inspect employee timesheet entries"
                          >
                            <Eye className="w-4 h-4 text-slate-600" />
                          </button>

                          {/* Export Excel Icon Button */}
                          <button
                            onClick={() => handleExportUserExcel(item.user_id)}
                            className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-all duration-150 active:scale-95 border border-emerald-200/80 shadow-2xs"
                            title="Export Metso Excel Timesheet Template"
                          >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          </button>

                          {/* Sign & Approve Icon Button */}
                          <button
                            onClick={() => handleOpenApproveModal(item)}
                            className="p-2 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#E05600] hover:from-[#E05600] hover:to-[#C04600] text-white transition-all duration-150 active:scale-95 shadow-md shadow-orange-500/20"
                            title="Sign & Approve Timesheet"
                          >
                            <PenTool className="w-4 h-4 text-white" />
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
      </div>

      {/* SET DEFAULT SIGNATURE MODAL */}
      {showSetSignatureModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="glass-card max-w-md w-full rounded-3xl p-6 space-y-4 shadow-2xl bg-white/95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Bookmark className="w-5 h-5 text-[#FF6B00]" />
                  Set Default Approver Signature
                </h3>
                <p className="text-xs text-slate-500 font-medium">Draw or upload your signature once to use for instant bulk approvals.</p>
              </div>

              <button onClick={() => setShowSetSignatureModal(false)} className="p-1.5 rounded-xl bg-slate-100 text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                <span>Draw your signature below:</span>
                <button
                  type="button"
                  onClick={() => clearCanvas(setSigCanvasRef.current)}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Pad
                </button>
              </div>

              <div className="border-2 border-slate-300 rounded-2xl overflow-hidden bg-white shadow-inner cursor-crosshair">
                <canvas
                  ref={setSigCanvasRef}
                  width={380}
                  height={150}
                  className="w-full h-36 touch-none"
                  onMouseDown={e => startDrawing(setSigCanvasRef.current, e)}
                  onMouseMove={e => draw(setSigCanvasRef.current, e)}
                  onMouseUp={() => stopDrawing(setSigCanvasRef.current, handleSaveDefaultSignature)}
                  onMouseLeave={() => stopDrawing(setSigCanvasRef.current, handleSaveDefaultSignature)}
                  onTouchStart={e => startDrawing(setSigCanvasRef.current, e)}
                  onTouchMove={e => draw(setSigCanvasRef.current, e)}
                  onTouchEnd={() => stopDrawing(setSigCanvasRef.current, handleSaveDefaultSignature)}
                />
              </div>

              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Or Upload PNG Signature File</label>
                <input
                  type="file"
                  accept="image/png"
                  onChange={e => handleSignatureFileUpload(e, handleSaveDefaultSignature)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white"
                />
              </div>

              {defaultSignature && (
                <div className="p-3 border border-slate-200 rounded-xl bg-slate-50 text-center">
                  <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Current Saved Default Signature:</div>
                  <img src={defaultSignature} alt="Default Signature" className="h-14 mx-auto object-contain" />
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSetSignatureModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK APPROVE ALL MODAL */}
      {showBulkApproveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="glass-card max-w-lg w-full rounded-3xl p-6 space-y-4 shadow-2xl bg-white/95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[#FF6B00]" />
                  Bulk Approve All Timesheets ({selectedMonth})
                </h3>
                <p className="text-xs text-slate-500 font-medium">Execute instant digital signature approval for all employee timesheets.</p>
              </div>

              <button onClick={() => setShowBulkApproveModal(false)} className="p-1.5 rounded-xl bg-slate-100 text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {bulkMessage && (
              <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-semibold ${
                bulkMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {bulkMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                <span>{bulkMessage.text}</span>
              </div>
            )}

            {defaultSignature ? (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-slate-800 space-y-2">
                  <div className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-[#FF6B00]" />
                    Ready to Approve All Employees
                  </div>
                  <p className="text-xs text-slate-600">
                    This will digitally sign and set <strong>APPROVED</strong> status for <strong>{filteredAndSortedData.length} employees</strong> for month <strong>{selectedMonth}</strong>.
                  </p>
                </div>

                <div className="p-3 border border-slate-200 rounded-xl bg-slate-50 text-center">
                  <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Applying Saved Approver Signature:</div>
                  <img src={defaultSignature} alt="Default Signature" className="h-16 mx-auto object-contain" />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-700">Please draw or upload your signature to approve all timesheets:</p>

                <div className="border-2 border-slate-300 rounded-2xl overflow-hidden bg-white shadow-inner cursor-crosshair">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="w-full h-36 touch-none"
                    onMouseDown={e => startDrawing(canvasRef.current, e)}
                    onMouseMove={e => draw(canvasRef.current, e)}
                    onMouseUp={() => stopDrawing(canvasRef.current, setSignatureData)}
                    onMouseLeave={() => stopDrawing(canvasRef.current, setSignatureData)}
                    onTouchStart={e => startDrawing(canvasRef.current, e)}
                    onTouchMove={e => draw(canvasRef.current, e)}
                    onTouchEnd={() => stopDrawing(canvasRef.current, setSignatureData)}
                  />
                </div>

                <input
                  type="file"
                  accept="image/png"
                  onChange={e => handleSignatureFileUpload(e, setSignatureData)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white"
                />
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkApproveModal(false)}
                disabled={bulkSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteBulkApproveAll}
                disabled={bulkSubmitting}
                className="px-6 py-2 rounded-xl btn-orange text-xs font-black shadow-lg flex items-center gap-2"
              >
                {bulkSubmitting ? (
                  <span>Executing Bulk Approval...</span>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                    <span>Confirm &amp; Approve All ({filteredAndSortedData.length} Users)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECT TIMESHEET MODAL */}
      {inspectUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="glass-card max-w-4xl w-full rounded-3xl p-6 space-y-4 shadow-2xl bg-white/95 max-h-[85vh] flex flex-col">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-[#FF6B00]" />
                  Timesheet Details: {inspectUser.username} ({inspectUser.user_id})
                </h3>
                <p className="text-xs text-slate-500 font-medium">Month: {selectedMonth}</p>
              </div>

              <button
                onClick={() => setInspectUser(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto flex-1 max-h-[50vh]">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-900 text-white font-semibold uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Day</th>
                    <th className="px-3 py-2.5 text-center">Reg Hours</th>
                    <th className="px-3 py-2.5 text-center">Overtime</th>
                    <th className="px-3 py-2.5">Area Allocations</th>
                    <th className="px-3 py-2.5">Shift</th>
                    <th className="px-3 py-2.5">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loadingEntries ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading user timesheet...</td>
                    </tr>
                  ) : userTimesheetEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">No timesheet entries found for this month.</td>
                    </tr>
                  ) : (
                    userTimesheetEntries.map((r) => {
                      const areasJoined = [r.area1, r.area2, r.area3, r.area4].filter(Boolean).join(', ');
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono font-semibold">{r.date}</td>
                          <td className="px-3 py-2 text-slate-500">{r.day}</td>
                          <td className="px-3 py-2 text-center font-bold text-slate-900">{r.working_hours}</td>
                          <td className="px-3 py-2 text-center font-bold text-[#FF6B00]">{r.overtime_hours}</td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-950 text-[10px] font-semibold">
                              {areasJoined || 'N/A'}
                            </span>
                          </td>
                          <td className="px-3 py-2">{r.shift}</td>
                          <td className="px-3 py-2 text-slate-500 italic">{r.remark || '-'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => handleExportUserExcel(inspectUser.user_id)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Metso Excel</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = inspectUser;
                  setInspectUser(null);
                  handleOpenApproveModal(target);
                }}
                className="px-5 py-2 rounded-xl btn-orange font-extrabold flex items-center gap-1.5"
              >
                <PenTool className="w-4 h-4" />
                <span>Proceed to Sign &amp; Approve</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SINGLE DIGITAL SIGNATURE APPROVAL MODAL */}
      {approveTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="glass-card max-w-lg w-full rounded-3xl p-6 space-y-4 shadow-2xl bg-white/95">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <PenTool className="w-5 h-5 text-[#FF6B00]" />
                  Digital Signature Approval
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Approving timesheet for <strong>{approveTarget.username}</strong> ({selectedMonth})
                </p>
              </div>

              <button
                onClick={() => setApproveTarget(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {approvalMessage && (
              <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-semibold ${
                approvalMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {approvalMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                <span>{approvalMessage.text}</span>
              </div>
            )}

            {/* Signature Input Mode Tabs */}
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSignatureMode('draw')}
                className={`flex-1 py-1.5 rounded-lg transition ${signatureMode === 'draw' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
              >
                Draw on Sign Pad
              </button>
              <button
                type="button"
                onClick={() => setSignatureMode('upload')}
                className={`flex-1 py-1.5 rounded-lg transition ${signatureMode === 'upload' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
              >
                Upload PNG Signature
              </button>
            </div>

            {/* DRAW MODE (CANVAS) */}
            {signatureMode === 'draw' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                  <span>Sign inside the box below:</span>
                  <button
                    type="button"
                    onClick={() => clearCanvas(canvasRef.current)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Pad
                  </button>
                </div>

                <div className="border-2 border-slate-300 rounded-2xl overflow-hidden bg-white shadow-inner cursor-crosshair">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={160}
                    className="w-full h-40 touch-none"
                    onMouseDown={e => startDrawing(canvasRef.current, e)}
                    onMouseMove={e => draw(canvasRef.current, e)}
                    onMouseUp={() => stopDrawing(canvasRef.current, setSignatureData)}
                    onMouseLeave={() => stopDrawing(canvasRef.current, setSignatureData)}
                    onTouchStart={e => startDrawing(canvasRef.current, e)}
                    onTouchMove={e => draw(canvasRef.current, e)}
                    onTouchEnd={() => stopDrawing(canvasRef.current, setSignatureData)}
                  />
                </div>
              </div>
            )}

            {/* UPLOAD MODE */}
            {signatureMode === 'upload' && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700">Select Signature PNG Image</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={e => handleSignatureFileUpload(e, setSignatureData)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800"
                />

                {(signatureData || defaultSignature) && (
                  <div className="p-3 border border-slate-200 rounded-xl bg-slate-50 text-center">
                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Signature Preview:</div>
                    <img src={signatureData || defaultSignature} alt="Signature Preview" className="h-16 mx-auto object-contain" />
                  </div>
                )}
              </div>
            )}

            {/* Approver Details Confirmation */}
            <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-[#FF6B00]" />
                Approver Confirmation:
              </div>
              <p className="text-[11px] text-slate-600">
                Approver: <strong>{currentUser.username}</strong> ({currentUser.id}) &bull; Role: <strong>{currentUser.role}</strong>
              </p>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleSubmitApproval('Rejected')}
                disabled={submittingApproval}
                className="px-4 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold transition"
              >
                Reject
              </button>

              <button
                type="button"
                onClick={() => handleSubmitApproval('Approved')}
                disabled={submittingApproval}
                className="px-6 py-2 rounded-xl btn-orange text-xs font-extrabold shadow-md flex items-center gap-2"
              >
                {submittingApproval ? (
                  <span>Signing &amp; Approving...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve &amp; Sign Timesheet</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
