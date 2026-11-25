import mongoose, { Schema, Document, Model } from "mongoose";

export type CustomerType = "registered" | "unregistered";

export interface ICustomer extends Document {
  name: string;
  businessName?: string;
  phone: string;
  email?: string;
  billingAddress: string;
  shippingAddress?: string;
  gstin?: string;
  state: string;
  stateCode: string;
  customerType: CustomerType;
  totalPurchases: number;
  totalPaid: number;
  balance: number;
  remindersEnabled: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true, index: true },
    businessName: { type: String, trim: true, default: "" },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, lowercase: true, trim: true, default: "" },
    billingAddress: { type: String, required: true, trim: true },
    shippingAddress: { type: String, trim: true, default: "" },
    gstin: { type: String, uppercase: true, trim: true, default: "" },
    state: { type: String, required: true, default: "Bihar" },
    stateCode: { type: String, required: true, default: "10" },
    customerType: {
      type: String,
      enum: ["registered", "unregistered"],
      default: "unregistered",
    },
    totalPurchases: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0, index: true },
    remindersEnabled: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ name: "text", businessName: "text", phone: "text", gstin: "text" });

export const Customer: Model<ICustomer> =
  mongoose.models.Customer || mongoose.model<ICustomer>("Customer", CustomerSchema);

export default Customer;
