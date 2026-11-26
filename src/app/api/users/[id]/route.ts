import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";
import { getCurrentUser, hashPassword, createSessionToken, setSessionCookie } from "@/lib/auth";
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

    // If the logged-in admin updated their own account, refresh their active session cookie
    if (currentUser.userId === id || currentUser.email === updated.email) {
      const updatedSession = {
        ...currentUser,
        name: updated.name || currentUser.name,
        role: updated.role || currentUser.role,
      };
      const token = await createSessionToken(updatedSession);
      await setSessionCookie(token);
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;

    // Prevent self-deletion of currently logged-in admin
    if (currentUser.userId === id) {
      return NextResponse.json(
        { error: "You cannot delete your own active admin account" },
        { status: 400 }
      );
    }

    const deleted = await DataService.deleteUser(id);
    if (!deleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await recordAuditLog({
      action: "USER_DELETED",
      entity: "User",
      entityId: id,
      performedBy: { userId: currentUser.userId, userName: currentUser.name, role: currentUser.role },
      details: { name: deleted.name, email: deleted.email, role: deleted.role },
    });

    return NextResponse.json({
      success: true,
      message: `Staff account "${deleted.name}" (${deleted.email}) deleted successfully`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
