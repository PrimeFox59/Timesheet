import { NextResponse } from 'next/server';
import db from '@/lib/db';
import '@/lib/seed';

function euclideanDistance(arrA: number[], arrB: number[]): number {
  if (!arrA || !arrB || arrA.length !== arrB.length || arrA.length === 0) return 1.0;
  let sum = 0;
  for (let i = 0; i < arrA.length; i++) {
    const diff = arrA[i] - arrB[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, descriptor, confidence } = body;

    // Check if Face Login feature is toggled OFF by Superuser
    try {
      const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'enable_face_login'").get() as any;
      if (setting && setting.value === 'false') {
        return NextResponse.json({
          success: false,
          disabled: true,
          message: 'AI Face ID Login feature is currently disabled by Administrator.'
        }, { status: 403 });
      }
    } catch (e) {}

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Case 1: Match by user_id confirmed by client-side face-api.js edge model
    if (user_id) {
      const cleanId = String(user_id).trim();
      const user = db.prepare('SELECT * FROM users WHERE LOWER(id) = LOWER(?)').get(cleanId) as any;

      if (!user) {
        return NextResponse.json({
          success: false,
          message: 'User profile not found in database.'
        }, { status: 404 });
      }

      // If user has face_descriptor and client sent live descriptor, double verify
      let matchScore = confidence || 95;
      if (user.face_descriptor && Array.isArray(descriptor) && descriptor.length > 0) {
        try {
          const registeredDesc = JSON.parse(user.face_descriptor);
          const dist = euclideanDistance(descriptor, registeredDesc);
          if (dist > 0.60) {
            return NextResponse.json({
              success: false,
              message: 'Biometric verification does not match account owner.'
            }, { status: 401 });
          }
          matchScore = Math.round((1 - dist) * 100);
        } catch (e) {}
      }

      // Record audit log
      db.prepare(`
        INSERT INTO audit_log (timestamp, user_id, username, action, description, details, status)
        VALUES (?, ?, ?, 'FACE_LOGIN', 'Login via AI Face Recognition', ?, 'Success')
      `).run(timestamp, user.id, user.username, `Match Score: ${matchScore}% via face-api.js`);

      const { password, ...safeUser } = user;
      return NextResponse.json({
        success: true,
        message: `Welcome back, ${user.username}! Face verification successful.`,
        confidence: matchScore,
        user: {
          ...safeUser,
          phone: safeUser.phone || '',
          email: safeUser.email || '',
          avatar: safeUser.avatar || '',
          face_descriptor: safeUser.face_descriptor || '',
          face_photo: safeUser.face_photo || '',
          face_registered_at: safeUser.face_registered_at || ''
        }
      });
    }

    // Case 2: Server-side search across all registered users
    if (Array.isArray(descriptor) && descriptor.length > 0) {
      const users = db.prepare(`
        SELECT * FROM users 
        WHERE face_descriptor IS NOT NULL AND face_descriptor != '' AND face_descriptor != '[]'
      `).all() as any[];

      if (users.length === 0) {
        return NextResponse.json({
          success: false,
          message: 'No registered Face ID profiles found in database. Please log in with password and enroll your face in Profile settings.'
        }, { status: 404 });
      }

      let bestMatch: any = null;
      let minDistance = 0.60;

      for (const u of users) {
        try {
          const regDesc = JSON.parse(u.face_descriptor);
          const dist = euclideanDistance(descriptor, regDesc);
          if (dist < minDistance) {
            minDistance = dist;
            bestMatch = u;
          }
        } catch (e) {}
      }

      if (!bestMatch) {
        db.prepare(`
          INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
          VALUES (?, 'UNRECOGNIZED', 'Face Scanner', 'FACE_LOGIN', 'Face recognition failed: No matching biometric data.', 'Failed')
        `).run(timestamp);

        return NextResponse.json({
          success: false,
          message: 'Face did not match any registered employee account. Please ensure adequate lighting and face directly to camera.'
        }, { status: 401 });
      }

      const matchPercent = Math.round((1 - minDistance) * 100);

      db.prepare(`
        INSERT INTO audit_log (timestamp, user_id, username, action, description, details, status)
        VALUES (?, ?, ?, 'FACE_LOGIN', 'Login via AI Face Recognition', ?, 'Success')
      `).run(timestamp, bestMatch.id, bestMatch.username, `Match Score: ${matchPercent}%, Euclidean Dist: ${minDistance.toFixed(3)}`);

      const { password, ...safeUser } = bestMatch;
      return NextResponse.json({
        success: true,
        message: `Welcome back, ${bestMatch.username}! Face ID login successful.`,
        confidence: matchPercent,
        user: {
          ...safeUser,
          phone: safeUser.phone || '',
          email: safeUser.email || '',
          avatar: safeUser.avatar || '',
          face_descriptor: safeUser.face_descriptor || '',
          face_photo: safeUser.face_photo || '',
          face_registered_at: safeUser.face_registered_at || ''
        }
      });
    }

    return NextResponse.json({
      success: false,
      message: 'Incomplete biometric authentication parameters.'
    }, { status: 400 });

  } catch (error: any) {
    console.error('Face ID Login API Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Server error processing face login' 
    }, { status: 500 });
  }
}
