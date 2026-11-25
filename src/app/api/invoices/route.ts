import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";
import { getCurrentUser } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { createInvoiceSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const paymentStatus = searchParams.get("paymentStatus") || undefined;
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    const invoices = await DataService.getInvoices({
      search,
      status,
      paymentStatus,
      includeDeleted,
    });
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
    const parsed = createInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid invoice payload" },
        { status: 400 }
      );
    }

    const invoice = await DataService.createInvoice({
      ...parsed.data,
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
        amountPaid: invoice.amountPaid,
        balanceDue: invoice.balanceDue,
        customer: invoice.customer.name,
      },
    });

    return NextResponse.json({ success: true, invoice }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate invoice";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
