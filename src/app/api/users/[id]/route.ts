import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const updatePayload: any = {};
    if (body.name) updatePayload.name = body.name.trim();
    if (body.role) updatePayload.role = body.role;
    if (body.phone !== undefined) updatePayload.phone = body.phone;
    if (body.isActive !== undefined) updatePayload.isActive = body.isActive;
    if (body.password) {
      updatePayload.passwordHash = await hashPassword(body.password);
    }

    const updated = await DataService.updateUser(id, updatePayload);
    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await recordAuditLog({
      action: "USER_MODIFIED",
      entity: "User",
      entityId: id,
      performedBy: { userId: currentUser.userId, userName: currentUser.name, role: currentUser.role },
      details: { modifiedFields: Object.keys(updatePayload) },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
