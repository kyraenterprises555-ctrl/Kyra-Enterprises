import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";
import { getCurrentUser } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const category = searchParams.get("category") || undefined;
    const activeOnly = searchParams.get("activeOnly") === "true";

    const products = await DataService.getProducts({ search, category, activeOnly });
    return NextResponse.json({ success: true, products });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch products";
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
    const {
      name,
      sku,
      barcode,
      categoryName,
      description,
      uom,
      sellingPrice,
      purchasePrice,
      availableQuantity,
      minStockAlert,
      gstRate,
      hsnCode,
    } = body;

    if (!name || !sku || sellingPrice === undefined || purchasePrice === undefined) {
      return NextResponse.json(
        { error: "Product name, SKU, selling price, and purchase price are required" },
        { status: 400 }
      );
    }

    const product = await DataService.createProduct(
      {
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        barcode: barcode?.trim() || "",
        categoryName: categoryName || "General",
        description: description?.trim() || "",
        uom: uom || "PCS",
        sellingPrice: Number(sellingPrice),
        purchasePrice: Number(purchasePrice),
        availableQuantity: Number(availableQuantity || 0),
        minStockAlert: Number(minStockAlert || 5),
        gstRate: Number(gstRate !== undefined ? gstRate : 18),
        hsnCode: hsnCode?.trim() || "8471",
        isActive: true,
      },
      { userId: user.userId, userName: user.name }
    );

    await recordAuditLog({
      action: "PRODUCT_CREATED",
      entity: "Product",
      entityId: String(product._id),
      performedBy: { userId: user.userId, userName: user.name, role: user.role },
      details: { sku: product.sku, name: product.name },
    });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create product";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
