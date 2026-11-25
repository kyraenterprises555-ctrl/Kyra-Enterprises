import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";
import { getCurrentUser } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { recordPaymentSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get("invoiceId") || undefined;
    const customerId = searchParams.get("customerId") || undefined;
    const payments = await DataService.getPayments({ invoiceId, customerId });
    return NextResponse.json({ success: true, payments });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch payments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const headerIdem = request.headers.get("x-idempotency-key") || undefined;
    const parsed = recordPaymentSchema.safeParse({
      ...body,
      idempotencyKey: body.idempotencyKey || headerIdem,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid payment data" },
        { status: 400 }
      );
    }

    const result = await DataService.recordPayment({
      ...parsed.data,
      user: { userId: user.userId, userName: user.name },
    });

    if (!("idempotentReplay" in result && result.idempotentReplay)) {
      await recordAuditLog({
        action: "PAYMENT_RECORDED",
        entity: "Payment",
        entityId: String(result.payment._id),
        performedBy: { userId: user.userId, userName: user.name, role: user.role },
        details: {
          invoiceNumber: result.payment.invoiceNumber,
          amount: result.payment.amount,
          paymentMode: result.payment.paymentMode,
          remainingBalance: result.invoice?.balanceDue,
        },
      });
    }

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record payment";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
