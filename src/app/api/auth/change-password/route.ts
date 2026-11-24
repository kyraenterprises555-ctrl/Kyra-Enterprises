import { NextResponse } from "next/server";
import { getCurrentUser, comparePassword, hashPassword } from "@/lib/auth";
import { DataService } from "@/lib/db-store";
import { recordAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // Fetch user with password hash
    const user = await DataService.getUserWithPassword(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User account not found" }, { status: 404 });
    }

    // Verify current password
    const isCurrentValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    // Hash new password and update
    const newPasswordHash = await hashPassword(newPassword);
    await DataService.updateUser(session.userId, { passwordHash: newPasswordHash });

    await recordAuditLog({
      action: "PASSWORD_CHANGED",
      entity: "User",
      entityId: session.userId,
      performedBy: { userId: session.userId, userName: session.name, role: session.role },
      details: { email: session.email },
    });

    return NextResponse.json({
      success: true,
      message: "Password changed successfully! Please use your new password next time you sign in.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to change password";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
