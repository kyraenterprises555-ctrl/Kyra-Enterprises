import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DataService } from "@/lib/db-store";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get("invoiceId") || undefined;
    const channel = searchParams.get("channel") || undefined;
    const unreadInAppOnly = searchParams.get("unreadInAppOnly") === "true";
    const limit = Number(searchParams.get("limit") || 100);

    const logs = await DataService.getPaymentReminderLogs({
      invoiceId,
      channel,
      unreadInAppOnly,
      limit,
    });
    return NextResponse.json({ success: true, logs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load reminder logs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let ids: string[] | undefined = undefined;
    try {
      const body = await request.json();
      if (Array.isArray(body?.ids)) ids = body.ids;
    } catch {}

    await DataService.markReminderNotificationsRead(ids);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
