import mongoose, { Schema, Document, Model } from "mongoose";

export interface IReminderProviderConfig {
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  whatsappApiUrl?: string;
  whatsappPhoneNumberId?: string;
  whatsappAccessToken?: string;
  whatsappTemplateName?: string;
  smsApiUrl?: string;
  smsApiKey?: string;
  smsSenderId?: string;
}

export interface IReminderSettings {
  enabled: boolean;
  intervalDays: 3 | 4;
  reminderStartDate?: Date;
  startDaysAfterInvoice: number;
  channels: Array<"email" | "whatsapp" | "sms" | "in_app">;
  subjectTemplate: string;
  messageTemplate: string;
  maxRetries: number;
  retryDelayMinutes: number;
  providers: IReminderProviderConfig;
}

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
  defaultDueDays: number;
  invoiceTerms: string;
  reminderSettings: IReminderSettings;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_REMINDER_SUBJECT = "Payment Reminder – Kyra Enterprises";
export const DEFAULT_REMINDER_TEMPLATE = `Dear {{customerName}},

This is a friendly reminder regarding your pending payment.

Invoice Number: {{invoiceNumber}}

Invoice Amount: ₹{{invoiceAmount}}
Amount Paid: ₹{{amountPaid}}
Remaining Balance: ₹{{remainingBalance}}

Kindly clear the outstanding amount at your earliest convenience.

Thank you for doing business with Kyra Enterprises.`;

const BusinessSettingsSchema = new Schema<IBusinessSettings>(
  {
    businessName: { type: String, required: true, trim: true, default: "Kyra Enterprises" },
    logoUrl: { type: String, default: "/logo.jpeg" },
    gstin: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "Bihar" },
    stateCode: { type: String, trim: true, default: "10" },
    pincode: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, lowercase: true, trim: true, default: "" },
    bankDetails: {
      bankName: { type: String, default: "" },
      accountHolder: { type: String, default: "Kyra Enterprises" },
      accountNumber: { type: String, default: "" },
      ifscCode: { type: String, default: "" },
      branch: { type: String, default: "" },
    },
    upiId: { type: String, trim: true, default: "" },
    invoicePrefix: { type: String, trim: true, default: "KE/26-27/" },
    currentInvoiceSequence: { type: Number, default: 0 },
    defaultDueDays: { type: Number, default: 5, min: 0 },
    invoiceTerms: {
      type: String,
      default:
        "1. We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.\n2. Payments are due within the agreed credit period from the invoice date.\n3. Manufacturer warranty applies as per official brand terms.\n4. Physical, liquid, or burnt damage is not covered under warranty.",
    },
    reminderSettings: {
      enabled: { type: Boolean, default: true },
      intervalDays: { type: Number, enum: [3, 4], default: 4 },
      reminderStartDate: { type: Date },
      startDaysAfterInvoice: { type: Number, default: 0, min: 0 },
      channels: {
        type: [String],
        enum: ["email", "whatsapp", "sms", "in_app"],
        default: ["in_app", "email"],
      },
      subjectTemplate: { type: String, default: DEFAULT_REMINDER_SUBJECT },
      messageTemplate: { type: String, default: DEFAULT_REMINDER_TEMPLATE },
      maxRetries: { type: Number, default: 3 },
      retryDelayMinutes: { type: Number, default: 60 },
      providers: {
        smtpHost: { type: String, default: "" },
        smtpPort: { type: Number, default: 587 },
        smtpSecure: { type: Boolean, default: false },
        smtpUser: { type: String, default: "" },
        smtpPass: { type: String, default: "" },
        smtpFrom: { type: String, default: "" },
        whatsappApiUrl: { type: String, default: "" },
        whatsappPhoneNumberId: { type: String, default: "" },
        whatsappAccessToken: { type: String, default: "" },
        whatsappTemplateName: { type: String, default: "" },
        smsApiUrl: { type: String, default: "" },
        smsApiKey: { type: String, default: "" },
        smsSenderId: { type: String, default: "" },
      },
    },
  },
  { timestamps: true }
);

export const BusinessSettings: Model<IBusinessSettings> =
  mongoose.models.BusinessSettings ||
  mongoose.model<IBusinessSettings>("BusinessSettings", BusinessSettingsSchema);

export default BusinessSettings;
