import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { emitRealtimeEvent } from '@/lib/events';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { month, approver_id, approver_name, signature_data, target_user_ids } = body;

    if (!month || !approver_id || !signature_data) {
      return NextResponse.json({ error: 'Missing required parameters: month, approver_id, signature_data' }, { status: 400 });
    }

    // Determine target users to approve
    let usersToApprove: string[] = [];

    if (Array.isArray(target_user_ids) && target_user_ids.length > 0) {
      usersToApprove = target_user_ids;
    } else {
      // Fetch ALL users from users database table so all employees are approved!
      const allUsers = db.prepare('SELECT id FROM users').all() as any[];
      usersToApprove = allUsers.map(u => u.id);
    }

    if (usersToApprove.length === 0) {
      return NextResponse.json({ error: 'No employees found for bulk approval.' }, { status: 400 });
    }

    const timestamp = new Date().toISOString();

    // Use SQLite transaction for high speed batch execution
    const insertApprovalStmt = db.prepare(`
      INSERT OR REPLACE INTO approvals (user_id, month, status, approver_id, approver_name, signature_data, timestamp)
      VALUES (?, ?, 'Approved', ?, ?, ?, ?)
    `);

    const auditStmt = db.prepare(`
      INSERT INTO audit_log (timestamp, user_id, username, action, description, details)
      VALUES (?, ?, ?, 'BULK_APPROVE_TIMESHEETS', ?, ?)
    `);

    const bulkTransaction = db.transaction((users: string[]) => {
      let count = 0;
      for (const uId of users) {
        insertApprovalStmt.run(uId, month, approver_id, approver_name || approver_id, signature_data, timestamp);
        count++;
      }
      const descText = `Bulk approved ${count} timesheets for month ${month}`;
      auditStmt.run(
        timestamp,
        approver_id,
        approver_name || approver_id,
        descText,
        descText
      );
      return count;
    });

    const approvedCount = bulkTransaction(usersToApprove);

    // Notify all connected clients via SSE stream
    emitRealtimeEvent('TIMESHEET_BULK_APPROVED', {
      month,
      approved_count: approvedCount,
      approver: approver_name || approver_id,
      timestamp
    });

    return NextResponse.json({
      success: true,
      message: `Successfully approved ${approvedCount} employee timesheets for ${month}!`,
      approved_count: approvedCount
    });

  } catch (error: any) {
    console.error('Bulk Approval API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to execute bulk approval' }, { status: 500 });
  }
}
