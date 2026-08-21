const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

async function testExport() {
  const templatePath = path.join(__dirname, '..', '..', 'Timesheet_Template_v2.xlsx');
  const outputPath = path.join(__dirname, 'test_output.xlsx');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const sheet = workbook.getWorksheet('Timesheet');

  // Fill Header Information
  sheet.getCell('A6').value = 'NAME:  John Doe';
  sheet.getCell('G6').value = 'Aug-2026';
  sheet.getCell('G7').value = 'COM116';
  sheet.getCell('G8').value = 'Commissioning Lead Engineer';

  // Fill Day 1 (Row 11)
  sheet.getCell('A11').value = 'Saturday';
  sheet.getCell('B11').value = '01/08/2026';
  sheet.getCell('C11').value = 'WORK';
  sheet.getCell('D11').value = 8;
  sheet.getCell('E11').value = 2;
  sheet.getCell('F11').value = 0;
  sheet.getCell('G11').value = 'CMN, SAP - Pre-commissioning test';

  // Fill Signature
  sheet.getCell('B57').value = 'John Doe';
  sheet.getCell('B58').value = 'Commissioning Lead Engineer';

  await workbook.xlsx.writeFile(outputPath);
  console.log('Successfully written to:', outputPath);
}

testExport().catch(console.error);
