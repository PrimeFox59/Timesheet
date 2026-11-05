import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/socketBroadcaster';
import { getWibTimestamp } from '@/lib/dateUtils';

export async function GET() {
  try {
    const areas = db.prepare('SELECT name FROM areas ORDER BY name ASC').all();
    return NextResponse.json({ success: true, data: areas });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, admin_id, admin_name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Area name is required' }, { status: 400 });
    }

    const cleanName = name.trim().toUpperCase();

    const existing = db.prepare('SELECT name FROM areas WHERE name = ?').get(cleanName);
    if (existing) {
      return NextResponse.json({ error: `Area ${cleanName} already exists.` }, { status: 400 });
    }

    db.prepare('INSERT INTO areas (name) VALUES (?)').run(cleanName);

    const timestamp = getWibTimestamp();
    db.prepare(`
      INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      timestamp,
      admin_id || 'System',
      admin_name || 'Admin',
      'Master Edit - Add Area',
      `Added new work area code ${cleanName}`,
      'Success'
    );

    await broadcastRealtimeEvent('area_updated', { action: 'add', name: cleanName });

    return NextResponse.json({ success: true, message: `Work area ${cleanName} added successfully!` });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json({ error: 'Area name parameter is required' }, { status: 400 });
    }

    const cleanName = name.trim().toUpperCase();

    db.prepare('DELETE FROM areas WHERE name = ?').run(cleanName);

    const timestamp = getWibTimestamp();
    db.prepare(`
      INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      timestamp,
      'System',
      'Admin',
      'Master Edit - Delete Area',
      `Deleted work area code ${cleanName}`,
      'Success'
    );

    await broadcastRealtimeEvent('area_updated', { action: 'delete', name: cleanName });

    return NextResponse.json({ success: true, message: `Work area ${cleanName} deleted successfully!` });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
