import { NextResponse } from 'next/server';
import db from '@/lib/db';
import * as XLSX from 'xlsx';
import { getWibDateStr } from '@/lib/dateUtils';

export async function GET() {
  try {
    const users = db.prepare('SELECT * FROM users ORDER BY id ASC').all();
    const presensi = db.prepare('SELECT * FROM presensi ORDER BY date DESC').all();
    const auditLog = db.prepare('SELECT * FROM audit_log ORDER BY id DESC').all();
    const areas = db.prepare('SELECT * FROM areas ORDER BY name ASC').all();

    const workbook = XLSX.utils.book_new();

    const userSheet = XLSX.utils.json_to_sheet(users);
    XLSX.utils.book_append_sheet(workbook, userSheet, 'user');

    const presensiSheet = XLSX.utils.json_to_sheet(presensi);
    XLSX.utils.book_append_sheet(workbook, presensiSheet, 'presensi');

    const auditSheet = XLSX.utils.json_to_sheet(auditLog);
    XLSX.utils.book_append_sheet(workbook, auditSheet, 'audit_log');

    const areasSheet = XLSX.utils.json_to_sheet(areas);
    XLSX.utils.book_append_sheet(workbook, areasSheet, 'areas');

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
