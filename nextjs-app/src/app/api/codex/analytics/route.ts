import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || new Date().toISOString().substring(0, 7); // YYYY-MM
    const year = searchParams.get('year') || month.substring(0, 4); // YYYY

    const monthPattern = `${month}-%`;
    const yearPattern = `${year}-%`;

    // 1. Daily timeline aggregation for selected month
    const dailyRows = db.prepare(`
      SELECT date, 
             SUM(COALESCE(working_hours, hours, 8)) as total_hours,
             SUM(COALESCE(overtime_hours, overtime, 0)) as total_overtime,
             COUNT(DISTINCT user_id) as active_users
      FROM presensi
      WHERE date LIKE ?
      GROUP BY date
      ORDER BY date ASC
    `).all(monthPattern) as any[];

    // 2. Yearly timeline aggregation (Jan - Dec for selected year)
    const yearlyRows = db.prepare(`
      SELECT substr(date, 1, 7) as month_str,
             SUM(COALESCE(working_hours, hours, 8)) as total_hours,
             SUM(COALESCE(overtime_hours, overtime, 0)) as total_overtime
      FROM presensi
      WHERE date LIKE ?
      GROUP BY month_str
      ORDER BY month_str ASC
    `).all(yearPattern) as any[];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let yearlyTotalWH = 0;
    let yearlyTotalOT = 0;
    let peakMonth = { monthName: 'N/A', grandTotal: 0 };

    const yearlyTimeline = monthNames.map((mName, idx) => {
      const mNum = String(idx + 1).padStart(2, '0');
      const monthKey = `${year}-${mNum}`;
      const found = yearlyRows.find(r => r.month_str === monthKey);

      const wh = found ? float(found.total_hours) : 0;
      const ot = found ? float(found.total_overtime) : 0;
      const grandTotal = wh + ot;

      yearlyTotalWH += wh;
      yearlyTotalOT += ot;

      if (grandTotal > peakMonth.grandTotal) {
        peakMonth = { monthName: `${mName} ${year}`, grandTotal };
      }

      return {
        monthKey,
        monthName: mName,
        total_hours: Math.round(wh * 10) / 10,
        total_overtime: Math.round(ot * 10) / 10,
        grand_total: Math.round(grandTotal * 10) / 10
      };
    });

    // 3. Area breakdown for pie/doughnut chart
    const allPresensiInMonth = db.prepare(`
      SELECT area1, area2, area3, area4, 
             COALESCE(working_hours, hours, 8) as hours,
             COALESCE(overtime_hours, overtime, 0) as overtime
      FROM presensi
      WHERE date LIKE ?
    `).all(monthPattern) as any[];

    const areaMap: Record<string, number> = {};
    let totalAllAreaHours = 0;

    for (const r of allPresensiInMonth) {
      const activeAreas = [r.area1, r.area2, r.area3, r.area4].filter(Boolean);
      if (activeAreas.length > 0) {
        const hrsPerArea = (float(r.hours) + float(r.overtime)) / activeAreas.length;
        for (const a of activeAreas) {
          areaMap[a] = (areaMap[a] || 0) + hrsPerArea;
          totalAllAreaHours += hrsPerArea;
        }
      }
    }

    const areaBreakdown = Object.entries(areaMap)
      .map(([name, hours]) => ({
        name,
        hours: Math.round(hours * 10) / 10,
        percentage: totalAllAreaHours > 0 ? Math.round((hours / totalAllAreaHours) * 100) : 0
      }))
      .sort((a, b) => b.hours - a.hours);

    // 4. Top working employees leaderboard
    const topEmployees = db.prepare(`
      SELECT user_id, username,
             SUM(COALESCE(working_hours, hours, 8)) as total_hours,
             SUM(COALESCE(overtime_hours, overtime, 0)) as total_overtime,
             COUNT(date) as total_days
      FROM presensi
      WHERE date LIKE ?
      GROUP BY user_id
      ORDER BY (total_hours + total_overtime) DESC
      LIMIT 6
    `).all(monthPattern) as any[];

    // 5. Identify peak activity day & peak overtime day
    let peakDay = { date: 'N/A', hours: 0 };
    let peakOvertimeDay = { date: 'N/A', overtime: 0 };

    for (const d of dailyRows) {
      if (d.total_hours > peakDay.hours) {
        peakDay = { date: d.date, hours: d.total_hours };
      }
      if (d.total_overtime > peakOvertimeDay.overtime) {
        peakOvertimeDay = { date: d.date, overtime: d.total_overtime };
      }
    }

    return NextResponse.json({
      success: true,
      month,
      year,
      dailyTimeline: dailyRows,
      yearlyTimeline,
      areaBreakdown,
      topEmployees,
      kpiSummary: {
        peakDay,
        peakOvertimeDay,
        yearlyTotalWH: Math.round(yearlyTotalWH),
        yearlyTotalOT: Math.round(yearlyTotalOT),
        peakMonth,
        totalAreaCount: areaBreakdown.length,
        topArea: areaBreakdown[0] || { name: 'N/A', hours: 0 }
      }
    });

  } catch (error: any) {
    console.error('Workhour Analytics API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch analytics' }, { status: 500 });
  }
}

function float(val: any): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}
