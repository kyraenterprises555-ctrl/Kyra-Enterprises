import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";
import { getCurrentUser } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const paymentStatus = searchParams.get("paymentStatus") || undefined;

    const invoices = await DataService.getInvoices({ search, status, paymentStatus });
    return NextResponse.json({ success: true, invoices });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch invoices";
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
    const { customerId, customerData, items, paymentMode, amountPaid, notes } = body;

    if (!customerData || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Customer details and at least one line item are required" },
        { status: 400 }
      );
    }

    const invoice = await DataService.createInvoice({
      customerId,
      customerData,
      items,
      paymentMode,
      amountPaid: Number(amountPaid || 0),
      notes,
      user: { userId: user.userId, userName: user.name },
    });

    await recordAuditLog({
      action: "INVOICE_GENERATED",
      entity: "Invoice",
      entityId: String(invoice._id),
      performedBy: { userId: user.userId, userName: user.name, role: user.role },
      details: {
        invoiceNumber: invoice.invoiceNumber,
        grandTotal: invoice.grandTotal,
        customer: invoice.customer.name,
      },
    });

    return NextResponse.json({ success: true, invoice }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate invoice";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
