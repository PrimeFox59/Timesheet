import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/socketBroadcaster';
import { getWibTimestamp } from '@/lib/dateUtils';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const user_id = body.user_id || body.id;
    const action = body.action;

    if (!user_id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (action === 'logout' || action === 'offline') {
      db.prepare("UPDATE users SET last_active = '' WHERE LOWER(id) = LOWER(?)").run(user_id);
      await broadcastRealtimeEvent('presence_updated', {
        user_id,
        is_online: false,
        timestamp: ''
      });
      return NextResponse.json({ success: true, is_online: false });
    }

    const timestamp = getWibTimestamp();

    db.prepare('UPDATE users SET last_active = ? WHERE LOWER(id) = LOWER(?)').run(timestamp, user_id);

    await broadcastRealtimeEvent('presence_updated', {
      user_id,
      is_online: true,
      timestamp
    });

    return NextResponse.json({ success: true, timestamp });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
