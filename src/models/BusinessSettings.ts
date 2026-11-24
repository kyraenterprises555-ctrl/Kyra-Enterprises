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
    businessName: { type: String, required: true, default: "KYRA ENTERPRISES" },
    logoUrl: { type: String, default: "/logo.jpeg" },
    gstin: { type: String, required: true, trim: true, default: "10CPLPK1520H1ZF" },
    address: { type: String, required: true, default: "BASAITHA MADHUBANI" },
    city: { type: String, required: true, default: "Madhubani" },
    state: { type: String, required: true, default: "Bihar" },
    stateCode: { type: String, required: true, default: "10" },
    pincode: { type: String, required: true, default: "847223" },
    phone: { type: String, required: true, default: "+91 98765 43210" },
    email: { type: String, required: true, default: "kyraenterprises555@gmail.com" },
    bankDetails: {
      bankName: { type: String, default: "Union Bank of India" },
      accountHolder: { type: String, default: "KYRA ENTERPRISES" },
      accountNumber: { type: String, default: "195721010000113" },
      ifscCode: { type: String, default: "UBIN0919578" },
      branch: { type: String, default: "BENIPATTI BRANCH" },
    },
    upiId: { type: String, default: "10cplpk1520h1zf@unionbank" },
    invoicePrefix: { type: String, default: "26-27/" },
    currentInvoiceSequence: { type: Number, default: 10 },
    invoiceTerms: {
      type: String,
      default:
        "1. We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.\n2. Payments due within 5 days of Invoice date.\n3. In case of a product being defective or having a manufacturing defect, the primary responsibility for repairing or replacing it lies with the company.\n4. Burnt and broken will not be warrented, please check while purchasing.",
    },
  },
  { timestamps: true }
);

export const BusinessSettings: Model<IBusinessSettings> =
  mongoose.models.BusinessSettings ||
  mongoose.model<IBusinessSettings>("BusinessSettings", BusinessSettingsSchema);

export default BusinessSettings;
