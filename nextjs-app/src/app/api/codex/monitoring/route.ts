import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || new Date().toISOString().substring(0, 7); // YYYY-MM
    const monthPattern = `${month}-%`;

    // 1. Fetch all users
    const users = db.prepare('SELECT id, username, role, grade FROM users ORDER BY id ASC').all() as any[];

    // 2. Fetch presensi aggregated per user for the month
    const presensiSummary = db.prepare(`
      SELECT 
        user_id,
        COUNT(*) as total_entries,
        SUM(COALESCE(working_hours, hours, 8)) as total_hours,
        SUM(COALESCE(overtime_hours, overtime, 0)) as total_overtime,
        MAX(COALESCE(timestamp, submission_timestamp)) as last_submission
      FROM presensi
      WHERE date LIKE ?
      GROUP BY user_id
    `).all(monthPattern) as any[];

    const presensiMap = new Map<string, any>();
    presensiSummary.forEach(p => presensiMap.set(p.user_id, p));

    // 3. Fetch approval records for the month
    const approvals = db.prepare(`
      SELECT id, user_id, month, status, approver_id, approver_name, timestamp, signature_data
      FROM approvals
      WHERE month = ?
    `).all(month) as any[];

    const approvalMap = new Map<string, any>();
    approvals.forEach(a => approvalMap.set(a.user_id, a));

    // 4. Combine into monitoring user list
    const monitoringList = users.map(u => {
      const p = presensiMap.get(u.id);
      const app = approvalMap.get(u.id);

      return {
        user_id: u.id,
        username: u.username,
        role: u.role,
        grade: u.grade,
        total_entries: p?.total_entries || 0,
        total_hours: p?.total_hours || 0,
        total_overtime: p?.total_overtime || 0,
        last_submission: p?.last_submission || null,
        approval_status: app ? app.status : (p?.total_entries > 0 ? 'Pending' : 'Unsubmitted'),
        approver_name: app ? app.approver_name : null,
        approval_timestamp: app ? app.timestamp : null,
        has_signature: Boolean(app?.signature_data)
      };
    });

    // KPI Aggregations
    const totalUsers = users.length;
    const submittedUsers = monitoringList.filter(m => m.total_entries > 0).length;
    const approvedCount = monitoringList.filter(m => m.approval_status === 'Approved').length;
    const pendingCount = monitoringList.filter(m => m.approval_status === 'Pending').length;

    const grandTotalHours = monitoringList.reduce((acc, m) => acc + m.total_hours, 0);
    const grandTotalOvertime = monitoringList.reduce((acc, m) => acc + m.total_overtime, 0);

    return NextResponse.json({
      success: true,
      month,
      kpi: {
        totalUsers,
        submittedUsers,
        approvedCount,
        pendingCount,
        grandTotalHours,
        grandTotalOvertime
      },
      data: monitoringList
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
