import mongoose, { Schema, Document, Model } from "mongoose";

export type ReminderDeliveryStatus =
  | "sent"
  | "failed"
  | "provider_not_configured"
  | "retrying"
  | "skipped";

export interface IPaymentReminderLog extends Document {
  reminderId?: mongoose.Types.ObjectId | string;
  invoiceId: mongoose.Types.ObjectId | string;
  invoiceNumber: string;
  customerId?: mongoose.Types.ObjectId | string;
  customerName: string;
  channel: "email" | "whatsapp" | "sms" | "in_app";
  recipient: string;
  periodKey: string;
  invoiceAmount: number;
  amountPaid: number;
  remainingBalance: number;
  subject: string;
  messageBody: string;
  deliveryStatus: ReminderDeliveryStatus;
  providerResponse?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  isRead: boolean;
  triggeredBy: "cron" | "manual" | "retry";
  createdAt: Date;
  updatedAt: Date;
}

const PaymentReminderLogSchema = new Schema<IPaymentReminderLog>(
  {
    reminderId: { type: Schema.Types.Mixed, index: true },
    invoiceId: { type: Schema.Types.Mixed, required: true, index: true },
    invoiceNumber: { type: String, required: true, index: true },
    customerId: { type: Schema.Types.Mixed, index: true },
    customerName: { type: String, required: true },
    channel: {
      type: String,
      enum: ["email", "whatsapp", "sms", "in_app"],
      required: true,
      index: true,
    },
    recipient: { type: String, default: "" },
    periodKey: { type: String, required: true },
    invoiceAmount: { type: Number, required: true },
    amountPaid: { type: Number, required: true },
    remainingBalance: { type: Number, required: true },
    subject: { type: String, required: true },
    messageBody: { type: String, required: true },
    deliveryStatus: {
      type: String,
      enum: ["sent", "failed", "provider_not_configured", "retrying", "skipped"],
      required: true,
      index: true,
    },
    providerResponse: { type: String },
    errorMessage: { type: String },
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    nextRetryAt: { type: Date, index: true },
    isRead: { type: Boolean, default: false, index: true },
    triggeredBy: {
      type: String,
      enum: ["cron", "manual", "retry"],
      default: "cron",
    },
  },
  { timestamps: true }
);

PaymentReminderLogSchema.index({ invoiceId: 1, channel: 1, periodKey: 1 }, { unique: true });

export const PaymentReminderLog: Model<IPaymentReminderLog> =
  mongoose.models.PaymentReminderLog ||
  mongoose.model<IPaymentReminderLog>("PaymentReminderLog", PaymentReminderLogSchema);

export default PaymentReminderLog;
