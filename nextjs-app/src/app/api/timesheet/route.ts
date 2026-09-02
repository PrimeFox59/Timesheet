import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/socketBroadcaster';
import { getWibTimestamp, getWibMonthStr } from '@/lib/dateUtils';

// Cache prepared queries for maximum speed
const getTimesheetStmt = db.prepare(`
  SELECT id, user_id, username, date, day, 
         COALESCE(working_hours, hours, 8) as working_hours,
         COALESCE(hours, working_hours, 8) as hours,
         COALESCE(overtime_hours, overtime, 0) as overtime_hours,
         COALESCE(overtime, overtime_hours, 0) as overtime,
         area1, area2, area3, area4, shift, remark,
         COALESCE(timestamp, submission_timestamp, datetime('now', '+7 hours')) as timestamp
  FROM presensi 
  WHERE 1=1
`);

const checkExistingStmt = db.prepare(`SELECT id FROM presensi WHERE user_id = ? AND date = ?`);

const insertPresensiStmt = db.prepare(`
  INSERT INTO presensi (date, day, user_id, username, hours, working_hours, overtime, overtime_hours, area1, area2, area3, area4, shift, remark, timestamp, submission_timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updatePresensiStmt = db.prepare(`
  UPDATE presensi
  SET hours = ?, working_hours = ?, overtime = ?, overtime_hours = ?, area1 = ?, area2 = ?, area3 = ?, area4 = ?, shift = ?, remark = ?, timestamp = ?, submission_timestamp = ?
  WHERE user_id = ? AND date = ?
`);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = `
      SELECT id, user_id, username, date, day, 
             COALESCE(working_hours, hours, 8) as working_hours,
             COALESCE(hours, working_hours, 8) as hours,
             COALESCE(overtime_hours, overtime, 0) as overtime_hours,
             COALESCE(overtime, overtime_hours, 0) as overtime,
             area1, area2, area3, area4, shift, remark,
             COALESCE(timestamp, submission_timestamp, datetime('now')) as timestamp
      FROM presensi 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date DESC, id DESC';

    // Limit log view for instant response when no specific filter is selected
    if (!userId && !startDate && !endDate) {
      query += ' LIMIT 300';
    }

    const records = db.prepare(query).all(...params);

    return NextResponse.json({ success: true, data: records });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, username, entries } = body;

    if (!user_id || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'User ID and entries array are required' }, { status: 400 });
    }

    // Check if submitting user has superuser privileges
    const uidLower = String(user_id).toLowerCase();
    let isSuperUser = uidLower === 'prime' || uidLower === 'com116';
    if (!isSuperUser) {
      try {
        const u = db.prepare('SELECT role FROM users WHERE LOWER(id) = LOWER(?)').get(user_id) as any;
        if (u && u.role && u.role.toLowerCase() === 'superuser') {
          isSuperUser = true;
        }
      } catch (e) {}
    }

    // If regular user (non-superuser), strictly validate that all entry dates belong to current running month (YYYY-MM in GMT+7 WIB)
    if (!isSuperUser) {
      const currentYearMonth = getWibMonthStr(); // Always matches Indonesia WIB (YYYY-MM)
      for (const row of entries) {
        if (!row.date || !String(row.date).startsWith(currentYearMonth)) {
          return NextResponse.json({
            error: `Timesheet submission is locked to the current active month (${currentYearMonth} WIB). Date '${row.date}' falls outside this period.`
          }, { status: 400 });
        }
      }
    }

    const timestamp = getWibTimestamp();

    const transaction = db.transaction((rows: any[]) => {
      for (const row of rows) {
        const hrs = Number(row.working_hours ?? row.hours) || 0;
        const ot = Number(row.overtime_hours ?? row.overtime) || 0;
        const a1 = row.area1 || 'CMN';
        const a2 = row.area2 || 'CMN';
        const a3 = row.area3 || '';
        const a4 = row.area4 || '';
        const sft = row.shift || 'Day Shift';
        const rmk = row.remark || '';

        const existing = checkExistingStmt.get(user_id, row.date);
        if (existing) {
          updatePresensiStmt.run(
            hrs, hrs, ot, ot, a1, a2, a3, a4, sft, rmk, timestamp, timestamp, user_id, row.date
          );
        } else {
          insertPresensiStmt.run(
            row.date,
            row.day || 'Monday',
            user_id,
            username,
            hrs, hrs, ot, ot, a1, a2, a3, a4, sft, rmk, timestamp, timestamp
          );
        }
      }
    });

    transaction(entries);

    // Audit Log
    db.prepare(`
      INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      timestamp,
      user_id,
      username,
      'Input Timesheet Submission',
      `Submitted/Updated ${entries.length} daily timesheet records`,
      'Success'
    );

    // Broadcast Realtime Event
    await broadcastRealtimeEvent('timesheet_updated', {
      user_id,
      username,
      count: entries.length,
      timestamp
    });

    return NextResponse.json({ success: true, message: 'Timesheet submitted successfully!' });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
