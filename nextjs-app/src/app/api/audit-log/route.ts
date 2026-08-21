import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit')) || 200;

    const logs = db.prepare(`
      SELECT id, timestamp, user_id, username, action, description, status
      FROM audit_log
      ORDER BY id DESC
      LIMIT ?
    `).all(limit);

    return NextResponse.json({ success: true, data: logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
