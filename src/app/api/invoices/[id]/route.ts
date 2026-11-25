import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";
import { getCurrentUser } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { editInvoiceSchema } from "@/lib/validations";

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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === "billing_staff") {
      return NextResponse.json(
        { error: "Forbidden: Only Admins and Managers are authorized to edit/amend invoices" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = editInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid invoice edit payload" },
        { status: 400 }
      );
    }

    const updated = await DataService.editInvoice(id, {
      ...parsed.data,
      user: { userId: user.userId, userName: user.name, role: user.role },
    });

    await recordAuditLog({
      action: "INVOICE_EDITED",
      entity: "Invoice",
      entityId: id,
      performedBy: { userId: user.userId, userName: user.name, role: user.role },
      details: {
        invoiceNumber: updated.invoiceNumber,
        revisionNumber: updated.revisionNumber,
        newGrandTotal: updated.grandTotal,
        newBalanceDue: updated.balanceDue,
        amendmentReason: parsed.data.amendmentReason,
      },
    });

    return NextResponse.json({ success: true, invoice: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to edit invoice";
    return NextResponse.json({ error: message }, { status: 400 });
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
      if (!reason || !String(reason).trim()) {
        return NextResponse.json(
          { error: "Reason is required to cancel an invoice" },
          { status: 400 }
        );
      }

      const cancelled = await DataService.cancelInvoice(id, String(reason).trim(), {
        userId: user.userId,
        userName: user.name,
        role: user.role,
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
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Invoice deletion is restricted to Admin / Owner" },
        { status: 403 }
      );
    }

    const { id } = await params;
    let reason = "Administrative soft deletion";
    try {
      const body = await request.json();
      if (body?.reason && String(body.reason).trim()) {
        reason = String(body.reason).trim();
      } else {
        return NextResponse.json(
          { error: "Deletion reason is mandatory for audit compliance" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Deletion reason is mandatory for audit compliance" },
        { status: 400 }
      );
    }

    const deleted = await DataService.softDeleteInvoice(id, reason, {
      userId: user.userId,
      userName: user.name,
      role: user.role,
    });

    await recordAuditLog({
      action: "INVOICE_SOFT_DELETED",
      entity: "Invoice",
      entityId: id,
      performedBy: { userId: user.userId, userName: user.name, role: user.role },
      details: {
        invoiceNumber: deleted.invoiceNumber,
        customerName: deleted.customer?.name,
        deletionReason: reason,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Invoice ${deleted.invoiceNumber} soft-deleted and archived in audit history.`,
      invoice: deleted,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete invoice";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
