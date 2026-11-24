import xlsx from "xlsx";

const workbook = xlsx.readFile("product list with hsn.xlsx");
const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(firstSheet, { header: 1 });

for (let i = 0; i < data.length; i++) {
  console.log(i, JSON.stringify(data[i]));
}
