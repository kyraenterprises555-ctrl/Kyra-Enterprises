import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBusinessSettings extends Document {
  businessName: string;
  logoUrl?: string;
  gstin: string;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  phone: string;
  email: string;
  bankDetails: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    ifscCode: string;
    branch: string;
  };
  upiId?: string;
  invoicePrefix: string;
  currentInvoiceSequence: number;
  invoiceTerms: string;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSettingsSchema = new Schema<IBusinessSettings>(
  {
    businessName: { type: String, required: true, default: "Kayra Enterprises" },
    logoUrl: { type: String, default: "" },
    gstin: { type: String, required: true, trim: true, default: "07AAAAA0000A1Z5" },
    address: { type: String, required: true, default: "Main Commercial Complex, Sector 18" },
    city: { type: String, required: true, default: "New Delhi" },
    state: { type: String, required: true, default: "Delhi" },
    stateCode: { type: String, required: true, default: "07" },
    pincode: { type: String, required: true, default: "110001" },
    phone: { type: String, required: true, default: "+91 98765 43210" },
    email: { type: String, required: true, default: "contact@kayraenterprises.com" },
    bankDetails: {
      bankName: { type: String, default: "HDFC Bank" },
      accountHolder: { type: String, default: "Kayra Enterprises" },
      accountNumber: { type: String, default: "50200012345678" },
      ifscCode: { type: String, default: "HDFC0001234" },
      branch: { type: String, default: "Connaught Place" },
    },
    upiId: { type: String, default: "kayra@okhdfcbank" },
    invoicePrefix: { type: String, default: "KE/2026-27/" },
    currentInvoiceSequence: { type: Number, default: 1000 },
    invoiceTerms: {
      type: String,
      default:
        "1. Goods once sold will not be taken back without original invoice.\n2. Interest @ 18% p.a. will be charged if payment is not made within due date.\n3. All disputes are subject to local jurisdiction only.",
    },
  },
  { timestamps: true }
);

export const BusinessSettings: Model<IBusinessSettings> =
  mongoose.models.BusinessSettings ||
  mongoose.model<IBusinessSettings>("BusinessSettings", BusinessSettingsSchema);

export default BusinessSettings;
