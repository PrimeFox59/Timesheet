import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/socketBroadcaster';
import { getWibTimestamp } from '@/lib/dateUtils';

export async function POST(request: Request) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const timestamp = getWibTimestamp();

    db.prepare('UPDATE users SET last_active = ? WHERE id = ?').run(timestamp, user_id);

    await broadcastRealtimeEvent('presence_updated', {
      user_id,
      timestamp
    });

    return NextResponse.json({ success: true, timestamp });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
