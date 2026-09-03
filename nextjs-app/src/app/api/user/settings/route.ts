import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getWibTimestamp } from '@/lib/dateUtils';

async function handleSettingsUpdate(request: Request) {
  try {
    const body = await request.json();
    const {
      user_id,
      action,
      old_password,
      new_password,
      new_username,
      username,
      phone,
      email,
      avatar,
      preferred_shift,
      preferred_areas,
      number_of_areas
    } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id) as any;
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const timestamp = getWibTimestamp();

    if (action === 'change_password') {
      if (!old_password || !new_password) {
        return NextResponse.json({ error: 'Old and new password are required' }, { status: 400 });
      }

      if (user.password !== old_password) {
        db.prepare(`
          INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(timestamp, user.id, user.username, 'Password Change', 'Failed password change: Incorrect old password.', 'Failed');

        return NextResponse.json({ error: 'Incorrect old password' }, { status: 400 });
      }

      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(new_password, user_id);

      db.prepare(`
        INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(timestamp, user.id, user.username, 'Password Change', 'Successfully updated password.', 'Success');

      const updatedUser = db.prepare('SELECT id, username, role, grade, preferred_areas, preferred_shift, number_of_areas, phone, email, avatar, face_descriptor, face_photo, face_registered_at FROM users WHERE id = ?').get(user_id);
      return NextResponse.json({ success: true, message: 'Password updated successfully', user: updatedUser });
    }

    if (action === 'update_profile' || action === 'update_preferences') {
      const targetUsername = new_username !== undefined ? new_username : username;
      if (targetUsername !== undefined && targetUsername.trim() !== '' && targetUsername !== user.username) {
        db.prepare('UPDATE users SET username = ? WHERE id = ?').run(targetUsername.trim(), user_id);
      }
      if (phone !== undefined) {
        db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, user_id);
      }
      if (email !== undefined) {
        db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, user_id);
      }
      if (avatar !== undefined) {
        db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, user_id);
      }
      if (preferred_shift) {
        db.prepare('UPDATE users SET preferred_shift = ? WHERE id = ?').run(preferred_shift, user_id);
      }
      if (preferred_areas !== undefined) {
        db.prepare('UPDATE users SET preferred_areas = ? WHERE id = ?').run(preferred_areas, user_id);
      }
      if (number_of_areas !== undefined) {
        const num = Math.max(1, Math.min(4, Number(number_of_areas) || 2));
        db.prepare('UPDATE users SET number_of_areas = ? WHERE id = ?').run(num, user_id);
      }

      const logDesc = action === 'update_preferences' 
        ? 'Updated work preferences and layout settings.' 
        : 'Updated user profile information.';

      db.prepare(`
        INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(timestamp, user.id, targetUsername || user.username, 'User Settings Update', logDesc, 'Success');

      const updatedUser = db.prepare('SELECT id, username, role, grade, preferred_areas, preferred_shift, number_of_areas, phone, email, avatar, face_descriptor, face_photo, face_registered_at FROM users WHERE id = ?').get(user_id);

      return NextResponse.json({ success: true, message: 'Preferences updated successfully', user: updatedUser });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  return handleSettingsUpdate(request);
}

export async function POST(request: Request) {
  return handleSettingsUpdate(request);
}

