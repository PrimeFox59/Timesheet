import { NextResponse } from 'next/server';
import db from '@/lib/db';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

export async function GET(request: Request) {
  const tmpFiles: string[] = [];
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || searchParams.get('user_id');
    const monthStr = searchParams.get('month'); // Format YYYY-MM, e.g. "2026-08"

    if (!userId || !monthStr) {
      return NextResponse.json({ error: 'userId and month (YYYY-MM) parameters are required.' }, { status: 400 });
    }

    const [year, monthNum] = monthStr.split('-').map(Number);
    if (!year || !monthNum || monthNum < 1 || monthNum > 12) {
      return NextResponse.json({ error: 'Invalid month format. Expected YYYY-MM' }, { status: 400 });
    }

    // 1. Fetch User details
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return NextResponse.json({ error: `User ID '${userId}' not found.` }, { status: 404 });
    }

    // 2. Fetch Presensi records for month
    const monthPattern = `${monthStr}-%`;
    const records = db.prepare(`
      SELECT date, day, 
             COALESCE(working_hours, hours, 8) as working_hours,
             COALESCE(overtime_hours, overtime, 0) as overtime_hours,
             area1, area2, area3, area4, shift, remark
      FROM presensi
      WHERE user_id = ? AND date LIKE ?
      ORDER BY date ASC
    `).all(userId, monthPattern) as any[];

    // 3. Fetch Approval Record if exists
    const approval = db.prepare(`
      SELECT user_id, month, status, approver_id, approver_name, signature_data, timestamp
      FROM approvals
      WHERE user_id = ? AND month = ?
    `).get(userId, monthStr) as any;

    // 4. Template File Path
    let templatePath = path.join(process.cwd(), 'public', 'Timesheet_Template_v2.xlsx');
    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(process.cwd(), '..', 'Timesheet_Template_v2.xlsx');
    }

    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: 'Timesheet_Template_v2.xlsx template file not found.' }, { status: 500 });
    }

    // 5. Create Temporary File Paths
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const nonce = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const jsonPath = path.join(tmpDir, `records_${nonce}.json`);
    const approvalJsonPath = path.join(tmpDir, `approval_${nonce}.json`);
    const outputPath = path.join(tmpDir, `export_${nonce}.xlsx`);
    const pythonScriptPath = path.join(process.cwd(), 'scripts', 'export_metso_template.py');

    tmpFiles.push(jsonPath, approvalJsonPath, outputPath);

    fs.writeFileSync(jsonPath, JSON.stringify(records), 'utf-8');
    if (approval) {
      fs.writeFileSync(approvalJsonPath, JSON.stringify(approval), 'utf-8');
    } else {
      fs.writeFileSync(approvalJsonPath, '{}', 'utf-8');
    }

    // 6. Execute Python Openpyxl Script (Preserves 100% Logo, Styles, Fills, Borders, Fonts, Formulas & Signature)
    let pythonBin = 'python3';
    if (process.platform === 'win32') {
      try {
        execSync('python --version', { stdio: 'ignore' });
        pythonBin = 'python';
      } catch (e) {
        try {
          execSync('py --version', { stdio: 'ignore' });
          pythonBin = 'py';
        } catch (e2) {
          pythonBin = 'python';
        }
      }
    }

    const pythonCmd = `${pythonBin} "${pythonScriptPath}" "${templatePath}" "${outputPath}" "${user.id}" "${user.username}" "${user.role || 'Commissioning Engineer'}" "${monthStr}" "${jsonPath}" "${approvalJsonPath}"`;

    execSync(pythonCmd, { encoding: 'utf-8' });

    if (!fs.existsSync(outputPath)) {
      throw new Error('Python failed to generate exported Excel file.');
    }

    const outputBuffer = fs.readFileSync(outputPath);

    // Cleanup temp files
    tmpFiles.forEach(f => {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
    });

    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Metso_Timesheet_${userId}_${monthStr}.xlsx"`
      }
    });

  } catch (error: any) {
    // Cleanup temp files on error
    tmpFiles.forEach(f => {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
    });

    console.error('Export Template Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to export timesheet template' }, { status: 500 });
  }
}
