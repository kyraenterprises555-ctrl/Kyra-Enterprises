import mongoose, { Schema, Document, Model } from "mongoose";

export type StockMovementType =
  | "purchase"
  | "sale"
  | "adjustment"
  | "return"
  | "cancellation_reversal";

export interface IStockMovement extends Document {
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  type: StockMovementType;
  quantity: number; // Positive for additions, negative for deductions
  previousQuantity: number;
  newQuantity: number;
  referenceType: "invoice" | "purchase" | "manual" | "adjustment";
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
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    type: {
      type: String,
      enum: ["purchase", "sale", "adjustment", "return", "cancellation_reversal"],
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true },
    previousQuantity: { type: Number, required: true },
    newQuantity: { type: Number, required: true },
    referenceType: {
      type: String,
      enum: ["invoice", "purchase", "manual", "adjustment"],
      default: "manual",
    },
    referenceId: { type: String },
    referenceNumber: { type: String },
    reason: { type: String },
    unitCost: { type: Number },
    performedBy: {
      userId: { type: String },
      userName: { type: String, default: "System" },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const StockMovement: Model<IStockMovement> =
  mongoose.models.StockMovement ||
  mongoose.model<IStockMovement>("StockMovement", StockMovementSchema);

export default StockMovement;
