import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";
import { getCurrentUser } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const customers = await DataService.getCustomers(search);
    return NextResponse.json({ success: true, customers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch customers";
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
      businessName,
      phone,
      email,
      billingAddress,
      shippingAddress,
      gstin,
      state,
      stateCode,
      customerType,
    } = body;

    if (!name || !phone || !billingAddress || !state || !stateCode) {
      return NextResponse.json(
        { error: "Customer name, phone, billing address, and state details are required" },
        { status: 400 }
      );
    }

    const customer = await DataService.createCustomer({
      name: name.trim(),
      businessName: businessName?.trim() || "",
      phone: phone.trim(),
      email: email?.toLowerCase().trim() || "",
      billingAddress: billingAddress.trim(),
      shippingAddress: shippingAddress?.trim() || billingAddress.trim(),
      gstin: gstin?.toUpperCase().trim() || "",
      state,
      stateCode,
      customerType: customerType || (gstin ? "registered" : "unregistered"),
    });

    await recordAuditLog({
      action: "CUSTOMER_CREATED",
      entity: "Customer",
      entityId: String(customer._id),
      performedBy: { userId: user.userId, userName: user.name, role: user.role },
      details: { name: customer.name, phone: customer.phone },
    });

    return NextResponse.json({ success: true, customer }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create customer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
