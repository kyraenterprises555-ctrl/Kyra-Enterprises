import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";

export async function GET() {
  try {
    const users = await DataService.getUsers();
    const productsResult = await DataService.getProducts();
    const settings = await DataService.getSettings();

    return NextResponse.json({
      success: true,
      message: "Database initialized with Kyra Enterprises defaults",
      stats: {
        usersCount: users.length,
        productsCount: productsResult.length,
        businessName: settings.businessName,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Seed failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
