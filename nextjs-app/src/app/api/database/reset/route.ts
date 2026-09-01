import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/socketBroadcaster';

export async function POST(request: Request) {
  try {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const resetTx = db.transaction(() => {
      // 1. Clear all tables safely
      try { db.prepare('DELETE FROM presensi').run(); } catch (e) {}
      try { db.prepare('DELETE FROM audit_log').run(); } catch (e) {}
      try { db.prepare('DELETE FROM areas').run(); } catch (e) {}
      try { db.prepare('DELETE FROM users').run(); } catch (e) {}
      try { db.prepare('DELETE FROM tasks').run(); } catch (e) {}
      try { db.prepare('DELETE FROM projects').run(); } catch (e) {}
      try { db.prepare('DELETE FROM project_members').run(); } catch (e) {}
      try { db.prepare('DELETE FROM chat_messages').run(); } catch (e) {}
      try { db.prepare('DELETE FROM approvals').run(); } catch (e) {}

      // 2. Insert Default Superuser & Initial Metso Users
      const insertUser = db.prepare(`
        INSERT OR IGNORE INTO users (id, username, password, role, grade, preferred_areas, preferred_shift, number_of_areas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const defaultUsers = [
        ['prime', 'Prime Admin', 'zzz', 'superuser', 'A', 'CMN', 'Day Shift', 2],
        ['COM001', 'Kari Pienimäki', 'Metso', 'Commissioning Director', 'A', 'CMN', 'Day Shift', 2],
        ['COM004', 'Jukka Tuominen', 'Metso', 'Comm. Lead Advisor (Deputy)', 'B', 'SM', 'Day Shift', 3],
        ['COM006', 'Vivek Agarwal', 'Metso', 'Process Lead Advisor', 'A', 'ET', 'Day Shift', 2],
        ['COM008', 'Satu Jyrkänen', 'Metso', 'Process Area Commissioning Lead Advisor', 'A', 'SM', 'Day Shift', 2],
        ['COM116', 'Iqlima Nur Hayati', 'Metso', 'Site Admin', 'A', 'CMN', 'Day Shift', 2],
        ['COM200', 'Andre Mailoa', 'Metso', 'Equipment Expert', 'B', 'CMN', 'Day Shift', 2],
      ];

      for (const u of defaultUsers) {
        insertUser.run(...u);
      }

      // 3. Insert Default 7 Work Areas
      const defaultAreas = ['GCP', 'SAP', 'ER', 'SM', 'SC', 'CMN', 'ET'];
      const insertArea = db.prepare('INSERT OR IGNORE INTO areas (name) VALUES (?)');
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
        'Reset database to clean factory state with prime and default Metso accounts',
        'Success'
      );
    });

    resetTx();

    // Broadcast Socket RTC events
    try {
      await broadcastRealtimeEvent('user_updated', { action: 'reset' });
      await broadcastRealtimeEvent('area_updated', { action: 'reset' });
      await broadcastRealtimeEvent('timesheet_updated', { action: 'reset' });
    } catch (e) {}

    return NextResponse.json({
      success: true,
      message: 'Database reset successfully! Created default superuser (id: prime, password: zzz).'
    });

  } catch (error: any) {
    console.error('Reset database error:', error);
    return NextResponse.json({ error: error.message || 'Failed to reset database' }, { status: 500 });
  }
}
