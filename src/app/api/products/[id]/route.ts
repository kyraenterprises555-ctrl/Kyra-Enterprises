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
    const product = await DataService.getProductById(id);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, product });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch product";
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
        { error: "Unauthorized: Product updates require Manager or Admin access" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const existing = await DataService.getProductById(id);
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const body = await request.json();
    const payload: any = { ...body };
    if (payload.sellingPrice !== undefined) payload.sellingPrice = Number(payload.sellingPrice);
    if (payload.purchasePrice !== undefined) payload.purchasePrice = Number(payload.purchasePrice);
    if (payload.availableQuantity !== undefined) {
      payload.availableQuantity = Number(payload.availableQuantity);
    }
    if (payload.minStockAlert !== undefined) payload.minStockAlert = Number(payload.minStockAlert);
    if (payload.gstRate !== undefined) payload.gstRate = Number(payload.gstRate);

    if (payload.sellingPrice !== undefined && payload.sellingPrice < 0) {
      return NextResponse.json({ error: "Selling price cannot be negative" }, { status: 400 });
    }
    if (payload.purchasePrice !== undefined && payload.purchasePrice < 0) {
      return NextResponse.json({ error: "Purchase price cannot be negative" }, { status: 400 });
    }
    if (payload.availableQuantity !== undefined && payload.availableQuantity < 0) {
      return NextResponse.json({ error: "Quantity cannot be negative" }, { status: 400 });
    }

    const updated = await DataService.updateProduct(id, payload, {
      userId: user.userId,
      userName: user.name,
    });

    const priceChanged =
      (payload.sellingPrice !== undefined && payload.sellingPrice !== existing.sellingPrice) ||
      (payload.purchasePrice !== undefined && payload.purchasePrice !== existing.purchasePrice);

    await recordAuditLog({
      action: priceChanged ? "PRODUCT_PRICE_UPDATED" : "PRODUCT_UPDATED",
      entity: "Product",
      entityId: id,
      performedBy: { userId: user.userId, userName: user.name, role: user.role },
      details: {
        sku: updated?.sku,
        previousPrice: existing.sellingPrice,
        newPrice: updated?.sellingPrice,
        previousQty: existing.availableQuantity,
        newQty: updated?.availableQuantity,
        updatedFields: Object.keys(body),
      },
    });

    return NextResponse.json({ success: true, product: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update product";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === "billing_staff") {
      return NextResponse.json({ error: "Unauthorized to delete product" }, { status: 403 });
    }

    const { id } = await params;
    const res = await DataService.deleteProduct(id, {
      userId: user.userId,
      userName: user.name,
    });
    if (!res) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await recordAuditLog({
      action: res.permanent ? "PRODUCT_PERMANENTLY_DELETED" : "PRODUCT_SOFT_DELETED",
      entity: "Product",
      entityId: id,
      performedBy: { userId: user.userId, userName: user.name, role: user.role },
      details: { name: res.product?.name, sku: res.product?.sku, permanent: res.permanent },
    });

    return NextResponse.json({
      success: true,
      permanent: res.permanent,
      message: res.permanent
        ? "Product removed permanently (no historical invoices referenced it)"
        : "Product deactivated and soft-deleted to preserve historical invoice integrity",
      product: res.product,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete product";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
