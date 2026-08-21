import { NextResponse } from 'next/server';
import db from '@/lib/db';
import '@/lib/seed';

export async function POST(request: Request) {
  try {
    const { user_id, password } = await request.json();

    if (!user_id || !password) {
      return NextResponse.json({ error: 'User ID and Password are required' }, { status: 400 });
    }

    const cleanId = String(user_id).trim();

    // Case insensitive ID lookup
    const stmt = db.prepare('SELECT * FROM users WHERE LOWER(id) = LOWER(?)');
    const user = stmt.get(cleanId) as any;

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    if (!user || user.password !== password) {
      // Log failed login
      db.prepare(`
        INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(timestamp, cleanId, user ? user.username : 'Unknown', 'Login', 'Failed login attempt: Invalid credentials.', 'Failed');

      return NextResponse.json({ error: 'Invalid User ID or Password' }, { status: 401 });
    }

    // Log successful login
    db.prepare(`
      INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(timestamp, user.id, user.username, 'Login', 'Successful login to Timesheet METSO.', 'Success');

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
        avatar: user.avatar || ''
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
