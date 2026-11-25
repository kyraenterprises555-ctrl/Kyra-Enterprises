import { formatDate } from "./utils";

export const DEFAULT_REMINDER_SUBJECT = "Payment Reminder – Kyra Enterprises";
export const DEFAULT_REMINDER_TEMPLATE = `Dear {{customerName}},

This is a friendly reminder regarding your pending payment.

Invoice Number: {{invoiceNumber}}

Invoice Amount: ₹{{invoiceAmount}}
Amount Paid: ₹{{amountPaid}}
Remaining Balance: ₹{{remainingBalance}}

Kindly clear the outstanding amount at your earliest convenience.

Thank you for doing business with Kyra Enterprises.`;

export interface ReminderTemplateContext {
  customerName: string;
  invoiceNumber: string;
  invoiceAmount: number;
  amountPaid: number;
  remainingBalance: number;
  dueDate?: Date | string;
  enterpriseName?: string;
}

export function renderReminderTemplate(
  template: string,
  ctx: ReminderTemplateContext
): string {
  const fmtMoney = (n: number) =>
    Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: n % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });

  const enterprise = ctx.enterpriseName || "Kyra Enterprises";
  const dueStr = ctx.dueDate ? formatDate(ctx.dueDate) : "Due upon receipt";

  return template
    .replace(/\{\{\s*customerName\s*\}\}/gi, ctx.customerName)
    .replace(/\[\s*Customer Name\s*\]/gi, ctx.customerName)
    .replace(/\{\{\s*invoiceNumber\s*\}\}/gi, ctx.invoiceNumber)
    .replace(/\[\s*Invoice Number\s*\]/gi, ctx.invoiceNumber)
    .replace(/\{\{\s*invoiceAmount\s*\}\}/gi, fmtMoney(ctx.invoiceAmount))
    .replace(/\{\{\s*amountPaid\s*\}\}/gi, fmtMoney(ctx.amountPaid))
    .replace(/\{\{\s*remainingBalance\s*\}\}/gi, fmtMoney(ctx.remainingBalance))
    .replace(/\{\{\s*dueDate\s*\}\}/gi, dueStr)
    .replace(/\{\{\s*enterpriseName\s*\}\}/gi, enterprise);
}
