import mongoose, { Schema, Document, Model } from "mongoose";

export interface IInvoiceRevision extends Document {
  invoiceId: mongoose.Types.ObjectId | string;
  invoiceNumber: string;
  revisionNumber: number;
  changeType: "edit" | "amendment" | "cancel" | "soft_delete";
  reason: string;
  previousSnapshot: Record<string, unknown>;
  newSnapshot?: Record<string, unknown>;
  stockAdjustments?: Array<{
    productId: string;
    productName: string;
    sku: string;
    deltaQuantity: number;
  }>;
  balanceDelta?: number;
  changedBy: {
    userId?: string;
    userName?: string;
    role?: string;
  };
  createdAt: Date;
}

const InvoiceRevisionSchema = new Schema<IInvoiceRevision>(
  {
    invoiceId: { type: Schema.Types.Mixed, required: true, index: true },
    invoiceNumber: { type: String, required: true, index: true },
    revisionNumber: { type: Number, required: true },
    changeType: {
      type: String,
      enum: ["edit", "amendment", "cancel", "soft_delete"],
      required: true,
    },
    reason: { type: String, required: true },
    previousSnapshot: { type: Schema.Types.Mixed, required: true },
    newSnapshot: { type: Schema.Types.Mixed },
    stockAdjustments: [
      {
        productId: { type: String },
        productName: { type: String },
        sku: { type: String },
        deltaQuantity: { type: Number },
      },
    ],
    balanceDelta: { type: Number, default: 0 },
    changedBy: {
      userId: { type: String },
      userName: { type: String, default: "Admin" },
      role: { type: String, default: "admin" },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

InvoiceRevisionSchema.index({ invoiceId: 1, revisionNumber: -1 });

export const InvoiceRevision: Model<IInvoiceRevision> =
  mongoose.models.InvoiceRevision ||
  mongoose.model<IInvoiceRevision>("InvoiceRevision", InvoiceRevisionSchema);

export default InvoiceRevision;
