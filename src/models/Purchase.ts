import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPurchaseItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  purchasePrice: number;
  gstRate: number;
  totalAmount: number;
}

export interface IPurchase extends Document {
  purchaseNumber: string;
  supplierName: string;
  supplierGstin?: string;
  supplierPhone?: string;
  purchaseDate: Date;
  items: IPurchaseItem[];
  totalTaxable: number;
  totalTax: number;
  totalAmount: number;
  status: "received" | "cancelled";
  notes?: string;
  createdBy: {
    userId?: string;
    userName?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseItemSchema = new Schema<IPurchaseItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    purchasePrice: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
  },
  { _id: false }
);

const PurchaseSchema = new Schema<IPurchase>(
  {
    purchaseNumber: { type: String, required: true, unique: true, trim: true },
    supplierName: { type: String, required: true, trim: true },
    supplierGstin: { type: String, uppercase: true, trim: true },
    supplierPhone: { type: String, trim: true },
    purchaseDate: { type: Date, default: Date.now },
    items: [PurchaseItemSchema],
    totalTaxable: { type: Number, required: true, default: 0 },
    totalTax: { type: Number, required: true, default: 0 },
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ["received", "cancelled"], default: "received" },
    notes: { type: String },
    createdBy: {
      userId: { type: String },
      userName: { type: String, default: "Admin" },
    },
  },
  { timestamps: true }
);

export const Purchase: Model<IPurchase> =
  mongoose.models.Purchase || mongoose.model<IPurchase>("Purchase", PurchaseSchema);

export default Purchase;
