import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import connectToDatabase from "./mongodb";
import User, { IUser } from "@/models/User";
import BusinessSettings, { IBusinessSettings } from "@/models/BusinessSettings";
import Product, { IProduct } from "@/models/Product";
import Category, { ICategory } from "@/models/Category";
import Customer, { ICustomer } from "@/models/Customer";
import Invoice, { IInvoice } from "@/models/Invoice";
import Payment, { IPayment } from "@/models/Payment";
import Purchase, { IPurchase } from "@/models/Purchase";
import StockMovement, { IStockMovement } from "@/models/StockMovement";
import AuditLog, { IAuditLog } from "@/models/AuditLog";
import { calculateInvoiceTaxes, numberToWordsINR } from "./gst";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

interface LocalStore {
  settings: any;
  users: any[];
  categories: any[];
  products: any[];
  customers: any[];
  purchases: any[];
  stockMovements: any[];
  invoices: any[];
  payments: any[];
  auditLogs: any[];
}

function getInitialStore(): LocalStore {
  const adminHash = bcrypt.hashSync("Admin@123", 10);
  const managerHash = bcrypt.hashSync("Manager@123", 10);
  const staffHash = bcrypt.hashSync("Staff@123", 10);

  return {
    settings: {
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
    },
    users: [
      {
        _id: "user_admin",
        name: "Rajesh Sharma (Admin)",
        email: "admin@kayra.com",
        passwordHash: adminHash,
        role: "admin",
        phone: "+91 98112 34567",
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        _id: "user_manager",
        name: "Pooja Verma (Manager)",
        email: "manager@kayra.com",
        passwordHash: managerHash,
        role: "manager",
        phone: "+91 98112 88899",
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        _id: "user_staff",
        name: "Amit Kumar (Billing Staff)",
        email: "staff@kayra.com",
        passwordHash: staffHash,
        role: "billing_staff",
        phone: "+91 98112 55544",
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ],
    categories: [
      { _id: "cat_1", name: "Electronics & Accessories", description: "Displays, peripherals and adapters", isActive: true },
      { _id: "cat_2", name: "Computer Hardware", description: "Internal PC parts, SSDs, RAM", isActive: true },
      { _id: "cat_3", name: "Office Supplies", description: "Toner cartridges, copier paper", isActive: true },
    ],
    products: [
      {
        _id: "prod_1",
        name: "Dell 24-inch FHD IPS Monitor",
        sku: "KE-MON-24",
        barcode: "8901234567890",
        categoryId: "cat_1",
        categoryName: "Electronics & Accessories",
        description: "1080p 75Hz IPS Display with HDMI & DisplayPort",
        uom: "PCS",
        sellingPrice: 11500,
        purchasePrice: 9200,
        availableQuantity: 24,
        minStockAlert: 5,
        gstRate: 18,
        hsnCode: "8528",
        isActive: true,
        isDeleted: false,
        createdAt: new Date().toISOString(),
      },
      {
        _id: "prod_2",
        name: "Logitech MX Master 3S Wireless Mouse",
        sku: "KE-LOGI-MX3S",
        barcode: "8901234567891",
        categoryId: "cat_1",
        categoryName: "Electronics & Accessories",
        description: "Ergonomic quiet click Bluetooth mouse with 8K DPI sensor",
        uom: "PCS",
        sellingPrice: 7999,
        purchasePrice: 6200,
        availableQuantity: 35,
        minStockAlert: 8,
        gstRate: 18,
        hsnCode: "8471",
        isActive: true,
        isDeleted: false,
        createdAt: new Date().toISOString(),
      },
      {
        _id: "prod_3",
        name: "Samsung 980 Pro 1TB NVMe M.2 SSD",
        sku: "KE-SSD-SAM-1TB",
        barcode: "8901234567892",
        categoryId: "cat_2",
        categoryName: "Computer Hardware",
        description: "PCIe 4.0 NVMe SSD with read speeds up to 7,000 MB/s",
        uom: "PCS",
        sellingPrice: 9400,
        purchasePrice: 7600,
        availableQuantity: 18,
        minStockAlert: 5,
        gstRate: 18,
        hsnCode: "8471",
        isActive: true,
        isDeleted: false,
        createdAt: new Date().toISOString(),
      },
      {
        _id: "prod_4",
        name: "Crucial 16GB DDR5 4800MHz Desktop RAM",
        sku: "KE-RAM-CRU-16",
        barcode: "8901234567893",
        categoryId: "cat_2",
        categoryName: "Computer Hardware",
        description: "High performance dual-channel ready desktop memory module",
        uom: "PCS",
        sellingPrice: 4200,
        purchasePrice: 3300,
        availableQuantity: 40,
        minStockAlert: 10,
        gstRate: 18,
        hsnCode: "8473",
        isActive: true,
        isDeleted: false,
        createdAt: new Date().toISOString(),
      },
      {
        _id: "prod_5",
        name: "HP LaserJet 108w Monochrome Printer",
        sku: "KE-PRN-HP-108W",
        barcode: "8901234567894",
        categoryId: "cat_1",
        categoryName: "Electronics & Accessories",
        description: "Compact wireless laser printer with fast crisp printing",
        uom: "PCS",
        sellingPrice: 13800,
        purchasePrice: 11200,
        availableQuantity: 12,
        minStockAlert: 3,
        gstRate: 18,
        hsnCode: "8443",
        isActive: true,
        isDeleted: false,
        createdAt: new Date().toISOString(),
      },
      {
        _id: "prod_6",
        name: "HP 110A Black Original Laser Toner Cartridge",
        sku: "KE-TNR-HP-110A",
        barcode: "8901234567895",
        categoryId: "cat_3",
        categoryName: "Office Supplies",
        description: "Original toner cartridge with 1500 page yield",
        uom: "PCS",
        sellingPrice: 3600,
        purchasePrice: 2850,
        availableQuantity: 50,
        minStockAlert: 10,
        gstRate: 18,
        hsnCode: "8443",
        isActive: true,
        isDeleted: false,
        createdAt: new Date().toISOString(),
      },
      {
        _id: "prod_7",
        name: "Bilt Matrix Copier Paper A4 75 GSM (Box of 5 Reams)",
        sku: "KE-PPR-A4-75",
        barcode: "8901234567896",
        categoryId: "cat_3",
        categoryName: "Office Supplies",
        description: "Premium high brightness multi-purpose copier paper",
        uom: "BOX",
        sellingPrice: 1450,
        purchasePrice: 1150,
        availableQuantity: 60,
        minStockAlert: 15,
        gstRate: 12,
        hsnCode: "4802",
        isActive: true,
        isDeleted: false,
        createdAt: new Date().toISOString(),
      },
      {
        _id: "prod_8",
        name: "APC Back-UPS 600VA / 360W Battery Backup",
        sku: "KE-UPS-APC-600",
        barcode: "8901234567897",
        categoryId: "cat_1",
        categoryName: "Electronics & Accessories",
        description: "Line-interactive UPS with battery surge protection",
        uom: "PCS",
        sellingPrice: 3850,
        purchasePrice: 3000,
        availableQuantity: 15,
        minStockAlert: 4,
        gstRate: 18,
        hsnCode: "8504",
        isActive: true,
        isDeleted: false,
        createdAt: new Date().toISOString(),
      },
    ],
    customers: [
      {
        _id: "cust_1",
        name: "Sharma Infotech Solutions Pvt Ltd",
        businessName: "Sharma Infotech",
        phone: "+91 98223 34455",
        email: "procurement@sharmainfotech.com",
        billingAddress: "402, Skyline Towers, Sector 62",
        shippingAddress: "402, Skyline Towers, Sector 62, Noida, UP - 201309",
        gstin: "09AABCS1234E1Z8", // Uttar Pradesh (Inter-state supply test)
        state: "Uttar Pradesh",
        stateCode: "09",
        customerType: "registered",
        balance: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        _id: "cust_2",
        name: "Apex Global Traders",
        businessName: "Apex Traders",
        phone: "+91 99110 99887",
        email: "accounts@apextraders.in",
        billingAddress: "Shop 12, Nehru Place Market",
        shippingAddress: "Shop 12, Nehru Place Market, New Delhi - 110019",
        gstin: "07AAHCA9988C1ZK", // Delhi (Intra-state supply test)
        state: "Delhi",
        stateCode: "07",
        customerType: "registered",
        balance: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        _id: "cust_3",
        name: "Anand Kumar",
        businessName: "",
        phone: "+91 98711 22334",
        email: "anand.kumar@gmail.com",
        billingAddress: "B-24, Lajpat Nagar-II, New Delhi - 110024",
        shippingAddress: "B-24, Lajpat Nagar-II, New Delhi - 110024",
        gstin: "",
        state: "Delhi",
        stateCode: "07",
        customerType: "unregistered",
        balance: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ],
    purchases: [],
    stockMovements: [
      {
        _id: "mov_1",
        productId: "prod_1",
        productName: "Dell 24-inch FHD IPS Monitor",
        sku: "KE-MON-24",
        type: "purchase",
        quantity: 24,
        previousQuantity: 0,
        newQuantity: 24,
        referenceType: "purchase",
        referenceNumber: "INITIAL-STOCK",
        reason: "Initial warehouse intake",
        unitCost: 9200,
        performedBy: { userId: "user_admin", userName: "Rajesh Sharma (Admin)" },
        createdAt: new Date().toISOString(),
      },
      {
        _id: "mov_2",
        productId: "prod_2",
        productName: "Logitech MX Master 3S Wireless Mouse",
        sku: "KE-LOGI-MX3S",
        type: "purchase",
        quantity: 35,
        previousQuantity: 0,
        newQuantity: 35,
        referenceType: "purchase",
        referenceNumber: "INITIAL-STOCK",
        reason: "Initial warehouse intake",
        unitCost: 6200,
        performedBy: { userId: "user_admin", userName: "Rajesh Sharma (Admin)" },
        createdAt: new Date().toISOString(),
      },
    ],
    invoices: [],
    payments: [],
    auditLogs: [
      {
        _id: "audit_1",
        action: "SYSTEM_INITIALIZED",
        entity: "System",
        performedBy: { userName: "System", role: "admin" },
        details: { message: "System initialized with enterprise defaults" },
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function readStore(): LocalStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      const initial = getInitialStore();
      fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
      return initial;
    }
    const data = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading store, resetting:", err);
    const initial = getInitialStore();
    return initial;
  }
}

function writeStore(store: LocalStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error("Error writing store:", err);
  }
}

let isMongoConnected: boolean | null = null;

async function checkMongoConnection(): Promise<boolean> {
  if (isMongoConnected === true) return true;
  try {
    await connectToDatabase();
    isMongoConnected = true;
    return true;
  } catch {
    isMongoConnected = false;
    return false;
  }
}

export const DataService = {
  // --- SETTINGS ---
  async getSettings() {
    if (await checkMongoConnection()) {
      let settings: any = await BusinessSettings.findOne({}).lean();
      if (!settings) {
        settings = (await BusinessSettings.create(getInitialStore().settings)).toObject();
      }
      return settings;
    }
    const store = readStore();
    return store.settings;
  },

  async updateSettings(data: any) {
    if (await checkMongoConnection()) {
      let settings = await BusinessSettings.findOne({});
      if (!settings) {
        settings = new BusinessSettings(data);
      } else {
        Object.assign(settings, data);
      }
      await settings.save();
      return settings.toObject();
    }
    const store = readStore();
    store.settings = { ...store.settings, ...data, updatedAt: new Date().toISOString() };
    writeStore(store);
    return store.settings;
  },

  // --- USERS ---
  async getUsers() {
    if (await checkMongoConnection()) {
      return await User.find({}).select("-passwordHash").lean();
    }
    const store = readStore();
    return store.users.map(({ passwordHash, ...u }) => u);
  },

  async getUserByEmail(email: string) {
    if (await checkMongoConnection()) {
      return await User.findOne({ email: email.toLowerCase().trim() }).lean();
    }
    const store = readStore();
    return store.users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim()) || null;
  },

  async getUserById(id: string) {
    if (await checkMongoConnection()) {
      return await User.findById(id).select("-passwordHash").lean();
    }
    const store = readStore();
    const u = store.users.find((u) => u._id === id);
    if (!u) return null;
    const { passwordHash, ...safe } = u;
    return safe;
  },

  async createUser(data: any) {
    if (await checkMongoConnection()) {
      const u = await User.create(data);
      return u.toObject();
    }
    const store = readStore();
    const newUser = {
      _id: `user_${Date.now()}`,
      ...data,
      createdAt: new Date().toISOString(),
    };
    store.users.push(newUser);
    writeStore(store);
    const { passwordHash, ...safe } = newUser;
    return safe;
  },

  async updateUser(id: string, data: any) {
    if (await checkMongoConnection()) {
      return await User.findByIdAndUpdate(id, data, { new: true }).select("-passwordHash").lean();
    }
    const store = readStore();
    const idx = store.users.findIndex((u) => u._id === id);
    if (idx !== -1) {
      store.users[idx] = { ...store.users[idx], ...data, updatedAt: new Date().toISOString() };
      writeStore(store);
      const { passwordHash, ...safe } = store.users[idx];
      return safe;
    }
    return null;
  },

  // --- PRODUCTS ---
  async getProducts(params?: { search?: string; category?: string; activeOnly?: boolean }) {
    if (await checkMongoConnection()) {
      const query: any = { isDeleted: false };
      if (params?.activeOnly) query.isActive = true;
      if (params?.category) query.categoryName = params.category;
      if (params?.search) {
        query.$or = [
          { name: { $regex: params.search, $options: "i" } },
          { sku: { $regex: params.search, $options: "i" } },
        ];
      }
      return await Product.find(query).sort({ createdAt: -1 }).lean();
    }

    const store = readStore();
    let prods = store.products.filter((p) => !p.isDeleted);
    if (params?.activeOnly) prods = prods.filter((p) => p.isActive);
    if (params?.category) prods = prods.filter((p) => p.categoryName === params.category);
    if (params?.search) {
      const q = params.search.toLowerCase();
      prods = prods.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.includes(q))
      );
    }
    return prods;
  },

  async getProductById(id: string) {
    if (await checkMongoConnection()) {
      return await Product.findById(id).lean();
    }
    const store = readStore();
    return store.products.find((p) => p._id === id) || null;
  },

  async createProduct(data: any, user: { userId?: string; userName?: string }) {
    if (await checkMongoConnection()) {
      const p = await Product.create(data);
      if (data.availableQuantity > 0) {
        await StockMovement.create({
          productId: p._id,
          productName: p.name,
          sku: p.sku,
          type: "purchase",
          quantity: data.availableQuantity,
          previousQuantity: 0,
          newQuantity: data.availableQuantity,
          referenceType: "manual",
          reason: "Initial product stock on creation",
          unitCost: data.purchasePrice,
          performedBy: user,
        });
      }
      return p.toObject();
    }

    const store = readStore();
    const newProd = {
      _id: `prod_${Date.now()}`,
      ...data,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.products.unshift(newProd);

    if (newProd.availableQuantity > 0) {
      store.stockMovements.unshift({
        _id: `mov_${Date.now()}`,
        productId: newProd._id,
        productName: newProd.name,
        sku: newProd.sku,
        type: "purchase",
        quantity: newProd.availableQuantity,
        previousQuantity: 0,
        newQuantity: newProd.availableQuantity,
        referenceType: "manual",
        reason: "Initial product stock on creation",
        unitCost: newProd.purchasePrice,
        performedBy: user,
        createdAt: new Date().toISOString(),
      });
    }

    writeStore(store);
    return newProd;
  },

  async updateProduct(id: string, data: any) {
    if (await checkMongoConnection()) {
      return await Product.findByIdAndUpdate(id, data, { new: true }).lean();
    }
    const store = readStore();
    const idx = store.products.findIndex((p) => p._id === id);
    if (idx !== -1) {
      store.products[idx] = { ...store.products[idx], ...data, updatedAt: new Date().toISOString() };
      writeStore(store);
      return store.products[idx];
    }
    return null;
  },

  async softDeleteProduct(id: string) {
    if (await checkMongoConnection()) {
      return await Product.findByIdAndUpdate(id, { isDeleted: true, isActive: false }, { new: true }).lean();
    }
    const store = readStore();
    const idx = store.products.findIndex((p) => p._id === id);
    if (idx !== -1) {
      store.products[idx].isDeleted = true;
      store.products[idx].isActive = false;
      writeStore(store);
      return store.products[idx];
    }
    return null;
  },

  // --- CATEGORIES ---
  async getCategories() {
    if (await checkMongoConnection()) {
      return await Category.find({ isActive: true }).lean();
    }
    const store = readStore();
    return store.categories.filter((c) => c.isActive);
  },

  async createCategory(data: any) {
    if (await checkMongoConnection()) {
      const c = await Category.create(data);
      return c.toObject();
    }
    const store = readStore();
    const newCat = {
      _id: `cat_${Date.now()}`,
      ...data,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    store.categories.push(newCat);
    writeStore(store);
    return newCat;
  },

  // --- CUSTOMERS ---
  async getCustomers(search?: string) {
    if (await checkMongoConnection()) {
      const query: any = { isActive: true };
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { businessName: { $regex: search, $options: "i" } },
        ];
      }
      return await Customer.find(query).sort({ createdAt: -1 }).lean();
    }

    const store = readStore();
    let custs = store.customers.filter((c) => c.isActive);
    if (search) {
      const q = search.toLowerCase();
      custs = custs.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.businessName && c.businessName.toLowerCase().includes(q))
      );
    }
    return custs;
  },

  async getCustomerById(id: string) {
    if (await checkMongoConnection()) {
      return await Customer.findById(id).lean();
    }
    const store = readStore();
    return store.customers.find((c) => c._id === id) || null;
  },

  async createCustomer(data: any) {
    if (await checkMongoConnection()) {
      const c = await Customer.create(data);
      return c.toObject();
    }
    const store = readStore();
    const newCust = {
      _id: `cust_${Date.now()}`,
      balance: 0,
      isActive: true,
      ...data,
      createdAt: new Date().toISOString(),
    };
    store.customers.unshift(newCust);
    writeStore(store);
    return newCust;
  },

  async updateCustomer(id: string, data: any) {
    if (await checkMongoConnection()) {
      return await Customer.findByIdAndUpdate(id, data, { new: true }).lean();
    }
    const store = readStore();
    const idx = store.customers.findIndex((c) => c._id === id);
    if (idx !== -1) {
      store.customers[idx] = { ...store.customers[idx], ...data, updatedAt: new Date().toISOString() };
      writeStore(store);
      return store.customers[idx];
    }
    return null;
  },

  // --- INVENTORY / STOCK ---
  async adjustStock(params: {
    productId: string;
    type: "adjustment" | "purchase" | "return";
    quantity: number; // positive or negative
    reason: string;
    user: { userId?: string; userName?: string };
  }) {
    if (await checkMongoConnection()) {
      const prod = await Product.findById(params.productId);
      if (!prod) throw new Error("Product not found");

      const prev = prod.availableQuantity;
      const next = Math.max(0, prev + params.quantity);
      prod.availableQuantity = next;
      await prod.save();

      const mov = await StockMovement.create({
        productId: prod._id,
        productName: prod.name,
        sku: prod.sku,
        type: params.type,
        quantity: params.quantity,
        previousQuantity: prev,
        newQuantity: next,
        referenceType: "adjustment",
        reason: params.reason,
        performedBy: params.user,
      });

      return { product: prod.toObject(), movement: mov.toObject() };
    }

    const store = readStore();
    const pIdx = store.products.findIndex((p) => p._id === params.productId);
    if (pIdx === -1) throw new Error("Product not found");

    const prod = store.products[pIdx];
    const prev = prod.availableQuantity;
    const next = Math.max(0, prev + params.quantity);
    prod.availableQuantity = next;
    prod.updatedAt = new Date().toISOString();

    const mov = {
      _id: `mov_${Date.now()}`,
      productId: prod._id,
      productName: prod.name,
      sku: prod.sku,
      type: params.type,
      quantity: params.quantity,
      previousQuantity: prev,
      newQuantity: next,
      referenceType: "adjustment",
      reason: params.reason,
      performedBy: params.user,
      createdAt: new Date().toISOString(),
    };

    store.stockMovements.unshift(mov);
    writeStore(store);
    return { product: prod, movement: mov };
  },

  async getStockMovements(productId?: string) {
    if (await checkMongoConnection()) {
      const query: any = {};
      if (productId) query.productId = productId;
      return await StockMovement.find(query).sort({ createdAt: -1 }).limit(100).lean();
    }
    const store = readStore();
    let movs = store.stockMovements;
    if (productId) movs = movs.filter((m) => m.productId === productId);
    return movs.slice(0, 100);
  },

  // --- PURCHASES (STOCK IN) ---
  async createPurchase(data: any, user: { userId?: string; userName?: string }) {
    if (await checkMongoConnection()) {
      const purchase = await Purchase.create({
        ...data,
        createdBy: user,
      });

      // Update product stocks
      for (const item of data.items) {
        const prod = await Product.findById(item.productId);
        if (prod) {
          const prev = prod.availableQuantity;
          const next = prev + Number(item.quantity);
          prod.availableQuantity = next;
          // Optionally update purchase price
          if (item.purchasePrice > 0) prod.purchasePrice = item.purchasePrice;
          await prod.save();

          await StockMovement.create({
            productId: prod._id,
            productName: prod.name,
            sku: prod.sku,
            type: "purchase",
            quantity: Number(item.quantity),
            previousQuantity: prev,
            newQuantity: next,
            referenceType: "purchase",
            referenceNumber: purchase.purchaseNumber,
            reason: `Purchase from ${data.supplierName}`,
            unitCost: item.purchasePrice,
            performedBy: user,
          });
        }
      }

      return purchase.toObject();
    }

    const store = readStore();
    const purchase = {
      _id: `purch_${Date.now()}`,
      ...data,
      createdBy: user,
      createdAt: new Date().toISOString(),
    };
    store.purchases.unshift(purchase);

    // Update stocks
    for (const item of data.items) {
      const pIdx = store.products.findIndex((p) => p._id === item.productId);
      if (pIdx !== -1) {
        const prod = store.products[pIdx];
        const prev = prod.availableQuantity;
        const next = prev + Number(item.quantity);
        prod.availableQuantity = next;
        if (item.purchasePrice > 0) prod.purchasePrice = item.purchasePrice;

        store.stockMovements.unshift({
          _id: `mov_${Date.now()}_${item.productId}`,
          productId: prod._id,
          productName: prod.name,
          sku: prod.sku,
          type: "purchase",
          quantity: Number(item.quantity),
          previousQuantity: prev,
          newQuantity: next,
          referenceType: "purchase",
          referenceNumber: purchase.purchaseNumber,
          reason: `Purchase from ${data.supplierName}`,
          unitCost: item.purchasePrice,
          performedBy: user,
          createdAt: new Date().toISOString(),
        });
      }
    }

    writeStore(store);
    return purchase;
  },

  async getPurchases() {
    if (await checkMongoConnection()) {
      return await Purchase.find({}).sort({ createdAt: -1 }).lean();
    }
    const store = readStore();
    return store.purchases;
  },

  // --- BILLING / INVOICES ---
  async createInvoice(payload: {
    customerId?: string;
    customerData: any;
    items: Array<{
      productId: string;
      quantity: number;
      rate: number;
      discount?: number;
      discountPercent?: number;
    }>;
    paymentMode?: "cash" | "upi" | "bank_transfer" | "card" | "credit";
    amountPaid?: number;
    notes?: string;
    user: { userId?: string; userName?: string };
  }) {
    const settings = await this.getSettings();

    // 1. Fetch products & validate stock
    const productsMap = new Map<string, any>();
    for (const item of payload.items) {
      const prod = await this.getProductById(item.productId);
      if (!prod) throw new Error(`Product ${item.productId} not found`);
      if (prod.availableQuantity < item.quantity) {
        throw new Error(
          `Insufficient stock for "${prod.name}". Available: ${prod.availableQuantity}, Requested: ${item.quantity}`
        );
      }
      productsMap.set(item.productId, prod);
    }

    // 2. Perform GST tax calculation
    const sellerStateCode = settings.stateCode || "07";
    const customerStateCode = payload.customerData.stateCode || "07";

    const preparedItems = payload.items.map((it) => {
      const prod = productsMap.get(it.productId);
      return {
        rate: it.rate,
        quantity: it.quantity,
        discount: it.discount || 0,
        discountPercent: it.discountPercent || 0,
        gstRate: prod.gstRate || 0,
      };
    });

    const taxCalculation = calculateInvoiceTaxes(preparedItems, sellerStateCode, customerStateCode);

    // 3. Assemble immutable snapshot line items
    const snapshotItems = payload.items.map((it, idx) => {
      const prod = productsMap.get(it.productId);
      const calc = taxCalculation.items[idx];

      return {
        productId: prod._id,
        productName: prod.name,
        sku: prod.sku,
        hsnCode: prod.hsnCode,
        uom: prod.uom,
        rate: it.rate,
        purchasePrice: prod.purchasePrice || 0,
        quantity: it.quantity,
        discount: calc.discountAmount,
        discountPercent: it.discountPercent || 0,
        taxableAmount: calc.taxableAmount,
        gstRate: calc.gstRate,
        cgstRate: calc.cgstRate,
        cgstAmount: calc.cgstAmount,
        sgstRate: calc.sgstRate,
        sgstAmount: calc.sgstAmount,
        igstRate: calc.igstRate,
        igstAmount: calc.igstAmount,
        totalTax: calc.totalTax,
        totalAmount: calc.totalAmount,
      };
    });

    const grandTotal = taxCalculation.summary.grandTotal;
    const amountPaid = Math.min(Number(payload.amountPaid || 0), grandTotal);
    const balanceDue = Math.max(0, grandTotal - amountPaid);
    const paymentStatus = balanceDue === 0 ? "paid" : amountPaid > 0 ? "partial" : "unpaid";

    const nextSeq = (settings.currentInvoiceSequence || 9) + 1;
    const padLen = nextSeq < 100 ? 2 : 4;
    const invoiceNumber = `${settings.invoicePrefix || "26-27/"}${String(nextSeq).padStart(padLen, "0")}`;

    const paymentsRecord: any[] = [];
    if (amountPaid > 0) {
      paymentsRecord.push({
        paymentId: `pay_${Date.now()}`,
        amount: amountPaid,
        paymentMode: payload.paymentMode || "cash",
        paymentDate: new Date(),
        notes: "Initial payment at invoice generation",
      });
    }

    const invoiceData = {
      invoiceNumber,
      invoiceDate: new Date(),
      customer: {
        name: payload.customerData.name,
        businessName: payload.customerData.businessName || "",
        phone: payload.customerData.phone,
        email: payload.customerData.email || "",
        billingAddress: payload.customerData.billingAddress,
        shippingAddress: payload.customerData.shippingAddress || payload.customerData.billingAddress,
        gstin: payload.customerData.gstin || "",
        state: payload.customerData.state,
        stateCode: customerStateCode,
        customerType: payload.customerData.gstin ? "registered" : "unregistered",
      },
      seller: {
        businessName: settings.businessName,
        logoUrl: settings.logoUrl || "",
        gstin: settings.gstin,
        address: settings.address,
        city: settings.city,
        state: settings.state,
        stateCode: settings.stateCode,
        pincode: settings.pincode,
        phone: settings.phone,
        email: settings.email,
        bankDetails: settings.bankDetails,
        upiId: settings.upiId || "",
      },
      items: snapshotItems,
      taxableAmount: taxCalculation.summary.taxableAmount,
      totalDiscount: taxCalculation.summary.totalDiscount,
      totalCgst: taxCalculation.summary.totalCgst,
      totalSgst: taxCalculation.summary.totalSgst,
      totalIgst: taxCalculation.summary.totalIgst,
      totalTax: taxCalculation.summary.totalTax,
      roundOff: taxCalculation.summary.roundOff,
      grandTotal,
      amountInWords: numberToWordsINR(grandTotal),
      isInterState: taxCalculation.summary.isInterState,
      paymentStatus,
      amountPaid,
      balanceDue,
      payments: paymentsRecord,
      notes: payload.notes || "",
      termsAndConditions: settings.invoiceTerms || "",
      status: "finalized",
      createdBy: payload.user,
    };

    if (await checkMongoConnection()) {
      const inv = await Invoice.create(invoiceData);

      // Increment sequence
      await BusinessSettings.findByIdAndUpdate(settings._id, { currentInvoiceSequence: nextSeq });

      // Deduct stock atomically & record movements
      for (const it of payload.items) {
        const prod = await Product.findById(it.productId);
        if (prod) {
          const prev = prod.availableQuantity;
          const next = Math.max(0, prev - it.quantity);
          prod.availableQuantity = next;
          await prod.save();

          await StockMovement.create({
            productId: prod._id,
            productName: prod.name,
            sku: prod.sku,
            type: "sale",
            quantity: -it.quantity,
            previousQuantity: prev,
            newQuantity: next,
            referenceType: "invoice",
            referenceNumber: invoiceNumber,
            reason: `Invoice sale #${invoiceNumber}`,
            performedBy: payload.user,
          });
        }
      }

      // Record standalone payment if any
      if (amountPaid > 0) {
        await Payment.create({
          invoiceId: inv._id,
          invoiceNumber,
          customerName: payload.customerData.name,
          amount: amountPaid,
          paymentMode: payload.paymentMode || "cash",
          recordedBy: payload.user,
        });
      }

      // Update customer balance if registered/existing
      if (payload.customerId) {
        await Customer.findByIdAndUpdate(payload.customerId, {
          $inc: { balance: balanceDue },
        });
      }

      return inv.toObject();
    }

    // Local Store Execution
    const store = readStore();
    const inv = {
      _id: `inv_${Date.now()}`,
      ...invoiceData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.invoices.unshift(inv);
    store.settings.currentInvoiceSequence = nextSeq;

    // Deduct stock
    for (const it of payload.items) {
      const pIdx = store.products.findIndex((p) => p._id === it.productId);
      if (pIdx !== -1) {
        const prod = store.products[pIdx];
        const prev = prod.availableQuantity;
        const next = Math.max(0, prev - it.quantity);
        prod.availableQuantity = next;

        store.stockMovements.unshift({
          _id: `mov_${Date.now()}_${prod._id}`,
          productId: prod._id,
          productName: prod.name,
          sku: prod.sku,
          type: "sale",
          quantity: -it.quantity,
          previousQuantity: prev,
          newQuantity: next,
          referenceType: "invoice",
          referenceNumber: invoiceNumber,
          reason: `Invoice sale #${invoiceNumber}`,
          performedBy: payload.user,
          createdAt: new Date().toISOString(),
        });
      }
    }

    if (amountPaid > 0) {
      store.payments.unshift({
        _id: `pay_${Date.now()}`,
        invoiceId: inv._id,
        invoiceNumber,
        customerName: payload.customerData.name,
        amount: amountPaid,
        paymentMode: payload.paymentMode || "cash",
        paymentDate: new Date().toISOString(),
        recordedBy: payload.user,
      });
    }

    if (payload.customerId) {
      const cIdx = store.customers.findIndex((c) => c._id === payload.customerId);
      if (cIdx !== -1) {
        store.customers[cIdx].balance = (store.customers[cIdx].balance || 0) + balanceDue;
      }
    }

    writeStore(store);
    return inv;
  },

  async getInvoices(params?: { search?: string; status?: string; paymentStatus?: string }) {
    if (await checkMongoConnection()) {
      const query: any = {};
      if (params?.status) query.status = params.status;
      if (params?.paymentStatus) query.paymentStatus = params.paymentStatus;
      if (params?.search) {
        query.$or = [
          { invoiceNumber: { $regex: params.search, $options: "i" } },
          { "customer.name": { $regex: params.search, $options: "i" } },
        ];
      }
      return await Invoice.find(query).sort({ createdAt: -1 }).lean();
    }

    const store = readStore();
    let invs = store.invoices;
    if (params?.status) invs = invs.filter((i) => i.status === params.status);
    if (params?.paymentStatus) invs = invs.filter((i) => i.paymentStatus === params.paymentStatus);
    if (params?.search) {
      const q = params.search.toLowerCase();
      invs = invs.filter(
        (i) => i.invoiceNumber.toLowerCase().includes(q) || i.customer.name.toLowerCase().includes(q)
      );
    }
    return invs;
  },

  async getInvoiceById(id: string) {
    if (await checkMongoConnection()) {
      return await Invoice.findById(id).lean();
    }
    const store = readStore();
    return store.invoices.find((i) => i._id === id || i.invoiceNumber === id) || null;
  },

  async cancelInvoice(id: string, reason: string, user: { userId?: string; userName?: string }) {
    if (await checkMongoConnection()) {
      const inv = await Invoice.findById(id);
      if (!inv) throw new Error("Invoice not found");
      if (inv.status === "cancelled") throw new Error("Invoice is already cancelled");

      inv.status = "cancelled";
      inv.cancellationReason = reason;
      inv.cancelledAt = new Date();
      inv.cancelledBy = user;
      await inv.save();

      // Reverse stock movements safely
      for (const it of inv.items) {
        const prod = await Product.findById(it.productId);
        if (prod) {
          const prev = prod.availableQuantity;
          const next = prev + it.quantity;
          prod.availableQuantity = next;
          await prod.save();

          await StockMovement.create({
            productId: prod._id,
            productName: prod.name,
            sku: prod.sku,
            type: "cancellation_reversal",
            quantity: it.quantity,
            previousQuantity: prev,
            newQuantity: next,
            referenceType: "invoice",
            referenceNumber: inv.invoiceNumber,
            reason: `Stock restored from cancelled invoice #${inv.invoiceNumber}: ${reason}`,
            performedBy: user,
          });
        }
      }

      // Revert customer balance if unpaid balance existed
      if (inv.customerId && inv.balanceDue > 0) {
        await Customer.findByIdAndUpdate(inv.customerId, {
          $inc: { balance: -inv.balanceDue },
        });
      }

      return inv.toObject();
    }

    const store = readStore();
    const idx = store.invoices.findIndex((i) => i._id === id);
    if (idx === -1) throw new Error("Invoice not found");
    const inv = store.invoices[idx];
    if (inv.status === "cancelled") throw new Error("Invoice is already cancelled");

    inv.status = "cancelled";
    inv.cancellationReason = reason;
    inv.cancelledAt = new Date().toISOString();
    inv.cancelledBy = user;

    // Restore stock
    for (const it of inv.items) {
      const pIdx = store.products.findIndex((p) => p._id === it.productId);
      if (pIdx !== -1) {
        const prod = store.products[pIdx];
        const prev = prod.availableQuantity;
        const next = prev + it.quantity;
        prod.availableQuantity = next;

        store.stockMovements.unshift({
          _id: `mov_${Date.now()}_rev_${prod._id}`,
          productId: prod._id,
          productName: prod.name,
          sku: prod.sku,
          type: "cancellation_reversal",
          quantity: it.quantity,
          previousQuantity: prev,
          newQuantity: next,
          referenceType: "invoice",
          referenceNumber: inv.invoiceNumber,
          reason: `Stock restored from cancelled invoice #${inv.invoiceNumber}: ${reason}`,
          performedBy: user,
          createdAt: new Date().toISOString(),
        });
      }
    }

    if (inv.customerId && inv.balanceDue > 0) {
      const cIdx = store.customers.findIndex((c) => c._id === inv.customerId);
      if (cIdx !== -1) {
        store.customers[cIdx].balance = Math.max(0, (store.customers[cIdx].balance || 0) - inv.balanceDue);
      }
    }

    writeStore(store);
    return inv;
  },

  // --- PAYMENTS ---
  async recordPayment(payload: {
    invoiceId: string;
    amount: number;
    paymentMode: "cash" | "upi" | "bank_transfer" | "card" | "credit";
    transactionRef?: string;
    notes?: string;
    user: { userId?: string; userName?: string };
  }) {
    if (await checkMongoConnection()) {
      const inv = await Invoice.findById(payload.invoiceId);
      if (!inv) throw new Error("Invoice not found");
      if (inv.status === "cancelled") throw new Error("Cannot pay a cancelled invoice");

      const payment = await Payment.create({
        invoiceId: inv._id,
        invoiceNumber: inv.invoiceNumber,
        customerId: inv.customerId,
        customerName: inv.customer.name,
        amount: payload.amount,
        paymentMode: payload.paymentMode,
        transactionRef: payload.transactionRef,
        notes: payload.notes,
        recordedBy: payload.user,
      });

      inv.amountPaid += payload.amount;
      inv.balanceDue = Math.max(0, inv.grandTotal - inv.amountPaid);
      inv.paymentStatus = inv.balanceDue === 0 ? "paid" : "partial";
      inv.payments.push({
        paymentId: payment._id.toString(),
        amount: payload.amount,
        paymentMode: payload.paymentMode,
        transactionRef: payload.transactionRef,
        paymentDate: new Date(),
        notes: payload.notes,
      });
      await inv.save();

      if (inv.customerId) {
        await Customer.findByIdAndUpdate(inv.customerId, {
          $inc: { balance: -payload.amount },
        });
      }

      return { payment: payment.toObject(), invoice: inv.toObject() };
    }

    const store = readStore();
    const idx = store.invoices.findIndex((i) => i._id === payload.invoiceId);
    if (idx === -1) throw new Error("Invoice not found");
    const inv = store.invoices[idx];
    if (inv.status === "cancelled") throw new Error("Cannot pay a cancelled invoice");

    const payment = {
      _id: `pay_${Date.now()}`,
      invoiceId: inv._id,
      invoiceNumber: inv.invoiceNumber,
      customerId: inv.customerId,
      customerName: inv.customer.name,
      amount: payload.amount,
      paymentMode: payload.paymentMode,
      transactionRef: payload.transactionRef,
      paymentDate: new Date().toISOString(),
      notes: payload.notes,
      recordedBy: payload.user,
    };
    store.payments.unshift(payment);

    inv.amountPaid += payload.amount;
    inv.balanceDue = Math.max(0, inv.grandTotal - inv.amountPaid);
    inv.paymentStatus = inv.balanceDue === 0 ? "paid" : "partial";
    inv.payments.push(payment);

    if (inv.customerId) {
      const cIdx = store.customers.findIndex((c) => c._id === inv.customerId);
      if (cIdx !== -1) {
        store.customers[cIdx].balance = Math.max(0, (store.customers[cIdx].balance || 0) - payload.amount);
      }
    }

    writeStore(store);
    return { payment, invoice: inv };
  },

  async getPayments() {
    if (await checkMongoConnection()) {
      return await Payment.find({}).sort({ createdAt: -1 }).lean();
    }
    const store = readStore();
    return store.payments;
  },

  // --- AUDIT LOGS ---
  async createAuditLog(data: any) {
    if (await checkMongoConnection()) {
      try {
        const log = await AuditLog.create(data);
        return log.toObject();
      } catch {
        // fallback
      }
    }
    const store = readStore();
    const newLog = {
      _id: `audit_${Date.now()}`,
      ...data,
      createdAt: new Date().toISOString(),
    };
    store.auditLogs.unshift(newLog);
    if (store.auditLogs.length > 200) store.auditLogs.pop();
    writeStore(store);
    return newLog;
  },

  async getAuditLogs(limit = 100) {
    if (await checkMongoConnection()) {
      return await AuditLog.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    }
    const store = readStore();
    return store.auditLogs.slice(0, limit);
  },

  // --- DASHBOARD METRICS ---
  async getDashboardMetrics() {
    const products = await this.getProducts();
    const customers = await this.getCustomers();
    const invoices = await this.getInvoices();

    const activeInvoices = invoices.filter((i) => i.status !== "cancelled");

    const todayStr = new Date().toISOString().split("T")[0];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let totalSales = 0;
    let todaySales = 0;
    let monthlySales = 0;
    let pendingPayments = 0;

    for (const inv of activeInvoices) {
      totalSales += inv.grandTotal;
      pendingPayments += inv.balanceDue;

      const d = new Date(inv.invoiceDate || inv.createdAt);
      const dStr = d.toISOString().split("T")[0];
      if (dStr === todayStr) {
        todaySales += inv.grandTotal;
      }
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        monthlySales += inv.grandTotal;
      }
    }

    let totalStockValue = 0;
    const lowStockProducts: any[] = [];
    for (const p of products) {
      totalStockValue += (p.availableQuantity || 0) * (p.purchasePrice || 0);
      if (p.availableQuantity <= p.minStockAlert) {
        lowStockProducts.push(p);
      }
    }

    // Monthly breakdown for charts
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyOverview: { [key: string]: { month: string; sales: number; invoices: number } } = {};

    for (let m = 0; m < 12; m++) {
      const key = monthNames[m];
      monthlyOverview[key] = { month: key, sales: 0, invoices: 0 };
    }

    for (const inv of activeInvoices) {
      const d = new Date(inv.invoiceDate || inv.createdAt);
      if (d.getFullYear() === currentYear) {
        const mName = monthNames[d.getMonth()];
        if (monthlyOverview[mName]) {
          monthlyOverview[mName].sales += inv.grandTotal;
          monthlyOverview[mName].invoices += 1;
        }
      }
    }

    // Top selling products aggregation
    const prodSalesMap: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
    for (const inv of activeInvoices) {
      for (const it of inv.items || []) {
        if (!prodSalesMap[it.productName]) {
          prodSalesMap[it.productName] = { name: it.productName, quantity: 0, revenue: 0 };
        }
        prodSalesMap[it.productName].quantity += it.quantity;
        prodSalesMap[it.productName].revenue += it.totalAmount;
      }
    }

    const topSellingProducts = Object.values(prodSalesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return {
      totalSales,
      todaySales,
      monthlySales,
      totalInvoices: activeInvoices.length,
      totalProducts: products.length,
      totalCustomers: customers.length,
      totalStockValue,
      lowStockCount: lowStockProducts.length,
      lowStockProducts: lowStockProducts.slice(0, 6),
      pendingPayments,
      recentInvoices: activeInvoices.slice(0, 6),
      monthlySalesChart: Object.values(monthlyOverview),
      topSellingProducts,
    };
  },
};
