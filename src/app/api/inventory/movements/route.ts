import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId") || undefined;

    const movements = await DataService.getStockMovements(productId);
    return NextResponse.json({ success: true, movements });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch stock movements";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
