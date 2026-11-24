import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";

export async function GET() {
  try {
    const users = await DataService.getUsers();
    const products = await DataService.getProducts();
    const settings = await DataService.getSettings();

    return NextResponse.json({
      success: true,
      message: "Database initialized with Kayra Enterprises defaults",
      stats: {
        usersCount: users.length,
        productsCount: products.length,
        businessName: settings.businessName,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Seed failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
