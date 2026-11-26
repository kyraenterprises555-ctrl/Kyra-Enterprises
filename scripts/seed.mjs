import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import xlsx from "xlsx";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://kyraenterprises555_db_user:Admin1234@cluster0.qixixqm.mongodb.net/kyra_enterprises?retryWrites=true&w=majority&appName=Cluster0";

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

async function seed() {
  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected successfully!");

  const db = mongoose.connection.db;

  // 1. Business Settings
  const settingsColl = db.collection("businesssettings");
  const existingSettings = await settingsColl.findOne({});
  if (!existingSettings) {
    console.log("Seeding Business Settings...");
    await settingsColl.insertOne({
      businessName: "Kyra Enterprises",
      logoUrl: "/logo.jpeg",
      gstin: "10CPLPK1520H1ZF",
      address: "BASAITHA MADHUBANI",
      city: "Madhubani",
      state: "Bihar",
      stateCode: "10",
      pincode: "847223",
      phone: "7393931555",
      email: "ke1133569@gmail.com",
      bankDetails: {
        bankName: "Union Bank of India",
        accountHolder: "Kyra Enterprises",
        accountNumber: "195721010000113",
        ifscCode: "UBIN0919578",
        branch: "BENIPATTI BRANCH",
      },
      upiId: "QR919565590333-0113@unionbankofindia",
      invoicePrefix: "26-27/",
      currentInvoiceSequence: 10,
      invoiceTerms:
        "1. We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.\n2. Payments due within 5 days of Invoice date.\n3. In case of a product being defective or having a manufacturing defect, the primary responsibility for repairing or replacing it lies with the company.\n4. Burnt and broken will not be warrented, please check while purchasing.",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // 2. Users
  const userColl = db.collection("users");
  const existingAdmin = await userColl.findOne({ email: "admin@kyra.com" });
  if (!existingAdmin) {
    console.log("Seeding Users...");
    const adminPasswordHash = await hashPassword("Admin@123");
    const managerPasswordHash = await hashPassword("Manager@123");
    const staffPasswordHash = await hashPassword("Staff@123");

    await userColl.insertMany([
      {
        name: "Vivek Kr Jha",
        email: "admin@kyra.com",
        passwordHash: adminPasswordHash,
        role: "admin",
        phone: "+91 7393931555",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Pooja Verma (Manager)",
        email: "manager@kyra.com",
        passwordHash: managerPasswordHash,
        role: "manager",
        phone: "+91 98112 88899",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Amit Kumar (Billing Staff)",
        email: "staff@kyra.com",
        passwordHash: staffPasswordHash,
        role: "billing_staff",
        phone: "+91 98112 55544",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  }

  // 3. Categories
  const categoryColl = db.collection("categories");
  const categoriesCount = await categoryColl.countDocuments({});
  let catMap = {};

  if (categoriesCount === 0) {
    console.log("Seeding Categories...");
    const categoryDefs = [
      { name: "Home Appliances - Irons", description: "Dry and Steam Irons", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Fans & Ventilation", description: "Ceiling, Table, Pedestal, and Exhaust Fans", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Kitchen Appliances - Kettles", description: "Electric Kettles, Mixers, and Cooktops", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Water Heaters & Coolers", description: "Geysers, Water Heaters, and Air Coolers", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ];
    const catResult = await categoryColl.insertMany(categoryDefs);
    categoryDefs.forEach((cat, idx) => {
      catMap[cat.name] = catResult.insertedIds[idx];
    });
  } else {
    const existingCats = await categoryColl.find({}).toArray();
    existingCats.forEach((c) => {
      catMap[c.name] = c._id;
    });
  }

  // 4. Products & Initial Stock Ledger
  const productColl = db.collection("products");
  const stockColl = db.collection("stockmovements");
  const productsCount = await productColl.countDocuments({});

  if (productsCount === 0) {
    console.log("Seeding Products from Excel...");
    const workbook = xlsx.readFile("product list with hsn.xlsx");
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = xlsx.utils.sheet_to_json(firstSheet, { header: 1 });

    const products = [];
    const usedSkus = new Set();

    for (let i = 2; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || !row[1]) continue;

      const name = String(row[1]).trim();
      const rawHsn = row[2] ? String(row[2]).trim() : "85164000";
      const rateRaw = String(row[3] || "0").replace(/,/g, "");
      const rateInclTax = parseFloat(rateRaw) || 1000;

      const taxableRate = Math.round((rateInclTax / 1.18) * 100) / 100;
      const purchasePrice = Math.round(taxableRate * 0.8 * 100) / 100;

      const codeMatch = name.match(/\(([^\)]+)\)/);
      let sku = codeMatch ? `KE-${codeMatch[1].trim()}` : `KE-PRD-${String(i - 1).padStart(3, "0")}`;
      if (usedSkus.has(sku)) {
        sku = name.toLowerCase().includes("turbo") ? `${sku}-TURBO` : `${sku}-${i - 1}`;
      }
      usedSkus.add(sku);

      let categoryName = "Home Appliances - Irons";
      const lower = name.toLowerCase();
      if (lower.includes("fan") || lower.includes("cf") || lower.includes("farrata") || lower.includes("exhaust") || lower.includes("table")) {
        categoryName = "Fans & Ventilation";
      } else if (lower.includes("kettle") || lower.includes("mixer") || lower.includes("notch")) {
        categoryName = "Kitchen Appliances - Kettles";
      } else if (lower.includes("cooler") || lower.includes("geyser") || lower.includes("astor")) {
        categoryName = "Water Heaters & Coolers";
      }

      const catId = catMap[categoryName] || Object.values(catMap)[0];
      const qty = 25;

      products.push({
        name,
        sku,
        barcode: `890${String(1000000000 + i)}`,
        categoryId: catId,
        categoryName,
        description: name,
        uom: "PCS",
        sellingPrice: taxableRate,
        purchasePrice,
        availableQuantity: qty,
        minStockAlert: 5,
        gstRate: 18,
        hsnCode: rawHsn,
        isActive: true,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const insertedProducts = await productColl.insertMany(products);

    const stockMovements = products.map((prod, idx) => ({
      productId: insertedProducts.insertedIds[idx],
      productName: prod.name,
      sku: prod.sku,
      type: "purchase",
      quantity: prod.availableQuantity,
      previousQuantity: 0,
      newQuantity: prod.availableQuantity,
      referenceType: "purchase",
      referenceNumber: "INITIAL-STOCK",
      reason: "Initial warehouse inventory intake",
      unitCost: prod.purchasePrice,
      performedBy: {
        userId: "admin_seed",
        userName: "Vivek Kr Jha",
      },
      createdAt: new Date(),
    }));

    await stockColl.insertMany(stockMovements);
  }

  // 5. Customers
  const customerColl = db.collection("customers");
  const customersCount = await customerColl.countDocuments({});

  if (customersCount === 0) {
    console.log("Seeding Customers...");
    await customerColl.insertMany([
      {
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Apex Global Traders",
        businessName: "Apex Traders",
        phone: "+91 99110 99887",
        email: "accounts@apextraders.in",
        billingAddress: "Shop 12, Main Market, Patna, Bihar - 800001",
        shippingAddress: "Shop 12, Main Market, Patna, Bihar - 800001",
        gstin: "10AAHCA9988C1ZK",
        state: "Bihar",
        stateCode: "10",
        customerType: "registered",
        balance: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Sharma Infotech Solutions Pvt Ltd",
        businessName: "Sharma Infotech",
        phone: "+91 98223 34455",
        email: "procurement@sharmainfotech.com",
        billingAddress: "402, Skyline Towers, Sector 62, Noida, UP - 201309",
        shippingAddress: "402, Skyline Towers, Sector 62, Noida, UP - 201309",
        gstin: "09AABCS1234E1Z8",
        state: "Uttar Pradesh",
        stateCode: "09",
        customerType: "registered",
        balance: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  }

  console.log("Seeding completed successfully!");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});
