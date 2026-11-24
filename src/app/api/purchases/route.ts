import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";
import { getCurrentUser } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const purchases = await DataService.getPurchases();
    return NextResponse.json({ success: true, purchases });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch purchases";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === "billing_staff") {
      return NextResponse.json({ error: "Manager or Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { supplierName, supplierGstin, supplierPhone, items, notes } = body;

    if (!supplierName || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Supplier name and purchase items are required" },
        { status: 400 }
      );
    }

    const purchaseNumber = `PO-${Date.now().toString().slice(-6)}`;
    let totalTaxable = 0;
    let totalTax = 0;
    let totalAmount = 0;

    const formattedItems = items.map((it: any) => {
      const taxable = it.quantity * it.purchasePrice;
      const tax = (taxable * (it.gstRate || 0)) / 100;
      const lineTotal = taxable + tax;

      totalTaxable += taxable;
      totalTax += tax;
      totalAmount += lineTotal;

      return {
        productId: it.productId,
        productName: it.productName,
        sku: it.sku,
        quantity: Number(it.quantity),
        purchasePrice: Number(it.purchasePrice),
        gstRate: Number(it.gstRate || 0),
        totalAmount: lineTotal,
      };
    });

    const purchase = await DataService.createPurchase(
      {
        purchaseNumber,
        supplierName,
        supplierGstin: supplierGstin || "",
        supplierPhone: supplierPhone || "",
        purchaseDate: new Date(),
        items: formattedItems,
        totalTaxable,
        totalTax,
        totalAmount,
        status: "received",
        notes,
      },
      { userId: user.userId, userName: user.name }
    );

    await recordAuditLog({
      action: "PURCHASE_ENTRY_CREATED",
      entity: "Purchase",
      entityId: String(purchase._id),
      performedBy: { userId: user.userId, userName: user.name, role: user.role },
      details: { purchaseNumber, supplierName, totalAmount },
    });

    return NextResponse.json({ success: true, purchase }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record purchase";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
