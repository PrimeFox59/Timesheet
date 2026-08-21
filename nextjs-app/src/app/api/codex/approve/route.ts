import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/socketBroadcaster';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, month, status = 'Approved', approver_id, approver_name, signature_data } = body;

    if (!user_id || !month || !approver_id || !signature_data) {
      return NextResponse.json({ error: 'user_id, month, approver_id, and signature_data are required.' }, { status: 400 });
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const upsertStmt = db.prepare(`
      INSERT INTO approvals (user_id, month, status, approver_id, approver_name, signature_data, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, month) DO UPDATE SET
        status = excluded.status,
        approver_id = excluded.approver_id,
        approver_name = excluded.approver_name,
        signature_data = excluded.signature_data,
        timestamp = excluded.timestamp
    `);

    upsertStmt.run(
      user_id,
      month,
      status,
      approver_id,
      approver_name || approver_id,
      signature_data,
      timestamp
    );

    // Audit Log
    db.prepare(`
      INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      timestamp,
      approver_id,
      approver_name || approver_id,
      'Timesheet Digital Approval',
      `Approved timesheet for user '${user_id}' for month '${month}' with digital signature`,
      'Success'
    );

    // Broadcast Realtime Event
    await broadcastRealtimeEvent('timesheet_updated', {
      action: 'approval',
      user_id,
      month,
      approver_id
    });

    return NextResponse.json({
      success: true,
      message: `Timesheet for user '${user_id}' successfully ${status.toLowerCase()} and digitally signed!`
    });

  } catch (error: any) {
    console.error('Approval API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to approve timesheet' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const month = searchParams.get('month');

    if (!userId || !month) {
      return NextResponse.json({ error: 'userId and month parameters are required.' }, { status: 400 });
    }

    const approval = db.prepare(`
      SELECT id, user_id, month, status, approver_id, approver_name, signature_data, timestamp
      FROM approvals
      WHERE user_id = ? AND month = ?
    `).get(userId, month);

    return NextResponse.json({ success: true, data: approval || null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
