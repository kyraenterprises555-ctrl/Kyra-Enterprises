import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";
import { getCurrentUser } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { productSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const category = searchParams.get("category") || undefined;
    const activeOnly = searchParams.get("activeOnly") === "true";
    const status = (searchParams.get("status") as any) || undefined;
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    const allMatching = await DataService.getProducts({ search, category, activeOnly, status });

    if (pageParam && limitParam) {
      const page = Math.max(1, Number(pageParam) || 1);
      const limit = Math.max(1, Math.min(200, Number(limitParam) || 15));
      const total = allMatching.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const slice = allMatching.slice((page - 1) * limit, page * limit);
      return NextResponse.json({
        success: true,
        products: slice,
        pagination: { total, page, limit, totalPages },
      });
    }

    return NextResponse.json({
      success: true,
      products: allMatching,
      pagination: {
        total: allMatching.length,
        page: 1,
        limit: allMatching.length || 1,
        totalPages: 1,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch products";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === "billing_staff") {
      return NextResponse.json(
        { error: "Unauthorized: Product creation requires Manager or Admin access" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid product data" },
        { status: 400 }
      );
    }

    const product = await DataService.createProduct(parsed.data, {
      userId: user.userId,
      userName: user.name,
    });

    await recordAuditLog({
      action: "PRODUCT_CREATED",
      entity: "Product",
      entityId: String(product._id),
      performedBy: { userId: user.userId, userName: user.name, role: user.role },
      details: {
        sku: product.sku,
        name: product.name,
        sellingPrice: product.sellingPrice,
        gstRate: product.gstRate,
      },
    });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create product";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
