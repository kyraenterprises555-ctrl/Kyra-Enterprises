export type UserRole = "admin" | "manager" | "billing_staff";

export interface SessionUser {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
}

export type PaymentStatus = "paid" | "partial" | "unpaid";
export type InvoiceStatus = "finalized" | "cancelled";
export type PaymentMode = "cash" | "upi" | "bank_transfer" | "card" | "credit";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
