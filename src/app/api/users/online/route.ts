import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const currentUserId = searchParams.get('currentUserId') || searchParams.get('userId');

    // Fetch all users with profile data
    const allUsers = db.prepare(`
      SELECT id, username, role, grade, preferred_areas, preferred_shift, avatar, phone, email, last_active
      FROM users
      ORDER BY 
        CASE 
          WHEN LOWER(id) = LOWER(?) THEN 0
          WHEN last_active IS NOT NULL AND last_active != '' THEN 1
          ELSE 2 
        END,
        username ASC
    `).all(currentUserId || '');

    const now = Date.now();
    // A user is considered online if heartbeat was received within the last 60 seconds (heartbeat pulse is every 15-20s)
    const ONLINE_TIMEOUT_MS = 60 * 1000;

    let onlineCount = 0;

    const mappedUsers = allUsers.map((u: any) => {
      let isOnline = false;

      // Current user is online if actively requesting from session
      if (currentUserId && u.id.toLowerCase() === currentUserId.toLowerCase()) {
        isOnline = true;
      } else if (u.last_active && typeof u.last_active === 'string' && u.last_active.trim() !== '') {
        // Parse WIB timestamp ('YYYY-MM-DD HH:mm:ss') accurately with +07:00 timezone offset
        const isoWibStr = u.last_active.trim().replace(' ', 'T') + '+07:00';
        const lastActiveTime = new Date(isoWibStr).getTime();
        if (!isNaN(lastActiveTime)) {
          const diffMs = now - lastActiveTime;
          // Must be strictly within the last 60 seconds (with 5s tolerance for slight clock drift)
          if (diffMs >= -5000 && diffMs <= ONLINE_TIMEOUT_MS) {
            isOnline = true;
          }
        }
      }

      if (isOnline) {
        onlineCount++;
      }

      return {
        ...u,
        is_online: isOnline
      };
    });

    const onlineOnlyUsers = mappedUsers.filter((u: any) => u.is_online);

    return NextResponse.json({
      success: true,
      onlineCount: onlineOnlyUsers.length,
      users: onlineOnlyUsers
    });

  } catch (error: any) {
    console.error('GET /api/users/online error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
