import { NextResponse } from 'next/server';
import db from '@/lib/db';
import * as XLSX from 'xlsx';
import { broadcastRealtimeEvent } from '@/lib/socketBroadcaster';
import { getWibTimestamp } from '@/lib/dateUtils';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No Excel file uploaded.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Read Excel workbook using XLSX
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    let importedUsers = 0;
    let importedPresensi = 0;
    let importedAudit = 0;
    let importedAreas = 0;

    const timestamp = getWibTimestamp();

    // Helper to find value from row with flexible key matching
    const getValue = (row: any, keys: string[], defaultValue: any = '') => {
      for (const k of Object.keys(row)) {
        const cleanK = k.trim().toLowerCase().replace(/[\s_]+/g, '');
        for (const targetKey of keys) {
          if (cleanK === targetKey.toLowerCase().replace(/[\s_]+/g, '')) {
            if (row[k] !== undefined && row[k] !== null && row[k] !== '') {
              return row[k];
            }
          }
        }
      }
      return defaultValue;
    };

    // 1. Process 'user' / 'users' sheet if exists
    const userSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('user'));
    if (userSheetName) {
      const sheet = workbook.Sheets[userSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);
      
      const checkUser = db.prepare('SELECT id FROM users WHERE id = ?');
      const insertUser = db.prepare(`
        INSERT INTO users (id, username, password, role, grade, preferred_areas, preferred_shift, number_of_areas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const updateUser = db.prepare(`
        UPDATE users SET username = ?, password = ?, role = ?, grade = ?, preferred_areas = ?, preferred_shift = ?, number_of_areas = ?
        WHERE id = ?
      `);

      const userTx = db.transaction((userRows: any[]) => {
        for (const u of userRows) {
          const id = String(getValue(u, ['id', 'user_id', 'userid'], '')).trim();
          if (!id) continue;
          
          const name = getValue(u, ['username', 'name', 'user_name'], 'User');
          const pass = getValue(u, ['password', 'pass', 'pwd'], 'Metso');
          const role = getValue(u, ['role', 'User Role'], 'Member');
          const grade = getValue(u, ['grade', 'Grade'], 'A');
          const pAreas = getValue(u, ['preferred_areas', 'preferred_area', 'area'], 'CMN');
          const pShift = getValue(u, ['preferred_shift', 'shift'], 'Day Shift');
          const numAreas = Number(getValue(u, ['number_of_areas', 'num_areas'], 2)) || 2;

          const existing = checkUser.get(id);
          if (existing) {
            updateUser.run(name, pass, role, grade, pAreas, pShift, numAreas, id);
          } else {
            insertUser.run(id, name, pass, role, grade, pAreas, pShift, numAreas);
          }
          importedUsers++;
        }
      });
      userTx(rows);
    }

    // 2. Process 'presensi' / 'timesheet' / 'presence' sheet if exists
    const presensiSheetName = workbook.SheetNames.find(s => 
      s.toLowerCase().includes('presensi') || 
      s.toLowerCase().includes('timesheet') || 
      s.toLowerCase().includes('presence')
    );

    if (presensiSheetName) {
      const sheet = workbook.Sheets[presensiSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      const checkPresensi = db.prepare('SELECT id FROM presensi WHERE user_id = ? AND date = ?');
      const insertPresensi = db.prepare(`
        INSERT INTO presensi (date, day, user_id, username, hours, working_hours, overtime, overtime_hours, area1, area2, area3, area4, shift, remark, timestamp, submission_timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const updatePresensi = db.prepare(`
        UPDATE presensi SET hours = ?, working_hours = ?, overtime = ?, overtime_hours = ?, area1 = ?, area2 = ?, area3 = ?, area4 = ?, shift = ?, remark = ?, timestamp = ?, submission_timestamp = ?
        WHERE user_id = ? AND date = ?
      `);

      const presensiTx = db.transaction((pRows: any[]) => {
        for (const p of pRows) {
          const userId = String(getValue(p, ['user_id', 'userid', 'user', 'id'], '')).trim();
          const pDate = String(getValue(p, ['date', 'date_log', 'tanggal'], '')).trim();
          if (!userId || !pDate) continue;

          const pDay = getValue(p, ['day', 'hari'], 'Monday');
          const pName = getValue(p, ['username', 'name', 'user_name'], 'User');
          const pWorkHours = Number(getValue(p, ['working_hours', 'hours', 'work_hours', 'jam_kerja'], 8)) || 0;
          const pOvertime = Number(getValue(p, ['overtime_hours', 'overtime', 'ot', 'lembur'], 0)) || 0;
          const a1 = getValue(p, ['area1', 'area_1', 'area'], 'CMN');
          const a2 = getValue(p, ['area2', 'area_2'], 'CMN');
          const a3 = getValue(p, ['area3', 'area_3'], '');
          const a4 = getValue(p, ['area4', 'area_4'], '');
          const pShift = getValue(p, ['shift', 'shift_type'], 'Day Shift');
          const pRemark = getValue(p, ['remark', 'notes', 'keterangan'], '');
          const pTime = getValue(p, ['timestamp', 'submission_timestamp', 'time'], timestamp);

          const existing = checkPresensi.get(userId, pDate);
          if (existing) {
            updatePresensi.run(
              pWorkHours, pWorkHours, pOvertime, pOvertime, a1, a2, a3, a4, pShift, pRemark, pTime, pTime, userId, pDate
            );
          } else {
            insertPresensi.run(
              pDate, pDay, userId, pName, pWorkHours, pWorkHours, pOvertime, pOvertime, a1, a2, a3, a4, pShift, pRemark, pTime, pTime
            );
          }
          importedPresensi++;
        }
      });
      presensiTx(rows);
    }

    // 3. Process 'areas' / 'area' sheet if exists
    const areaSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('area'));
    if (areaSheetName) {
      const sheet = workbook.Sheets[areaSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      const checkArea = db.prepare('SELECT name FROM areas WHERE name = ?');
      const insertArea = db.prepare('INSERT INTO areas (name) VALUES (?)');

      const areaTx = db.transaction((aRows: any[]) => {
        for (const a of aRows) {
          const name = getValue(a, ['name', 'area', 'area_code', 'code'], '');
          if (!name) continue;
          const clean = String(name).trim().toUpperCase();
          if (!checkArea.get(clean)) {
            insertArea.run(clean);
            importedAreas++;
          }
        }
      });
      areaTx(rows);
    }

    // 4. Process 'audit_log' / 'audit' sheet if exists
    const auditSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('audit'));
    if (auditSheetName) {
      const sheet = workbook.Sheets[auditSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      const insertAudit = db.prepare(`
        INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const auditTx = db.transaction((aRows: any[]) => {
        for (const a of aRows) {
          insertAudit.run(
            getValue(a, ['timestamp', 'time'], timestamp),
            getValue(a, ['user_id', 'userid', 'user'], 'System'),
            getValue(a, ['username', 'name'], 'Admin'),
            getValue(a, ['action', 'activity'], 'Imported Log'),
            getValue(a, ['description', 'desc', 'keterangan'], 'Google Sheets Data Migration'),
            getValue(a, ['status', 'state'], 'Success')
          );
          importedAudit++;
        }
      });
      auditTx(rows);
    }

    // Log Migration Activity to Audit Log
    db.prepare(`
      INSERT INTO audit_log (timestamp, user_id, username, action, description, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      timestamp,
      'Admin',
      'Site Admin',
      'Database Migration',
      `Migrated Excel file: ${importedUsers} users, ${importedPresensi} timesheets, ${importedAreas} areas, ${importedAudit} audit logs`,
      'Success'
    );

    // Broadcast Realtime Event
    await broadcastRealtimeEvent('user_updated', { action: 'migrate' });
    await broadcastRealtimeEvent('timesheet_updated', { action: 'migrate' });

    return NextResponse.json({
      success: true,
      message: `Excel migration completed successfully! Imported ${importedUsers} users, ${importedPresensi} presensi entries, ${importedAreas} areas.`,
      stats: {
        users: importedUsers,
        presensi: importedPresensi,
        auditLogs: importedAudit,
        areas: importedAreas
      }
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: error.message || 'Failed to parse & migrate Excel file' }, { status: 500 });
  }
}
