import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ledger = await DataService.getCustomerLedger(id);
    if (!ledger) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, ledger });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to compute customer ledger";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
