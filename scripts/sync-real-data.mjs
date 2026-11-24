import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import xlsx from "xlsx";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

// Parse Excel
const workbook = xlsx.readFile("product list with hsn.xlsx");
const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
const rawRows = xlsx.utils.sheet_to_json(firstSheet, { header: 1 });

const products = [];
const stockMovements = [];

// Skip header rows (0 and 1)
for (let i = 2; i < rawRows.length; i++) {
  const row = rawRows[i];
  if (!row || !row[1]) continue;

  const name = String(row[1]).trim();
  const rawHsn = row[2] ? String(row[2]).trim() : "85164000";
  const rateInclTax = Number(row[3]) || 1000;
  
  // Calculate taxable rate (excluding 18% GST)
  const taxableRate = Math.round((rateInclTax / 1.18) * 100) / 100;
  const purchasePrice = Math.round(taxableRate * 0.8 * 100) / 100; // estimated purchase cost

  // Generate clean SKU from name and id
  const codeMatch = name.match(/\(([^\)]+)\)/);
  const sku = codeMatch ? `KE-${codeMatch[1].trim()}` : `KE-PRD-${String(i - 1).padStart(3, "0")}`;

  const prodId = `prod_${i - 1}`;
  const qty = 25; // Initial stock

  products.push({
    _id: prodId,
    name: name,
    sku: sku,
    barcode: `890${String(1000000000 + i)}`,
    categoryName: name.toLowerCase().includes("fan")
      ? "Fans & Ventilation"
      : name.toLowerCase().includes("iron")
      ? "Home Appliances - Irons"
      : name.toLowerCase().includes("kettle")
      ? "Kitchen Appliances - Kettles"
      : "Electrical Appliances",
    description: name,
    uom: "PCS",
    sellingPrice: taxableRate,
    purchasePrice: purchasePrice,
    availableQuantity: qty,
    minStockAlert: 5,
    gstRate: 18,
    hsnCode: rawHsn,
    isActive: true,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  stockMovements.push({
    _id: `mov_${i - 1}`,
    productId: prodId,
    productName: name,
    sku: sku,
    type: "purchase",
    quantity: qty,
    previousQuantity: 0,
    newQuantity: qty,
    referenceType: "purchase",
    referenceNumber: "INITIAL-STOCK",
    reason: "Initial warehouse intake from vendor",
    unitCost: purchasePrice,
    performedBy: { userId: "user_admin", userName: "Admin" },
    createdAt: new Date().toISOString(),
  });
}

// Seller details directly from sample invoice.pdf
const settings = {
  _id: "settings_1",
  businessName: "KYRA ENTERPRISES",
  logoUrl: "/logo.jpeg",
  gstin: "10CPLPK1520H1ZF",
  address: "BASAITHA MADHUBANI",
  city: "Madhubani",
  state: "Bihar",
  stateCode: "10",
  pincode: "847223",
  phone: "+91 98765 43210",
  email: "kyraenterprises555@gmail.com",
  bankDetails: {
    bankName: "Union Bank of India",
    accountHolder: "KYRA ENTERPRISES",
    accountNumber: "195721010000113",
    ifscCode: "UBIN0919578",
    branch: "BENIPATTI BRANCH",
  },
  upiId: "10cplpk1520h1zf@unionbank",
  invoicePrefix: "26-27/",
  currentInvoiceSequence: 10,
  invoiceTerms:
    "1. We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.\n2. Payments due within 5 days of Invoice date.\n3. In case of a product being defective or having a manufacturing defect, the primary responsibility for repairing or replacing it lies with the company.\n4. Burnt and broken will not be warrented, please check while purchasing.",
  updatedAt: new Date().toISOString(),
};

// Customers
const customers = [
  {
    _id: "cust_dev_electric",
    name: "DEV ELECTRIC",
    businessName: "DEV ELECTRIC",
    phone: "+91 98012 34567",
    email: "develectric@gmail.com",
    billingAddress: "BENIPATTI MADHUBANI",
    shippingAddress: "BENIPATTI MADHUBANI",
    gstin: "",
    state: "Bihar",
    stateCode: "10",
    customerType: "unregistered",
    balance: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    _id: "cust_apex",
    name: "Apex Global Traders",
    businessName: "Apex Traders",
    phone: "+91 99110 99887",
    email: "accounts@apextraders.in",
    billingAddress: "Shop 12, Main Market, Patna, Bihar - 800001",
    shippingAddress: "Shop 12, Main Market, Patna, Bihar - 800001",
    gstin: "10AAHCA9988C1ZK", // Bihar Registered
    state: "Bihar",
    stateCode: "10",
    customerType: "registered",
    balance: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    _id: "cust_sharma_up",
    name: "Sharma Infotech Solutions Pvt Ltd",
    businessName: "Sharma Infotech",
    phone: "+91 98223 34455",
    email: "procurement@sharmainfotech.com",
    billingAddress: "402, Skyline Towers, Sector 62, Noida, UP - 201309",
    shippingAddress: "402, Skyline Towers, Sector 62, Noida, UP - 201309",
    gstin: "09AABCS1234E1Z8", // Uttar Pradesh (Inter-state test)
    state: "Uttar Pradesh",
    stateCode: "09",
    customerType: "registered",
    balance: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

// Recreate the exact invoice from sample invoice.pdf as invoice # 26-27/09!
const sampleInvoiceItems = [
  {
    productId: "prod_sample_1",
    productName: "Bajaj Notch 500W French Blue M (410651)",
    sku: "KE-410651",
    hsnCode: "85167990",
    uom: "PCS",
    rate: 1762.50,
    purchasePrice: 1400,
    quantity: 2,
    discount: 0,
    taxableAmount: 3525.00,
    gstRate: 18,
    cgstRate: 9,
    cgstAmount: 317.25,
    sgstRate: 9,
    sgstAmount: 317.25,
    igstRate: 0,
    igstAmount: 0,
    totalTax: 634.50,
    totalAmount: 4159.50,
  },
  {
    productId: "prod_sample_2",
    productName: "KTX 1.5 L dlx Kettle (670106)",
    sku: "KE-670106",
    hsnCode: "85167100",
    uom: "PCS",
    rate: 610.15,
    purchasePrice: 480,
    quantity: 1,
    discount: 0,
    taxableAmount: 610.15,
    gstRate: 18,
    cgstRate: 9,
    cgstAmount: 54.91,
    sgstRate: 9,
    sgstAmount: 54.91,
    igstRate: 0,
    igstAmount: 0,
    totalTax: 109.83,
    totalAmount: 719.98,
  },
  {
    productId: "prod_sample_3",
    productName: "KTX 1.8 L dlx Kettle (670107)",
    sku: "KE-670107",
    hsnCode: "85167100",
    uom: "PCS",
    rate: 648.30,
    purchasePrice: 510,
    quantity: 1,
    discount: 0,
    taxableAmount: 648.30,
    gstRate: 18,
    cgstRate: 9,
    cgstAmount: 58.35,
    sgstRate: 9,
    sgstAmount: 58.35,
    igstRate: 0,
    igstAmount: 0,
    totalTax: 116.69,
    totalAmount: 764.99,
  },
  {
    productId: "prod_sample_4",
    productName: "Bajaj Majesty Canvas Brown (440306)",
    sku: "KE-440306",
    hsnCode: "85164000",
    uom: "PCS",
    rate: 699.15,
    purchasePrice: 550,
    quantity: 1,
    discount: 0,
    taxableAmount: 699.15,
    gstRate: 18,
    cgstRate: 9,
    cgstAmount: 62.92,
    sgstRate: 9,
    sgstAmount: 62.92,
    igstRate: 0,
    igstAmount: 0,
    totalTax: 125.85,
    totalAmount: 825.00,
  },
  {
    productId: "prod_sample_5",
    productName: "Bajaj DX 4 Neo Dry Iron (440325)",
    sku: "KE-440325",
    hsnCode: "85164000",
    uom: "PCS",
    rate: 639.83,
    purchasePrice: 500,
    quantity: 1,
    discount: 0,
    taxableAmount: 639.83,
    gstRate: 18,
    cgstRate: 9,
    cgstAmount: 57.58,
    sgstRate: 9,
    sgstAmount: 57.58,
    igstRate: 0,
    igstAmount: 0,
    totalTax: 115.17,
    totalAmount: 755.00,
  },
  {
    productId: "prod_sample_6",
    productName: "New Popular 1000 Dry Iron (440302)",
    sku: "KE-440302",
    hsnCode: "85164000",
    uom: "PCS",
    rate: 478.81,
    purchasePrice: 380,
    quantity: 1,
    discount: 0,
    taxableAmount: 478.81,
    gstRate: 18,
    cgstRate: 9,
    cgstAmount: 43.09,
    sgstRate: 9,
    sgstAmount: 43.09,
    igstRate: 0,
    igstAmount: 0,
    totalTax: 86.19,
    totalAmount: 565.00,
  },
];

const sampleInvoice = {
  _id: "inv_sample_09",
  invoiceNumber: "26-27/09",
  invoiceDate: new Date("2026-10-31").toISOString(),
  customerId: "cust_dev_electric",
  customer: {
    name: "DEV ELECTRIC",
    businessName: "DEV ELECTRIC",
    phone: "+91 98012 34567",
    email: "develectric@gmail.com",
    billingAddress: "BENIPATTI MADHUBANI",
    shippingAddress: "BENIPATTI MADHUBANI",
    gstin: "",
    state: "Bihar",
    stateCode: "10",
    customerType: "unregistered",
  },
  seller: {
    businessName: settings.businessName,
    logoUrl: settings.logoUrl,
    gstin: settings.gstin,
    address: settings.address,
    city: settings.city,
    state: settings.state,
    stateCode: settings.stateCode,
    pincode: settings.pincode,
    phone: settings.phone,
    email: settings.email,
    bankDetails: settings.bankDetails,
    upiId: settings.upiId,
  },
  items: sampleInvoiceItems,
  taxableAmount: 6601.24,
  totalDiscount: 0,
  totalCgst: 594.11,
  totalSgst: 594.11,
  totalIgst: 0,
  totalTax: 1188.22,
  roundOff: 0,
  grandTotal: 7789.46,
  amountInWords: "Seven Thousand Seven Hundred Eighty Nine Rupees and Forty Six Paise Only",
  isInterState: false,
  paymentStatus: "paid",
  amountPaid: 7789.46,
  balanceDue: 0,
  payments: [
    {
      paymentId: "pay_sample_09",
      amount: 7789.46,
      paymentMode: "cash",
      paymentDate: new Date("2026-10-31").toISOString(),
      notes: "Settled against bill 26-27/09",
    },
  ],
  notes: "Goods delivered in good condition.",
  termsAndConditions: settings.invoiceTerms,
  status: "finalized",
  createdBy: { userId: "user_admin", userName: "Admin" },
  createdAt: new Date("2026-10-31").toISOString(),
  updatedAt: new Date("2026-10-31").toISOString(),
};

const adminHash = bcrypt.hashSync("Admin@123", 10);
const managerHash = bcrypt.hashSync("Manager@123", 10);
const staffHash = bcrypt.hashSync("Staff@123", 10);

const store = {
  settings,
  users: [
    {
      _id: "user_admin",
      name: "KYRA Admin",
      email: "admin@kayra.com",
      passwordHash: adminHash,
      role: "admin",
      phone: "+91 98765 43210",
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      _id: "user_manager",
      name: "Store Manager",
      email: "manager@kayra.com",
      passwordHash: managerHash,
      role: "manager",
      phone: "+91 98765 43211",
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      _id: "user_staff",
      name: "Billing Staff",
      email: "staff@kayra.com",
      passwordHash: staffHash,
      role: "billing_staff",
      phone: "+91 98765 43212",
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ],
  categories: [
    { _id: "cat_1", name: "Home Appliances - Irons", description: "Dry and Steam Irons", isActive: true },
    { _id: "cat_2", name: "Fans & Ventilation", description: "Ceiling, Table, Pedestal, and Exhaust Fans", isActive: true },
    { _id: "cat_3", name: "Kitchen Appliances - Kettles", description: "Electric Kettles and Mixers", isActive: true },
    { _id: "cat_4", name: "Water Heaters & Coolers", description: "Geysers and Air Coolers", isActive: true },
  ],
  products,
  customers,
  purchases: [],
  stockMovements,
  invoices: [sampleInvoice],
  payments: [
    {
      _id: "pay_sample_09",
      invoiceId: "inv_sample_09",
      invoiceNumber: "26-27/09",
      customerId: "cust_dev_electric",
      customerName: "DEV ELECTRIC",
      amount: 7789.46,
      paymentMode: "cash",
      paymentDate: new Date("2026-10-31").toISOString(),
      notes: "Settled against bill 26-27/09",
      recordedBy: { userId: "user_admin", userName: "Admin" },
    },
  ],
  auditLogs: [
    {
      _id: "audit_init",
      action: "ENTERPRISE_INITIALIZED",
      entity: "BusinessSettings",
      performedBy: { userName: "Admin", role: "admin" },
      details: { businessName: "KYRA ENTERPRISES", gstin: "10CPLPK1520H1ZF" },
      createdAt: new Date().toISOString(),
    },
  ],
};

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
console.log("Successfully seeded .data/store.json with authentic Kyra Enterprises bill & products data!");
