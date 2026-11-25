import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const revisions = await DataService.getInvoiceRevisions(id);
    return NextResponse.json({ success: true, revisions });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load invoice revision history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
