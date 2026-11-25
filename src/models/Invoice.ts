import mongoose, { Schema, Document, Model } from "mongoose";

export interface IInvoiceItemSnapshot {
  productId: mongoose.Types.ObjectId | string;
  productName: string;
  sku: string;
  hsnCode: string;
  uom: string;
  rate: number;
  purchasePrice?: number;
  quantity: number;
  discount: number;
  discountPercent?: number;
  taxableAmount: number;
  gstRate: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  totalAmount: number;
}

export interface IInvoiceCustomerSnapshot {
  name: string;
  businessName?: string;
  phone: string;
  email?: string;
  billingAddress: string;
  shippingAddress?: string;
  gstin?: string;
  state: string;
  stateCode: string;
  customerType: string;
}

export interface IInvoiceSellerSnapshot {
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
}

export interface IInvoicePaymentRecord {
  paymentId: string;
  amount: number;
  paymentMode: "cash" | "upi" | "bank_transfer" | "card" | "credit" | "other";
  transactionRef?: string;
  paymentDate: Date;
  notes?: string;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  customerId?: mongoose.Types.ObjectId | string;
  customer: IInvoiceCustomerSnapshot;
  seller: IInvoiceSellerSnapshot;
  items: IInvoiceItemSnapshot[];
  taxableAmount: number;
  totalDiscount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
  isInterState: boolean;
  paymentStatus: "paid" | "partial" | "unpaid" | "overdue";
  amountPaid: number;
  balanceDue: number;
  payments: IInvoicePaymentRecord[];
  notes?: string;
  termsAndConditions?: string;
  status: "finalized" | "amended" | "cancelled" | "deleted";
  revisionNumber: number;
  lastEditedAt?: Date;
  lastEditedBy?: {
    userId?: string;
    userName?: string;
  };
  amendmentNotes?: string;
  cancellationReason?: string;
  cancelledAt?: Date;
  cancelledBy?: {
    userId?: string;
    userName?: string;
  };
  isDeleted: boolean;
  deletedBy?: {
    userId?: string;
    userName?: string;
    role?: string;
  };
  deletedAt?: Date;
  deletionReason?: string;
  previousInvoiceData?: Record<string, unknown>;
  createdBy: {
    userId?: string;
    userName?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceItemSchema = new Schema<IInvoiceItemSnapshot>(
  {
    productId: { type: Schema.Types.Mixed, required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    hsnCode: { type: String, required: true },
    uom: { type: String, required: true, default: "PCS" },
    rate: { type: Number, required: true, min: 0 },
    purchasePrice: { type: Number, default: 0 },
    quantity: { type: Number, required: true, min: 1 },
    discount: { type: Number, default: 0, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    taxableAmount: { type: Number, required: true },
    gstRate: { type: Number, required: true, min: 0 },
    cgstRate: { type: Number, default: 0 },
    cgstAmount: { type: Number, default: 0 },
    sgstRate: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstRate: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    totalTax: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
  },
  { _id: false }
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    invoiceDate: { type: Date, default: Date.now, index: true },
    dueDate: {
      type: Date,
      default: () => new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      index: true,
    },
    customerId: { type: Schema.Types.Mixed, index: true },
    customer: {
      name: { type: String, required: true },
      businessName: { type: String, default: "" },
      phone: { type: String, required: true },
      email: { type: String, default: "" },
      billingAddress: { type: String, required: true },
      shippingAddress: { type: String, default: "" },
      gstin: { type: String, default: "" },
      state: { type: String, required: true },
      stateCode: { type: String, required: true },
      customerType: { type: String, default: "unregistered" },
    },
    seller: {
      businessName: { type: String, required: true, default: "Kyra Enterprises" },
      logoUrl: { type: String, default: "/logo.jpeg" },
      gstin: { type: String, default: "" },
      address: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, required: true },
      stateCode: { type: String, required: true },
      pincode: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      bankDetails: {
        bankName: { type: String, default: "" },
        accountHolder: { type: String, default: "Kyra Enterprises" },
        accountNumber: { type: String, default: "" },
        ifscCode: { type: String, default: "" },
        branch: { type: String, default: "" },
      },
      upiId: { type: String, default: "" },
    },
    items: [InvoiceItemSchema],
    taxableAmount: { type: Number, required: true },
    totalDiscount: { type: Number, default: 0 },
    totalCgst: { type: Number, default: 0 },
    totalSgst: { type: Number, default: 0 },
    totalIgst: { type: Number, default: 0 },
    totalTax: { type: Number, required: true },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    amountInWords: { type: String, required: true },
    isInterState: { type: Boolean, required: true, default: false },
    paymentStatus: {
      type: String,
      enum: ["paid", "partial", "unpaid", "overdue"],
      default: "unpaid",
      index: true,
    },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, required: true },
    payments: [
      {
        paymentId: { type: String, required: true },
        amount: { type: Number, required: true },
        paymentMode: {
          type: String,
          enum: ["cash", "upi", "bank_transfer", "card", "credit", "other"],
          default: "cash",
        },
        transactionRef: { type: String },
        paymentDate: { type: Date, default: Date.now },
        notes: { type: String },
      },
    ],
    notes: { type: String, default: "" },
    termsAndConditions: { type: String, default: "" },
    status: {
      type: String,
      enum: ["finalized", "amended", "cancelled", "deleted"],
      default: "finalized",
      index: true,
    },
    revisionNumber: { type: Number, default: 1 },
    lastEditedAt: { type: Date },
    lastEditedBy: {
      userId: { type: String },
      userName: { type: String },
    },
    amendmentNotes: { type: String },
    cancellationReason: { type: String },
    cancelledAt: { type: Date },
    cancelledBy: {
      userId: { type: String },
      userName: { type: String },
    },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedBy: {
      userId: { type: String },
      userName: { type: String },
      role: { type: String },
    },
    deletedAt: { type: Date },
    deletionReason: { type: String },
    previousInvoiceData: { type: Schema.Types.Mixed },
    createdBy: {
      userId: { type: String },
      userName: { type: String, default: "Admin" },
    },
  },
  { timestamps: true }
);

InvoiceSchema.index({ "customer.name": "text", invoiceNumber: "text" });
InvoiceSchema.index({ isDeleted: 1, status: 1, paymentStatus: 1, dueDate: 1 });

export const Invoice: Model<IInvoice> =
  mongoose.models.Invoice || mongoose.model<IInvoice>("Invoice", InvoiceSchema);

export default Invoice;
