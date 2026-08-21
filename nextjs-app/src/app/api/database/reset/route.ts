import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/socketBroadcaster';

export async function POST(request: Request) {
  try {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const resetTx = db.transaction(() => {
      // 1. Clear all tables
      db.prepare('DELETE FROM presensi').run();
      db.prepare('DELETE FROM audit_log').run();
      db.prepare('DELETE FROM areas').run();
      db.prepare('DELETE FROM users').run();

      // 2. Insert Superuser Account
      db.prepare(`
        INSERT INTO users (id, username, password, role, grade, preferred_areas, preferred_shift, number_of_areas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'prime',
        'Prime Admin',
        'zzz',
        'superuser',
        'A',
        'CMN',
        'Day Shift',
        2
      );

      // 3. Insert Default 7 Work Areas
      const defaultAreas = ['GCP', 'SAP', 'ER', 'SM', 'SC', 'CMN', 'ET'];
      const insertArea = db.prepare('INSERT INTO areas (name) VALUES (?)');
      for (const area of defaultAreas) {
        insertArea.run(area);
      }

      // 4. Insert Initial Audit Log
      db.prepare(`
        INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        timestamp,
        'prime',
        'Prime Admin',
        'Database Factory Reset',
        'Reset database to clean factory state with prime superuser account',
        'Success'
      );
    });

    resetTx();

    // Broadcast Socket RTC event
    await broadcastRealtimeEvent('user_updated', { action: 'reset' });
    await broadcastRealtimeEvent('area_updated', { action: 'reset' });
    await broadcastRealtimeEvent('timesheet_updated', { action: 'reset' });

    return NextResponse.json({
      success: true,
      message: 'Database reset successfully! Created default superuser (id: prime, password: zzz).'
    });

  } catch (error: any) {
    console.error('Reset database error:', error);
    return NextResponse.json({ error: error.message || 'Failed to reset database' }, { status: 500 });
  }
}
