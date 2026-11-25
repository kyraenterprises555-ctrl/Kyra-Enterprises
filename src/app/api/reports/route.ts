import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === "billing_staff") {
      return NextResponse.json(
        { error: "Forbidden: Financial reports require Manager or Admin access" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const report = await DataService.getComprehensiveReports({ startDate, endDate });
    return NextResponse.json({ success: true, report });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate reports";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
