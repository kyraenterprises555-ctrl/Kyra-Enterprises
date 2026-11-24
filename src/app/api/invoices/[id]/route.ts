import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";
import { getCurrentUser } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await DataService.getInvoiceById(id);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, invoice });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch invoice";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === "billing_staff") {
      return NextResponse.json(
        { error: "Unauthorized: Only Managers and Admins can cancel invoices" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { action, reason } = await request.json();

    if (action === "cancel") {
      if (!reason) {
        return NextResponse.json(
          { error: "Reason is required to cancel an invoice" },
          { status: 400 }
        );
      }

      const cancelled = await DataService.cancelInvoice(id, reason, {
        userId: user.userId,
        userName: user.name,
      });

      await recordAuditLog({
        action: "INVOICE_CANCELLED",
        entity: "Invoice",
        entityId: id,
        performedBy: { userId: user.userId, userName: user.name, role: user.role },
        details: { invoiceNumber: cancelled.invoiceNumber, reason },
      });

      return NextResponse.json({ success: true, invoice: cancelled });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to process invoice action";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
