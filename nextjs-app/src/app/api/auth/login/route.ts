import { NextResponse } from 'next/server';
import db from '@/lib/db';
import '@/lib/seed';
import { getWibTimestamp } from '@/lib/dateUtils';
import { broadcastRealtimeEvent } from '@/lib/socketBroadcaster';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawId = body.user_id || body.id || body.username || body.userId;
    const password = body.password ? String(body.password).trim() : '';

    if (!rawId || !password) {
      return NextResponse.json({ error: 'User ID and Password are required' }, { status: 400 });
    }

    const cleanId = String(rawId).trim();

    // Case insensitive ID or username lookup
    const stmt = db.prepare('SELECT * FROM users WHERE LOWER(id) = LOWER(?) OR LOWER(username) = LOWER(?)');
    const user = stmt.get(cleanId, cleanId) as any;

    const timestamp = getWibTimestamp();

    if (!user || user.password !== password) {
      // Log failed login
      try {
        db.prepare(`
          INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(timestamp, cleanId, user ? user.username : 'Unknown', 'Login', 'Failed login attempt: Invalid credentials.', 'Failed');
      } catch (e) {}

      return NextResponse.json({ error: 'Invalid User ID or Password' }, { status: 401 });
    }

    // Update presence in SQLite
    db.prepare('UPDATE users SET last_active = ? WHERE LOWER(id) = LOWER(?)').run(timestamp, user.id);

    // Broadcast live presence event immediately
    await broadcastRealtimeEvent('presence_updated', {
      user_id: user.id,
      is_online: true,
      timestamp
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        grade: user.grade,
        preferred_areas: user.preferred_areas,
        preferred_shift: user.preferred_shift,
        number_of_areas: user.number_of_areas,
        phone: user.phone || '',
        email: user.email || '',
        avatar: user.avatar || '',
        face_descriptor: user.face_descriptor || '',
        face_photo: user.face_photo || '',
        face_registered_at: user.face_registered_at || ''
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
