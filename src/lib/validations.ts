import { z } from "zod";

export const VALID_GST_RATES = [0, 0.1, 0.25, 1.5, 3, 5, 6, 7.5, 12, 14, 18, 28] as const;

export const businessSettingsSchema = z.object({
  businessName: z.string().min(2, "Enterprise name is required"),
  logoUrl: z.string().optional().default("/logo.jpeg"),
  gstin: z
    .string()
    .trim()
    .refine(
      (val) => val === "" || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(val),
      "Invalid 15-character GSTIN format"
    ),
  address: z.string().min(2, "Business address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required"),
  stateCode: z.string().min(1, "State code is required"),
  pincode: z.string().min(4, "Pincode is required"),
  phone: z.string().min(6, "Phone number is required"),
  email: z.string().email("Valid email address is required").or(z.literal("")),
  bankDetails: z.object({
    bankName: z.string().default(""),
    accountHolder: z.string().default("Kyra Enterprises"),
    accountNumber: z.string().default(""),
    ifscCode: z.string().default(""),
    branch: z.string().default(""),
  }),
  upiId: z.string().optional().default(""),
  invoicePrefix: z.string().min(1, "Invoice prefix is required"),
  defaultDueDays: z.coerce.number().int().min(0).max(365).optional().default(5),
  invoiceTerms: z.string().optional().default(""),
  reminderSettings: z
    .object({
      enabled: z.boolean().default(true),
      intervalDays: z.union([z.literal(3), z.literal(4)]).default(4),
      reminderStartDate: z.string().optional().nullable(),
      startDaysAfterInvoice: z.coerce.number().int().min(0).default(0),
      channels: z.array(z.enum(["email", "whatsapp", "sms", "in_app"])).default(["in_app", "email"]),
      subjectTemplate: z.string().min(3),
      messageTemplate: z.string().min(10),
      maxRetries: z.coerce.number().int().min(0).max(10).default(3),
      retryDelayMinutes: z.coerce.number().int().min(5).default(60),
      providers: z
        .object({
          smtpHost: z.string().optional().default(""),
          smtpPort: z.coerce.number().optional().default(587),
          smtpSecure: z.boolean().optional().default(false),
          smtpUser: z.string().optional().default(""),
          smtpPass: z.string().optional().default(""),
          smtpFrom: z.string().optional().default(""),
          whatsappApiUrl: z.string().optional().default(""),
          whatsappPhoneNumberId: z.string().optional().default(""),
          whatsappAccessToken: z.string().optional().default(""),
          whatsappTemplateName: z.string().optional().default(""),
          smsApiUrl: z.string().optional().default(""),
          smsApiKey: z.string().optional().default(""),
          smsSenderId: z.string().optional().default(""),
        })
        .optional(),
    })
    .optional(),
});

export const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required")
    .regex(/^[A-Za-z0-9\-_./]+$/, "SKU may only contain letters, numbers, hyphens, underscores, dots or slashes")
    .transform((v) => v.toUpperCase()),
  barcode: z.string().optional().default(""),
  categoryName: z.string().trim().min(1, "Category is required").default("General"),
  description: z.string().optional().default(""),
  uom: z.string().trim().min(1, "Unit is required").default("PCS").transform((v) => v.toUpperCase()),
  purchasePrice: z.coerce.number().min(0, "Purchase price cannot be negative"),
  sellingPrice: z.coerce.number().min(0, "Selling price cannot be negative"),
  availableQuantity: z.coerce.number().min(0, "Quantity cannot be negative").default(0),
  minStockAlert: z.coerce.number().min(0, "Minimum stock level cannot be negative").default(5),
  hsnCode: z.string().trim().min(2, "HSN code is required"),
  gstRate: z.coerce
    .number()
    .min(0, "GST percentage cannot be negative")
    .max(100, "GST percentage cannot exceed 100%")
    .refine(
      (n) => [0, 0.1, 0.25, 1.5, 3, 5, 6, 7.5, 12, 14, 18, 28].includes(Number(n)),
      "GST percentage must be a valid Indian GST slab (0, 0.1, 0.25, 1.5, 3, 5, 6, 7.5, 12, 14, 18, or 28%)"
    ),
  isActive: z.boolean().optional().default(true),
});

