import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/socketBroadcaster';
import { getWibTimestamp, getWibMonthStr, getTimesheetAllowedDateRange, isTimesheetDateAllowed } from '@/lib/dateUtils';

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
    const userIdsParam = searchParams.get('userIds');
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

    if (userIdsParam) {
      const idList = userIdsParam.split(',').map(s => s.trim()).filter(Boolean);
      if (idList.length > 0) {
        const placeholders = idList.map(() => '?').join(',');
        query += ` AND user_id IN (${placeholders})`;
        params.push(...idList);
      }
    } else if (userId && userId !== 'ALL') {
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
    if (!userIdsParam && (!userId || userId === 'ALL') && !startDate && !endDate) {
      query += ' LIMIT 500';
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

    // If regular user (non-superuser), strictly validate that all entry dates belong to allowed window: current active month + last 1 week of previous month (GMT+7 WIB)
    if (!isSuperUser) {
      const { minDate, maxDate } = getTimesheetAllowedDateRange();
      for (const row of entries) {
        if (!row.date || !isTimesheetDateAllowed(row.date)) {
          return NextResponse.json({
            error: `Timesheet submission is locked to the active period (${minDate} to ${maxDate} WIB). Date '${row.date}' falls outside this period.`
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

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { rows, adminId, adminName } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided to update' }, { status: 400 });
    }

    const timestamp = getWibTimestamp();

    const updateStmt = db.prepare(`
      UPDATE presensi 
      SET working_hours = ?, hours = ?, overtime_hours = ?, overtime = ?, 
          area1 = ?, area2 = ?, area3 = ?, area4 = ?, shift = ?, remark = ?,
          timestamp = ?
      WHERE id = ?
    `);

    const updateTransaction = db.transaction((items: any[]) => {
      for (const item of items) {
        const hrs = Number(item.working_hours ?? item.hours ?? 0);
        const ot = Number(item.overtime_hours ?? item.overtime ?? 0);
        const a1 = item.area1 || 'CMN';
        const a2 = item.area2 || 'CMN';
        const a3 = item.area3 || '';
        const a4 = item.area4 || '';
        const sft = item.shift || 'Day Shift';
        const rmk = item.remark || '';

        updateStmt.run(hrs, hrs, ot, ot, a1, a2, a3, a4, sft, rmk, timestamp, item.id);
      }
    });

    updateTransaction(rows);

    // Audit Log
    db.prepare(`
      INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      timestamp,
      adminId || 'superuser',
      adminName || 'Superuser',
      'Superuser Batch Correction',
      `Superuser corrected ${rows.length} timesheet records directly via Excel Data Editor`,
      'Success'
    );

    await broadcastRealtimeEvent('timesheet_updated', {
      action: 'superuser_correction',
      count: rows.length,
      timestamp
    });

    return NextResponse.json({ success: true, message: `Successfully saved ${rows.length} corrected records!` });
  } catch (error: any) {
    console.error('PUT /api/timesheet error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const adminId = searchParams.get('adminId');
    const adminName = searchParams.get('adminName') || 'Superuser';

    if (!id) {
      return NextResponse.json({ error: 'Missing entry id to delete' }, { status: 400 });
    }

    const entry = db.prepare(`SELECT * FROM presensi WHERE id = ?`).get(id) as any;
    if (!entry) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    db.prepare(`DELETE FROM presensi WHERE id = ?`).run(id);

    const timestamp = getWibTimestamp();

    // Audit Log
    db.prepare(`
      INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      timestamp,
      adminId || 'superuser',
      adminName,
      'Superuser Delete Record',
      `Deleted timesheet record #${id} for user ${entry.username} (${entry.user_id}) date ${entry.date}`,
      'Success'
    );

    await broadcastRealtimeEvent('timesheet_updated', {
      action: 'delete',
      id,
      user_id: entry.user_id,
      username: entry.username,
      date: entry.date,
      timestamp
    });

    return NextResponse.json({ success: true, message: 'Record deleted successfully!' });
  } catch (error: any) {
    console.error('DELETE /api/timesheet error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
