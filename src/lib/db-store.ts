import fs from "fs";
import path from "path";
import connectToDatabase, { runInMongoTransaction } from "./mongodb";
import User from "@/models/User";
import BusinessSettings, {
  DEFAULT_REMINDER_SUBJECT,
  DEFAULT_REMINDER_TEMPLATE,
} from "@/models/BusinessSettings";
import Product from "@/models/Product";
import Category from "@/models/Category";
import Customer from "@/models/Customer";
import Invoice from "@/models/Invoice";
import InvoiceRevision from "@/models/InvoiceRevision";
import Payment from "@/models/Payment";
import Purchase from "@/models/Purchase";
import StockMovement from "@/models/StockMovement";
import PaymentReminder from "@/models/PaymentReminder";
import PaymentReminderLog from "@/models/PaymentReminderLog";
import AuditLog from "@/models/AuditLog";
import ImportJob from "@/models/ImportJob";
import { calculateInvoiceTaxes, numberToWordsINR, roundToTwo } from "./gst";
import { ParsedBulkRow, validateBulkRows } from "./bulk-import";
import {
  buildReminderContent,
  computeReminderPeriodKey,
  dispatchReminderChannel,
} from "./reminder-engine";
import {
  computeComprehensiveReports,
  computeDashboardAnalytics,
  normalizeInvoiceStatus,
} from "./analytics-engine";
import initialData from "./initial-data.json";

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
  invoiceRevisions: any[];
  payments: any[];
  paymentReminders: any[];
  paymentReminderLogs: any[];
  auditLogs: any[];
  importJobs: any[];
}

let memoryStore: LocalStore | null = null;

function buildDefaultReminderSettings(existing?: any) {
  return {
    enabled: existing?.enabled ?? true,
    intervalDays: existing?.intervalDays === 3 ? 3 : 4,
    reminderStartDate: existing?.reminderStartDate || null,
    startDaysAfterInvoice: Number(existing?.startDaysAfterInvoice ?? 0),
    channels: Array.isArray(existing?.channels) && existing.channels.length > 0
      ? existing.channels
      : ["in_app", "email"],
    subjectTemplate: existing?.subjectTemplate || DEFAULT_REMINDER_SUBJECT,
    messageTemplate: existing?.messageTemplate || DEFAULT_REMINDER_TEMPLATE,
    maxRetries: Number(existing?.maxRetries ?? 3),
    retryDelayMinutes: Number(existing?.retryDelayMinutes ?? 60),
    providers: {
      smtpHost: existing?.providers?.smtpHost || "",
      smtpPort: Number(existing?.providers?.smtpPort ?? 587),
      smtpSecure: Boolean(existing?.providers?.smtpSecure ?? false),
      smtpUser: existing?.providers?.smtpUser || "",
      smtpPass: existing?.providers?.smtpPass || "",
      smtpFrom: existing?.providers?.smtpFrom || "",
      whatsappApiUrl: existing?.providers?.whatsappApiUrl || "",
      whatsappPhoneNumberId: existing?.providers?.whatsappPhoneNumberId || "",
      whatsappAccessToken: existing?.providers?.whatsappAccessToken || "",
      whatsappTemplateName: existing?.providers?.whatsappTemplateName || "",
      smsApiUrl: existing?.providers?.smsApiUrl || "",
      smsApiKey: existing?.providers?.smsApiKey || "",
      smsSenderId: existing?.providers?.smsSenderId || "",
    },
  };
}

function normalizeStoreShape(raw: any): LocalStore {
  const settings = raw?.settings || {};
  if (!settings.businessName || settings.businessName === "KYRA ENTERPRISES") {
    settings.businessName = "Kyra Enterprises";
  }
  settings.defaultDueDays = Number(settings.defaultDueDays ?? 5);
  settings.reminderSettings = buildDefaultReminderSettings(settings.reminderSettings);

  return {
    settings,
    users: Array.isArray(raw?.users) ? raw.users : [],
    categories: Array.isArray(raw?.categories) ? raw.categories : [],
    products: Array.isArray(raw?.products) ? raw.products : [],
    customers: Array.isArray(raw?.customers)
      ? raw.customers.map((c: any) => ({
          remindersEnabled: true,
          totalPurchases: 0,
          totalPaid: 0,
          ...c,
        }))
      : [],
    purchases: Array.isArray(raw?.purchases) ? raw.purchases : [],
    stockMovements: Array.isArray(raw?.stockMovements) ? raw.stockMovements : [],
    invoices: Array.isArray(raw?.invoices)
      ? raw.invoices.map((inv: any) => ({
          isDeleted: false,
          revisionNumber: 1,
          dueDate:
            inv.dueDate ||
            new Date(
              new Date(inv.invoiceDate || inv.createdAt || Date.now()).getTime() +
                5 * 24 * 3600 * 1000
            ).toISOString(),
          ...inv,
        }))
      : [],
    invoiceRevisions: Array.isArray(raw?.invoiceRevisions) ? raw.invoiceRevisions : [],
    payments: Array.isArray(raw?.payments)
      ? raw.payments.map((p: any) => ({ status: "completed", ...p }))
      : [],
    paymentReminders: Array.isArray(raw?.paymentReminders) ? raw.paymentReminders : [],
    paymentReminderLogs: Array.isArray(raw?.paymentReminderLogs) ? raw.paymentReminderLogs : [],
    auditLogs: Array.isArray(raw?.auditLogs) ? raw.auditLogs : [],
    importJobs: Array.isArray(raw?.importJobs) ? raw.importJobs : [],
  };
}

function getInitialStore(): LocalStore {
  return normalizeStoreShape(JSON.parse(JSON.stringify(initialData)));
}

function readStore(): LocalStore {
  if (memoryStore) return memoryStore;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch {}
    }
    if (!fs.existsSync(DATA_FILE)) {
      const initial = getInitialStore();
      try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
      } catch {}
      memoryStore = initial;
      return initial;
    }
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    memoryStore = normalizeStoreShape(raw);
    return memoryStore;
  } catch {
    const initial = getInitialStore();
    memoryStore = initial;
    return initial;
  }
}

function writeStore(store: LocalStore): void {
  memoryStore = store;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  } catch {}
}

let isMongoConnected: boolean | null = null;
let lastMongoAttemptAt = 0;

