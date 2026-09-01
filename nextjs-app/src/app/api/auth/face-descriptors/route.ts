import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const rows = db.prepare(`
      SELECT id, username, role, grade, preferred_areas, preferred_shift, number_of_areas, phone, email, avatar, face_descriptor, face_photo, face_registered_at
      FROM users 
      WHERE face_descriptor IS NOT NULL AND face_descriptor != '' AND face_descriptor != '[]'
      ORDER BY id ASC
    `).all() as any[];

    const embeddings = [];
    for (const r of rows) {
      try {
        const descriptorArray = JSON.parse(r.face_descriptor);
        if (Array.isArray(descriptorArray) && descriptorArray.length > 0) {
          embeddings.push({
            user_id: r.id,
            username: r.username,
            role: r.role,
            grade: r.grade,
            preferred_areas: r.preferred_areas,
            preferred_shift: r.preferred_shift,
            number_of_areas: r.number_of_areas,
            phone: r.phone,
            email: r.email,
            avatar: r.avatar,
            descriptor: descriptorArray,
            photo: r.face_photo || '',
            registered_at: r.face_registered_at || ''
          });
        }
      } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      count: embeddings.length,
      embeddings
    });
  } catch (error: any) {
    console.error('GET /api/auth/face-descriptors error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
