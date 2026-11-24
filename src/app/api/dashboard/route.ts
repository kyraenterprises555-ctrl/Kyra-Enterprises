import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";

export async function GET() {
  try {
    const metrics = await DataService.getDashboardMetrics();
    return NextResponse.json({ success: true, metrics });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard metrics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
