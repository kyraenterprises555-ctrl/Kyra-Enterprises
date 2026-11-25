import mongoose from "mongoose";
import bcrypt from "bcryptjs";

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
        name: "Rajesh Sharma (Admin)",
        email: "admin@kyra.com",
        passwordHash: adminPasswordHash,
        role: "admin",
        phone: "+91 98112 34567",
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
  let catElectronicsId, catHardwareId, catOfficeId;

  if (categoriesCount === 0) {
    console.log("Seeding Categories...");
    const cat1 = await categoryColl.insertOne({
      name: "Electronics & Accessories",
      description: "Electronic devices, adapters, monitors, and peripherals",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const cat2 = await categoryColl.insertOne({
      name: "Computer Hardware",
      description: "Hard drives, SSDs, RAM, and computer components",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const cat3 = await categoryColl.insertOne({
      name: "Office Supplies & Stationeries",
      description: "Printer cartridges, paper reams, and office essentials",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    catElectronicsId = cat1.insertedId;
    catHardwareId = cat2.insertedId;
    catOfficeId = cat3.insertedId;
  }

  // 4. Products & Initial Stock Ledger
  const productColl = db.collection("products");
  const stockColl = db.collection("stockmovements");
  const productsCount = await productColl.countDocuments({});

  if (productsCount === 0) {
    console.log("Seeding Products and Stock Movements...");
    const productsData = [
      {
        name: "Dell 24-inch FHD IPS Monitor",
        sku: "KE-MON-24",
        barcode: "8901234567890",
        categoryId: catElectronicsId,
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Logitech MX Master 3S Wireless Mouse",
        sku: "KE-LOGI-MX3S",
        barcode: "8901234567891",
        categoryId: catElectronicsId,
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Samsung 980 Pro 1TB NVMe M.2 SSD",
        sku: "KE-SSD-SAM-1TB",
        barcode: "8901234567892",
        categoryId: catHardwareId,
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Crucial 16GB DDR5 4800MHz Desktop RAM",
        sku: "KE-RAM-CRU-16",
        barcode: "8901234567893",
        categoryId: catHardwareId,
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "HP LaserJet 108w Monochrome Printer",
        sku: "KE-PRN-HP-108W",
        barcode: "8901234567894",
        categoryId: catElectronicsId,
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "HP 110A Black Original Laser Toner Cartridge",
        sku: "KE-TNR-HP-110A",
        barcode: "8901234567895",
        categoryId: catOfficeId,
        categoryName: "Office Supplies & Stationeries",
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Bilt Matrix Copier Paper A4 75 GSM (Box of 5 Reams)",
        sku: "KE-PPR-A4-75",
        barcode: "8901234567896",
        categoryId: catOfficeId,
        categoryName: "Office Supplies & Stationeries",
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "APC Back-UPS 600VA / 360W Battery Backup",
        sku: "KE-UPS-APC-600",
        barcode: "8901234567897",
        categoryId: catElectronicsId,
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const insertedProducts = await productColl.insertMany(productsData);

    // Record initial stock movements
    const stockMovements = Object.keys(insertedProducts.insertedIds).map((idx) => {
      const prod = productsData[idx];
      return {
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
          userName: "Rajesh Sharma (Admin)",
        },
        createdAt: new Date(),
      };
    });

    await stockColl.insertMany(stockMovements);
  }

  // 5. Customers
  const customerColl = db.collection("customers");
  const customersCount = await customerColl.countDocuments({});

  if (customersCount === 0) {
    console.log("Seeding Customers...");
    await customerColl.insertMany([
      {
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
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
