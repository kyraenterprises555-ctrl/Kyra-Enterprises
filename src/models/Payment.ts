import mongoose, { Schema, Document, Model } from "mongoose";

export type PaymentMode = "cash" | "upi" | "bank_transfer" | "card" | "credit" | "other";

export interface IPayment extends Document {
  invoiceId: mongoose.Types.ObjectId | string;
  invoiceNumber: string;
  customerId?: mongoose.Types.ObjectId | string;
  customerName: string;
  amount: number;
  invoiceTotalSnapshot?: number;
  balanceAfterPayment?: number;
  paymentMode: PaymentMode;
  transactionRef?: string;
  idempotencyKey?: string;
  status: "completed" | "voided";
  paymentDate: Date;
  notes?: string;
  recordedBy: {
    userId?: string;
    userName?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    invoiceId: { type: Schema.Types.Mixed, required: true, index: true },
    invoiceNumber: { type: String, required: true, index: true },
    customerId: { type: Schema.Types.Mixed, index: true },
    customerName: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    invoiceTotalSnapshot: { type: Number },
    balanceAfterPayment: { type: Number },
    paymentMode: {
      type: String,
      enum: ["cash", "upi", "bank_transfer", "card", "credit", "other"],
      default: "cash",
      required: true,
    },
    transactionRef: { type: String, trim: true },
    idempotencyKey: { type: String, trim: true, unique: true, sparse: true },
    status: {
      type: String,
      enum: ["completed", "voided"],
      default: "completed",
      index: true,
    },
    paymentDate: { type: Date, default: Date.now, index: true },
    notes: { type: String, trim: true },
    recordedBy: {
      userId: { type: String },
      userName: { type: String, default: "Admin" },
    },
  },
  { timestamps: true }
);

export const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);

export default Payment;
