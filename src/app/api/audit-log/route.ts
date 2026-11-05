import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit')) || 200;
    const userId = searchParams.get('userId') || searchParams.get('user_id');
    const userRole = searchParams.get('userRole') || searchParams.get('user_role');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const selectedUser = searchParams.get('user');
    const selectedAction = searchParams.get('action');
    const selectedStatus = searchParams.get('status');

    const roleLower = (userRole || '').toLowerCase();
    const userIdLower = (userId || '').toLowerCase();
    const isPrivileged = roleLower === 'superuser' || 
                         roleLower === 'site admin' || 
                         roleLower.includes('director') || 
                         userIdLower === 'prime' || 
                         userIdLower === 'com116';

    let query = `
      SELECT id, timestamp, user_id, username, action, description, status
      FROM audit_log
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    // Regular users can strictly only see audit logs of themselves
    if (!isPrivileged) {
      if (userId) {
        conditions.push('(user_id = ? OR username = ?)');
        params.push(userId, userId);
      } else {
        conditions.push('1 = 0');
      }
    } else if (selectedUser && selectedUser !== 'All') {
      conditions.push('(user_id = ? OR username = ?)');
      params.push(selectedUser, selectedUser);
    }

    if (startDate) {
      conditions.push('timestamp >= ?');
      params.push(`${startDate} 00:00:00`);
    }
    if (endDate) {
      conditions.push('timestamp <= ?');
      params.push(`${endDate} 23:59:59`);
    }
    if (selectedAction && selectedAction !== 'All') {
      conditions.push('action = ?');
      params.push(selectedAction);
    }
    if (selectedStatus && selectedStatus !== 'All') {
      conditions.push('status = ?');
      params.push(selectedStatus);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY id DESC LIMIT ?`;
    params.push(limit);

    const logs = db.prepare(query).all(...params);

    return NextResponse.json({ success: true, data: logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
