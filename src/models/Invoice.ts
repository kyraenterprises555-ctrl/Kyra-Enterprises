import mongoose, { Schema, Document, Model } from "mongoose";

export interface IInvoiceItemSnapshot {
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  hsnCode: string;
  uom: string;
  rate: number; // Snapshot selling price
  purchasePrice?: number; // Snapshot purchase price for profit calculation
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
  paymentMode: "cash" | "upi" | "bank_transfer" | "card" | "credit";
  transactionRef?: string;
  paymentDate: Date;
  notes?: string;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate?: Date;
  customerId?: mongoose.Types.ObjectId;
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
  paymentStatus: "paid" | "partial" | "unpaid";
  amountPaid: number;
  balanceDue: number;
  payments: IInvoicePaymentRecord[];
  notes?: string;
  termsAndConditions?: string;
  status: "finalized" | "cancelled";
  cancellationReason?: string;
  cancelledAt?: Date;
  cancelledBy?: {
    userId?: string;
    userName?: string;
  };
  createdBy: {
    userId?: string;
    userName?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceItemSchema = new Schema<IInvoiceItemSnapshot>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    hsnCode: { type: String, required: true },
    uom: { type: String, required: true, default: "PCS" },
    rate: { type: Number, required: true },
    purchasePrice: { type: Number, default: 0 },
    quantity: { type: Number, required: true, min: 1 },
    discount: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    taxableAmount: { type: Number, required: true },
    gstRate: { type: Number, required: true },
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
    dueDate: { type: Date },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", index: true },
    customer: {
      name: { type: String, required: true },
      businessName: { type: String },
      phone: { type: String, required: true },
      email: { type: String },
      billingAddress: { type: String, required: true },
      shippingAddress: { type: String },
      gstin: { type: String },
      state: { type: String, required: true },
      stateCode: { type: String, required: true },
      customerType: { type: String, default: "unregistered" },
    },
    seller: {
      businessName: { type: String, required: true },
      logoUrl: { type: String },
      gstin: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      stateCode: { type: String, required: true },
      pincode: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: true },
      bankDetails: {
        bankName: { type: String },
        accountHolder: { type: String },
        accountNumber: { type: String },
        ifscCode: { type: String },
        branch: { type: String },
      },
      upiId: { type: String },
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
      enum: ["paid", "partial", "unpaid"],
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
          enum: ["cash", "upi", "bank_transfer", "card", "credit"],
          default: "cash",
        },
        transactionRef: { type: String },
        paymentDate: { type: Date, default: Date.now },
        notes: { type: String },
      },
    ],
    notes: { type: String },
    termsAndConditions: { type: String },
    status: {
      type: String,
      enum: ["finalized", "cancelled"],
      default: "finalized",
      index: true,
    },
    cancellationReason: { type: String },
    cancelledAt: { type: Date },
    cancelledBy: {
      userId: { type: String },
      userName: { type: String },
    },
    createdBy: {
      userId: { type: String },
      userName: { type: String, default: "Admin" },
    },
  },
  { timestamps: true }
);

InvoiceSchema.index({ "customer.name": "text", invoiceNumber: "text" });

export const Invoice: Model<IInvoice> =
  mongoose.models.Invoice || mongoose.model<IInvoice>("Invoice", InvoiceSchema);

export default Invoice;
