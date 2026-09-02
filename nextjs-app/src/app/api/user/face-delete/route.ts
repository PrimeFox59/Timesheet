import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getWibTimestamp } from '@/lib/dateUtils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 });
    }

    const cleanId = String(user_id).trim();
    const user = db.prepare('SELECT * FROM users WHERE LOWER(id) = LOWER(?)').get(cleanId) as any;
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    db.prepare(`
      UPDATE users 
      SET face_descriptor = '', face_photo = '', face_registered_at = ''
      WHERE LOWER(id) = LOWER(?)
    `).run(cleanId);

    const timestamp = getWibTimestamp();
    db.prepare(`
      INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
      VALUES (?, ?, ?, 'DELETE_FACE_ID', 'Face ID Biometric Profile Deleted', 'Success')
    `).run(timestamp, user.id, user.username);

    const updatedUser = db.prepare(`
      SELECT id, username, role, grade, preferred_areas, preferred_shift, number_of_areas, phone, email, avatar, face_descriptor, face_photo, face_registered_at
      FROM users WHERE LOWER(id) = LOWER(?)
    `).get(cleanId);

    return NextResponse.json({
      success: true,
      message: 'Face ID biometric profile successfully removed.',
      user: updatedUser
    });
  } catch (error: any) {
    console.error('POST /api/user/face-delete error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
