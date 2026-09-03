import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/socketBroadcaster';
import { getWibTimestamp } from '@/lib/dateUtils';

export async function GET() {
  try {
    const users = db.prepare(`
      SELECT id, username, role, grade, preferred_areas, preferred_shift, number_of_areas, phone, email, avatar, face_descriptor, face_photo, face_registered_at
      FROM users ORDER BY id ASC
    `).all();
    return NextResponse.json({ success: true, data: users });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, id, username, password, role, grade, preferred_areas, preferred_shift, number_of_areas, admin_id, admin_name } = body;

    // Handle user creation
    if (action === 'create' || (!action && id && username)) {
      if (!id || !username || !password) {
        return NextResponse.json({ error: 'User ID, Username, and Password are required' }, { status: 400 });
      }

      const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
      if (existing) {
        return NextResponse.json({ error: `User ID ${id} already exists.` }, { status: 400 });
      }

      db.prepare(`
        INSERT INTO users (id, username, password, role, grade, preferred_areas, preferred_shift, number_of_areas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id.trim(),
        username.trim(),
        password || 'Metso',
        role || 'Member',
        grade || 'A',
        preferred_areas || 'CMN',
        preferred_shift || 'Day Shift',
        Number(number_of_areas) || 2
      );

      // Audit Log
      const timestamp = getWibTimestamp();
      db.prepare(`
        INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        timestamp,
        admin_id || 'System',
        admin_name || 'Admin',
        'User Management - Create User',
        `Created new user ${username} (${id}) with role ${role}`,
        'Success'
      );

      await broadcastRealtimeEvent('user_updated', { action: 'create', id, username });

      return NextResponse.json({ success: true, message: `User ${username} created successfully.` });
    }

    // Password reset fallback
    if (!action && id && password) {
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(password, id);

      await broadcastRealtimeEvent('user_updated', { action: 'password_reset', id });

      return NextResponse.json({ success: true, message: `Password reset successfully for ${id}` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, username, password, role, grade, preferred_areas, preferred_shift, number_of_areas, admin_id, admin_name } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    db.prepare(`
      UPDATE users
      SET username = ?, password = ?, role = ?, grade = ?, preferred_areas = ?, preferred_shift = ?, number_of_areas = ?
      WHERE id = ?
    `).run(
      username.trim(),
      password,
      role,
      grade,
      preferred_areas,
      preferred_shift,
      Number(number_of_areas) || 2,
      id
    );

    // Audit Log
    const timestamp = getWibTimestamp();
    db.prepare(`
      INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      timestamp,
      admin_id || 'System',
      admin_name || 'Admin',
      'User Management - Update User',
      `Updated user profile & credentials for ${username} (${id})`,
      'Success'
    );

    await broadcastRealtimeEvent('user_updated', { action: 'update', id, username });

    return NextResponse.json({ success: true, message: `User ${username} updated successfully.` });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID parameter is required' }, { status: 400 });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    // Audit Log
    const timestamp = getWibTimestamp();
    db.prepare(`
      INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      timestamp,
      'System',
      'Admin',
      'User Management - Delete User',
      `Deleted user ${user.username} (${id})`,
      'Success'
    );

    await broadcastRealtimeEvent('user_updated', { action: 'delete', id });

    return NextResponse.json({ success: true, message: `User ${user.username} deleted successfully.` });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
