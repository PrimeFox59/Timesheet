import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/socketBroadcaster';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = body.user_id || body.id;

    if (userId) {
      // Clear last_active in database immediately
      db.prepare("UPDATE users SET last_active = '' WHERE LOWER(id) = LOWER(?)").run(userId);

      // Broadcast real-time presence update to all connected SSE clients
      await broadcastRealtimeEvent('presence_updated', {
        user_id: userId,
        is_online: false,
        timestamp: ''
      });
    }

    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
