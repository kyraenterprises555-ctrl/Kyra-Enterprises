import { NextResponse } from "next/server";
import { getCurrentUser, createSessionToken, setSessionCookie } from "@/lib/auth";
import { DataService } from "@/lib/db-store";
import { recordAuditLog } from "@/lib/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const fullUser = await DataService.getUserById(user.userId);
  return NextResponse.json({
    success: true,
    user: { ...user, phone: fullUser?.phone || "" },
  });
}

export async function PUT(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Full Name cannot be empty" }, { status: 400 });
    }

    const updatePayload: any = {
      name: name.trim(),
    };
    if (phone !== undefined) {
      updatePayload.phone = phone.trim();
    }

    const updated = await DataService.updateUser(session.userId, updatePayload);
    if (!updated) {
      return NextResponse.json({ error: "User account not found" }, { status: 404 });
    }

    // Refresh JWT session cookie with new name
    const updatedSession = {
      ...session,
      name: updated.name,
    };
    const token = await createSessionToken(updatedSession);
    await setSessionCookie(token);

    await recordAuditLog({
      action: "USER_PROFILE_UPDATED",
      entity: "User",
      entityId: session.userId,
      performedBy: { userId: session.userId, userName: updated.name, role: session.role },
      details: { updatedFields: Object.keys(updatePayload) },
    });

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully!",
      user: { ...updatedSession, phone: updated.phone || "" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
