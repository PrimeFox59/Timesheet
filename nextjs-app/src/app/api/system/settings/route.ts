import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const rows = db.prepare('SELECT key, value, description, updated_at FROM system_settings').all() as any[];
    const settingsMap: Record<string, boolean | string> = {};
    for (const r of rows) {
      if (r.value === 'true') settingsMap[r.key] = true;
      else if (r.value === 'false') settingsMap[r.key] = false;
      else settingsMap[r.key] = r.value;
    }
    return NextResponse.json({
      success: true,
      settings: settingsMap,
      raw: rows
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, value, admin_id } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Key and Value are required' }, { status: 400 });
    }

    const valString = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    db.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, valString, timestamp);

    // Audit log
    db.prepare(`
      INSERT INTO audit_log (timestamp, user_id, username, action, description, details, status)
      VALUES (?, ?, ?, 'SYSTEM_SETTING_TOGGLE', ?, ?, 'Success')
    `).run(
      timestamp,
      admin_id || 'prime',
      'Superuser',
      `Toggled system feature flag: ${key} -> ${valString}`,
      `Setting ${key} updated to ${valString}`
    );

    const rows = db.prepare('SELECT key, value, description, updated_at FROM system_settings').all() as any[];
    const settingsMap: Record<string, boolean | string> = {};
    for (const r of rows) {
      if (r.value === 'true') settingsMap[r.key] = true;
      else if (r.value === 'false') settingsMap[r.key] = false;
      else settingsMap[r.key] = r.value;
    }

    return NextResponse.json({
      success: true,
      message: `Pengaturan fitur "${key}" berhasil diubah menjadi ${valString}.`,
      settings: settingsMap
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
