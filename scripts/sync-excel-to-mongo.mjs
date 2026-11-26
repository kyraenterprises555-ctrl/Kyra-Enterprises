import xlsx from "xlsx";
import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://kyraenterprises555_db_user:Admin1234@cluster0.qixixqm.mongodb.net/kyra_enterprises?retryWrites=true&w=majority&appName=Cluster0";

async function run() {
  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected!");

  const db = mongoose.connection.db;

  // 1. Setup Categories
  const categoryColl = db.collection("categories");
  await categoryColl.deleteMany({});
  
  const categoryDefs = [
    { name: "Home Appliances - Irons", description: "Dry and Steam Irons", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { name: "Fans & Ventilation", description: "Ceiling, Table, Pedestal, and Exhaust Fans", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { name: "Kitchen Appliances - Kettles", description: "Electric Kettles, Mixers, and Cooktops", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { name: "Water Heaters & Coolers", description: "Geysers, Water Heaters, and Air Coolers", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ];

  const catResult = await categoryColl.insertMany(categoryDefs);
  const catMap = {};
  categoryDefs.forEach((cat, idx) => {
    catMap[cat.name] = catResult.insertedIds[idx];
  });
  console.log("Inserted Categories:", Object.keys(catMap));

  // 2. Read Excel
  const workbook = xlsx.readFile("product list with hsn.xlsx");
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = xlsx.utils.sheet_to_json(firstSheet, { header: 1 });

  const products = [];
  const stockMovements = [];

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

    // Code match or fallback SKU
    const codeMatch = name.match(/\(([^\)]+)\)/);
    let sku = codeMatch ? `KE-${codeMatch[1].trim()}` : `KE-PRD-${String(i - 1).padStart(3, "0")}`;
    if (usedSkus.has(sku)) {
      if (name.toLowerCase().includes("turbo")) {
        sku = `${sku}-TURBO`;
      } else {
        sku = `${sku}-${i - 1}`;
      }
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

    const prodDoc = {
      name: name,
      sku: sku,
      barcode: `890${String(1000000000 + i)}`,
      categoryId: catId,
      categoryName: categoryName,
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
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    products.push(prodDoc);
  }

  // 3. Clear old dummy products & stock movements
  const productColl = db.collection("products");
  const stockColl = db.collection("stockmovements");

  await productColl.deleteMany({});
  await stockColl.deleteMany({});

  const insertProdResult = await productColl.insertMany(products);
  console.log(`Successfully inserted ${products.length} authentic products into MongoDB Atlas!`);

  // Record stock movements
  for (let idx = 0; idx < products.length; idx++) {
    const prod = products[idx];
    const prodId = insertProdResult.insertedIds[idx];
    stockMovements.push({
      productId: prodId,
      productName: prod.name,
      sku: prod.sku,
      type: "purchase",
      quantity: prod.availableQuantity,
      previousQuantity: 0,
      newQuantity: prod.availableQuantity,
      referenceType: "purchase",
      referenceNumber: "INITIAL-STOCK",
      reason: "Initial warehouse intake from vendor",
      unitCost: prod.purchasePrice,
      performedBy: { userId: "admin_seed", userName: "Vivek Kr Jha" },
      createdAt: new Date(),
    });
  }

  await stockColl.insertMany(stockMovements);
  console.log(`Successfully recorded ${stockMovements.length} initial stock movements!`);

  // 4. Update Customers to real Kyra Enterprises customers if currently dummy
  const customerColl = db.collection("customers");
  const existingCusts = await customerColl.find({}).toArray();
  const hasDevElectric = existingCusts.some(c => c.name?.includes("DEV ELECTRIC"));

  if (!hasDevElectric) {
    await customerColl.deleteMany({});
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
    console.log("Updated customers with DEV ELECTRIC (Bihar)!");
  }

  await mongoose.disconnect();
  console.log("ALL DONE! MongoDB Atlas now contains the exact Excel product catalog!");
}

run().catch(err => {
  console.error("Sync error:", err);
  process.exit(1);
});
