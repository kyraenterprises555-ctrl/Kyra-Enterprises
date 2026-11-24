import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export async function POST() {
  const user = await getCurrentUser();
  if (user) {
    await recordAuditLog({
      action: "USER_LOGOUT",
      entity: "User",
      entityId: user.userId,
      performedBy: {
        userId: user.userId,
        userName: user.name,
        role: user.role,
      },
    });
  }

  await clearSessionCookie();
  return NextResponse.json({ success: true, message: "Logged out" });
}
