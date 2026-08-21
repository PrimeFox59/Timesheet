import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const username = searchParams.get('username');
    const shift = searchParams.get('shift');
    const area = searchParams.get('area');
    const limit = Number(searchParams.get('limit')) || (startDate || endDate || username !== 'All' ? 500 : 50);

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (startDate) {
      whereClause += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND date <= ?';
      params.push(endDate);
    }
    if (username && username !== 'All') {
      whereClause += ' AND username = ?';
      params.push(username);
    }
    if (shift && shift !== 'All') {
      whereClause += ' AND shift = ?';
      params.push(shift);
    }
    if (area && area !== 'All') {
      whereClause += ' AND (area1 = ? OR area2 = ? OR area3 = ? OR area4 = ?)';
      params.push(area, area, area, area);
    }

    // Fast SQL Aggregation for KPI Cards
    const summaryQuery = `
      SELECT 
        COUNT(*) as totalEntries,
        COALESCE(SUM(COALESCE(working_hours, hours, 8)), 0) as totalHours,
        COALESCE(SUM(COALESCE(overtime_hours, overtime, 0)), 0) as totalOvertime,
        COUNT(DISTINCT user_id) as uniqueUsers
      FROM presensi
      ${whereClause}
    `;

    const summary = db.prepare(summaryQuery).get(...params) as any;

    // Fast Limited Query for Table Display
    const recordsQuery = `
      SELECT id, user_id, username, date, day, 
             COALESCE(working_hours, hours, 8) as hours,
             COALESCE(overtime_hours, overtime, 0) as overtime,
             area1, area2, area3, area4, shift, remark,
             COALESCE(timestamp, submission_timestamp, datetime('now')) as timestamp
      FROM presensi
      ${whereClause}
      ORDER BY date DESC, id DESC
      LIMIT ?
    `;

    const rows = db.prepare(recordsQuery).all(...params, limit) as any[];

    return NextResponse.json({
      success: true,
      data: rows,
      summary: {
        totalEntries: summary?.totalEntries || 0,
        totalHours: summary?.totalHours || 0,
        totalOvertime: summary?.totalOvertime || 0,
        uniqueUsers: summary?.uniqueUsers || 0
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