async function checkMongoConnection(): Promise<boolean> {
  if (process.env.FORCE_LOCAL_STORE === "true") return false;
  if (isMongoConnected === true) return true;
  const now = Date.now();
  if (isMongoConnected === false && now - lastMongoAttemptAt < 15000) {
    return false;
  }
  lastMongoAttemptAt = now;
  try {
    await connectToDatabase();
    isMongoConnected = true;
    return true;
  } catch {
    isMongoConnected = false;
    return false;
  }
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export const DataService = {
  resetConnectionCache() {
    isMongoConnected = null;
    lastMongoAttemptAt = 0;
  },

  async isUsingMongo(): Promise<boolean> {
    return checkMongoConnection();
  },

  // --- 1. BUSINESS SETTINGS ---
  async getSettings() {
    if (await checkMongoConnection()) {
      let settings: any = await BusinessSettings.findOne({}).lean();
      if (!settings) {
        const seedSettings = getInitialStore().settings;
        const { _id, ...cleanSeed } = seedSettings;
        settings = (await BusinessSettings.create(cleanSeed)).toObject();
      }
      settings.reminderSettings = buildDefaultReminderSettings(settings.reminderSettings);
      return settings;
    }
    const store = readStore();
    store.settings.reminderSettings = buildDefaultReminderSettings(store.settings.reminderSettings);
    return store.settings;
  },

  async updateSettings(data: any) {
    if (await checkMongoConnection()) {
      let settings = await BusinessSettings.findOne({});
      if (!settings) {
        settings = new BusinessSettings(data);
      } else {
        if (data.reminderSettings) {
          settings.reminderSettings = {
            ...buildDefaultReminderSettings(settings.reminderSettings),
            ...data.reminderSettings,
            providers: {
              ...buildDefaultReminderSettings(settings.reminderSettings).providers,
              ...(data.reminderSettings.providers || {}),
            },
          } as any;
        }
        const { reminderSettings, ...rest } = data;
        Object.assign(settings, rest);
      }
      await settings.save();

      // Sync intervalDays / channels onto active reminders
      if (data.reminderSettings?.intervalDays || data.reminderSettings?.channels) {
        const patch: any = {};
        if (data.reminderSettings.intervalDays) {
          patch.intervalDays = data.reminderSettings.intervalDays;
        }
        if (data.reminderSettings.channels) {
          patch.channels = data.reminderSettings.channels;
        }
        await PaymentReminder.updateMany({ status: "active" }, { $set: patch });
      }

      return settings.toObject();
    }

    const store = readStore();
    const mergedReminder = data.reminderSettings
      ? {
          ...buildDefaultReminderSettings(store.settings.reminderSettings),
          ...data.reminderSettings,
          providers: {
            ...buildDefaultReminderSettings(store.settings.reminderSettings).providers,
            ...(data.reminderSettings.providers || {}),
          },
        }
      : buildDefaultReminderSettings(store.settings.reminderSettings);

    store.settings = {
      ...store.settings,
      ...data,
      reminderSettings: mergedReminder,
      updatedAt: new Date().toISOString(),
    };

    if (data.reminderSettings?.intervalDays || data.reminderSettings?.channels) {
      for (const rem of store.paymentReminders) {
        if (rem.status === "active") {
          if (data.reminderSettings.intervalDays) rem.intervalDays = data.reminderSettings.intervalDays;
          if (data.reminderSettings.channels) rem.channels = data.reminderSettings.channels;
        }
      }
    }

    writeStore(store);
    return store.settings;
  },

  // --- 2. USERS ---
  async getUsers() {
    if (await checkMongoConnection()) {
      return await User.find({}).select("-passwordHash").sort({ createdAt: -1 }).lean();
    }
    const store = readStore();
    return store.users.map(({ passwordHash, ...u }) => u);
  },

  async getUserByEmail(email: string) {
    const clean = email.toLowerCase().trim();
    if (await checkMongoConnection()) {
      return await User.findOne({ email: clean }).lean();
    }
    const store = readStore();
    return store.users.find((u) => u.email.toLowerCase() === clean) || null;
  },

  async getUserById(id: string) {
    if (await checkMongoConnection()) {
      return await User.findById(id).select("-passwordHash").lean();
    }
    const store = readStore();
    const u = store.users.find((u) => String(u._id) === String(id));
    if (!u) return null;
    const { passwordHash, ...safe } = u;
    return safe;
  },

  async getUserWithPassword(id: string) {
    if (await checkMongoConnection()) {
      return await User.findById(id).lean();
    }
    const store = readStore();
    return store.users.find((u) => String(u._id) === String(id)) || null;
  },

  async createUser(data: any) {
    if (await checkMongoConnection()) {
      const u = await User.create(data);
      const obj = u.toObject();
      const { passwordHash, ...safe } = obj as any;
      return safe;
    }
    const store = readStore();
    const newUser = {
      _id: uid("user"),
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
    const idx = store.users.findIndex((u) => String(u._id) === String(id));
    if (idx !== -1) {
      store.users[idx] = { ...store.users[idx], ...data, updatedAt: new Date().toISOString() };
      writeStore(store);
      const { passwordHash, ...safe } = store.users[idx];
      return safe;
    }
    return null;
  },

  async deleteUser(id: string) {
    if (await checkMongoConnection()) {
      return await User.findByIdAndDelete(id).select("-passwordHash").lean();
    }
    const store = readStore();
    const idx = store.users.findIndex((u) => String(u._id) === String(id));
    if (idx !== -1) {
      const deleted = store.users.splice(idx, 1)[0];
      writeStore(store);
      const { passwordHash, ...safe } = deleted;
      return safe;
    }
    return null;
  },

  // --- 3. PRODUCTS & BULK UPLOAD ---
  async getProducts(params?: {
    search?: string;
    category?: string;
    activeOnly?: boolean;
    status?: "all" | "active" | "inactive" | "low_stock";
  }) {
    if (await checkMongoConnection()) {
      const query: any = { isDeleted: false };
      if (params?.activeOnly || params?.status === "active") query.isActive = true;
      if (params?.status === "inactive") query.isActive = false;
      if (params?.category) query.categoryName = params.category;
      if (params?.search) {
        query.$or = [
          { name: { $regex: params.search, $options: "i" } },
          { sku: { $regex: params.search, $options: "i" } },
          { hsnCode: { $regex: params.search, $options: "i" } },
        ];
      }
      let items: any[] = await Product.find(query).sort({ createdAt: -1 }).lean();
      if (params?.status === "low_stock") {
        items = items.filter((p) => Number(p.availableQuantity) <= Number(p.minStockAlert ?? 5));
      }
      return items;
    }

    const store = readStore();
    let prods = store.products.filter((p) => !p.isDeleted);
    if (params?.activeOnly || params?.status === "active") {
      prods = prods.filter((p) => p.isActive !== false);
    }
    if (params?.status === "inactive") {
      prods = prods.filter((p) => p.isActive === false);
    }
    if (params?.category) {
      prods = prods.filter((p) => p.categoryName === params.category);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      prods = prods.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.hsnCode && String(p.hsnCode).toLowerCase().includes(q)) ||
          (p.barcode && String(p.barcode).includes(q))
      );
    }
    if (params?.status === "low_stock") {
      prods = prods.filter((p) => Number(p.availableQuantity) <= Number(p.minStockAlert ?? 5));
    }
    return prods;
  },

  async getProductById(id: string) {
    if (await checkMongoConnection()) {
      return await Product.findById(id).lean();
    }
    const store = readStore();
    return store.products.find((p) => String(p._id) === String(id)) || null;
  },

  async createProduct(data: any, user: { userId?: string; userName?: string }) {
    const cleanSku = String(data.sku).trim().toUpperCase();

    if (await checkMongoConnection()) {
      const existing = await Product.findOne({ sku: cleanSku });
      if (existing && !existing.isDeleted) {
        throw new Error(`A product with SKU "${cleanSku}" already exists.`);
      }

      return await runInMongoTransaction(async (session) => {
        // Ensure category exists
        if (data.categoryName) {
          await Category.findOneAndUpdate(
            { name: data.categoryName.trim() },
            { $setOnInsert: { name: data.categoryName.trim(), isActive: true } },
            { upsert: true, session }
          );
        }

        const [created] = await Product.create(
          [
            {
              ...data,
              sku: cleanSku,
              availableQuantity: Math.max(0, Number(data.availableQuantity || 0)),
              isDeleted: false,
            },
          ],
          { session }
        );

        if (created.availableQuantity > 0) {
          await StockMovement.create(
            [
              {
                productId: created._id,
                productName: created.name,
                sku: created.sku,
                type: "stock_in",
                quantity: created.availableQuantity,
                previousQuantity: 0,
                newQuantity: created.availableQuantity,
                referenceType: "manual",
                reason: "Opening stock on product creation",
                unitCost: created.purchasePrice,
                performedBy: user,
              },
            ],
            { session }
          );
        }

        return created.toObject();
      });
    }

    const store = readStore();
    if (store.products.some((p) => !p.isDeleted && p.sku.toUpperCase() === cleanSku)) {
      throw new Error(`A product with SKU "${cleanSku}" already exists.`);
    }

    if (
      data.categoryName &&
      !store.categories.some((c) => c.name.toLowerCase() === data.categoryName.trim().toLowerCase())
    ) {
      store.categories.push({
        _id: uid("cat"),
        name: data.categoryName.trim(),
        isActive: true,
        createdAt: new Date().toISOString(),
      });
    }

    const newProd = {
      _id: uid("prod"),
      ...data,
      sku: cleanSku,
      availableQuantity: Math.max(0, Number(data.availableQuantity || 0)),
      isActive: data.isActive !== false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.products.unshift(newProd);

    if (newProd.availableQuantity > 0) {
      store.stockMovements.unshift({
        _id: uid("mov"),
        productId: newProd._id,
        productName: newProd.name,
        sku: newProd.sku,
        type: "stock_in",
        quantity: newProd.availableQuantity,
        previousQuantity: 0,
        newQuantity: newProd.availableQuantity,
        referenceType: "manual",
        reason: "Opening stock on product creation",
        unitCost: newProd.purchasePrice,
        performedBy: user,
        createdAt: new Date().toISOString(),
      });
    }

    writeStore(store);
    return newProd;
  },

  async updateProduct(
    id: string,
    data: any,
    user: { userId?: string; userName?: string } = { userName: "Admin" }
  ) {
    if (await checkMongoConnection()) {
      return await runInMongoTransaction(async (session) => {
        const current = await Product.findById(id).session(session || null);
        if (!current) return null;

        if (data.sku) {
          const cleanSku = String(data.sku).trim().toUpperCase();
          const conflict = await Product.findOne({
            sku: cleanSku,
            _id: { $ne: current._id },
            isDeleted: false,
          }).session(session || null);
          if (conflict) {
            throw new Error(`Another active product already uses SKU "${cleanSku}".`);
          }
          data.sku = cleanSku;
        }

        const prevQty = Number(current.availableQuantity || 0);
        const hasQtyUpdate = data.availableQuantity !== undefined;
        const nextQty = hasQtyUpdate ? Math.max(0, Number(data.availableQuantity)) : prevQty;

        Object.assign(current, data, { availableQuantity: nextQty });
        await current.save({ session });

        if (hasQtyUpdate && nextQty !== prevQty) {
          await StockMovement.create(
            [
              {
                productId: current._id,
                productName: current.name,
                sku: current.sku,
                type: "adjustment",
                quantity: nextQty - prevQty,
                previousQuantity: prevQty,
                newQuantity: nextQty,
                referenceType: "adjustment",
                reason: "Direct stock quantity update from Product Management",
                unitCost: current.purchasePrice,
                performedBy: user,
              },
            ],
            { session }
          );
        }

        return current.toObject();
      });
    }

    const store = readStore();
    const idx = store.products.findIndex((p) => String(p._id) === String(id));
    if (idx === -1) return null;

    const current = store.products[idx];
    if (data.sku) {
      const cleanSku = String(data.sku).trim().toUpperCase();
      const conflict = store.products.find(
        (p, i) => i !== idx && !p.isDeleted && p.sku.toUpperCase() === cleanSku
      );
      if (conflict) {
        throw new Error(`Another active product already uses SKU "${cleanSku}".`);
      }
      data.sku = cleanSku;
    }

    const prevQty = Number(current.availableQuantity || 0);
    const hasQtyUpdate = data.availableQuantity !== undefined;
    const nextQty = hasQtyUpdate ? Math.max(0, Number(data.availableQuantity)) : prevQty;

    store.products[idx] = {
      ...current,
      ...data,
      availableQuantity: nextQty,
      updatedAt: new Date().toISOString(),
    };

    if (hasQtyUpdate && nextQty !== prevQty) {
      store.stockMovements.unshift({
        _id: uid("mov"),
        productId: current._id,
        productName: store.products[idx].name,
        sku: store.products[idx].sku,
        type: "adjustment",
        quantity: nextQty - prevQty,
        previousQuantity: prevQty,
        newQuantity: nextQty,
        referenceType: "adjustment",
        reason: "Direct stock quantity update from Product Management",
        unitCost: store.products[idx].purchasePrice,
        performedBy: user,
        createdAt: new Date().toISOString(),
      });
    }

    writeStore(store);
    return store.products[idx];
  },

  async deleteProduct(id: string, user?: { userId?: string; userName?: string }) {
    if (await checkMongoConnection()) {
      const prod = await Product.findById(id).lean();
      if (!prod) return null;

      const invoiceCount = await Invoice.countDocuments({
        "items.productId": { $in: [id, prod._id] },
      });

      if (invoiceCount > 0) {
        const updated = await Product.findByIdAndUpdate(
          id,
          {
            isDeleted: true,
            isActive: false,
            deletedAt: new Date(),
            deletedBy: user,
          },
          { new: true }
        ).lean();
        return { product: updated, permanent: false };
      } else {
        await Product.findByIdAndDelete(id);
        return { product: prod, permanent: true };
      }
    }

    const store = readStore();
    const idx = store.products.findIndex((p) => String(p._id) === String(id));
    if (idx === -1) return null;

    const prod = store.products[idx];
    const hasInvoices = store.invoices.some((inv: any) =>
      (inv.items || []).some((it: any) => String(it.productId) === String(id))
    );

    if (hasInvoices) {
      store.products[idx].isDeleted = true;
      store.products[idx].isActive = false;
      store.products[idx].deletedAt = new Date().toISOString();
      store.products[idx].deletedBy = user;
      writeStore(store);
      return { product: store.products[idx], permanent: false };
    } else {
      store.products.splice(idx, 1);
      writeStore(store);
      return { product: prod, permanent: true };
    }
  },

  async bulkImportProducts(params: {
    fileName: string;
    fileType: "xlsx" | "xls" | "csv";
    rows: ParsedBulkRow[];
    duplicateStrategy: "skip" | "update" | "new_only";
    updateStock: boolean;
    user: { userId?: string; userName?: string };
  }) {
    const existingProducts = await this.getProducts();
    const existingSkuMap = new Map<string, any>();
    for (const p of existingProducts) {
      existingSkuMap.set(String(p.sku).toUpperCase(), p);
    }

    const validated = validateBulkRows(
      params.rows,
      new Set(Array.from(existingSkuMap.keys()))
    );

    const jobNumber = `IMP-${Date.now()}`;
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const validationErrors: Array<{
      rowNumber: number;
      sku?: string;
      productName?: string;
      errors: string[];
    }> = [];

    const validRows = validated.filter((r) => {
      if (!r.isValid) {
        failedCount++;
        validationErrors.push({
          rowNumber: r.rowNumber,
          sku: r.sku,
          productName: r.productName,
          errors: r.errors,
        });
        return false;
      }
      return true;
    });

    const BATCH_SIZE = 100;
    const usingMongo = await checkMongoConnection();

    for (let offset = 0; offset < validRows.length; offset += BATCH_SIZE) {
      const batch = validRows.slice(offset, offset + BATCH_SIZE);

      for (const row of batch) {
        const cleanSku = row.sku.toUpperCase();
        const existing = existingSkuMap.get(cleanSku);

        if (existing) {
          if (params.duplicateStrategy === "skip" || params.duplicateStrategy === "new_only") {
            skippedCount++;
            continue;
          }

          // Duplicate strategy === "update"
          const prevQty = Number(existing.availableQuantity || 0);
          const nextQty = params.updateStock ? Math.max(0, Number(row.quantity || 0)) : prevQty;

          const updatePayload: any = {
            name: row.productName,
            categoryName: row.category || "General",
            description: row.description || "",
            purchasePrice: Number(row.purchasePrice || 0),
            sellingPrice: Number(row.sellingPrice || 0),
            uom: String(row.unit || "PCS").toUpperCase(),
            hsnCode: String(row.hsnCode).trim(),
            gstRate: Number(row.gstPercentage),
            minStockAlert: Number(row.minStockLevel ?? 5),
            isActive: true,
            isDeleted: false,
          };

          if (params.updateStock) {
            updatePayload.availableQuantity = nextQty;
          }

          if (usingMongo) {
            await Product.findByIdAndUpdate(existing._id, updatePayload);
            if (params.updateStock && nextQty !== prevQty) {
              await StockMovement.create({
                productId: existing._id,
                productName: row.productName,
                sku: cleanSku,
                type: "bulk_import",
                quantity: nextQty - prevQty,
                previousQuantity: prevQty,
                newQuantity: nextQty,
                referenceType: "import",
                referenceNumber: jobNumber,
                reason: `Bulk import stock update (${params.fileName})`,
                unitCost: Number(row.purchasePrice || 0),
                performedBy: params.user,
              });
            }
          } else {
            const store = readStore();
            const pIdx = store.products.findIndex((p) => String(p._id) === String(existing._id));
            if (pIdx !== -1) {
              store.products[pIdx] = {
                ...store.products[pIdx],
                ...updatePayload,
                updatedAt: new Date().toISOString(),
              };
              if (params.updateStock && nextQty !== prevQty) {
                store.stockMovements.unshift({
                  _id: uid("mov"),
                  productId: existing._id,
                  productName: row.productName,
                  sku: cleanSku,
                  type: "bulk_import",
                  quantity: nextQty - prevQty,
                  previousQuantity: prevQty,
                  newQuantity: nextQty,
                  referenceType: "import",
                  referenceNumber: jobNumber,
                  reason: `Bulk import stock update (${params.fileName})`,
                  unitCost: Number(row.purchasePrice || 0),
                  performedBy: params.user,
                  createdAt: new Date().toISOString(),
                });
              }
            }
            writeStore(store);
          }

          updatedCount++;
        } else {
          // Brand new product
          const created = await this.createProduct(
            {
              name: row.productName,
              sku: cleanSku,
              categoryName: row.category || "General",
              description: row.description || "",
              purchasePrice: Number(row.purchasePrice || 0),
              sellingPrice: Number(row.sellingPrice || 0),
              availableQuantity: Math.max(0, Number(row.quantity || 0)),
              uom: String(row.unit || "PCS").toUpperCase(),
              hsnCode: String(row.hsnCode).trim(),
              gstRate: Number(row.gstPercentage),
              minStockAlert: Number(row.minStockLevel ?? 5),
              isActive: true,
            },
            params.user
          );
          existingSkuMap.set(cleanSku, created);
          importedCount++;
        }
      }
    }

    const jobData = {
      jobNumber,
      fileName: params.fileName,
      fileType: params.fileType,
      duplicateStrategy: params.duplicateStrategy,
      updateStock: params.updateStock,
      totalRows: params.rows.length,
      importedCount,
      updatedCount,
      skippedCount,
      failedCount,
      validationErrors,
      status: "completed" as const,
      performedBy: params.user,
      completedAt: new Date(),
    };

    if (usingMongo) {
      const savedJob = await ImportJob.create(jobData);
      return savedJob.toObject();
    }

    const store = readStore();
    const localJob = {
      _id: uid("imp"),
      ...jobData,
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    store.importJobs.unshift(localJob);
    writeStore(store);
    return localJob;
  },

  async getImportJobs(limit = 20) {
    if (await checkMongoConnection()) {
      return await ImportJob.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    }
    const store = readStore();
    return store.importJobs.slice(0, limit);
  },

  // --- 4. CATEGORIES ---
  async getCategories() {
    if (await checkMongoConnection()) {
      return await Category.find({ isActive: true }).sort({ name: 1 }).lean();
    }
    const store = readStore();
    return store.categories.filter((c) => c.isActive !== false);
  },

  async createCategory(data: any) {
    if (await checkMongoConnection()) {
      const c = await Category.findOneAndUpdate(
        { name: data.name.trim() },
        { $set: { name: data.name.trim(), description: data.description || "", isActive: true } },
        { upsert: true, new: true }
      );
      return c.toObject();
    }
    const store = readStore();
    const existing = store.categories.find(
      (c) => c.name.toLowerCase() === data.name.trim().toLowerCase()
    );
    if (existing) return existing;
    const newCat = {
      _id: uid("cat"),
      name: data.name.trim(),
      description: data.description || "",
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    store.categories.push(newCat);
    writeStore(store);
    return newCat;
  },

  // --- 5. CUSTOMERS & CUSTOMER LEDGER ---
  async getCustomers(search?: string) {
    const rawCustomers: any[] = (await checkMongoConnection())
      ? await Customer.find(
          search
            ? {
                isActive: true,
                $or: [
                  { name: { $regex: search, $options: "i" } },
                  { phone: { $regex: search, $options: "i" } },
                  { businessName: { $regex: search, $options: "i" } },
                  { gstin: { $regex: search, $options: "i" } },
                ],
              }
            : { isActive: true }
        )
          .sort({ createdAt: -1 })
          .lean()
      : (() => {
          const store = readStore();
          let list = store.customers.filter((c) => c.isActive !== false);
          if (search) {
            const q = search.toLowerCase();
            list = list.filter(
              (c) =>
                c.name.toLowerCase().includes(q) ||
                c.phone.includes(q) ||
                (c.businessName && c.businessName.toLowerCase().includes(q)) ||
                (c.gstin && c.gstin.toLowerCase().includes(q))
            );
          }
          return list;
        })();

    // Enrich with accurate real-time totals from active invoices
    const allInvoices = await this.getInvoices();
    const activeInvs = allInvoices.filter(
      (i) => !i.isDeleted && i.status !== "cancelled" && i.status !== "deleted"
    );

    return rawCustomers.map((c) => {
      const custInvs = activeInvs.filter(
        (inv) =>
          (inv.customerId && String(inv.customerId) === String(c._id)) ||
          (!inv.customerId &&
            inv.customer?.phone &&
            c.phone &&
            inv.customer.phone.trim() === c.phone.trim())
      );
      const totalPurchases = roundToTwo(
        custInvs.reduce((s, inv) => s + Number(inv.grandTotal || 0), 0)
      );
      const totalPaid = roundToTwo(
        custInvs.reduce((s, inv) => s + Number(inv.amountPaid || 0), 0)
      );
      const balance = roundToTwo(
        custInvs.reduce((s, inv) => s + Number(inv.balanceDue || 0), 0)
      );

      return {
        ...c,
        remindersEnabled: c.remindersEnabled !== false,
        totalPurchases,
        totalPaid,
        balance,
        invoicesCount: custInvs.length,
      };
    });
  },

  async getCustomerById(id: string) {
    if (await checkMongoConnection()) {
      return await Customer.findById(id).lean();
    }
    const store = readStore();
    return store.customers.find((c) => String(c._id) === String(id)) || null;
  },

  async createCustomer(data: any) {
    if (await checkMongoConnection()) {
      const c = await Customer.create({
        ...data,
        remindersEnabled: data.remindersEnabled !== false,
      });
      return c.toObject();
    }
    const store = readStore();
    const newCust = {
      _id: uid("cust"),
      balance: 0,
      totalPurchases: 0,
      totalPaid: 0,
      remindersEnabled: data.remindersEnabled !== false,
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
    const idx = store.customers.findIndex((c) => String(c._id) === String(id));
    if (idx !== -1) {
      store.customers[idx] = {
        ...store.customers[idx],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      writeStore(store);
      return store.customers[idx];
    }
    return null;
  },

  async getCustomerLedger(customerId: string) {
    const customer = await this.getCustomerById(customerId);
    if (!customer) return null;

    const allInvoices = await this.getInvoices();
    const allPayments = await this.getPayments();

    const customerInvoices = allInvoices.filter(
      (inv) =>
        !inv.isDeleted &&
        inv.status !== "cancelled" &&
        inv.status !== "deleted" &&
        ((inv.customerId && String(inv.customerId) === String(customerId)) ||
          (!inv.customerId &&
            inv.customer?.phone &&
            customer.phone &&
            inv.customer.phone.trim() === customer.phone.trim()))
    );

    const invoiceIds = new Set(customerInvoices.map((i) => String(i._id)));
    const customerPayments = allPayments
      .filter(
        (p) =>
          p.status !== "voided" &&
          (invoiceIds.has(String(p.invoiceId)) ||
            (p.customerId && String(p.customerId) === String(customerId)))
      )
      .sort(
        (a, b) =>
          new Date(a.paymentDate || a.createdAt).getTime() -
          new Date(b.paymentDate || b.createdAt).getTime()
      );

    // Build per-invoice chronological ledger (Invoice Created -> Payment 1 -> Payment 2 -> Final Payment)
    const invoiceLedgers = customerInvoices.map((inv) => {
      const invPayments = customerPayments.filter(
        (p) => String(p.invoiceId) === String(inv._id)
      );
      let runningRemaining = Number(inv.grandTotal || 0);

      const entries: Array<{
        type: "invoice" | "payment";
        label: string;
        date: string | Date;
        amount: number;
        paymentMode?: string;
        transactionRef?: string;
        remainingBalance: number;
        status: string;
      }> = [
        {
          type: "invoice",
          label: "Invoice Created",
          date: inv.invoiceDate || inv.createdAt,
          amount: 0,
          remainingBalance: runningRemaining,
          status: runningRemaining === 0 ? "paid" : "unpaid",
        },
      ];

      invPayments.forEach((p, idx) => {
        runningRemaining = roundToTwo(Math.max(0, runningRemaining - Number(p.amount || 0)));
        const isFinal = runningRemaining === 0;
        const ordinalLabels = ["First Payment", "Second Payment", "Third Payment", "Fourth Payment"];
        const label =
          isFinal && idx > 0
            ? "Final Payment"
            : isFinal && idx === 0
            ? "Full Payment"
            : ordinalLabels[idx] || `Payment #${idx + 1}`;

        entries.push({
          type: "payment",
          label,
          date: p.paymentDate || p.createdAt,
          amount: Number(p.amount || 0),
          paymentMode: p.paymentMode,
          transactionRef: p.transactionRef,
          remainingBalance: runningRemaining,
          status: runningRemaining === 0 ? "paid" : "partial",
        });
      });

      return {
        invoiceId: inv._id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        invoiceAmount: Number(inv.grandTotal || 0),
        amountPaid: Number(inv.amountPaid || 0),
        remainingBalance: Number(inv.balanceDue || 0),
        paymentStatus: inv.paymentStatus,
        entries,
      };
    });

    // Build unified chronological account statement
    const rawEvents: Array<{
      date: Date;
      entryType: "INVOICE" | "PAYMENT";
      invoiceNumber: string;
      invoiceId: string;
      invoiceAmount: number;
      paymentAmount: number;
      paymentMode?: string;
      transactionRef?: string;
      invoiceRemainingBalance: number;
      paymentStatus: string;
    }> = [];

    for (const invLedger of invoiceLedgers) {
      for (const e of invLedger.entries) {
        rawEvents.push({
          date: new Date(e.date),
          entryType: e.type === "invoice" ? "INVOICE" : "PAYMENT",
          invoiceNumber: invLedger.invoiceNumber,
          invoiceId: String(invLedger.invoiceId),
          invoiceAmount: invLedger.invoiceAmount,
          paymentAmount: e.amount,
          paymentMode: e.paymentMode,
          transactionRef: e.transactionRef,
          invoiceRemainingBalance: e.remainingBalance,
          paymentStatus: invLedger.paymentStatus,
        });
      }
    }

    rawEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

    let accountRunningBalance = 0;
    const chronologicalLedger = rawEvents.map((ev) => {
      if (ev.entryType === "INVOICE") {
        accountRunningBalance = roundToTwo(accountRunningBalance + ev.invoiceAmount);
      } else {
        accountRunningBalance = roundToTwo(Math.max(0, accountRunningBalance - ev.paymentAmount));
      }
      return {
        ...ev,
        accountBalance: accountRunningBalance,
      };
    });

    const totalPurchases = roundToTwo(
      customerInvoices.reduce((s, i) => s + Number(i.grandTotal || 0), 0)
    );
    const totalPayments = roundToTwo(
      customerInvoices.reduce((s, i) => s + Number(i.amountPaid || 0), 0)
    );
    const outstandingBalance = roundToTwo(
      customerInvoices.reduce((s, i) => s + Number(i.balanceDue || 0), 0)
    );

    return {
      customer: {
        ...customer,
        remindersEnabled: customer.remindersEnabled !== false,
      },
      summary: {
        totalPurchases,
        totalPayments,
        outstandingBalance,
        invoicesCount: customerInvoices.length,
        paymentsCount: customerPayments.length,
      },
      invoices: customerInvoices,
      payments: customerPayments.slice().reverse(),
      invoiceLedgers,
      chronologicalLedger,
    };
  },

  // --- 6. INVENTORY & STOCK MOVEMENTS ---
  async adjustStock(params: {
    productId: string;
    type: "stock_in" | "stock_out" | "adjustment" | "purchase" | "return";
    quantity: number;
    reason: string;
    unitCost?: number;
    user: { userId?: string; userName?: string };
  }) {
    const signedDelta =
      params.type === "stock_out"
        ? -Math.abs(Number(params.quantity))
        : params.type === "stock_in" || params.type === "purchase" || params.type === "return"
        ? Math.abs(Number(params.quantity))
        : Number(params.quantity);

    if (signedDelta === 0) {
      throw new Error("Stock quantity change cannot be zero.");
    }

    if (await checkMongoConnection()) {
      return await runInMongoTransaction(async (session) => {
        const prod = await Product.findById(params.productId).session(session || null);
        if (!prod) throw new Error("Product not found");

        const prev = Number(prod.availableQuantity || 0);
        const next = prev + signedDelta;
        if (next < 0) {
          throw new Error(
            `Insufficient stock for "${prod.name}". Available: ${prev} ${prod.uom}, Requested deduction: ${Math.abs(signedDelta)}`
          );
        }

        prod.availableQuantity = next;
        await prod.save({ session });

        const [mov] = await StockMovement.create(
          [
            {
              productId: prod._id,
              productName: prod.name,
              sku: prod.sku,
              type: params.type,
              quantity: signedDelta,
              previousQuantity: prev,
              newQuantity: next,
              referenceType: "adjustment",
              reason: params.reason,
              unitCost: params.unitCost ?? prod.purchasePrice,
              performedBy: params.user,
            },
          ],
          { session }
        );

        return { product: prod.toObject(), movement: mov.toObject() };
      });
    }

    const store = readStore();
    const pIdx = store.products.findIndex((p) => String(p._id) === String(params.productId));
    if (pIdx === -1) throw new Error("Product not found");

    const prod = store.products[pIdx];
    const prev = Number(prod.availableQuantity || 0);
    const next = prev + signedDelta;
    if (next < 0) {
      throw new Error(
        `Insufficient stock for "${prod.name}". Available: ${prev} ${prod.uom}, Requested deduction: ${Math.abs(signedDelta)}`
      );
    }

    prod.availableQuantity = next;
    prod.updatedAt = new Date().toISOString();

    const mov = {
      _id: uid("mov"),
      productId: prod._id,
      productName: prod.name,
      sku: prod.sku,
      type: params.type,
      quantity: signedDelta,
      previousQuantity: prev,
      newQuantity: next,
      referenceType: "adjustment",
      reason: params.reason,
      unitCost: params.unitCost ?? prod.purchasePrice,
      performedBy: params.user,
      createdAt: new Date().toISOString(),
    };

    store.stockMovements.unshift(mov);
    writeStore(store);
    return { product: prod, movement: mov };
  },

  async getStockMovements(productId?: string, limit = 200) {
    if (await checkMongoConnection()) {
      const query: any = {};
      if (productId) query.productId = productId;
      return await StockMovement.find(query).sort({ createdAt: -1 }).limit(limit).lean();
    }
    const store = readStore();
    let movs = store.stockMovements;
    if (productId) movs = movs.filter((m) => String(m.productId) === String(productId));
    return movs.slice(0, limit);
  },

  // --- 7. PURCHASES ---
  async createPurchase(data: any, user: { userId?: string; userName?: string }) {
    if (await checkMongoConnection()) {
      return await runInMongoTransaction(async (session) => {
        const [purchase] = await Purchase.create(
          [
            {
              ...data,
              createdBy: user,
            },
          ],
          { session }
        );

        for (const item of data.items) {
          const prod = await Product.findById(item.productId).session(session || null);
          if (prod) {
            const prev = Number(prod.availableQuantity || 0);
            const next = prev + Number(item.quantity);
            prod.availableQuantity = next;
            if (Number(item.purchasePrice) > 0) prod.purchasePrice = Number(item.purchasePrice);
            await prod.save({ session });

            await StockMovement.create(
              [
                {
                  productId: prod._id,
                  productName: prod.name,
                  sku: prod.sku,
                  type: "purchase",
                  quantity: Number(item.quantity),
                  previousQuantity: prev,
                  newQuantity: next,
                  referenceType: "purchase",
                  referenceNumber: purchase.purchaseNumber,
                  reason: `Purchase intake from ${data.supplierName}`,
                  unitCost: Number(item.purchasePrice),
                  performedBy: user,
                },
              ],
              { session }
            );
          }
        }

        return purchase.toObject();
      });
    }

    const store = readStore();
    const purchase = {
      _id: uid("purch"),
      ...data,
      createdBy: user,
      createdAt: new Date().toISOString(),
    };
    store.purchases.unshift(purchase);

    for (const item of data.items) {
      const pIdx = store.products.findIndex((p) => String(p._id) === String(item.productId));
      if (pIdx !== -1) {
        const prod = store.products[pIdx];
        const prev = Number(prod.availableQuantity || 0);
        const next = prev + Number(item.quantity);
        prod.availableQuantity = next;
        if (Number(item.purchasePrice) > 0) prod.purchasePrice = Number(item.purchasePrice);

        store.stockMovements.unshift({
          _id: uid("mov"),
          productId: prod._id,
          productName: prod.name,
          sku: prod.sku,
          type: "purchase",
          quantity: Number(item.quantity),
          previousQuantity: prev,
          newQuantity: next,
          referenceType: "purchase",
          referenceNumber: purchase.purchaseNumber,
          reason: `Purchase intake from ${data.supplierName}`,
          unitCost: Number(item.purchasePrice),
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

  // --- 8. GST BILLING & INVOICE MANAGEMENT (CREATE, EDIT, CANCEL, SOFT DELETE) ---
  async createInvoice(payload: {
    customerId?: string;
    saveNewCustomer?: boolean;
    customerData: any;
    items: Array<{
      productId: string;
      quantity: number;
      rate: number;
      discount?: number;
      discountPercent?: number;
    }>;
    dueDate?: string;
    paymentMode?: "cash" | "upi" | "bank_transfer" | "card" | "credit" | "other";
    amountPaid?: number;
    notes?: string;
    user: { userId?: string; userName?: string };
  }) {
    const settings = await this.getSettings();

    // Optionally register new customer
    let resolvedCustomerId =
      payload.customerId && payload.customerId !== "NEW" ? payload.customerId : undefined;

    if ((!resolvedCustomerId && payload.saveNewCustomer) || payload.customerId === "NEW") {
      const createdCust = await this.createCustomer({
        name: payload.customerData.name,
        businessName: payload.customerData.businessName || "",
        phone: payload.customerData.phone,
        email: payload.customerData.email || "",
        billingAddress: payload.customerData.billingAddress,
        shippingAddress:
          payload.customerData.shippingAddress || payload.customerData.billingAddress,
        gstin: payload.customerData.gstin || "",
        state: payload.customerData.state,
        stateCode: payload.customerData.stateCode,
        customerType: payload.customerData.gstin ? "registered" : "unregistered",
      });
      resolvedCustomerId = String(createdCust._id);
    }

    // Validate stock for all products (aggregating duplicate product lines safely!)
    const requestedByProd = new Map<string, number>();
    for (const item of payload.items) {
      if (Number(item.quantity) <= 0) throw new Error("Item quantity must be positive.");
      requestedByProd.set(
        item.productId,
        (requestedByProd.get(item.productId) || 0) + Number(item.quantity)
      );
    }

    const productsMap = new Map<string, any>();
    for (const [productId, totalReqQty] of requestedByProd.entries()) {
      const prod = await this.getProductById(productId);
      if (!prod || prod.isDeleted) throw new Error(`Product ${productId} not found`);
      if (prod.availableQuantity < totalReqQty) {
        throw new Error(
          `Insufficient stock for "${prod.name}". Available: ${prod.availableQuantity} ${prod.uom}, Requested: ${totalReqQty}`
        );
      }
      productsMap.set(productId, prod);
    }

    const sellerStateCode = settings.stateCode || "10";
    const customerStateCode = payload.customerData.stateCode || sellerStateCode;

    const preparedItems = payload.items.map((it) => {
      const prod = productsMap.get(it.productId);
      return {
        rate: Number(it.rate),
        quantity: Number(it.quantity),
        discount: Number(it.discount || 0),
        discountPercent: Number(it.discountPercent || 0),
        gstRate: Number(prod.gstRate ?? 0),
      };
    });

    const taxCalculation = calculateInvoiceTaxes(preparedItems, sellerStateCode, customerStateCode);

    const snapshotItems = payload.items.map((it, idx) => {
      const prod = productsMap.get(it.productId);
      const calc = taxCalculation.items[idx];
      return {
        productId: prod._id,
        productName: prod.name,
        sku: prod.sku,
        hsnCode: prod.hsnCode,
        uom: prod.uom,
        rate: Number(it.rate),
        purchasePrice: Number(prod.purchasePrice || 0),
        quantity: Number(it.quantity),
        discount: calc.discountAmount,
        discountPercent: Number(it.discountPercent || 0),
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
    const initialPaid = roundToTwo(Math.min(Math.max(0, Number(payload.amountPaid || 0)), grandTotal));
    const balanceDue = roundToTwo(Math.max(0, grandTotal - initialPaid));

    const invoiceDate = new Date();
    const defaultDueDays = Number(settings.defaultDueDays ?? 5);
    const dueDate = payload.dueDate
      ? new Date(payload.dueDate)
      : new Date(invoiceDate.getTime() + defaultDueDays * 24 * 3600 * 1000);

    const isPastDue = balanceDue > 0 && dueDate.getTime() < new Date().setHours(0, 0, 0, 0);
    const paymentStatus =
      balanceDue === 0
        ? "paid"
        : isPastDue
        ? "overdue"
        : initialPaid > 0
        ? "partial"
        : "unpaid";

    const reminderCfg = buildDefaultReminderSettings(settings.reminderSettings);
    const intervalDays: 3 | 4 = reminderCfg.intervalDays === 3 ? 3 : 4;

    if (await checkMongoConnection()) {
      return await runInMongoTransaction(async (session) => {
        // Atomic sequence increment for collision-free unique invoice numbers
        const updatedSettings = await BusinessSettings.findOneAndUpdate(
          {},
          { $inc: { currentInvoiceSequence: 1 } },
          { new: true, upsert: true, session }
        );
        const nextSeq = updatedSettings.currentInvoiceSequence || 1;
        const padLen = nextSeq < 100 ? 2 : 4;
        const invoiceNumber = `${settings.invoicePrefix || "KE/26-27/"}${String(nextSeq).padStart(padLen, "0")}`;

        const initialPayId = uid("pay");
        const paymentsSubdoc =
          initialPaid > 0
            ? [
                {
                  paymentId: initialPayId,
                  amount: initialPaid,
                  paymentMode: payload.paymentMode || "cash",
                  paymentDate: invoiceDate,
                  notes: "Initial payment received at billing",
                },
              ]
            : [];

        const [inv] = await Invoice.create(
          [
            {
              invoiceNumber,
              invoiceDate,
              dueDate,
              customerId: resolvedCustomerId,
              customer: {
                name: payload.customerData.name,
                businessName: payload.customerData.businessName || "",
                phone: payload.customerData.phone,
                email: payload.customerData.email || "",
                billingAddress: payload.customerData.billingAddress,
                shippingAddress:
                  payload.customerData.shippingAddress || payload.customerData.billingAddress,
                gstin: payload.customerData.gstin || "",
                state: payload.customerData.state,
                stateCode: customerStateCode,
                customerType: payload.customerData.gstin ? "registered" : "unregistered",
              },
              seller: {
                businessName: settings.businessName || "Kyra Enterprises",
                logoUrl: settings.logoUrl || "/logo.jpeg",
                gstin: settings.gstin || "",
                address: settings.address || "",
                city: settings.city || "",
                state: settings.state || "Bihar",
                stateCode: sellerStateCode,
                pincode: settings.pincode || "",
                phone: settings.phone || "",
                email: settings.email || "",
                bankDetails: settings.bankDetails || {},
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
              amountPaid: initialPaid,
              balanceDue,
              payments: paymentsSubdoc,
              notes: payload.notes || "",
              termsAndConditions: settings.invoiceTerms || "",
              status: "finalized",
              revisionNumber: 1,
              isDeleted: false,
              createdBy: payload.user,
            },
          ],
          { session }
        );

        // Deduct stock atomically
        for (const [productId, totalReqQty] of requestedByProd.entries()) {
          const prod = await Product.findById(productId).session(session || null);
          if (!prod || prod.availableQuantity < totalReqQty) {
            throw new Error(`Concurrent stock conflict on "${prod?.name || productId}"`);
          }
          const prev = prod.availableQuantity;
          const next = prev - totalReqQty;
          prod.availableQuantity = next;
          await prod.save({ session });

          await StockMovement.create(
            [
              {
                productId: prod._id,
                productName: prod.name,
                sku: prod.sku,
                type: "sale",
                quantity: -totalReqQty,
                previousQuantity: prev,
                newQuantity: next,
                referenceType: "invoice",
                referenceId: String(inv._id),
                referenceNumber: invoiceNumber,
                reason: `GST Invoice #${invoiceNumber}`,
                performedBy: payload.user,
              },
            ],
            { session }
          );
        }

        // Independent Payment document
        if (initialPaid > 0) {
          await Payment.create(
            [
              {
                invoiceId: inv._id,
                invoiceNumber,
                customerId: resolvedCustomerId,
                customerName: payload.customerData.name,
                amount: initialPaid,
                invoiceTotalSnapshot: grandTotal,
                balanceAfterPayment: balanceDue,
                paymentMode: payload.paymentMode || "cash",
                paymentDate: invoiceDate,
                notes: "Initial payment received at billing",
                recordedBy: payload.user,
              },
            ],
            { session }
          );
        }

        if (resolvedCustomerId) {
          await Customer.findByIdAndUpdate(
            resolvedCustomerId,
            {
              $inc: {
                balance: balanceDue,
                totalPurchases: grandTotal,
                totalPaid: initialPaid,
              },
            },
            { session }
          );
        }

        // Schedule recurring PaymentReminder if unpaid/partial
        if (balanceDue > 0) {
          const startAnchor = reminderCfg.reminderStartDate
            ? new Date(Math.max(dueDate.getTime(), new Date(reminderCfg.reminderStartDate).getTime()))
            : dueDate;
          await PaymentReminder.create(
            [
              {
                invoiceId: inv._id,
                invoiceNumber,
                customerId: resolvedCustomerId,
                customerName: payload.customerData.name,
                customerPhone: payload.customerData.phone || "",
                customerEmail: payload.customerData.email || "",
                status: reminderCfg.enabled ? "active" : "paused",
                intervalDays,
                startDate: invoiceDate,
                dueDate,
                nextReminderDate: startAnchor,
                reminderCount: 0,
                invoiceTotal: grandTotal,
                amountPaid: initialPaid,
                remainingBalance: balanceDue,
                channels: reminderCfg.channels,
              },
            ],
            { session }
          );
        }

        return inv.toObject();
      });
    }

    // Resilient Local Store Execution
    const store = readStore();
    const nextSeq = (store.settings.currentInvoiceSequence || 10) + 1;
    store.settings.currentInvoiceSequence = nextSeq;
    const padLen = nextSeq < 100 ? 2 : 4;
    const invoiceNumber = `${settings.invoicePrefix || "KE/26-27/"}${String(nextSeq).padStart(padLen, "0")}`;

    const invId = uid("inv");
    const payId = uid("pay");

    const inv = {
      _id: invId,
      invoiceNumber,
      invoiceDate: invoiceDate.toISOString(),
      dueDate: dueDate.toISOString(),
      customerId: resolvedCustomerId,
      customer: {
        name: payload.customerData.name,
        businessName: payload.customerData.businessName || "",
        phone: payload.customerData.phone,
        email: payload.customerData.email || "",
        billingAddress: payload.customerData.billingAddress,
        shippingAddress:
          payload.customerData.shippingAddress || payload.customerData.billingAddress,
        gstin: payload.customerData.gstin || "",
        state: payload.customerData.state,
        stateCode: customerStateCode,
        customerType: payload.customerData.gstin ? "registered" : "unregistered",
      },
      seller: {
        businessName: settings.businessName || "Kyra Enterprises",
        logoUrl: settings.logoUrl || "/logo.jpeg",
        gstin: settings.gstin || "",
        address: settings.address || "",
        city: settings.city || "",
        state: settings.state || "Bihar",
        stateCode: sellerStateCode,
        pincode: settings.pincode || "",
        phone: settings.phone || "",
        email: settings.email || "",
        bankDetails: settings.bankDetails || {},
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
      amountPaid: initialPaid,
      balanceDue,
      payments:
        initialPaid > 0
          ? [
              {
                paymentId: payId,
                amount: initialPaid,
                paymentMode: payload.paymentMode || "cash",
                paymentDate: invoiceDate.toISOString(),
                notes: "Initial payment received at billing",
              },
            ]
          : [],
      notes: payload.notes || "",
      termsAndConditions: settings.invoiceTerms || "",
      status: "finalized",
      revisionNumber: 1,
      isDeleted: false,
      createdBy: payload.user,
      createdAt: invoiceDate.toISOString(),
      updatedAt: invoiceDate.toISOString(),
    };

    store.invoices.unshift(inv);

    for (const [productId, totalReqQty] of requestedByProd.entries()) {
      const pIdx = store.products.findIndex((p) => String(p._id) === String(productId));
      if (pIdx !== -1) {
        const prod = store.products[pIdx];
        const prev = Number(prod.availableQuantity || 0);
        const next = Math.max(0, prev - totalReqQty);
        prod.availableQuantity = next;

        store.stockMovements.unshift({
          _id: uid("mov"),
          productId: prod._id,
          productName: prod.name,
          sku: prod.sku,
          type: "sale",
          quantity: -totalReqQty,
          previousQuantity: prev,
          newQuantity: next,
          referenceType: "invoice",
          referenceId: invId,
          referenceNumber: invoiceNumber,
          reason: `GST Invoice #${invoiceNumber}`,
          performedBy: payload.user,
          createdAt: invoiceDate.toISOString(),
        });
      }
    }

    if (initialPaid > 0) {
      store.payments.unshift({
        _id: payId,
        invoiceId: invId,
        invoiceNumber,
        customerId: resolvedCustomerId,
        customerName: payload.customerData.name,
        amount: initialPaid,
        invoiceTotalSnapshot: grandTotal,
        balanceAfterPayment: balanceDue,
        paymentMode: payload.paymentMode || "cash",
        status: "completed",
        paymentDate: invoiceDate.toISOString(),
        notes: "Initial payment received at billing",
        recordedBy: payload.user,
        createdAt: invoiceDate.toISOString(),
      });
    }

    if (resolvedCustomerId) {
      const cIdx = store.customers.findIndex((c) => String(c._id) === String(resolvedCustomerId));
      if (cIdx !== -1) {
        store.customers[cIdx].balance = roundToTwo(
          Number(store.customers[cIdx].balance || 0) + balanceDue
        );
        store.customers[cIdx].totalPurchases = roundToTwo(
          Number(store.customers[cIdx].totalPurchases || 0) + grandTotal
        );
        store.customers[cIdx].totalPaid = roundToTwo(
          Number(store.customers[cIdx].totalPaid || 0) + initialPaid
        );
      }
    }

    if (balanceDue > 0) {
      const startAnchor = reminderCfg.reminderStartDate
        ? new Date(Math.max(dueDate.getTime(), new Date(reminderCfg.reminderStartDate).getTime()))
        : dueDate;
      store.paymentReminders.unshift({
        _id: uid("rem"),
        invoiceId: invId,
        invoiceNumber,
        customerId: resolvedCustomerId,
        customerName: payload.customerData.name,
        customerPhone: payload.customerData.phone || "",
        customerEmail: payload.customerData.email || "",
        status: reminderCfg.enabled ? "active" : "paused",
        intervalDays,
        startDate: invoiceDate.toISOString(),
        dueDate: dueDate.toISOString(),
        nextReminderDate: startAnchor.toISOString(),
        reminderCount: 0,
        invoiceTotal: grandTotal,
        amountPaid: initialPaid,
        remainingBalance: balanceDue,
        channels: reminderCfg.channels,
        createdAt: invoiceDate.toISOString(),
        updatedAt: invoiceDate.toISOString(),
      });
    }

    writeStore(store);
    return inv;
  },

  async getInvoices(params?: {
    search?: string;
    status?: string;
    paymentStatus?: string;
    includeDeleted?: boolean;
  }) {
    const now = new Date();
    let list: any[] = [];

    if (await checkMongoConnection()) {
      const query: any = {};
      if (!params?.includeDeleted) {
        query.isDeleted = { $ne: true };
      }
      if (params?.status) query.status = params.status;
      if (params?.search) {
        query.$or = [
          { invoiceNumber: { $regex: params.search, $options: "i" } },
          { "customer.name": { $regex: params.search, $options: "i" } },
          { "customer.phone": { $regex: params.search, $options: "i" } },
        ];
      }
      list = await Invoice.find(query).sort({ createdAt: -1 }).lean();
    } else {
      const store = readStore();
      list = store.invoices.slice();
      if (!params?.includeDeleted) {
        list = list.filter((i) => !i.isDeleted);
      }
      if (params?.status) {
        list = list.filter((i) => i.status === params.status);
      }
      if (params?.search) {
        const q = params.search.toLowerCase();
        list = list.filter(
          (i) =>
            i.invoiceNumber.toLowerCase().includes(q) ||
            (i.customer?.name && i.customer.name.toLowerCase().includes(q)) ||
            (i.customer?.phone && i.customer.phone.includes(q))
        );
      }
    }

    const normalized = list.map((i) => normalizeInvoiceStatus(i, now));
    if (params?.paymentStatus) {
      return normalized.filter((i) => i.paymentStatus === params.paymentStatus);
    }
    return normalized;
  },

  async getInvoiceById(id: string) {
    const now = new Date();
    if (await checkMongoConnection()) {
      const inv = await Invoice.findById(id).lean();
      return inv ? normalizeInvoiceStatus(inv, now) : null;
    }
    const store = readStore();
    const inv = store.invoices.find(
      (i) => String(i._id) === String(id) || i.invoiceNumber === id
    );
    return inv ? normalizeInvoiceStatus(inv, now) : null;
  },

  async getInvoiceRevisions(invoiceId: string) {
    if (await checkMongoConnection()) {
      return await InvoiceRevision.find({ invoiceId }).sort({ revisionNumber: -1 }).lean();
    }
    const store = readStore();
    return store.invoiceRevisions
      .filter((r) => String(r.invoiceId) === String(invoiceId))
      .sort((a, b) => (b.revisionNumber || 0) - (a.revisionNumber || 0));
  },

  async editInvoice(
    id: string,
    payload: {
      customerData: any;
      items: Array<{
        productId: string;
        quantity: number;
        rate: number;
        discount?: number;
        discountPercent?: number;
      }>;
      dueDate?: string;
      notes?: string;
      amendmentReason: string;
      user: { userId?: string; userName?: string; role?: string };
    }
  ) {
    const existing = await this.getInvoiceById(id);
    if (!existing) throw new Error("Invoice not found");
    if (existing.isDeleted || existing.status === "deleted") {
      throw new Error("Deleted invoices cannot be edited.");
    }
    if (existing.status === "cancelled") {
      throw new Error("Cancelled invoices cannot be edited.");
    }

    const settings = await this.getSettings();
    const sellerStateCode = existing.seller?.stateCode || settings.stateCode || "10";
    const customerStateCode = payload.customerData.stateCode || sellerStateCode;

    // Compute old vs new quantities per productId
    const oldQtyMap = new Map<string, number>();
    for (const oldIt of existing.items || []) {
      const pid = String(oldIt.productId);
      oldQtyMap.set(pid, (oldQtyMap.get(pid) || 0) + Number(oldIt.quantity || 0));
    }

    const newQtyMap = new Map<string, number>();
    for (const newIt of payload.items) {
      const pid = String(newIt.productId);
      newQtyMap.set(pid, (newQtyMap.get(pid) || 0) + Number(newIt.quantity || 0));
    }

    const allInvolvedProductIds = new Set([
      ...Array.from(oldQtyMap.keys()),
      ...Array.from(newQtyMap.keys()),
    ]);

    const productsMap = new Map<string, any>();
    const stockAdjustments: Array<{
      productId: string;
      productName: string;
      sku: string;
      deltaQuantity: number;
    }> = [];

    for (const pid of allInvolvedProductIds) {
      const prod = await this.getProductById(pid);
      if (!prod) throw new Error(`Referenced product ${pid} not found`);
      productsMap.set(pid, prod);

      const oldQ = oldQtyMap.get(pid) || 0;
      const newQ = newQtyMap.get(pid) || 0;
      const stockDelta = oldQ - newQ; // positive = return to stock, negative = deduct more from stock

      if (stockDelta < 0 && Number(prod.availableQuantity || 0) < Math.abs(stockDelta)) {
        throw new Error(
          `Insufficient stock to increase "${prod.name}". Available: ${prod.availableQuantity}, Additional needed: ${Math.abs(stockDelta)}`
        );
      }

      if (stockDelta !== 0) {
        stockAdjustments.push({
          productId: pid,
          productName: prod.name,
          sku: prod.sku,
          deltaQuantity: stockDelta,
        });
      }
    }

    // Recalculate GST on server
    const preparedItems = payload.items.map((it) => {
      const prod = productsMap.get(String(it.productId));
      return {
        rate: Number(it.rate),
        quantity: Number(it.quantity),
        discount: Number(it.discount || 0),
        discountPercent: Number(it.discountPercent || 0),
        gstRate: Number(prod.gstRate ?? 0),
      };
    });

    const taxCalc = calculateInvoiceTaxes(preparedItems, sellerStateCode, customerStateCode);
    const snapshotItems = payload.items.map((it, idx) => {
      const prod = productsMap.get(String(it.productId));
      const calc = taxCalc.items[idx];
      return {
        productId: prod._id,
        productName: prod.name,
        sku: prod.sku,
        hsnCode: prod.hsnCode,
        uom: prod.uom,
        rate: Number(it.rate),
        purchasePrice: Number(prod.purchasePrice || 0),
        quantity: Number(it.quantity),
        discount: calc.discountAmount,
        discountPercent: Number(it.discountPercent || 0),
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

    // Reliable amountPaid from independent Payment records
    const allPayments = await this.getPayments({ invoiceId: String(existing._id) });
    const verifiedPaid = roundToTwo(
      allPayments
        .filter((p) => p.status !== "voided")
        .reduce((s, p) => s + Number(p.amount || 0), 0)
    );

    const newGrandTotal = taxCalc.summary.grandTotal;
    if (newGrandTotal < verifiedPaid) {
      throw new Error(
        `Amended invoice total (₹${newGrandTotal}) cannot be lower than payments already received (₹${verifiedPaid}).`
      );
    }

    const newBalanceDue = roundToTwo(Math.max(0, newGrandTotal - verifiedPaid));
    const oldBalanceDue = Number(existing.balanceDue || 0);
    const balanceDelta = roundToTwo(newBalanceDue - oldBalanceDue);
    const dueDate = payload.dueDate ? new Date(payload.dueDate) : new Date(existing.dueDate || Date.now());
    const isPastDue = newBalanceDue > 0 && dueDate.getTime() < new Date().setHours(0, 0, 0, 0);
    const newPaymentStatus =
      newBalanceDue === 0
        ? "paid"
        : isPastDue
        ? "overdue"
        : verifiedPaid > 0
        ? "partial"
        : "unpaid";

    const nextRevisionNumber = Number(existing.revisionNumber || 1) + 1;
    const previousSnapshot = JSON.parse(JSON.stringify(existing));

    const updatedFields = {
      dueDate,
      customer: {
        name: payload.customerData.name,
        businessName: payload.customerData.businessName || "",
        phone: payload.customerData.phone,
        email: payload.customerData.email || "",
        billingAddress: payload.customerData.billingAddress,
        shippingAddress:
          payload.customerData.shippingAddress || payload.customerData.billingAddress,
        gstin: payload.customerData.gstin || "",
        state: payload.customerData.state,
        stateCode: customerStateCode,
        customerType: payload.customerData.gstin ? "registered" : "unregistered",
      },
      items: snapshotItems,
      taxableAmount: taxCalc.summary.taxableAmount,
      totalDiscount: taxCalc.summary.totalDiscount,
      totalCgst: taxCalc.summary.totalCgst,
      totalSgst: taxCalc.summary.totalSgst,
      totalIgst: taxCalc.summary.totalIgst,
      totalTax: taxCalc.summary.totalTax,
      roundOff: taxCalc.summary.roundOff,
      grandTotal: newGrandTotal,
      amountInWords: numberToWordsINR(newGrandTotal),
      isInterState: taxCalc.summary.isInterState,
      amountPaid: verifiedPaid,
      balanceDue: newBalanceDue,
      paymentStatus: newPaymentStatus,
      notes: payload.notes ?? existing.notes ?? "",
      status: "amended" as const,
      revisionNumber: nextRevisionNumber,
      lastEditedAt: new Date(),
      lastEditedBy: {
        userId: payload.user.userId,
        userName: payload.user.userName,
      },
      amendmentNotes: payload.amendmentReason,
    };

    if (await checkMongoConnection()) {
      return await runInMongoTransaction(async (session) => {
        const updatedInv = await Invoice.findByIdAndUpdate(
          id,
          { $set: updatedFields },
          { new: true, session }
        ).lean();

        await InvoiceRevision.create(
          [
            {
              invoiceId: existing._id,
              invoiceNumber: existing.invoiceNumber,
              revisionNumber: nextRevisionNumber,
              changeType: "amendment",
              reason: payload.amendmentReason,
              previousSnapshot,
              newSnapshot: updatedInv as any,
              stockAdjustments,
              balanceDelta,
              changedBy: payload.user,
            },
          ],
          { session }
        );

        for (const adj of stockAdjustments) {
          const prod = await Product.findById(adj.productId).session(session || null);
          if (prod) {
            const prev = prod.availableQuantity;
            const next = prev + adj.deltaQuantity;
            if (next < 0) throw new Error(`Stock underflow on ${prod.name}`);
            prod.availableQuantity = next;
            await prod.save({ session });

            await StockMovement.create(
              [
                {
                  productId: prod._id,
                  productName: prod.name,
                  sku: prod.sku,
                  type: "invoice_edit",
                  quantity: adj.deltaQuantity,
                  previousQuantity: prev,
                  newQuantity: next,
                  referenceType: "invoice",
                  referenceId: String(existing._id),
                  referenceNumber: existing.invoiceNumber,
                  reason: `Invoice #${existing.invoiceNumber} amended: ${payload.amendmentReason}`,
                  performedBy: payload.user,
                },
              ],
              { session }
            );
          }
        }

        if (existing.customerId && balanceDelta !== 0) {
          await Customer.findByIdAndUpdate(
            existing.customerId,
            {
              $inc: {
                balance: balanceDelta,
                totalPurchases: roundToTwo(newGrandTotal - Number(existing.grandTotal || 0)),
              },
            },
            { session }
          );
        }

        // Sync PaymentReminder schedule
        if (newBalanceDue === 0) {
          await PaymentReminder.findOneAndUpdate(
            { invoiceId: existing._id },
            {
              $set: {
                status: "completed",
                invoiceTotal: newGrandTotal,
                amountPaid: verifiedPaid,
                remainingBalance: 0,
                completedAt: new Date(),
                stoppedReason: "Balance settled after invoice amendment",
              },
            },
            { session }
          );
        } else {
          const reminderCfg = buildDefaultReminderSettings(settings.reminderSettings);
          await PaymentReminder.findOneAndUpdate(
            { invoiceId: existing._id },
            {
              $set: {
                customerName: payload.customerData.name,
                customerPhone: payload.customerData.phone || "",
                customerEmail: payload.customerData.email || "",
                dueDate,
                invoiceTotal: newGrandTotal,
                amountPaid: verifiedPaid,
                remainingBalance: newBalanceDue,
                status: reminderCfg.enabled ? "active" : "paused",
              },
              $setOnInsert: {
                invoiceNumber: existing.invoiceNumber,
                customerId: existing.customerId,
                intervalDays: reminderCfg.intervalDays,
                startDate: new Date(),
                nextReminderDate: dueDate,
                reminderCount: 0,
                channels: reminderCfg.channels,
              },
            },
            { upsert: true, session }
          );
        }

        return normalizeInvoiceStatus(updatedInv);
      });
    }

    // Local Store Execution
    const store = readStore();
    const invIdx = store.invoices.findIndex((i) => String(i._id) === String(id));
    if (invIdx === -1) throw new Error("Invoice not found");

    const updatedLocal = {
      ...store.invoices[invIdx],
      ...updatedFields,
      dueDate: dueDate.toISOString(),
      lastEditedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.invoices[invIdx] = updatedLocal;

    store.invoiceRevisions.unshift({
      _id: uid("rev"),
      invoiceId: existing._id,
      invoiceNumber: existing.invoiceNumber,
      revisionNumber: nextRevisionNumber,
      changeType: "amendment",
      reason: payload.amendmentReason,
      previousSnapshot,
      newSnapshot: updatedLocal,
      stockAdjustments,
      balanceDelta,
      changedBy: payload.user,
      createdAt: new Date().toISOString(),
    });

    for (const adj of stockAdjustments) {
      const pIdx = store.products.findIndex((p) => String(p._id) === String(adj.productId));
      if (pIdx !== -1) {
        const prod = store.products[pIdx];
        const prev = Number(prod.availableQuantity || 0);
        const next = Math.max(0, prev + adj.deltaQuantity);
        prod.availableQuantity = next;

        store.stockMovements.unshift({
          _id: uid("mov"),
          productId: prod._id,
          productName: prod.name,
          sku: prod.sku,
          type: "invoice_edit",
          quantity: adj.deltaQuantity,
          previousQuantity: prev,
          newQuantity: next,
          referenceType: "invoice",
          referenceId: String(existing._id),
          referenceNumber: existing.invoiceNumber,
          reason: `Invoice #${existing.invoiceNumber} amended: ${payload.amendmentReason}`,
          performedBy: payload.user,
          createdAt: new Date().toISOString(),
        });
      }
    }

    const rIdx = store.paymentReminders.findIndex(
      (r) => String(r.invoiceId) === String(existing._id)
    );
    if (newBalanceDue === 0) {
      if (rIdx !== -1) {
        store.paymentReminders[rIdx] = {
          ...store.paymentReminders[rIdx],
          status: "completed",
          invoiceTotal: newGrandTotal,
          amountPaid: verifiedPaid,
          remainingBalance: 0,
          completedAt: new Date().toISOString(),
          stoppedReason: "Balance settled after invoice amendment",
        };
      }
    } else if (rIdx !== -1) {
      store.paymentReminders[rIdx] = {
        ...store.paymentReminders[rIdx],
        customerName: payload.customerData.name,
        customerPhone: payload.customerData.phone || "",
        customerEmail: payload.customerData.email || "",
        dueDate: dueDate.toISOString(),
        invoiceTotal: newGrandTotal,
        amountPaid: verifiedPaid,
        remainingBalance: newBalanceDue,
        status: "active",
      };
    }

    writeStore(store);
    return normalizeInvoiceStatus(updatedLocal);
  },

  async cancelInvoice(id: string, reason: string, user: { userId?: string; userName?: string; role?: string }) {
    if (await checkMongoConnection()) {
      return await runInMongoTransaction(async (session) => {
        const inv = await Invoice.findById(id).session(session || null);
        if (!inv) throw new Error("Invoice not found");
        if (inv.status === "cancelled" || inv.isDeleted) {
          throw new Error("Invoice is already cancelled or deleted");
        }

        const previousSnapshot = inv.toObject();
        const nextRev = (inv.revisionNumber || 1) + 1;

        inv.status = "cancelled";
        inv.cancellationReason = reason;
        inv.cancelledAt = new Date();
        inv.cancelledBy = { userId: user.userId, userName: user.userName } as any;
        inv.revisionNumber = nextRev;
        await inv.save({ session });

        await InvoiceRevision.create(
          [
            {
              invoiceId: inv._id,
              invoiceNumber: inv.invoiceNumber,
              revisionNumber: nextRev,
              changeType: "cancel",
              reason,
              previousSnapshot: previousSnapshot as any,
              changedBy: user,
            },
          ],
          { session }
        );

        for (const it of inv.items) {
          const prod = await Product.findById(it.productId).session(session || null);
          if (prod) {
            const prev = prod.availableQuantity;
            const next = prev + it.quantity;
            prod.availableQuantity = next;
            await prod.save({ session });

            await StockMovement.create(
              [
                {
                  productId: prod._id,
                  productName: prod.name,
                  sku: prod.sku,
                  type: "cancellation_reversal",
                  quantity: it.quantity,
                  previousQuantity: prev,
                  newQuantity: next,
                  referenceType: "invoice",
                  referenceId: String(inv._id),
                  referenceNumber: inv.invoiceNumber,
                  reason: `Stock restored from cancelled invoice #${inv.invoiceNumber}: ${reason}`,
                  performedBy: user,
                },
              ],
              { session }
            );
          }
        }

        if (inv.customerId && inv.balanceDue > 0) {
          await Customer.findByIdAndUpdate(
            inv.customerId,
            { $inc: { balance: -inv.balanceDue } },
            { session }
          );
        }

        await PaymentReminder.findOneAndUpdate(
          { invoiceId: inv._id },
          {
            $set: {
              status: "cancelled",
              stoppedReason: `Invoice cancelled: ${reason}`,
              completedAt: new Date(),
            },
          },
          { session }
        );

        return inv.toObject();
      });
    }

    const store = readStore();
    const idx = store.invoices.findIndex((i) => String(i._id) === String(id));
    if (idx === -1) throw new Error("Invoice not found");
    const inv = store.invoices[idx];
    if (inv.status === "cancelled" || inv.isDeleted) {
      throw new Error("Invoice is already cancelled or deleted");
    }

    const previousSnapshot = JSON.parse(JSON.stringify(inv));
    const nextRev = (inv.revisionNumber || 1) + 1;
    inv.status = "cancelled";
    inv.cancellationReason = reason;
    inv.cancelledAt = new Date().toISOString();
    inv.cancelledBy = user;
    inv.revisionNumber = nextRev;

    store.invoiceRevisions.unshift({
      _id: uid("rev"),
      invoiceId: inv._id,
      invoiceNumber: inv.invoiceNumber,
      revisionNumber: nextRev,
      changeType: "cancel",
      reason,
      previousSnapshot,
      changedBy: user,
      createdAt: new Date().toISOString(),
    });

    for (const it of inv.items) {
      const pIdx = store.products.findIndex((p) => String(p._id) === String(it.productId));
      if (pIdx !== -1) {
        const prod = store.products[pIdx];
        const prev = Number(prod.availableQuantity || 0);
        const next = prev + Number(it.quantity || 0);
        prod.availableQuantity = next;

        store.stockMovements.unshift({
          _id: uid("mov"),
          productId: prod._id,
          productName: prod.name,
          sku: prod.sku,
          type: "cancellation_reversal",
          quantity: Number(it.quantity),
          previousQuantity: prev,
          newQuantity: next,
          referenceType: "invoice",
          referenceId: String(inv._id),
          referenceNumber: inv.invoiceNumber,
          reason: `Stock restored from cancelled invoice #${inv.invoiceNumber}: ${reason}`,
          performedBy: user,
          createdAt: new Date().toISOString(),
        });
      }
    }

    const rIdx = store.paymentReminders.findIndex((r) => String(r.invoiceId) === String(inv._id));
    if (rIdx !== -1) {
      store.paymentReminders[rIdx].status = "cancelled";
      store.paymentReminders[rIdx].stoppedReason = `Invoice cancelled: ${reason}`;
    }

    writeStore(store);
    return inv;
  },

  async softDeleteInvoice(
    id: string,
    reason: string,
    user: { userId?: string; userName?: string; role?: string }
  ) {
    if (await checkMongoConnection()) {
      return await runInMongoTransaction(async (session) => {
        const inv = await Invoice.findById(id).session(session || null);
        if (!inv) throw new Error("Invoice not found");
        if (inv.isDeleted) throw new Error("Invoice is already soft-deleted");

        const wasActive = inv.status !== "cancelled" && inv.status !== "deleted";
        const previousSnapshot = inv.toObject();
        const nextRev = (inv.revisionNumber || 1) + 1;

        inv.isDeleted = true;
        inv.status = "deleted";
        inv.deletedBy = user;
        inv.deletedAt = new Date();
        inv.deletionReason = reason;
        inv.previousInvoiceData = previousSnapshot as any;
        inv.revisionNumber = nextRev;
        await inv.save({ session });

        await InvoiceRevision.create(
          [
            {
              invoiceId: inv._id,
              invoiceNumber: inv.invoiceNumber,
              revisionNumber: nextRev,
              changeType: "soft_delete",
              reason,
              previousSnapshot: previousSnapshot as any,
              changedBy: user,
            },
          ],
          { session }
        );

        if (wasActive) {
          for (const it of inv.items) {
            const prod = await Product.findById(it.productId).session(session || null);
            if (prod) {
              const prev = prod.availableQuantity;
              const next = prev + it.quantity;
              prod.availableQuantity = next;
              await prod.save({ session });

              await StockMovement.create(
                [
                  {
                    productId: prod._id,
                    productName: prod.name,
                    sku: prod.sku,
                    type: "deletion_reversal",
                    quantity: it.quantity,
                    previousQuantity: prev,
                    newQuantity: next,
                    referenceType: "invoice",
                    referenceId: String(inv._id),
                    referenceNumber: inv.invoiceNumber,
                    reason: `Stock restored on soft-delete of invoice #${inv.invoiceNumber}: ${reason}`,
                    performedBy: user,
                  },
                ],
                { session }
              );
            }
          }

          if (inv.customerId && inv.balanceDue > 0) {
            await Customer.findByIdAndUpdate(
              inv.customerId,
              { $inc: { balance: -inv.balanceDue } },
              { session }
            );
          }
        }

        await PaymentReminder.findOneAndUpdate(
          { invoiceId: inv._id },
          {
            $set: {
              status: "cancelled",
              stoppedReason: `Invoice soft-deleted: ${reason}`,
              completedAt: new Date(),
            },
          },
          { session }
        );

        return inv.toObject();
      });
    }

    const store = readStore();
    const idx = store.invoices.findIndex((i) => String(i._id) === String(id));
    if (idx === -1) throw new Error("Invoice not found");
    const inv = store.invoices[idx];
    if (inv.isDeleted) throw new Error("Invoice is already soft-deleted");

    const wasActive = inv.status !== "cancelled" && inv.status !== "deleted";
    const previousSnapshot = JSON.parse(JSON.stringify(inv));
    const nextRev = (inv.revisionNumber || 1) + 1;

    inv.isDeleted = true;
    inv.status = "deleted";
    inv.deletedBy = user;
    inv.deletedAt = new Date().toISOString();
    inv.deletionReason = reason;
    inv.previousInvoiceData = previousSnapshot;
    inv.revisionNumber = nextRev;

    store.invoiceRevisions.unshift({
      _id: uid("rev"),
      invoiceId: inv._id,
      invoiceNumber: inv.invoiceNumber,
      revisionNumber: nextRev,
      changeType: "soft_delete",
      reason,
      previousSnapshot,
      changedBy: user,
      createdAt: new Date().toISOString(),
    });

    if (wasActive) {
      for (const it of inv.items) {
        const pIdx = store.products.findIndex((p) => String(p._id) === String(it.productId));
        if (pIdx !== -1) {
          const prod = store.products[pIdx];
          const prev = Number(prod.availableQuantity || 0);
          const next = prev + Number(it.quantity || 0);
          prod.availableQuantity = next;

          store.stockMovements.unshift({
            _id: uid("mov"),
            productId: prod._id,
            productName: prod.name,
            sku: prod.sku,
            type: "deletion_reversal",
            quantity: Number(it.quantity),
            previousQuantity: prev,
            newQuantity: next,
            referenceType: "invoice",
            referenceId: String(inv._id),
            referenceNumber: inv.invoiceNumber,
            reason: `Stock restored on soft-delete of invoice #${inv.invoiceNumber}: ${reason}`,
            performedBy: user,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    const rIdx = store.paymentReminders.findIndex((r) => String(r.invoiceId) === String(inv._id));
    if (rIdx !== -1) {
      store.paymentReminders[rIdx].status = "cancelled";
      store.paymentReminders[rIdx].stoppedReason = `Invoice soft-deleted: ${reason}`;
    }

    writeStore(store);
    return inv;
  },

  // --- 9. PAYMENTS (MULTI-MODE, PARTIAL PAYMENTS, IDEMPOTENCY & REMINDER COMPLETION) ---
  async recordPayment(payload: {
    invoiceId: string;
    amount: number;
    paymentMode: "cash" | "upi" | "bank_transfer" | "card" | "credit" | "other";
    transactionRef?: string;
    paymentDate?: string;
    notes?: string;
    idempotencyKey?: string;
    user: { userId?: string; userName?: string };
  }) {
    const payDate = payload.paymentDate ? new Date(payload.paymentDate) : new Date();
    const cleanAmount = roundToTwo(Number(payload.amount));
    if (cleanAmount <= 0) throw new Error("Payment amount must be greater than zero.");

    if (await checkMongoConnection()) {
      // Idempotency check before starting transaction
      if (payload.idempotencyKey) {
        const duplicate = await Payment.findOne({ idempotencyKey: payload.idempotencyKey }).lean();
        if (duplicate) {
          const inv = await Invoice.findById(duplicate.invoiceId).lean();
          return { payment: duplicate, invoice: normalizeInvoiceStatus(inv), idempotentReplay: true };
        }
      }

      return await runInMongoTransaction(async (session) => {
        const inv = await Invoice.findById(payload.invoiceId).session(session || null);
        if (!inv) throw new Error("Invoice not found");
        if (inv.isDeleted || inv.status === "cancelled" || inv.status === "deleted") {
          throw new Error("Cannot record payment against a cancelled or deleted invoice");
        }

        // Compute current paid strictly from independent Payment records
        const priorPayments = await Payment.find({
          invoiceId: inv._id,
          status: { $ne: "voided" },
        }).session(session || null);

        const priorPaid = roundToTwo(
          priorPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
        );
        const currentRemaining = roundToTwo(Math.max(0, inv.grandTotal - priorPaid));

        if (currentRemaining <= 0) {
          throw new Error(`Invoice #${inv.invoiceNumber} is already fully paid.`);
        }
        if (cleanAmount > currentRemaining + 0.01) {
          throw new Error(
            `Payment amount (₹${cleanAmount}) exceeds remaining balance (₹${currentRemaining}).`
          );
        }

        const effectiveAmount = Math.min(cleanAmount, currentRemaining);
        const newTotalPaid = roundToTwo(priorPaid + effectiveAmount);
        const newRemaining = roundToTwo(Math.max(0, inv.grandTotal - newTotalPaid));

        const [payment] = await Payment.create(
          [
            {
              invoiceId: inv._id,
              invoiceNumber: inv.invoiceNumber,
              customerId: inv.customerId,
              customerName: inv.customer.name,
              amount: effectiveAmount,
              invoiceTotalSnapshot: inv.grandTotal,
              balanceAfterPayment: newRemaining,
              paymentMode: payload.paymentMode,
              transactionRef: payload.transactionRef,
              idempotencyKey: payload.idempotencyKey || undefined,
              status: "completed",
              paymentDate: payDate,
              notes: payload.notes,
              recordedBy: payload.user,
            },
          ],
          { session }
        );

        const isPastDue =
          newRemaining > 0 &&
          inv.dueDate &&
          new Date(inv.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);

        inv.amountPaid = newTotalPaid;
        inv.balanceDue = newRemaining;
        inv.paymentStatus =
          newRemaining === 0 ? "paid" : isPastDue ? "overdue" : "partial";
        inv.payments.push({
          paymentId: payment._id.toString(),
          amount: effectiveAmount,
          paymentMode: payload.paymentMode,
          transactionRef: payload.transactionRef,
          paymentDate: payDate,
          notes: payload.notes,
        });
        await inv.save({ session });

        if (inv.customerId) {
          await Customer.findByIdAndUpdate(
            inv.customerId,
            {
              $inc: {
                balance: -effectiveAmount,
                totalPaid: effectiveAmount,
              },
            },
            { session }
          );
        }

        // Update or Complete PaymentReminder immediately!
        if (newRemaining === 0) {
          await PaymentReminder.findOneAndUpdate(
            { invoiceId: inv._id },
            {
              $set: {
                status: "completed",
                amountPaid: newTotalPaid,
                remainingBalance: 0,
                completedAt: new Date(),
                stoppedReason: "Full payment received — balance is ₹0",
              },
            },
            { session }
          );
        } else {
          await PaymentReminder.findOneAndUpdate(
            { invoiceId: inv._id },
            {
              $set: {
                amountPaid: newTotalPaid,
                remainingBalance: newRemaining,
              },
            },
            { session }
          );
        }

        return {
          payment: payment.toObject(),
          invoice: normalizeInvoiceStatus(inv.toObject()),
        };
      });
    }

    // Local Store Execution
    const store = readStore();
    if (payload.idempotencyKey) {
      const dup = store.payments.find((p) => p.idempotencyKey === payload.idempotencyKey);
      if (dup) {
        const inv = store.invoices.find((i) => String(i._id) === String(dup.invoiceId));
        return { payment: dup, invoice: normalizeInvoiceStatus(inv), idempotentReplay: true };
      }
    }

    const idx = store.invoices.findIndex((i) => String(i._id) === String(payload.invoiceId));
    if (idx === -1) throw new Error("Invoice not found");
    const inv = store.invoices[idx];
    if (inv.isDeleted || inv.status === "cancelled" || inv.status === "deleted") {
      throw new Error("Cannot record payment against a cancelled or deleted invoice");
    }

    const priorPayments = store.payments.filter(
      (p) => String(p.invoiceId) === String(inv._id) && p.status !== "voided"
    );
    const priorPaid = roundToTwo(
      priorPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
    );
    const currentRemaining = roundToTwo(Math.max(0, Number(inv.grandTotal || 0) - priorPaid));

    if (currentRemaining <= 0) {
      throw new Error(`Invoice #${inv.invoiceNumber} is already fully paid.`);
    }
    if (cleanAmount > currentRemaining + 0.01) {
      throw new Error(
        `Payment amount (₹${cleanAmount}) exceeds remaining balance (₹${currentRemaining}).`
      );
    }

    const effectiveAmount = Math.min(cleanAmount, currentRemaining);
    const newTotalPaid = roundToTwo(priorPaid + effectiveAmount);
    const newRemaining = roundToTwo(Math.max(0, Number(inv.grandTotal || 0) - newTotalPaid));

    const payment = {
      _id: uid("pay"),
      invoiceId: inv._id,
      invoiceNumber: inv.invoiceNumber,
      customerId: inv.customerId,
      customerName: inv.customer.name,
      amount: effectiveAmount,
      invoiceTotalSnapshot: inv.grandTotal,
      balanceAfterPayment: newRemaining,
      paymentMode: payload.paymentMode,
      transactionRef: payload.transactionRef,
      idempotencyKey: payload.idempotencyKey || undefined,
      status: "completed",
      paymentDate: payDate.toISOString(),
      notes: payload.notes,
      recordedBy: payload.user,
      createdAt: new Date().toISOString(),
    };
    store.payments.unshift(payment);

    inv.amountPaid = newTotalPaid;
    inv.balanceDue = newRemaining;
    inv.paymentStatus = newRemaining === 0 ? "paid" : "partial";
    inv.payments = Array.isArray(inv.payments) ? inv.payments : [];
    inv.payments.push({
      paymentId: payment._id,
      amount: effectiveAmount,
      paymentMode: payload.paymentMode,
      transactionRef: payload.transactionRef,
      paymentDate: payDate.toISOString(),
      notes: payload.notes,
    });

    if (inv.customerId) {
      const cIdx = store.customers.findIndex((c) => String(c._id) === String(inv.customerId));
      if (cIdx !== -1) {
        store.customers[cIdx].balance = roundToTwo(
          Math.max(0, Number(store.customers[cIdx].balance || 0) - effectiveAmount)
        );
        store.customers[cIdx].totalPaid = roundToTwo(
          Number(store.customers[cIdx].totalPaid || 0) + effectiveAmount
        );
      }
    }

    const rIdx = store.paymentReminders.findIndex((r) => String(r.invoiceId) === String(inv._id));
    if (newRemaining === 0) {
      if (rIdx !== -1) {
        store.paymentReminders[rIdx] = {
          ...store.paymentReminders[rIdx],
          status: "completed",
          amountPaid: newTotalPaid,
          remainingBalance: 0,
          completedAt: new Date().toISOString(),
          stoppedReason: "Full payment received — balance is ₹0",
        };
      }
    } else if (rIdx !== -1) {
      store.paymentReminders[rIdx] = {
        ...store.paymentReminders[rIdx],
        amountPaid: newTotalPaid,
        remainingBalance: newRemaining,
      };
    }

    writeStore(store);
    return { payment, invoice: normalizeInvoiceStatus(inv) };
  },

  async getPayments(params?: { invoiceId?: string; customerId?: string }) {
    if (await checkMongoConnection()) {
      const query: any = { status: { $ne: "voided" } };
      if (params?.invoiceId) query.invoiceId = params.invoiceId;
      if (params?.customerId) query.customerId = params.customerId;
      return await Payment.find(query).sort({ paymentDate: -1, createdAt: -1 }).lean();
    }
    const store = readStore();
    let list = store.payments.filter((p) => p.status !== "voided");
    if (params?.invoiceId) {
      list = list.filter((p) => String(p.invoiceId) === String(params.invoiceId));
    }
    if (params?.customerId) {
      list = list.filter((p) => String(p.customerId) === String(params.customerId));
    }
    return list;
  },

  // --- 10. AUTOMATIC PAYMENT REMINDER SYSTEM ---
  async syncReminderSchedulesWithInvoices() {
    const settings = await this.getSettings();
    const reminderCfg = buildDefaultReminderSettings(settings.reminderSettings);
    const intervalDays: 3 | 4 = reminderCfg.intervalDays === 3 ? 3 : 4;

    const allInvoices = await this.getInvoices();
    const allPayments = await this.getPayments();
    const usingMongo = await checkMongoConnection();

    for (const inv of allInvoices) {
      const invPayments = allPayments.filter(
        (p) => String(p.invoiceId) === String(inv._id) && p.status !== "voided"
      );
      const truePaid = roundToTwo(
        invPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
      );
      // Fallback if seed invoices had amountPaid without standalone Payment row
      const effectivePaid = invPayments.length > 0 ? truePaid : Number(inv.amountPaid || 0);
      const trueRemaining = roundToTwo(Math.max(0, Number(inv.grandTotal || 0) - effectivePaid));

      const isStopped = inv.isDeleted || inv.status === "cancelled" || inv.status === "deleted";

      if (usingMongo) {
        const existingRem = await PaymentReminder.findOne({ invoiceId: inv._id });
        if (isStopped) {
          if (existingRem && existingRem.status !== "cancelled") {
            existingRem.status = "cancelled";
            existingRem.stoppedReason = "Invoice cancelled or deleted";
            await existingRem.save();
          }
          continue;
        }

        if (trueRemaining <= 0) {
          if (existingRem && existingRem.status !== "completed") {
            existingRem.status = "completed";
            existingRem.amountPaid = effectivePaid;
            existingRem.remainingBalance = 0;
            existingRem.completedAt = new Date();
            existingRem.stoppedReason = "Balance fully settled";
            await existingRem.save();
          }
          continue;
        }

        if (!existingRem) {
          const due = new Date(inv.dueDate || inv.invoiceDate || Date.now());
          await PaymentReminder.create({
            invoiceId: inv._id,
            invoiceNumber: inv.invoiceNumber,
            customerId: inv.customerId,
            customerName: inv.customer?.name || "Customer",
            customerPhone: inv.customer?.phone || "",
            customerEmail: inv.customer?.email || "",
            status: reminderCfg.enabled ? "active" : "paused",
            intervalDays,
            startDate: new Date(inv.invoiceDate || Date.now()),
            dueDate: due,
            nextReminderDate: due,
            reminderCount: 0,
            invoiceTotal: Number(inv.grandTotal || 0),
            amountPaid: effectivePaid,
            remainingBalance: trueRemaining,
            channels: reminderCfg.channels,
          });
        } else {
          existingRem.invoiceTotal = Number(inv.grandTotal || 0);
          existingRem.amountPaid = effectivePaid;
          existingRem.remainingBalance = trueRemaining;
          existingRem.intervalDays = intervalDays;
          await existingRem.save();
        }
      } else {
        const store = readStore();
        const rIdx = store.paymentReminders.findIndex(
          (r) => String(r.invoiceId) === String(inv._id)
        );
        if (isStopped) {
          if (rIdx !== -1 && store.paymentReminders[rIdx].status !== "cancelled") {
            store.paymentReminders[rIdx].status = "cancelled";
            store.paymentReminders[rIdx].stoppedReason = "Invoice cancelled or deleted";
          }
          continue;
        }
        if (trueRemaining <= 0) {
          if (rIdx !== -1 && store.paymentReminders[rIdx].status !== "completed") {
            store.paymentReminders[rIdx].status = "completed";
            store.paymentReminders[rIdx].amountPaid = effectivePaid;
            store.paymentReminders[rIdx].remainingBalance = 0;
            store.paymentReminders[rIdx].completedAt = new Date().toISOString();
            store.paymentReminders[rIdx].stoppedReason = "Balance fully settled";
          }
          continue;
        }
        if (rIdx === -1) {
          const due = new Date(inv.dueDate || inv.invoiceDate || Date.now());
          store.paymentReminders.unshift({
            _id: uid("rem"),
            invoiceId: inv._id,
            invoiceNumber: inv.invoiceNumber,
            customerId: inv.customerId,
            customerName: inv.customer?.name || "Customer",
            customerPhone: inv.customer?.phone || "",
            customerEmail: inv.customer?.email || "",
            status: reminderCfg.enabled ? "active" : "paused",
            intervalDays,
            startDate: inv.invoiceDate || new Date().toISOString(),
            dueDate: due.toISOString(),
            nextReminderDate: due.toISOString(),
            reminderCount: 0,
            invoiceTotal: Number(inv.grandTotal || 0),
            amountPaid: effectivePaid,
            remainingBalance: trueRemaining,
            channels: reminderCfg.channels,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } else {
          store.paymentReminders[rIdx].invoiceTotal = Number(inv.grandTotal || 0);
          store.paymentReminders[rIdx].amountPaid = effectivePaid;
          store.paymentReminders[rIdx].remainingBalance = trueRemaining;
          store.paymentReminders[rIdx].intervalDays = intervalDays;
        }
        writeStore(store);
      }
    }
  },

  async getPaymentReminders(status?: string) {
    await this.syncReminderSchedulesWithInvoices();
    if (await checkMongoConnection()) {
      const query: any = {};
      if (status) query.status = status;
      return await PaymentReminder.find(query).sort({ nextReminderDate: 1 }).lean();
    }
    const store = readStore();
    let list = store.paymentReminders.slice();
    if (status) list = list.filter((r) => r.status === status);
    return list.sort(
      (a, b) =>
        new Date(a.nextReminderDate || 0).getTime() -
        new Date(b.nextReminderDate || 0).getTime()
    );
  },

  async updateReminderSchedule(id: string, patch: { status?: "active" | "paused"; nextReminderDate?: string }) {
    if (await checkMongoConnection()) {
      return await PaymentReminder.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    }
    const store = readStore();
    const idx = store.paymentReminders.findIndex((r) => String(r._id) === String(id));
    if (idx !== -1) {
      store.paymentReminders[idx] = {
        ...store.paymentReminders[idx],
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      writeStore(store);
      return store.paymentReminders[idx];
    }
    return null;
  },

  async getPaymentReminderLogs(params?: {
    invoiceId?: string;
    channel?: string;
    unreadInAppOnly?: boolean;
    limit?: number;
  }) {
    const limit = params?.limit || 100;
    if (await checkMongoConnection()) {
      const query: any = {};
      if (params?.invoiceId) query.invoiceId = params.invoiceId;
      if (params?.channel) query.channel = params.channel;
      if (params?.unreadInAppOnly) {
        query.channel = "in_app";
        query.isRead = false;
      }
      return await PaymentReminderLog.find(query).sort({ createdAt: -1 }).limit(limit).lean();
    }
    const store = readStore();
    let list = store.paymentReminderLogs.slice();
    if (params?.invoiceId) {
      list = list.filter((l) => String(l.invoiceId) === String(params.invoiceId));
    }
    if (params?.channel) {
      list = list.filter((l) => l.channel === params.channel);
    }
    if (params?.unreadInAppOnly) {
      list = list.filter((l) => l.channel === "in_app" && !l.isRead);
    }
    return list.slice(0, limit);
  },

  async markReminderNotificationsRead(ids?: string[]) {
    if (await checkMongoConnection()) {
      const filter: any = { channel: "in_app", isRead: false };
      if (ids && ids.length > 0) filter._id = { $in: ids };
      await PaymentReminderLog.updateMany(filter, { $set: { isRead: true } });
      return true;
    }
    const store = readStore();
    for (const log of store.paymentReminderLogs) {
      if (log.channel === "in_app" && (!ids || ids.includes(String(log._id)))) {
        log.isRead = true;
      }
    }
    writeStore(store);
    return true;
  },

  /**
   * Executes the Automatic Payment Reminder cycle (scheduled cron or manual trigger).
   * Enforces all 10 business rules:
   * - Recalculates balance from verified Payment records right before sending
   * - Skips & completes schedules whose balance reached ₹0 between runs
   * - Skips cancelled/deleted invoices or customers with reminders disabled
   * - Sends ONLY current remaining balance
   * - Enforces periodKey idempotency per invoice & channel
   * - Applies controlled retry policy on transient provider failure
   */
  async runPaymentReminderCycle(options?: {
    forceInvoiceId?: string;
    triggeredBy?: "cron" | "manual" | "retry";
    nowOverride?: Date;
  }) {
    const now = options?.nowOverride || new Date();
    const triggeredBy = options?.triggeredBy || "cron";
    await this.syncReminderSchedulesWithInvoices();

    const settings = await this.getSettings();
    const reminderCfg = buildDefaultReminderSettings(settings.reminderSettings);

    if (!reminderCfg.enabled && !options?.forceInvoiceId) {
      return {
        processed: 0,
        sent: 0,
        failed: 0,
        skippedPaidOrCancelled: 0,
        skippedDuplicatePeriod: 0,
        message: "Automatic payment reminders are currently disabled in settings.",
      };
    }

    if (
      reminderCfg.reminderStartDate &&
      !options?.forceInvoiceId &&
      now.getTime() < new Date(reminderCfg.reminderStartDate).getTime()
    ) {
      return {
        processed: 0,
        sent: 0,
        failed: 0,
        skippedPaidOrCancelled: 0,
        skippedDuplicatePeriod: 0,
        message: "Reminder global start date has not arrived yet.",
      };
    }

    const schedules = await this.getPaymentReminders();
    const targetSchedules = options?.forceInvoiceId
      ? schedules.filter((s) => String(s.invoiceId) === String(options.forceInvoiceId))
      : schedules.filter(
          (s) =>
            s.status === "active" &&
            new Date(s.nextReminderDate).getTime() <= now.getTime()
        );

    let processed = 0;
    let sent = 0;
    let failed = 0;
    let skippedPaidOrCancelled = 0;
    let skippedDuplicatePeriod = 0;
    const usingMongo = await checkMongoConnection();

    for (const sched of targetSchedules) {
      processed++;
      const inv = await this.getInvoiceById(String(sched.invoiceId));

      // Rule 8 & 9: Stop immediately if cancelled, deleted, or missing
      if (!inv || inv.isDeleted || inv.status === "cancelled" || inv.status === "deleted") {
        skippedPaidOrCancelled++;
        if (usingMongo) {
          await PaymentReminder.findByIdAndUpdate(sched._id, {
            $set: { status: "cancelled", stoppedReason: "Invoice cancelled or deleted" },
          });
        } else {
          const store = readStore();
          const idx = store.paymentReminders.findIndex((r) => String(r._id) === String(sched._id));
          if (idx !== -1) store.paymentReminders[idx].status = "cancelled";
          writeStore(store);
        }
        continue;
      }

      // Check customer-level reminder opt-out
      if (inv.customerId) {
        const cust = await this.getCustomerById(String(inv.customerId));
        if (cust && cust.remindersEnabled === false && !options?.forceInvoiceId) {
          continue;
        }
      }

      // Rule 5 & 8: Recalculate outstanding balance from independent Payment records right before sending!
      const invPayments = await this.getPayments({ invoiceId: String(inv._id) });
      const verifiedPaid =
        invPayments.length > 0
          ? roundToTwo(invPayments.reduce((s, p) => s + Number(p.amount || 0), 0))
          : roundToTwo(Number(inv.amountPaid || 0));
      const remainingBalance = roundToTwo(Math.max(0, Number(inv.grandTotal || 0) - verifiedPaid));

      if (remainingBalance <= 0) {
        // Invoice was settled between scheduled executions -> mark Paid & Completed, send nothing!
        skippedPaidOrCancelled++;
        if (usingMongo) {
          await Invoice.findByIdAndUpdate(inv._id, {
            $set: { paymentStatus: "paid", amountPaid: verifiedPaid, balanceDue: 0 },
          });
          await PaymentReminder.findByIdAndUpdate(sched._id, {
            $set: {
              status: "completed",
              amountPaid: verifiedPaid,
              remainingBalance: 0,
              completedAt: now,
              stoppedReason: "Balance verified ₹0 prior to reminder execution",
            },
          });
        } else {
          const store = readStore();
          const iIdx = store.invoices.findIndex((x) => String(x._id) === String(inv._id));
          if (iIdx !== -1) {
            store.invoices[iIdx].paymentStatus = "paid";
            store.invoices[iIdx].amountPaid = verifiedPaid;
            store.invoices[iIdx].balanceDue = 0;
          }
          const rIdx = store.paymentReminders.findIndex((r) => String(r._id) === String(sched._id));
          if (rIdx !== -1) {
            store.paymentReminders[rIdx].status = "completed";
            store.paymentReminders[rIdx].amountPaid = verifiedPaid;
            store.paymentReminders[rIdx].remainingBalance = 0;
            store.paymentReminders[rIdx].completedAt = now.toISOString();
          }
          writeStore(store);
        }
        continue;
      }

      const intervalDays: 3 | 4 = reminderCfg.intervalDays === 3 ? 3 : 4;
      const periodKey = options?.forceInvoiceId
        ? `manual_${now.toISOString().slice(0, 16)}_${sched.reminderCount || 0}`
        : computeReminderPeriodKey(sched.startDate || inv.invoiceDate, intervalDays, now);

      const templateCtx = {
        customerName: inv.customer?.name || sched.customerName,
        invoiceNumber: inv.invoiceNumber,
        invoiceAmount: Number(inv.grandTotal || 0),
        amountPaid: verifiedPaid,
        remainingBalance,
        dueDate: inv.dueDate,
        enterpriseName: settings.businessName || "Kyra Enterprises",
      };

      const { subject, body } = buildReminderContent(
        reminderCfg.subjectTemplate,
        reminderCfg.messageTemplate,
        templateCtx
      );

      const channels: Array<"email" | "whatsapp" | "sms" | "in_app"> =
        Array.isArray(reminderCfg.channels) && reminderCfg.channels.length > 0
          ? reminderCfg.channels
          : ["in_app"];

      let anyChannelSentOrProcessed = false;
      let anyChannelTransientFailure = false;

      for (const channel of channels) {
        // Rule 10: Prevent duplicate reminders for the same invoice, channel, and periodKey
        const existingLogs = await this.getPaymentReminderLogs({
          invoiceId: String(inv._id),
          channel,
          limit: 50,
        });
        const duplicateForPeriod = existingLogs.find(
          (l) => l.periodKey === periodKey && l.deliveryStatus === "sent"
        );
        if (duplicateForPeriod) {
          skippedDuplicatePeriod++;
          continue;
        }

        const recipient =
          channel === "email"
            ? inv.customer?.email || sched.customerEmail || ""
            : channel === "whatsapp" || channel === "sms"
            ? inv.customer?.phone || sched.customerPhone || ""
            : "Kyra Enterprises Workspace";

        const dispatchRes = await dispatchReminderChannel({
          channel,
          recipientEmail: inv.customer?.email || sched.customerEmail,
          recipientPhone: inv.customer?.phone || sched.customerPhone,
          subject,
          body,
          context: templateCtx,
          providers: reminderCfg.providers,
        });

        anyChannelSentOrProcessed = true;
        if (dispatchRes.status === "sent") {
          sent++;
        } else {
          failed++;
          if (dispatchRes.status === "failed") {
            anyChannelTransientFailure = true;
          }
        }

        const priorFailedLog = existingLogs.find((l) => l.periodKey === periodKey);
        const retryCount = priorFailedLog ? Number(priorFailedLog.retryCount || 0) + 1 : 0;
        const canRetry =
          dispatchRes.status === "failed" && retryCount < Number(reminderCfg.maxRetries ?? 3);

        const logPayload = {
          reminderId: sched._id,
          invoiceId: inv._id,
          invoiceNumber: inv.invoiceNumber,
          customerId: inv.customerId,
          customerName: templateCtx.customerName,
          channel,
          recipient,
          periodKey,
          invoiceAmount: templateCtx.invoiceAmount,
          amountPaid: verifiedPaid,
          remainingBalance,
          subject,
          messageBody: body,
          deliveryStatus: canRetry ? ("retrying" as const) : dispatchRes.status,
          providerResponse: dispatchRes.providerResponse,
          errorMessage: dispatchRes.errorMessage,
          retryCount,
          maxRetries: Number(reminderCfg.maxRetries ?? 3),
          nextRetryAt: canRetry
            ? new Date(now.getTime() + Number(reminderCfg.retryDelayMinutes ?? 60) * 60 * 1000)
            : undefined,
          isRead: false,
          triggeredBy,
        };

        if (usingMongo) {
          await PaymentReminderLog.findOneAndUpdate(
            { invoiceId: inv._id, channel, periodKey },
            { $set: logPayload },
            { upsert: true, new: true }
          );
        } else {
          const store = readStore();
          const lIdx = store.paymentReminderLogs.findIndex(
            (l) =>
              String(l.invoiceId) === String(inv._id) &&
              l.channel === channel &&
              l.periodKey === periodKey
          );
          if (lIdx !== -1) {
            store.paymentReminderLogs[lIdx] = {
              ...store.paymentReminderLogs[lIdx],
              ...logPayload,
              updatedAt: now.toISOString(),
            };
          } else {
            store.paymentReminderLogs.unshift({
              _id: uid("rlog"),
              ...logPayload,
              nextRetryAt: logPayload.nextRetryAt?.toISOString(),
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            });
          }
          writeStore(store);
        }
      }

      if (anyChannelSentOrProcessed) {
        const nextDate = anyChannelTransientFailure
          ? new Date(now.getTime() + Number(reminderCfg.retryDelayMinutes ?? 60) * 60 * 1000)
          : new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

        if (usingMongo) {
          await PaymentReminder.findByIdAndUpdate(sched._id, {
            $set: {
              lastReminderSentAt: now,
              nextReminderDate: nextDate,
              lastPeriodKey: periodKey,
              intervalDays,
              invoiceTotal: templateCtx.invoiceAmount,
              amountPaid: verifiedPaid,
              remainingBalance,
            },
            $inc: { reminderCount: 1 },
          });
        } else {
          const store = readStore();
          const rIdx = store.paymentReminders.findIndex((r) => String(r._id) === String(sched._id));
          if (rIdx !== -1) {
            store.paymentReminders[rIdx] = {
              ...store.paymentReminders[rIdx],
              lastReminderSentAt: now.toISOString(),
              nextReminderDate: nextDate.toISOString(),
              lastPeriodKey: periodKey,
              intervalDays,
              invoiceTotal: templateCtx.invoiceAmount,
              amountPaid: verifiedPaid,
              remainingBalance,
              reminderCount: Number(store.paymentReminders[rIdx].reminderCount || 0) + 1,
              updatedAt: now.toISOString(),
            };
            writeStore(store);
          }
        }
      }
    }

    return {
      processed,
      sent,
      failed,
      skippedPaidOrCancelled,
      skippedDuplicatePeriod,
    };
  },

  // --- 11. AUDIT LOGS ---
  async createAuditLog(data: any) {
    if (await checkMongoConnection()) {
      try {
        const log = await AuditLog.create(data);
        return log.toObject();
      } catch {}
    }
    const store = readStore();
    const newLog = {
      _id: uid("audit"),
      ...data,
      createdAt: new Date().toISOString(),
    };
    store.auditLogs.unshift(newLog);
    if (store.auditLogs.length > 500) store.auditLogs.pop();
    writeStore(store);
    return newLog;
  },

  async getAuditLogs(limit = 150) {
    if (await checkMongoConnection()) {
      return await AuditLog.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    }
    const store = readStore();
    return store.auditLogs.slice(0, limit);
  },

  // --- 12. DASHBOARD & COMPREHENSIVE REPORTS ---
  async getDashboardMetrics() {
    const [products, customers, invoices, payments] = await Promise.all([
      this.getProducts(),
      this.getCustomers(),
      this.getInvoices(),
      this.getPayments(),
    ]);
    return computeDashboardAnalytics({ products, customers, invoices, payments });
  },

  async getComprehensiveReports(params?: { startDate?: string; endDate?: string }) {
    const [invoices, payments, products, customers, purchases] = await Promise.all([
      this.getInvoices(),
      this.getPayments(),
      this.getProducts(),
      this.getCustomers(),
      this.getPurchases(),
    ]);
    return computeComprehensiveReports({
      invoices,
      payments,
      products,
      customers,
      purchases,
      startDate: params?.startDate,
      endDate: params?.endDate,
    });
  },
};
