import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DataService } from "@/lib/db-store";
import { recordAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;

    const [reminders, settings] = await Promise.all([
      DataService.getPaymentReminders(status),
      DataService.getSettings(),
    ]);

    return NextResponse.json({
      success: true,
      reminders,
      reminderSettings: settings.reminderSettings,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load reminders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    if (body.action === "run_due" || body.action === "send_single") {
      const summary = await DataService.runPaymentReminderCycle({
        forceInvoiceId: body.action === "send_single" ? body.invoiceId : undefined,
        triggeredBy: "manual",
      });

      await recordAuditLog({
        action: "PAYMENT_REMINDER_TRIGGERED",
        entity: "PaymentReminder",
        entityId: body.invoiceId || "due_batch",
        performedBy: { userId: user.userId, userName: user.name, role: user.role },
        details: summary as unknown as Record<string, unknown>,
      });

      return NextResponse.json({ success: true, summary });
    }

    if (body.action === "toggle_status" && body.reminderId) {
      const updated = await DataService.updateReminderSchedule(body.reminderId, {
        status: body.status === "paused" ? "paused" : "active",
      });
      return NextResponse.json({ success: true, reminder: updated });
    }

    return NextResponse.json({ error: "Invalid reminder action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to execute reminder action";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
