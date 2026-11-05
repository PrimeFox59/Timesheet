const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

function testSheetJSExport() {
  const templatePath = path.join(__dirname, '..', '..', 'Timesheet_Template_v2.xlsx');
  const outputPath = path.join(__dirname, 'test_sheetjs_output.xlsx');

  const workbook = XLSX.readFile(templatePath, { cellStyles: true, cellFormulas: true });
  const sheet = workbook.Sheets['Timesheet'];

  // Populate Header
  sheet['A6'] = { t: 's', v: 'NAME:  John Doe' };
  sheet['G6'] = { t: 's', v: 'Aug-2026' };
  sheet['G7'] = { t: 's', v: 'COM116' };
  sheet['G8'] = { t: 's', v: 'Commissioning Lead Engineer' };

  // Populate Row 11 (Day 1)
  sheet['A11'] = { t: 's', v: 'Saturday' };
  sheet['B11'] = { t: 's', v: '01/08/2026' };
  sheet['C11'] = { t: 's', v: 'WORK' };
  sheet['D11'] = { t: 'n', v: 8 };
  sheet['E11'] = { t: 'n', v: 2 };
  sheet['F11'] = { t: 'n', v: 0 };
  sheet['G11'] = { t: 's', v: 'CMN, SAP - Pre-commissioning test' };

  // Signature
  sheet['B57'] = { t: 's', v: 'John Doe' };
  sheet['B58'] = { t: 's', v: 'Commissioning Lead Engineer' };

  XLSX.writeFile(workbook, outputPath);
  console.log('SheetJS successfully written to:', outputPath);
}

testSheetJSExport();
