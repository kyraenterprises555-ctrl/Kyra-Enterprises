import mongoose, { Schema, Document, Model } from "mongoose";

export type PaymentMode = "cash" | "upi" | "bank_transfer" | "card" | "credit";

export interface IPayment extends Document {
  invoiceId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  customerId?: mongoose.Types.ObjectId;
  customerName: string;
  amount: number;
  paymentMode: PaymentMode;
  transactionRef?: string;
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
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
    invoiceNumber: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMode: {
      type: String,
      enum: ["cash", "upi", "bank_transfer", "card", "credit"],
      default: "cash",
      required: true,
    },
    transactionRef: { type: String },
    paymentDate: { type: Date, default: Date.now },
    notes: { type: String },
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
