import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { bulkProductRowSchema } from "./validations";

export interface BulkColumnMapping {
  productName: string;
  sku: string;
  category: string;
  description: string;
  purchasePrice: string;
  sellingPrice: string;
  quantity: string;
  unit: string;
  hsnCode: string;
  gstPercentage: string;
  minStockLevel: string;
}

export interface ParsedBulkRow {
  rowNumber: number;
  productName: string;
  sku: string;
  category: string;
  description: string;
  purchasePrice: number | string;
  sellingPrice: number | string;
  quantity: number | string;
  unit: string;
  hsnCode: string;
  gstPercentage: number | string;
  minStockLevel: number | string;
}

export interface ValidatedBulkRow extends ParsedBulkRow {
  isValid: boolean;
  isDuplicateInFile: boolean;
  existsInDb: boolean;
  errors: string[];
}

export const TEMPLATE_COLUMNS = [
  "Product Name",
  "SKU",
  "Category",
  "Description",
  "Purchase Price",
  "Selling Price",
  "Quantity",
  "Unit",
  "HSN Code",
  "GST Percentage",
  "Minimum Stock Level",
] as const;

const SAMPLE_ROWS = [
  [
    "Crompton Ceiling Fan 1200mm High Speed",
    "KE-FAN-101",
    "Fans & Ventilation",
    "Energy efficient 1200mm 3-blade ceiling fan with 2-year warranty",
    1150,
    1450,
    30,
    "PCS",
    "84145110",
    18,
    5,
  ],
  [
    "Bajaj Majesty DX-11 Dry Iron 1000W",
    "KE-IRN-202",
    "Home Appliances",
    "1000W heavy plate non-stick coated dry iron",
    520,
    680,
    40,
    "PCS",
    "85164000",
    18,
    8,
  ],
  [
    "Havells 9W LED Bulb Cool Daylight",
    "KE-LED-303",
    "Electrical Lighting",
    "B22 base 9W energy saving LED lamp",
    55,
    85,
    150,
    "PCS",
    "85395000",
    12,
    20,
  ],
];

const HEADER_SYNONYMS: Record<keyof BulkColumnMapping, string[]> = {
  productName: ["product name", "name", "item name", "product", "item", "item description", "particulars"],
  sku: ["sku", "product code", "item code", "code", "part number", "part no"],
  category: ["category", "product category", "group", "department", "type"],
  description: ["description", "product description", "details", "remarks", "specification"],
  purchasePrice: ["purchase price", "cost price", "buy price", "cost", "landing cost", "purchase rate"],
  sellingPrice: ["selling price", "sale price", "rate", "mrp", "price", "unit price", "selling rate"],
  quantity: ["quantity", "qty", "available quantity", "stock", "opening stock", "current stock"],
  unit: ["unit", "uom", "unit of measurement", "units", "measure"],
  hsnCode: ["hsn code", "hsn", "hsn/sac", "sac", "hsn no"],
  gstPercentage: ["gst percentage", "gst", "gst %", "gst rate", "tax %", "tax rate", "igst %"],
  minStockLevel: ["minimum stock level", "min stock level", "min stock", "min stock alert", "reorder level", "low stock alert"],
};

export function autoDetectColumnMapping(headers: string[]): BulkColumnMapping {
  const normalized = headers.map((h) => ({
    raw: h,
    clean: String(h || "").trim().toLowerCase().replace(/[_-]+/g, " "),
  }));

  const pick = (field: keyof BulkColumnMapping): string => {
    const candidates = HEADER_SYNONYMS[field];
    for (const candidate of candidates) {
      const exact = normalized.find((h) => h.clean === candidate);
      if (exact) return exact.raw;
    }
    for (const candidate of candidates) {
      const partial = normalized.find((h) => h.clean.includes(candidate));
      if (partial) return partial.raw;
    }
    return "";
  };

  return {
    productName: pick("productName"),
    sku: pick("sku"),
    category: pick("category"),
    description: pick("description"),
    purchasePrice: pick("purchasePrice"),
    sellingPrice: pick("sellingPrice"),
    quantity: pick("quantity"),
    unit: pick("unit"),
    hsnCode: pick("hsnCode"),
    gstPercentage: pick("gstPercentage"),
    minStockLevel: pick("minStockLevel"),
  };
}

