import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPaymentReminder extends Document {
  invoiceId: mongoose.Types.ObjectId | string;
  invoiceNumber: string;
  customerId?: mongoose.Types.ObjectId | string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  status: "active" | "paused" | "completed" | "cancelled";
  intervalDays: 3 | 4;
  startDate: Date;
  dueDate: Date;
  lastReminderSentAt?: Date;
  nextReminderDate: Date;
  reminderCount: number;
  lastPeriodKey?: string;
  invoiceTotal: number;
  amountPaid: number;
  remainingBalance: number;
  channels: Array<"email" | "whatsapp" | "sms" | "in_app">;
  completedAt?: Date;
  stoppedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentReminderSchema = new Schema<IPaymentReminder>(
  {
    invoiceId: { type: Schema.Types.Mixed, required: true, unique: true, index: true },
    invoiceNumber: { type: String, required: true, index: true },
    customerId: { type: Schema.Types.Mixed, index: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: "" },
    customerEmail: { type: String, default: "" },
    status: {
      type: String,
      enum: ["active", "paused", "completed", "cancelled"],
      default: "active",
      index: true,
    },
    intervalDays: { type: Number, enum: [3, 4], default: 4 },
    startDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    lastReminderSentAt: { type: Date },
    nextReminderDate: { type: Date, required: true, index: true },
    reminderCount: { type: Number, default: 0 },
    lastPeriodKey: { type: String },
    invoiceTotal: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, default: 0, min: 0 },
    remainingBalance: { type: Number, required: true, min: 0 },
    channels: {
      type: [String],
      enum: ["email", "whatsapp", "sms", "in_app"],
      default: ["in_app", "email"],
    },
    completedAt: { type: Date },
    stoppedReason: { type: String },
  },
  { timestamps: true }
);

PaymentReminderSchema.index({ status: 1, nextReminderDate: 1 });

export const PaymentReminder: Model<IPaymentReminder> =
  mongoose.models.PaymentReminder ||
  mongoose.model<IPaymentReminder>("PaymentReminder", PaymentReminderSchema);

export default PaymentReminder;
