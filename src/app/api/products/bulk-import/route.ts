import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DataService } from "@/lib/db-store";
import { recordAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const jobs = await DataService.getImportJobs(25);
    return NextResponse.json({ success: true, jobs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch import history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === "billing_staff") {
      return NextResponse.json(
        { error: "Unauthorized: Bulk product import requires Manager or Admin access" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      fileName = "bulk_upload.xlsx",
      fileType = "xlsx",
      rows,
      duplicateStrategy = "skip",
      updateStock = false,
    } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No product rows provided for import" },
        { status: 400 }
      );
    }

    const normalizedType = ["xlsx", "xls", "csv"].includes(fileType) ? fileType : "xlsx";
    const normalizedStrategy = ["skip", "update", "new_only"].includes(duplicateStrategy)
      ? duplicateStrategy
      : "skip";

    const report = await DataService.bulkImportProducts({
      fileName,
      fileType: normalizedType,
      rows,
      duplicateStrategy: normalizedStrategy,
      updateStock: Boolean(updateStock),
      user: { userId: user.userId, userName: user.name },
    });

    await recordAuditLog({
      action: "BULK_PRODUCTS_IMPORTED",
      entity: "ImportJob",
      entityId: String(report._id || report.jobNumber),
      performedBy: { userId: user.userId, userName: user.name, role: user.role },
      details: {
        jobNumber: report.jobNumber,
        fileName,
        totalRows: report.totalRows,
        importedCount: report.importedCount,
        updatedCount: report.updatedCount,
        skippedCount: report.skippedCount,
        failedCount: report.failedCount,
        duplicateStrategy: normalizedStrategy,
        updateStock: Boolean(updateStock),
      },
    });

    return NextResponse.json({ success: true, report });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Bulk import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
