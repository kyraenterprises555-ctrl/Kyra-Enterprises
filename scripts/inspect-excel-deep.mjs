import xlsx from "xlsx";

const wb = xlsx.readFile("product list with hsn.xlsx");
console.log("Sheet Names:", wb.SheetNames);

for (const name of wb.SheetNames) {
  console.log(`\n--- Sheet: ${name} ---`);
  const sheet = wb.Sheets[name];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false });
  console.log(`Total rows: ${rows.length}`);
  for (let i = 0; i < rows.length; i++) {
    console.log(`Row ${i}:`, JSON.stringify(rows[i]));
  }
}
