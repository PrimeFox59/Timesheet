import { NextResponse } from 'next/server';
import db from '@/lib/db';

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

    const now = new Date().getTime();
    const fiveMinutesMs = 5 * 60 * 1000;

    let onlineCount = 0;

    const mappedUsers = allUsers.map((u: any) => {
      let isOnline = false;

      // Current user is always online
      if (currentUserId && u.id.toLowerCase() === currentUserId.toLowerCase()) {
        isOnline = true;
      } else if (u.last_active) {
        const lastActiveTime = new Date(u.last_active.replace(' ', 'T') + 'Z').getTime();
        if (!isNaN(lastActiveTime) && now - lastActiveTime < fiveMinutesMs) {
          isOnline = true;
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