export const bulkProductRowSchema = z.object({
  productName: z.string().trim().min(1, "Product Name is required"),
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required")
    .regex(/^[A-Za-z0-9\-_./]+$/, "SKU contains invalid characters"),
  category: z.string().trim().min(1, "Category is required").default("General"),
  description: z.string().optional().default(""),
  purchasePrice: z.coerce.number({ invalid_type_error: "Purchase Price must be a number" }).min(0, "Purchase Price cannot be negative"),
  sellingPrice: z.coerce.number({ invalid_type_error: "Selling Price must be a number" }).min(0, "Selling Price cannot be negative"),
  quantity: z.coerce.number({ invalid_type_error: "Quantity must be a number" }).min(0, "Quantity cannot be negative"),
  unit: z.string().trim().min(1, "Unit is required").default("PCS"),
  hsnCode: z.string().trim().min(2, "HSN Code is required"),
  gstPercentage: z.coerce
    .number({ invalid_type_error: "GST Percentage must be a number" })
    .refine(
      (n) => [0, 0.1, 0.25, 1.5, 3, 5, 6, 7.5, 12, 14, 18, 28].includes(Number(n)),
      "Invalid GST Percentage (use 0, 3, 5, 12, 18, or 28)"
    ),
  minStockLevel: z.coerce.number().min(0, "Minimum Stock Level cannot be negative").default(5),
});

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required"),
  businessName: z.string().optional().default(""),
  phone: z.string().trim().min(6, "Valid phone number is required"),
  email: z.string().email("Invalid email address").or(z.literal("")).optional().default(""),
  billingAddress: z.string().trim().min(2, "Billing address is required"),
  shippingAddress: z.string().optional().default(""),
  gstin: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine(
      (val) => !val || val === "" || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(val),
      "Invalid 15-character GSTIN"
    ),
  state: z.string().trim().min(2, "State is required"),
  stateCode: z.string().trim().min(1, "State code is required"),
  customerType: z.enum(["registered", "unregistered"]).default("unregistered"),
  remindersEnabled: z.boolean().optional().default(true),
});

export const invoiceItemInputSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  rate: z.coerce.number().min(0, "Rate cannot be negative"),
  discount: z.coerce.number().min(0).optional().default(0),
  discountPercent: z.coerce.number().min(0).max(100).optional().default(0),
});

export const createInvoiceSchema = z.object({
  customerId: z.string().optional(),
  saveNewCustomer: z.boolean().optional().default(false),
  customerData: z.object({
    name: z.string().trim().min(1, "Customer name is required"),
    businessName: z.string().optional().default(""),
    phone: z.string().trim().min(5, "Phone number is required"),
    email: z.string().optional().default(""),
    billingAddress: z.string().trim().min(2, "Billing address is required"),
    shippingAddress: z.string().optional().default(""),
    gstin: z.string().optional().default(""),
    state: z.string().trim().min(2, "Customer state is required"),
    stateCode: z.string().trim().min(1, "Customer state code is required"),
  }),
  items: z.array(invoiceItemInputSchema).min(1, "At least one product item is required"),
  dueDate: z.string().optional(),
  paymentMode: z.enum(["cash", "upi", "bank_transfer", "card", "credit", "other"]).optional().default("cash"),
  amountPaid: z.coerce.number().min(0).optional().default(0),
  notes: z.string().optional().default(""),
});

export const editInvoiceSchema = z.object({
  customerData: z.object({
    name: z.string().trim().min(1, "Customer name is required"),
    businessName: z.string().optional().default(""),
    phone: z.string().trim().min(5, "Phone number is required"),
    email: z.string().optional().default(""),
    billingAddress: z.string().trim().min(2, "Billing address is required"),
    shippingAddress: z.string().optional().default(""),
    gstin: z.string().optional().default(""),
    state: z.string().trim().min(2, "Customer state is required"),
    stateCode: z.string().trim().min(1, "Customer state code is required"),
  }),
  items: z.array(invoiceItemInputSchema).min(1, "At least one product item is required"),
  dueDate: z.string().optional(),
  notes: z.string().optional().default(""),
  amendmentReason: z.string().trim().min(3, "Amendment / edit reason is required for audit trail"),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  amount: z.coerce.number().positive("Payment amount must be greater than zero"),
  paymentMode: z.enum(["cash", "upi", "bank_transfer", "card", "credit", "other"]),
  transactionRef: z.string().optional().default(""),
  paymentDate: z.string().optional(),
  notes: z.string().optional().default(""),
  idempotencyKey: z.string().optional(),
});
