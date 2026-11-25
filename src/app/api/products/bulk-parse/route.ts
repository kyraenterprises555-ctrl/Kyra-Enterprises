import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DataService } from "@/lib/db-store";
import {
  BulkColumnMapping,
  ParsedBulkRow,
  mapRawRecordsToBulkRows,
  parseSpreadsheetBuffer,
  validateBulkRows,
} from "@/lib/bulk-import";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === "billing_staff") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const existingProducts = await DataService.getProducts();
    const existingSkus = new Set(existingProducts.map((p) => String(p.sku).toUpperCase()));

    const contentType = request.headers.get("content-type") || "";

    // Mode A: Remap or re-validate edited preview rows (JSON)
    if (contentType.includes("application/json")) {
      const body = await request.json();

      if (Array.isArray(body.rows)) {
        const validated = validateBulkRows(body.rows as ParsedBulkRow[], existingSkus);
        return NextResponse.json({
          success: true,
          rows: validated,
          existingSkus: Array.from(existingSkus),
        });
      }

      if (Array.isArray(body.rawRecords) && body.mapping) {
        const mapped = mapRawRecordsToBulkRows(
          body.rawRecords,
          body.mapping as BulkColumnMapping
        );
        const validated = validateBulkRows(mapped, existingSkus);
        return NextResponse.json({
          success: true,
          rows: validated,
          existingSkus: Array.from(existingSkus),
        });
      }

      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // Mode B: Initial multipart file upload (.xlsx, .xls, .csv)
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No spreadsheet file provided" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["xlsx", "xls", "csv"].includes(ext)) {
      return NextResponse.json(
        { error: "Unsupported file format. Please upload an .xlsx, .xls, or .csv file." },
        { status: 400 }
      );
    }

    const arrayBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    const { headers, rawRecords, suggestedMapping } = parseSpreadsheetBuffer(buffer);
    const mappedRows = mapRawRecordsToBulkRows(rawRecords, suggestedMapping);
    const validatedRows = validateBulkRows(mappedRows, existingSkus);

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileType: ext,
      headers,
      rawRecords,
      mapping: suggestedMapping,
      rows: validatedRows,
      existingSkus: Array.from(existingSkus),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to parse spreadsheet";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
