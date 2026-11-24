import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";
import { getCurrentUser } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === "billing_staff") {
      return NextResponse.json({ error: "Unauthorized: Manager or Admin access required" }, { status: 403 });
    }

    const { productId, quantity, type, reason } = await request.json();

    if (!productId || quantity === undefined || !reason) {
      return NextResponse.json(
        { error: "Product ID, quantity adjustment, and reason are required" },
        { status: 400 }
      );
    }

    const result = await DataService.adjustStock({
      productId,
      quantity: Number(quantity),
      type: type || "adjustment",
      reason,
      user: { userId: user.userId, userName: user.name },
    });

    await recordAuditLog({
      action: "STOCK_ADJUSTED",
      entity: "StockMovement",
      entityId: String(result.movement._id),
      performedBy: { userId: user.userId, userName: user.name, role: user.role },
      details: {
        product: result.product.name,
        qtyChanged: quantity,
        newQty: result.product.availableQuantity,
        reason,
      },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to adjust stock";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
