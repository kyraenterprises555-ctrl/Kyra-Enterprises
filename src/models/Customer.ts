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
  balance: number; // Positive = customer owes money (receivable), Negative = advance
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true, index: true },
    businessName: { type: String, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, lowercase: true, trim: true },
    billingAddress: { type: String, required: true, trim: true },
    shippingAddress: { type: String, trim: true },
    gstin: { type: String, uppercase: true, trim: true },
    state: { type: String, required: true, default: "Delhi" },
    stateCode: { type: String, required: true, default: "07" },
    customerType: {
      type: String,
      enum: ["registered", "unregistered"],
      default: "unregistered",
    },
    balance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ name: "text", businessName: "text", phone: "text", gstin: "text" });

export const Customer: Model<ICustomer> =
  mongoose.models.Customer || mongoose.model<ICustomer>("Customer", CustomerSchema);

export default Customer;
