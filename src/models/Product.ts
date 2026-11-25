import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProduct extends Document {
  name: string;
  sku: string;
  barcode?: string;
  categoryId?: mongoose.Types.ObjectId;
  categoryName: string;
  description?: string;
  uom: string;
  sellingPrice: number;
  purchasePrice: number;
  availableQuantity: number;
  minStockAlert: number;
  gstRate: number;
  hsnCode: string;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: {
    userId?: string;
    userName?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, index: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    barcode: { type: String, trim: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category" },
    categoryName: { type: String, trim: true, default: "General", index: true },
    description: { type: String, trim: true, default: "" },
    uom: { type: String, required: true, default: "PCS", uppercase: true, trim: true },
    sellingPrice: { type: Number, required: true, min: 0 },
    purchasePrice: { type: Number, required: true, min: 0, default: 0 },
    availableQuantity: { type: Number, required: true, min: 0, default: 0 },
    minStockAlert: { type: Number, required: true, min: 0, default: 5 },
    gstRate: { type: Number, required: true, min: 0, max: 100 },
    hsnCode: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: {
      userId: { type: String },
      userName: { type: String },
    },
  },
  { timestamps: true }
);

ProductSchema.index({ name: "text", sku: "text", hsnCode: "text", barcode: "text" });
ProductSchema.index({ isDeleted: 1, isActive: 1, categoryName: 1 });

export const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);

export default Product;
