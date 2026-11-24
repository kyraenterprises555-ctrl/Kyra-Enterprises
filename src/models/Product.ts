import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProduct extends Document {
  name: string;
  sku: string;
  barcode?: string;
  categoryId?: mongoose.Types.ObjectId;
  categoryName?: string;
  description?: string;
  uom: string; // Unit of measurement (e.g., PCS, BOX, KG, MTR, PKT)
  sellingPrice: number;
  purchasePrice: number;
  availableQuantity: number;
  minStockAlert: number;
  gstRate: number; // e.g. 0, 5, 12, 18, 28
  hsnCode: string;
  isActive: boolean;
  isDeleted: boolean; // Soft delete flag
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, index: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    barcode: { type: String, trim: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category" },
    categoryName: { type: String, trim: true, default: "General" },
    description: { type: String, trim: true },
    uom: { type: String, required: true, default: "PCS", uppercase: true },
    sellingPrice: { type: Number, required: true, min: 0 },
    purchasePrice: { type: Number, required: true, min: 0 },
    availableQuantity: { type: Number, required: true, default: 0 },
    minStockAlert: { type: Number, required: true, default: 5 },
    gstRate: { type: Number, required: true, default: 18 },
    hsnCode: { type: String, required: true, trim: true, default: "8471" },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

ProductSchema.index({ name: "text", sku: "text", barcode: "text" });

export const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);

export default Product;
