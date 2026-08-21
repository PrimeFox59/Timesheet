const fs = require('fs');
const path = require('path');
const XLSX = require('../node_modules/xlsx');

const filePath = path.join(__dirname, '..', '..', 'Timesheet_Template_v2.xlsx');
console.log('Template Path:', filePath);
console.log('File Exists:', fs.existsSync(filePath));

const wb = XLSX.readFile(filePath);
console.log('Sheet Names:', wb.SheetNames);

wb.SheetNames.forEach(sheetName => {
  console.log('\n========================================');
  console.log('SHEET:', sheetName);
  console.log('========================================');
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  rows.forEach((row, idx) => {
    if (row && row.length > 0 && row.some(c => c !== null && c !== undefined && c !== '')) {
      console.log(`Row ${idx + 1}:`, JSON.stringify(row));
    }
  });
});
