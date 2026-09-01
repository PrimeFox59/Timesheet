import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, descriptor, image_base64 } = body;

    if (!user_id || !descriptor || !Array.isArray(descriptor) || descriptor.length === 0) {
      return NextResponse.json(
        { success: false, message: 'User ID dan 128-d face descriptor wajib diisi!' },
        { status: 400 }
      );
    }

    const cleanId = String(user_id).trim();
    const user = db.prepare('SELECT * FROM users WHERE LOWER(id) = LOWER(?)').get(cleanId) as any;
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Pengguna tidak ditemukan dalam database.' },
        { status: 404 }
      );
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const descriptorJson = JSON.stringify(descriptor);

    db.prepare(`
      UPDATE users 
      SET face_descriptor = ?, face_photo = ?, face_registered_at = ?
      WHERE LOWER(id) = LOWER(?)
    `).run(descriptorJson, image_base64 || '', timestamp, cleanId);

    // Audit log
    db.prepare(`
      INSERT INTO audit_log (timestamp, user_id, username, action, description, details, status)
      VALUES (?, ?, ?, 'REGISTER_FACE_ID', 'Face ID Biometric Profile Registered', ?, 'Success')
    `).run(timestamp, user.id, user.username, '128-D Neural Landmark Vector Recorded via face-api.js');

    const updatedUser = db.prepare(`
      SELECT id, username, role, grade, preferred_areas, preferred_shift, number_of_areas, phone, email, avatar, face_descriptor, face_photo, face_registered_at
      FROM users WHERE LOWER(id) = LOWER(?)
    `).get(cleanId);

    return NextResponse.json({
      success: true,
      message: `Face ID biometrik untuk ${user.username} (${user.id}) berhasil didaftarkan!`,
      user: updatedUser
    });
  } catch (error: any) {
    console.error('POST /api/user/face-register error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
