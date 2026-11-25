import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";
import { recordAuditLog } from "@/lib/audit";

function verifyCronSecret(request: Request): boolean {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization") || "";
  const customHeader = request.headers.get("x-cron-secret") || "";

  if (authHeader === `Bearer ${configuredSecret}`) return true;
  if (customHeader === configuredSecret) return true;
  return false;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized scheduled job invocation: Invalid or missing CRON_SECRET" },
      { status: 401 }
    );
  }

  try {
    const summary = await DataService.runPaymentReminderCycle({ triggeredBy: "cron" });
    await recordAuditLog({
      action: "SCHEDULED_REMINDER_CRON_RUN",
      entity: "PaymentReminder",
      performedBy: { userName: "Kyra Cron Scheduler", role: "system" },
      details: summary as unknown as Record<string, unknown>,
    });

    return NextResponse.json({
      success: true,
      enterprise: "Kyra Enterprises",
      executedAt: new Date().toISOString(),
      summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Scheduled reminder job failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
