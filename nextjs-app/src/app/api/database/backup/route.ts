import { NextResponse } from 'next/server';
import db from '@/lib/db';
import * as XLSX from 'xlsx';
import { getWibDateStr } from '@/lib/dateUtils';

export async function GET() {
  try {
    const users = db.prepare('SELECT id, username, role, grade, preferred_areas, preferred_shift, number_of_areas, phone, email, avatar, face_descriptor, face_photo, face_registered_at FROM users ORDER BY id ASC').all();
    const presensi = db.prepare('SELECT * FROM presensi ORDER BY date DESC').all();
    const projects = db.prepare('SELECT * FROM projects ORDER BY id DESC').all();
    const tasks = db.prepare('SELECT * FROM tasks ORDER BY id DESC').all();
    const chatMessages = db.prepare('SELECT * FROM chat_messages ORDER BY id DESC').all();
    const settings = db.prepare('SELECT * FROM system_settings ORDER BY key ASC').all();
    const approvals = db.prepare('SELECT * FROM approvals ORDER BY id DESC').all();
    const auditLog = db.prepare('SELECT * FROM audit_log ORDER BY id DESC').all();
    const areas = db.prepare('SELECT * FROM areas ORDER BY name ASC').all();

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(users), 'users');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(presensi), 'presensi');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(projects), 'projects');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(tasks), 'tasks');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(chatMessages), 'chat_messages');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(settings), 'system_settings');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(approvals), 'approvals');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(auditLog), 'audit_log');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(areas), 'areas');

    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="timesheet_metso_backup_${getWibDateStr()}.xlsx"`
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server export error' }, { status: 500 });
  }
}
