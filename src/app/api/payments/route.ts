import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";
import { getCurrentUser } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const payments = await DataService.getPayments();
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
    const { invoiceId, amount, paymentMode, transactionRef, notes } = body;

    if (!invoiceId || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: "Valid invoice ID and payment amount are required" },
        { status: 400 }
      );
    }

    const result = await DataService.recordPayment({
      invoiceId,
      amount: Number(amount),
      paymentMode: paymentMode || "cash",
      transactionRef: transactionRef || "",
      notes: notes || "",
      user: { userId: user.userId, userName: user.name },
    });

    await recordAuditLog({
      action: "PAYMENT_RECORDED",
      entity: "Payment",
      entityId: String(result.payment._id),
      performedBy: { userId: user.userId, userName: user.name, role: user.role },
      details: {
        invoiceNumber: result.payment.invoiceNumber,
        amount,
        paymentMode,
      },
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