export function parseSpreadsheetBuffer(buffer: Buffer): {
  headers: string[];
  rawRecords: Record<string, unknown>[];
  suggestedMapping: BulkColumnMapping;
} {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false, cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Uploaded file contains no worksheets.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  if (!matrix || matrix.length === 0) {
    throw new Error("Uploaded file is empty.");
  }

  // Locate header row (first non-empty row with >= 2 non-empty cells)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const nonEmptyCount = (matrix[i] || []).filter((c) => String(c ?? "").trim() !== "").length;
    if (nonEmptyCount >= 2) {
      headerRowIdx = i;
      break;
    }
  }

  const rawHeaderRow = (matrix[headerRowIdx] || []).map((cell, idx) => {
    const txt = String(cell ?? "").trim();
    return txt || `Column_${idx + 1}`;
  });

  const rawRecords: Record<string, unknown>[] = [];
  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const rowArr = matrix[r] || [];
    const hasAnyValue = rowArr.some((v) => String(v ?? "").trim() !== "");
    if (!hasAnyValue) continue;

    const record: Record<string, unknown> = { __rowNumber: r + 1 };
    rawHeaderRow.forEach((colName, cIdx) => {
      record[colName] = rowArr[cIdx] ?? "";
    });
    rawRecords.push(record);
  }

  const suggestedMapping = autoDetectColumnMapping(rawHeaderRow);
  return {
    headers: rawHeaderRow,
    rawRecords,
    suggestedMapping,
  };
}

export function mapRawRecordsToBulkRows(
  rawRecords: Record<string, unknown>[],
  mapping: BulkColumnMapping
): ParsedBulkRow[] {
  const cleanNum = (val: unknown, fallback: number | string = ""): number | string => {
    if (val === null || val === undefined || String(val).trim() === "") return fallback;
    const stripped = String(val).replace(/[₹,\s%]/g, "").trim();
    const num = Number(stripped);
    return Number.isNaN(num) ? String(val) : num;
  };

  return rawRecords.map((rec, idx) => {
    const getStr = (colKey: string) =>
      colKey && rec[colKey] !== undefined ? String(rec[colKey]).trim() : "";

    return {
      rowNumber: Number(rec.__rowNumber || idx + 2),
      productName: getStr(mapping.productName),
      sku: getStr(mapping.sku).toUpperCase(),
      category: getStr(mapping.category) || "General",
      description: getStr(mapping.description),
      purchasePrice: cleanNum(mapping.purchasePrice ? rec[mapping.purchasePrice] : 0, 0),
      sellingPrice: cleanNum(mapping.sellingPrice ? rec[mapping.sellingPrice] : "", ""),
      quantity: cleanNum(mapping.quantity ? rec[mapping.quantity] : 0, 0),
      unit: (getStr(mapping.unit) || "PCS").toUpperCase(),
      hsnCode: getStr(mapping.hsnCode),
      gstPercentage: cleanNum(mapping.gstPercentage ? rec[mapping.gstPercentage] : "", ""),
      minStockLevel: cleanNum(mapping.minStockLevel ? rec[mapping.minStockLevel] : 5, 5),
    };
  });
}

export function validateBulkRows(
  rows: ParsedBulkRow[],
  existingSkus: Set<string>
): ValidatedBulkRow[] {
  const skuCounts = new Map<string, number>();
  for (const r of rows) {
    const normSku = String(r.sku || "").trim().toUpperCase();
    if (normSku) {
      skuCounts.set(normSku, (skuCounts.get(normSku) || 0) + 1);
    }
  }

  return rows.map((row) => {
    const errors: string[] = [];
    const normSku = String(row.sku || "").trim().toUpperCase();
    const isDuplicateInFile = Boolean(normSku && (skuCounts.get(normSku) || 0) > 1);
    const existsInDb = Boolean(normSku && existingSkus.has(normSku));

    if (row.sellingPrice === "") {
      errors.push("Selling Price is required");
    }
    if (row.gstPercentage === "") {
      errors.push("GST Percentage is required");
    }

    const parsed = bulkProductRowSchema.safeParse({
      ...row,
      sku: normSku,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (!errors.includes(issue.message)) {
          errors.push(issue.message);
        }
      }
    }

    if (isDuplicateInFile) {
      errors.push(`Duplicate SKU "${normSku}" appears multiple times in uploaded file`);
    }

    return {
      ...row,
      sku: normSku,
      isValid: errors.length === 0,
      isDuplicateInFile,
      existsInDb,
      errors,
    };
  });
}

export async function generateBulkTemplateExcel(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Kyra Enterprises";
  wb.created = new Date();

  const ws = wb.addWorksheet("Kyra_Products_Template");
  ws.columns = [
    { header: "Product Name", key: "productName", width: 38 },
    { header: "SKU", key: "sku", width: 18 },
    { header: "Category", key: "category", width: 24 },
    { header: "Description", key: "description", width: 42 },
    { header: "Purchase Price", key: "purchasePrice", width: 16 },
    { header: "Selling Price", key: "sellingPrice", width: 16 },
    { header: "Quantity", key: "quantity", width: 12 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "HSN Code", key: "hsnCode", width: 14 },
    { header: "GST Percentage", key: "gstPercentage", width: 16 },
    { header: "Minimum Stock Level", key: "minStockLevel", width: 20 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0E1E32" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.height = 24;

  for (const sample of SAMPLE_ROWS) {
    ws.addRow(sample);
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export function generateBulkTemplateCsv(): string {
  const escapeCsv = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    TEMPLATE_COLUMNS.map(escapeCsv).join(","),
    ...SAMPLE_ROWS.map((r) => r.map(escapeCsv).join(",")),
  ];
  return lines.join("\n");
}
