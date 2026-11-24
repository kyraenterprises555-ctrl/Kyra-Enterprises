import xlsx from "xlsx";

const workbook = xlsx.readFile("product list with hsn.xlsx");
console.log("Sheet Names:", workbook.SheetNames);

const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(firstSheet);
console.log("Total rows:", data.length);
console.log("Sample rows (first 10):", JSON.stringify(data.slice(0, 10), null, 2));
