'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, PieChart, Zap, Calendar, 
  RefreshCw, Award, MapPin, Flame, CalendarRange
} from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { getWibMonthStr } from '@/lib/dateUtils';

interface WorkhourAnalyticsTabProps {
  currentUser: any;
}

export default function WorkhourAnalyticsTab({ currentUser }: WorkhourAnalyticsTabProps) {
  const currentMonthStr = getWibMonthStr(); // YYYY-MM in GMT+7 WIB
  const currentYearStr = currentMonthStr.substring(0, 4); // YYYY

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [loading, setLoading] = useState(false);

  const [analytics, setAnalytics] = useState<{
    dailyTimeline: any[];
    yearlyTimeline: any[];
    areaBreakdown: any[];
    topEmployees: any[];
    kpiSummary: any;
  }>({
    dailyTimeline: [],
    yearlyTimeline: [],
    areaBreakdown: [],
    topEmployees: [],
    kpiSummary: {
      peakDay: { date: 'N/A', hours: 0 },
      peakOvertimeDay: { date: 'N/A', overtime: 0 },
      yearlyTotalWH: 0,
      yearlyTotalOT: 0,
      peakMonth: { monthName: 'N/A', grandTotal: 0 },
      totalAreaCount: 0,
      topArea: { name: 'N/A', hours: 0, percentage: 0 }
    }
  });

  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);
  const [hoveredPointPos, setHoveredPointPos] = useState<{ leftPct: number; topPx: number } | null>(null);
  const [hoveredYearlyMonth, setHoveredYearlyMonth] = useState<any | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/codex/analytics?month=${selectedMonth}&year=${selectedYear}`));
      const data = await res.json();

      if (data.success) {
        setAnalytics({
          dailyTimeline: data.dailyTimeline || [],
          yearlyTimeline: data.yearlyTimeline || [],
          areaBreakdown: data.areaBreakdown || [],
          topEmployees: data.topEmployees || [],
          kpiSummary: data.kpiSummary || {}
        });
      }
    } catch (e) {
      console.error("Failed to load workhour analytics", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedMonth, selectedYear]);

  // Color palette for area breakdown doughnut chart
  const AREA_COLORS = [
    '#FF6B00', '#3B82F6', '#10B981', '#8B5CF6', 
    '#EC4899', '#F59E0B', '#6366F1', '#14B8A6'
  ];

  // SVG Daily Line Chart calculation
  const timeline = analytics.dailyTimeline;
  const maxHours = Math.max(...timeline.map(d => d.total_hours || 0), 10);
  const chartHeight = 220;
  const chartWidth = 700;

  // Compute SVG Points for Regular Hours Line
  const pointsString = timeline.map((d, idx) => {
    const x = timeline.length > 1 ? (idx / (timeline.length - 1)) * (chartWidth - 40) + 20 : chartWidth / 2;
    const y = chartHeight - 30 - ((d.total_hours || 0) / maxHours) * (chartHeight - 60);
    return `${x},${y}`;
  }).join(' ');

  // Compute SVG Points for Overtime Line
  const otPointsString = timeline.map((d, idx) => {
    const x = timeline.length > 1 ? (idx / (timeline.length - 1)) * (chartWidth - 40) + 20 : chartWidth / 2;
    const y = chartHeight - 30 - ((d.total_overtime || 0) / maxHours) * (chartHeight - 60);
    return `${x},${y}`;
  }).join(' ');

  // Yearly Chart Calculations
  const yearlyTimeline = analytics.yearlyTimeline;
  const maxYearlyVal = Math.max(...yearlyTimeline.map(m => (m.total_hours || 0) + (m.total_overtime || 0)), 100);

  return (
    <div className="space-y-6 animate-smooth-fade">
      
      {/* Header Bar & Month/Year Selectors */}
      <div className="glass-card rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#FF6B00]" />
            Work Hour Cumulative Analytics Dashboard
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Cumulative workhour timeline, annual trends (WH &amp; OT), peak activity days &amp; area breakdown.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Filter Year</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs glass-input font-bold text-slate-800"
            >
              <option value="2025">Year 2025</option>
              <option value="2026">Year 2026</option>
              <option value="2027">Year 2027</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Filter Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => {
                setSelectedMonth(e.target.value);
                setSelectedYear(e.target.value.substring(0, 4));
              }}
              className="px-3 py-1.5 rounded-xl text-xs glass-input font-bold text-slate-800"
            />
          </div>

          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="self-end px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* YEARLY TIMELINE CHART SECTION */}
      <div className="glass-card rounded-2xl p-5 space-y-4 shadow-sm border border-white/80">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <CalendarRange className="w-5 h-5 text-[#FF6B00]" />
              Annual Timeline Trend by Year ({selectedYear}) — Workhours &amp; Overtime
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              12-month cumulative comparison of Regular Workhours (WH) and Overtime (OT).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-bold bg-white/70 px-3 py-1.5 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-[#FF6B00]" />
              <span className="text-slate-800">Regular WH ({analytics.kpiSummary?.yearlyTotalWH || 0} hrs)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-amber-500" />
              <span className="text-slate-800">Overtime OT ({analytics.kpiSummary?.yearlyTotalOT || 0} hrs)</span>
            </div>
          </div>
        </div>

        {/* 12 Months Dual Bar Chart Container */}
        <div className="relative pt-16 pb-2">
          <div className="h-48 flex items-end justify-between gap-2 sm:gap-3 px-2 overflow-visible">
            {yearlyTimeline.map((item) => {
              const whHeightPct = (item.total_hours / maxYearlyVal) * 100;
              const otHeightPct = (item.total_overtime / maxYearlyVal) * 100;
              const isSelected = item.monthKey === selectedMonth;
              const isHovered = hoveredYearlyMonth?.monthKey === item.monthKey;

              return (
                <div
                  key={item.monthKey}
                  onClick={() => setSelectedMonth(item.monthKey)}
                  onMouseEnter={() => setHoveredYearlyMonth(item)}
                  onMouseLeave={() => setHoveredYearlyMonth(null)}
                  className={`relative flex-1 flex flex-col items-center gap-1.5 group cursor-pointer p-1 rounded-xl transition duration-200 ${
                    isSelected ? 'bg-orange-100/60 ring-2 ring-[#FF6B00]' : 'hover:bg-white/80'
                  }`}
                >
                  {/* Floating Hover Tooltip Directly Above Pointer / Bar */}
                  {isHovered && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 pointer-events-none select-none glass-card bg-slate-900/95 text-white p-3 rounded-2xl shadow-2xl text-xs space-y-1 backdrop-blur-md border border-slate-700/80 animate-in fade-in zoom-in-95 duration-150 z-50 min-w-[185px]">
                      <div className="font-extrabold text-orange-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Month: {item.monthName} ({item.monthKey})</span>
                      </div>
                      <div className="text-[11px] text-slate-200">
                        Regular Workhours: <strong className="text-white font-mono">{item.total_hours} hrs</strong>
                      </div>
                      <div className="text-[11px] text-amber-300">
                        Overtime Hours: <strong className="font-mono">{item.total_overtime} OT hrs</strong>
                      </div>
                      <div className="text-[11px] text-orange-300 font-bold border-t border-slate-700/80 pt-1 flex items-center justify-between">
                        <span>Grand Total:</span>
                        <span className="font-mono">{item.grand_total} hrs</span>
                      </div>
                    </div>
                  )}

                  {/* Bars Stack Container */}
                  <div className="w-full flex items-end justify-center gap-1 h-36">
                    
                    {/* Regular WH Bar */}
                    <div className="w-1/2 max-w-[18px] bg-slate-200/80 rounded-t-md overflow-hidden h-full flex items-end">
                      <div
                        className="w-full bg-gradient-to-t from-[#E05D00] to-[#FF6B00] rounded-t-md transition-all duration-500 group-hover:brightness-110"
                        style={{ height: `${Math.max(whHeightPct, 4)}%` }}
                      />
                    </div>

                    {/* Overtime OT Bar */}
                    <div className="w-1/2 max-w-[18px] bg-slate-200/80 rounded-t-md overflow-hidden h-full flex items-end">
                      <div
                        className="w-full bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-md transition-all duration-500 group-hover:brightness-110"
                        style={{ height: `${Math.max(otHeightPct, 4)}%` }}
                      />
                    </div>

                  </div>

                  {/* Month Label */}
                  <span className={`text-[10px] font-mono font-bold tracking-tight ${
                    isSelected ? 'text-[#FF6B00] scale-110' : 'text-slate-600'
                  }`}>
                    {item.monthName}
                  </span>
                </div>
              );
            })}
          </div>

        </div>

        <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between text-xs text-slate-600 font-medium">
          <div>
            Yearly Total WH: <strong className="text-slate-900 font-bold">{analytics.kpiSummary?.yearlyTotalWH || 0} hrs</strong> &bull; Total OT: <strong className="text-[#FF6B00] font-bold">{analytics.kpiSummary?.yearlyTotalOT || 0} OT hrs</strong>
          </div>
          <div>
            Peak Month ({selectedYear}): <strong className="text-emerald-600 font-bold">{analytics.kpiSummary?.peakMonth?.monthName || 'N/A'}</strong> ({analytics.kpiSummary?.peakMonth?.grandTotal || 0} hrs)
          </div>
        </div>

      </div>

      {/* Top Insight KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Peak Work Date */}
        <div className="glass-card p-4 rounded-2xl flex items-center gap-3 hover:scale-[1.02] transition duration-200">
          <div className="w-11 h-11 rounded-xl bg-orange-100 text-[#FF6B00] flex items-center justify-center font-bold">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Peak Activity Date</div>
            <div className="text-base font-black text-slate-900">
              {analytics.kpiSummary?.peakDay?.date || 'N/A'}
            </div>
            <div className="text-xs font-bold text-[#FF6B00]">
              {analytics.kpiSummary?.peakDay?.hours || 0} hrs total
            </div>
          </div>
        </div>

        {/* Peak Overtime Date */}
        <div className="glass-card p-4 rounded-2xl flex items-center gap-3 hover:scale-[1.02] transition duration-200">
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Peak Overtime Date</div>
            <div className="text-base font-black text-slate-900">
              {analytics.kpiSummary?.peakOvertimeDay?.date || 'N/A'}
            </div>
            <div className="text-xs font-bold text-amber-600">
              {analytics.kpiSummary?.peakOvertimeDay?.overtime || 0} OT hrs
            </div>
          </div>
        </div>

        {/* Top Active Area */}
        <div className="glass-card p-4 rounded-2xl flex items-center gap-3 hover:scale-[1.02] transition duration-200">
          <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Top Area</div>
            <div className="text-base font-black text-slate-900">
              {analytics.kpiSummary?.topArea?.name || 'N/A'}
            </div>
            <div className="text-xs font-bold text-blue-600">
              {analytics.kpiSummary?.topArea?.hours || 0} hrs ({analytics.kpiSummary?.topArea?.percentage || 0}%)
            </div>
          </div>
        </div>

        {/* Hardest Working Contributor */}
        <div className="glass-card p-4 rounded-2xl flex items-center gap-3 hover:scale-[1.02] transition duration-200">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Top Contributor</div>
            <div className="text-base font-black text-slate-900 truncate max-w-[140px]">
              {analytics.topEmployees[0]?.username || 'N/A'}
            </div>
            <div className="text-xs font-bold text-emerald-600">
              {analytics.topEmployees[0]?.total_hours || 0} hrs ({analytics.topEmployees[0]?.total_overtime || 0} OT)
            </div>
          </div>
        </div>

      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CUMULATIVE WORKHOUR TREND LINE CHART (2 Cols) */}
        <div
          key={`chart-card-${selectedMonth}`}
          className="glass-card lg:col-span-2 rounded-2xl p-5 space-y-4 shadow-sm border border-white/80 animate-smooth-fade animate-smooth-scale"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#FF6B00]" />
                Daily Cumulative Timeline Trend ({selectedMonth})
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Daily total regular hours vs overtime hours across timeline. Hover points for details.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs font-bold">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#FF6B00]" />
                <span className="text-slate-700">Reg Hours</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-slate-700">Overtime</span>
              </div>
            </div>
          </div>

          {/* SVG Smooth Line Chart Container */}
          <div key={`chart-svg-${selectedMonth}`} className="relative w-full overflow-x-auto pt-2 pb-4 animate-smooth-scale">

            {timeline.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-xs text-slate-400 font-medium">
                No timesheet entries found for selected month ({selectedMonth}).
              </div>
            ) : (
              <div className="min-w-[650px] relative">
                
                {/* Floating Hover Tooltip Directly Near Pointer Dot */}
                {hoveredPoint && hoveredPointPos && (
                  <div
                    className="absolute pointer-events-none select-none glass-card bg-slate-900/95 text-white p-3 rounded-2xl shadow-2xl text-xs space-y-1 backdrop-blur-md border border-slate-700/80 animate-in fade-in zoom-in-95 duration-100 z-50 -translate-x-1/2 min-w-[170px]"
                    style={{
                      left: `${hoveredPointPos.leftPct}%`,
                      top: `${Math.max(hoveredPointPos.topPx - 118, 5)}px`
                    }}
                  >
                    <div className="font-extrabold text-orange-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{hoveredPoint.date}</span>
                    </div>
                    <div className="text-[11px] text-slate-200">
                      Regular WH: <strong className="text-white font-mono">{hoveredPoint.total_hours} hrs</strong>
                    </div>
                    <div className="text-[11px] text-amber-300">
                      Overtime: <strong className="font-mono">{hoveredPoint.total_overtime} OT hrs</strong>
                    </div>
                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-700/80">
                      Active Staff: <strong>{hoveredPoint.active_users} staff</strong>
                    </div>
                  </div>
                )}

                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-56 overflow-visible">
                  
                  {/* Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                    const y = chartHeight - 30 - pct * (chartHeight - 60);
                    const val = Math.round(pct * maxHours);
                    return (
                      <g key={idx}>
                        <line x1="20" y1={y} x2={chartWidth - 20} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="1" />
                        <text x="5" y={y + 3} fill="#94a3b8" fontSize="9" fontWeight="bold">{val}</text>
                      </g>
                    );
                  })}

                  {/* Gradient Fill under Regular Hours line */}
                  <defs>
                    <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF6B00" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#FF6B00" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Regular Hours Area */}
                  {timeline.length > 1 && (
                    <polygon
                      points={`20,${chartHeight - 30} ${pointsString} ${chartWidth - 20},${chartHeight - 30}`}
                      fill="url(#regGrad)"
                    />
                  )}

                  {/* Regular Hours Line */}
                  <polyline
                    fill="none"
                    stroke="#FF6B00"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={pointsString}
                  />

                  {/* Overtime Line */}
                  <polyline
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={otPointsString}
                  />

                  {/* Data Points */}
                  {timeline.map((d, idx) => {
                    const x = timeline.length > 1 ? (idx / (timeline.length - 1)) * (chartWidth - 40) + 20 : chartWidth / 2;
                    const yReg = chartHeight - 30 - ((d.total_hours || 0) / maxHours) * (chartHeight - 60);
                    const leftPct = (x / chartWidth) * 100;

                    return (
                      <g 
                        key={d.date} 
                        className="cursor-pointer group"
                        onMouseEnter={() => {
                          setHoveredPoint(d);
                          setHoveredPointPos({ leftPct, topPx: yReg });
                        }}
                        onMouseLeave={() => {
                          setHoveredPoint(null);
                          setHoveredPointPos(null);
                        }}
                      >
                        {/* Invisible enlarged hit target to ensure ultra-smooth mouse tracking */}
                        <circle cx={x} cy={yReg} r="12" fill="transparent" />
                        
                        <circle
                          cx={x}
                          cy={yReg}
                          r="5"
                          className="fill-[#FF6B00] stroke-white stroke-2"
                        />
                        {/* Date Label */}
                        <text
                          x={x}
                          y={chartHeight - 10}
                          textAnchor="middle"
                          fill="#64748b"
                          fontSize="8"
                          fontWeight="bold"
                        >
                          {d.date.substring(8)}
                        </text>
                      </g>
                    );
                  })}
                </svg>

              </div>
            )}
          </div>
        </div>

        {/* AREA DISTRIBUTION DONUT CHART (1 Col) */}
        <div
          key={`area-card-${selectedMonth}`}
          className="glass-card rounded-2xl p-5 space-y-4 shadow-sm border border-white/80 flex flex-col justify-between animate-smooth-fade"
        >
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[#FF6B00]" />
              Workhour Distribution by Area ({selectedMonth})
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Percentage breakdown of hours spent across commissioning areas.
            </p>
          </div>

          {analytics.areaBreakdown.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400">
              No area allocation data available for selected month.
            </div>
          ) : (
            <div className="space-y-4 my-auto">
              
              {/* Doughnut / Bar Progress Visual Representation */}
              <div className="space-y-2">
                {analytics.areaBreakdown.map((item, idx) => {
                  const color = AREA_COLORS[idx % AREA_COLORS.length];
                  return (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-slate-800">{item.name}</span>
                        </div>
                        <span className="text-slate-900 font-mono">
                          {item.hours} hrs <span className="text-[10px] text-slate-400">({item.percentage}%)</span>
                        </span>
                      </div>

                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${item.percentage}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-500 flex items-center justify-between font-medium">
            <span>Total Active Areas: <strong>{analytics.areaBreakdown.length}</strong></span>
            <span className="text-[#FF6B00] font-bold">Live Breakdown</span>
          </div>

        </div>

      </div>

      {/* BOTTOM SECTION: OVERTIME BAR CHART & HARDEST WORKING EMPLOYEES LEADERBOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* OVERTIME TIMELINE BAR CHART */}
        <div
          key={`ot-card-${selectedMonth}`}
          className="glass-card rounded-2xl p-5 space-y-4 shadow-sm border border-white/80 animate-smooth-fade"
        >

          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Overtime Hours Timeline Spikes ({selectedMonth})
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Overtime hours distribution across days to identify peak fatigue periods.
            </p>
          </div>

          <div className="h-48 flex items-end justify-between gap-1 pt-6 pb-2 px-2 overflow-x-auto relative">
            {timeline.length === 0 ? (
              <div className="w-full text-center text-xs text-slate-400 my-auto">No overtime recorded for selected month.</div>
            ) : (
              timeline.map((d) => {
                const maxOt = Math.max(...timeline.map(item => item.total_overtime || 0), 5);
                const heightPct = (d.total_overtime / maxOt) * 100;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative min-w-[12px]">
                    
                    {/* Floating Hover Tooltip Directly Above Bar */}
                    <div className="absolute bottom-full mb-3 opacity-0 group-hover:opacity-100 transition duration-150 pointer-events-none select-none glass-card bg-slate-900/95 text-white text-[10px] p-2 rounded-xl font-bold whitespace-nowrap z-50 shadow-xl border border-slate-700/80 -translate-x-1/2 left-1/2">
                      <div className="text-amber-400">{d.date}</div>
                      <div>{d.total_overtime} OT Hours</div>
                    </div>

                    <div
                      className={`w-full rounded-t-lg transition-all duration-300 ${
                        d.total_overtime > 0 ? 'bg-amber-500 hover:bg-amber-400' : 'bg-slate-200'
                      }`}
                      style={{ height: `${Math.max(heightPct, 6)}%` }}
                    />
                    <span className="text-[8px] font-mono text-slate-400 font-semibold">{d.date.substring(8)}</span>

                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* TOP WORKHOUR LEADERBOARD */}
        <div className="glass-card rounded-2xl p-5 space-y-4 shadow-sm border border-white/80">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#FF6B00]" />
              Top Workhour Contributors ({selectedMonth})
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Ranking of staff with highest cumulative regular &amp; overtime hours.
            </p>
          </div>

          <div className="space-y-3">
            {analytics.topEmployees.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No staff workhour data found for selected month.</div>
            ) : (
              analytics.topEmployees.map((emp, idx) => {
                const rankBadge = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;

                return (
                  <div key={emp.user_id} className="p-2.5 rounded-xl bg-white/60 hover:bg-white border border-slate-200/60 flex items-center justify-between gap-3 transition shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-bold w-6 text-center">{rankBadge}</span>
                      <div>
                        <div className="text-xs font-black text-slate-900">{emp.username}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{emp.user_id} &bull; {emp.total_days} active days</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-black text-slate-900">{emp.total_hours} hrs</div>
                      <div className="text-[10px] font-bold text-[#FF6B00]">+{emp.total_overtime} OT hrs</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
