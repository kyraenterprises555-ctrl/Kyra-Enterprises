"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { DataService } from "@/lib/db-store";
import { recordAuditLog } from "@/lib/audit";
import { businessSettingsSchema } from "@/lib/validations";

export async function saveBusinessSettingsAction(payload: unknown) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { success: false, error: "Forbidden: Admin privileges required" };
  }

  const parsed = businessSettingsSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid settings configuration",
    };
  }

  const updated = await DataService.updateSettings(parsed.data);
  await recordAuditLog({
    action: "SETTINGS_UPDATED",
    entity: "BusinessSettings",
    entityId: String(updated._id || "settings"),
    performedBy: { userId: user.userId, userName: user.name, role: user.role },
    details: { businessName: parsed.data.businessName, gstin: parsed.data.gstin },
  });

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/payment-reminders");
  return { success: true, settings: updated };
}

export async function toggleProductActiveAction(productId: string, isActive: boolean) {
  const user = await getCurrentUser();
  if (!user || user.role === "billing_staff") {
    return { success: false, error: "Unauthorized" };
  }

  const updated = await DataService.updateProduct(
    productId,
    { isActive },
    { userId: user.userId, userName: user.name }
  );
  if (!updated) {
    return { success: false, error: "Product not found" };
  }

  await recordAuditLog({
    action: isActive ? "PRODUCT_ACTIVATED" : "PRODUCT_DEACTIVATED",
    entity: "Product",
    entityId: productId,
    performedBy: { userId: user.userId, userName: user.name, role: user.role },
    details: { name: updated.name, sku: updated.sku, isActive },
  });

  revalidatePath("/products");
  return { success: true, product: updated };
}

export async function toggleCustomerReminderAction(customerId: string, remindersEnabled: boolean) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const updated = await DataService.updateCustomer(customerId, { remindersEnabled });
  if (!updated) {
    return { success: false, error: "Customer not found" };
  }

  await recordAuditLog({
    action: "CUSTOMER_REMINDER_PREF_UPDATED",
    entity: "Customer",
    entityId: customerId,
    performedBy: { userId: user.userId, userName: user.name, role: user.role },
    details: { customerName: updated.name, remindersEnabled },
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/payment-reminders");
  return { success: true, customer: updated };
}

export async function triggerManualReminderCycleAction(invoiceId?: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const summary = await DataService.runPaymentReminderCycle({
    forceInvoiceId: invoiceId,
    triggeredBy: "manual",
  });

  await recordAuditLog({
    action: "PAYMENT_REMINDER_EXECUTED",
    entity: "PaymentReminder",
    entityId: invoiceId || "batch",
    performedBy: { userId: user.userId, userName: user.name, role: user.role },
    details: summary as unknown as Record<string, unknown>,
  });

  revalidatePath("/payment-reminders");
  return { success: true, summary };
}
