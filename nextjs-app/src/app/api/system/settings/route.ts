import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getWibTimestamp } from '@/lib/dateUtils';
import { broadcastRealtimeEvent } from '@/lib/socketBroadcaster';

const KEY_ALIASES: Record<string, string[]> = {
  enable_face_login: ['feature_face_login'],
  feature_face_login: ['enable_face_login'],
  enable_face_registration: ['feature_face_registration'],
  feature_face_registration: ['enable_face_registration'],
  enable_codex_approval: ['menu_codex'],
  menu_codex: ['enable_codex_approval'],
  enable_audit_log: ['menu_audit_log'],
  menu_audit_log: ['enable_audit_log'],
  enable_database_migration: ['menu_database'],
  menu_database: ['enable_database_migration']
};

export async function GET() {
  try {
    const rows = db.prepare('SELECT * FROM system_settings').all() as any[];
    const settingsMap: Record<string, boolean | string> = {};
    for (const r of rows) {
      if (r.value === 'true') settingsMap[r.key] = true;
      else if (r.value === 'false') settingsMap[r.key] = false;
      else settingsMap[r.key] = r.value;
    }

    // Unify alias values
    for (const [mainKey, aliases] of Object.entries(KEY_ALIASES)) {
      if (settingsMap[mainKey] !== undefined) {
        for (const alias of aliases) {
          settingsMap[alias] = settingsMap[mainKey];
        }
      }
    }

    return NextResponse.json({
      success: true,
      settings: settingsMap,
      raw: rows
    });
  } catch (error: any) {
    console.error('GET /api/system/settings error:', error);
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
    const timestamp = getWibTimestamp();

    const keysToUpdate = [key, ...(KEY_ALIASES[key] || [])];

    for (const k of keysToUpdate) {
      db.prepare(`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(k, valString, timestamp);
    }

    // Audit log
    try {
      db.prepare(`
        INSERT INTO audit_log (timestamp, user_id, username, action, description, details, status)
        VALUES (?, ?, ?, 'SYSTEM_SETTING_TOGGLE', ?, ?, 'Success')
      `).run(
        timestamp,
        admin_id || 'prime',
        'Superuser',
        `Toggled system feature flag: ${key} -> ${valString}`,
        `Setting ${key} (and aliases) updated to ${valString}`
      );
    } catch (e) {}

    const rows = db.prepare('SELECT * FROM system_settings').all() as any[];
    const settingsMap: Record<string, boolean | string> = {};
    for (const r of rows) {
      if (r.value === 'true') settingsMap[r.key] = true;
      else if (r.value === 'false') settingsMap[r.key] = false;
      else settingsMap[r.key] = r.value;
    }

    for (const [mainKey, aliases] of Object.entries(KEY_ALIASES)) {
      if (settingsMap[mainKey] !== undefined) {
        for (const alias of aliases) {
          settingsMap[alias] = settingsMap[mainKey];
        }
      }
    }

    await broadcastRealtimeEvent('system_settings_updated', {
      key,
      value: valString,
      settings: settingsMap
    });

    return NextResponse.json({
      success: true,
      message: `Pengaturan fitur "${key}" berhasil diubah menjadi ${valString}.`,
      settings: settingsMap
    });
  } catch (error: any) {
    console.error('POST /api/system/settings error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
