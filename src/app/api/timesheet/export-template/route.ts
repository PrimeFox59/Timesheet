import { NextResponse } from 'next/server';
import db from '@/lib/db';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import ExcelJS from 'exceljs';

async function generateWithExcelJS(templatePath: string, outputPath: string, user: any, monthStr: string, records: any[], approval: any) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  const ws = workbook.getWorksheet('Timesheet') || workbook.worksheets[0];

  const [year, monthNum] = monthStr.split('-').map(Number);
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabel = `${monthNamesShort[monthNum - 1]}-${year}`;

  ws.getCell('A6').value = `NAME:  ${user.username}`;
  ws.getCell('G6').value = monthLabel;
  ws.getCell('G7').value = user.id;
  ws.getCell('G8').value = user.role || 'Commissioning Engineer';

  // Calculate days in month
  const totalDays = new Date(year, monthNum, 0).getDate();
  const dayNamesList = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const recordMap = new Map<string, any>();
  records.forEach(r => recordMap.set(r.date, r));

  for (let day = 1; day <= 31; day++) {
    const rowIdx = 10 + day; // Row 11 is Day 1
    if (day <= totalDays) {
      const dt = new Date(year, monthNum - 1, day);
      const dayName = dayNamesList[dt.getDay()];
      const dd = String(day).padStart(2, '0');
      const mm = String(monthNum).padStart(2, '0');
      const dateStrFormatted = `${dd}/${mm}/${year}`;
      const ymdDate = `${year}-${mm}-${dd}`;
      const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;

      const rec = recordMap.get(ymdDate);

      ws.getCell(`A${rowIdx}`).value = dayName;
      ws.getCell(`B${rowIdx}`).value = dateStrFormatted;

      if (rec) {
        const regHrs = Number(rec.working_hours || rec.hours || 0);
        const otHrs = Number(rec.overtime_hours || rec.overtime || 0);
        const areas = [rec.area1, rec.area2, rec.area3, rec.area4].filter(Boolean);
        const areasStr = areas.join(', ');
        const remark = rec.remark || '';
        const desc = (areasStr && remark) ? `${areasStr} - ${remark}` : (areasStr || remark || 'Commissioning Work');

        const rmkUpper = remark.toUpperCase();
        let dayType = 'WORK';
        if (rmkUpper.includes('ROTATION')) dayType = 'ROTATION';
        else if (rmkUpper.includes('SICK')) dayType = 'SICK';
        else if (rmkUpper.includes('HOLIDAY')) dayType = 'HOLIDAY';
        else if (rmkUpper.includes('TRAVEL')) dayType = 'TRAVEL';
        else if (regHrs === 0) dayType = 'WEEKLY OFF';

        ws.getCell(`C${rowIdx}`).value = dayType;
        ws.getCell(`D${rowIdx}`).value = regHrs;
        ws.getCell(`E${rowIdx}`).value = otHrs;
        ws.getCell(`F${rowIdx}`).value = 0;
        ws.getCell(`G${rowIdx}`).value = desc;
      } else {
        ws.getCell(`C${rowIdx}`).value = isWeekend ? 'WEEKLY OFF' : 'WORK';
        ws.getCell(`D${rowIdx}`).value = 0;
        ws.getCell(`E${rowIdx}`).value = 0;
        ws.getCell(`F${rowIdx}`).value = 0;
        ws.getCell(`G${rowIdx}`).value = '';
      }
    } else {
      ws.getCell(`A${rowIdx}`).value = '';
      ws.getCell(`B${rowIdx}`).value = '';
      ws.getCell(`C${rowIdx}`).value = '';
      ws.getCell(`D${rowIdx}`).value = 0;
      ws.getCell(`E${rowIdx}`).value = 0;
      ws.getCell(`F${rowIdx}`).value = 0;
      ws.getCell(`G${rowIdx}`).value = '';
    }
  }

  // Employee signature block
  ws.getCell('B57').value = user.username;
  ws.getCell('B58').value = user.role || 'Commissioning Engineer';

  // Approver signature block
  if (approval && approval.signature_data) {
    try {
      let base64Image = approval.signature_data;
      if (base64Image.includes(',')) {
        base64Image = base64Image.split(',')[1];
      }
      const imageId = workbook.addImage({
        base64: base64Image,
        extension: 'png'
      });
      ws.addImage(imageId, {
        tl: { col: 6.2, row: 59.2 },
        ext: { width: 140, height: 55 }
      });
      ws.getCell('G57').value = approval.approver_name || 'Site Manager';
      ws.getCell('G58').value = 'SITE MANAGER / CUSTOMER REP';
    } catch (e) {
      console.warn('Failed to embed signature image in exceljs:', e);
    }
  }

  await workbook.xlsx.writeFile(outputPath);
}

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

    // Try Python Openpyxl Engine first (for PIL signature anti-aliasing)
    let generated = false;
    if (fs.existsSync(pythonScriptPath)) {
      try {
        fs.writeFileSync(jsonPath, JSON.stringify(records), 'utf-8');
        fs.writeFileSync(approvalJsonPath, approval ? JSON.stringify(approval) : '{}', 'utf-8');

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
        execSync(pythonCmd, { encoding: 'utf-8', timeout: 10000 });

        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 10000) {
          generated = true;
        }
      } catch (pyErr) {
        console.warn('Python export failed or python not installed, falling back to ExcelJS:', pyErr);
      }
    }

    // Pure Node.js ExcelJS Engine Fallback (Zero Python runtime dependency)
    if (!generated) {
      await generateWithExcelJS(templatePath, outputPath, user, monthStr, records, approval);
    }

    if (!fs.existsSync(outputPath)) {
      throw new Error('Failed to generate exported Excel file.');
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
