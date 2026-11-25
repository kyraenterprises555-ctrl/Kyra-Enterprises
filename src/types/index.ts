export type UserRole = "admin" | "manager" | "billing_staff";

export interface SessionUser {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
}

export type PaymentStatus = "paid" | "partial" | "unpaid" | "overdue";
export type InvoiceStatus = "finalized" | "amended" | "cancelled" | "deleted";
export type PaymentMode = "cash" | "upi" | "bank_transfer" | "card" | "credit" | "other";
export type ReminderChannel = "email" | "whatsapp" | "sms" | "in_app";
export type ReminderStatus = "active" | "paused" | "completed" | "cancelled";
export type DuplicateStrategy = "skip" | "update" | "new_only";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
