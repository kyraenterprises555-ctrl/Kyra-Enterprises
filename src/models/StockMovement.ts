import mongoose, { Schema, Document, Model } from "mongoose";

export type StockMovementType =
  | "purchase"
  | "stock_in"
  | "stock_out"
  | "sale"
  | "adjustment"
  | "return"
  | "bulk_import"
  | "invoice_edit"
  | "cancellation_reversal"
  | "deletion_reversal";

export interface IStockMovement extends Document {
  productId: mongoose.Types.ObjectId | string;
  productName: string;
  sku: string;
  type: StockMovementType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  referenceType: "invoice" | "purchase" | "manual" | "adjustment" | "import";
  referenceId?: string;
  referenceNumber?: string;
  reason?: string;
  unitCost?: number;
  performedBy: {
    userId?: string;
    userName?: string;
  };
  createdAt: Date;
}

const StockMovementSchema = new Schema<IStockMovement>(
  {
    productId: { type: Schema.Types.Mixed, required: true, index: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: [
        "purchase",
        "stock_in",
        "stock_out",
        "sale",
        "adjustment",
        "return",
        "bulk_import",
        "invoice_edit",
        "cancellation_reversal",
        "deletion_reversal",
      ],
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true },
    previousQuantity: { type: Number, required: true },
    newQuantity: { type: Number, required: true },
    referenceType: {
      type: String,
      enum: ["invoice", "purchase", "manual", "adjustment", "import"],
      default: "manual",
    },
    referenceId: { type: String },
    referenceNumber: { type: String, index: true },
    reason: { type: String },
    unitCost: { type: Number },
    performedBy: {
      userId: { type: String },
      userName: { type: String, default: "System" },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

StockMovementSchema.index({ productId: 1, createdAt: -1 });

export const StockMovement: Model<IStockMovement> =
  mongoose.models.StockMovement ||
  mongoose.model<IStockMovement>("StockMovement", StockMovementSchema);

export default StockMovement;
