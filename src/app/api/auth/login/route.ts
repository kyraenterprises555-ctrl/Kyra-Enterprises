import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";
import { comparePassword, createSessionToken, setSessionCookie } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await DataService.getUserByEmail(email);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account is deactivated. Please contact administrator." },
        { status: 403 }
      );
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Update last login
    await DataService.updateUser(user._id.toString(), { lastLogin: new Date() });

    const sessionUser = {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const token = await createSessionToken(sessionUser);
    await setSessionCookie(token);

    // Audit log
    await recordAuditLog({
      action: "USER_LOGIN",
      entity: "User",
      entityId: user._id.toString(),
      performedBy: {
        userId: user._id.toString(),
        userName: user.name,
        role: user.role,
      },
      details: { email: user.email },
    });

    return NextResponse.json({
      success: true,
      user: sessionUser,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Login error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
