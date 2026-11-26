import assert from "node:assert/strict";
import fs from "node:fs";
import { DataService } from "../src/lib/db-store.ts";

async function runTests() {
  console.log("=== KYRA ENTERPRISES PERSISTENCE & VERIFICATION SUITE ===");

  // --- TEST 4: Existing Data Protection Baseline ---
  console.log("\n[RUNNING] Test 4: Existing Data Protection Baseline...");
  const initialProducts = await DataService.getProducts();
  const initialCustomers = await DataService.getCustomers();
  const initialInvoices = await DataService.getInvoices();
  const initialUsers = await DataService.getUsers();

  const prodCountBefore = initialProducts.length;
  const custCountBefore = initialCustomers.length;
  const invCountBefore = initialInvoices.length;

  console.log(`Baseline counts -> Products: ${prodCountBefore}, Customers: ${custCountBefore}, Invoices: ${invCountBefore}, Users: ${initialUsers.length}`);
  assert.ok(prodCountBefore > 0, "Existing products must be present");
  assert.ok(custCountBefore > 0, "Existing customers must be present");
  console.log("✓ Baseline counts verified.");

  // --- TEST 1: Product Persistence ---
  console.log("\n[RUNNING] Test 1: Product Persistence...");
  const testSku = `KE-TEST-${Date.now()}`;
  const createdProd = await DataService.createProduct(
    {
      name: "Kyra Test Persistence Product",
      sku: testSku,
      categoryName: "Electrical Appliances",
      sellingPrice: 1500,
      purchasePrice: 1100,
      availableQuantity: 50,
      minStockAlert: 10,
      gstRate: 18,
      hsnCode: "8516",
    },
    { userId: "test_admin", userName: "Admin" }
  );

  assert.ok(createdProd && createdProd._id, "Product must be created");
  assert.equal(createdProd.sku, testSku);
  assert.equal(createdProd.availableQuantity, 50);

  // Reload product from DataService
  const fetchedProd = await DataService.getProductById(String(createdProd._id));
  assert.ok(fetchedProd, "Product must persist after retrieval");
  assert.equal(fetchedProd.sku, testSku);
  assert.equal(fetchedProd.availableQuantity, 50);
  console.log("✓ Test 1: Product Persistence passed.");

  // --- TEST 2: Stock Persistence across Price & Description Edits ---
  console.log("\n[RUNNING] Test 2: Stock Persistence & Isolated Stock Management...");
  // Step 2a: Set product quantity to 100 via authorized adjustment
  const adj1 = await DataService.adjustStock({
    productId: String(createdProd._id),
    type: "adjustment",
    quantity: 50, // 50 + 50 = 100
    reason: "Authorized stock calibration to 100",
    user: { userId: "test_admin", userName: "Admin" },
  });
  assert.equal(adj1.product.availableQuantity, 100, "Quantity must now be 100");

  // Step 2b: Update selling price to 1800 (and send dummy availableQuantity: 0 to ensure it gets stripped)
  const priceUpdate = await DataService.updateProduct(
    String(createdProd._id),
    {
      sellingPrice: 1800,
      availableQuantity: 0, // This should be IGNORED by updateProduct allowlist!
    },
    { userId: "test_admin", userName: "Admin" }
  );
  assert.equal(priceUpdate.sellingPrice, 1800, "Selling price must be updated to 1800");
  assert.equal(priceUpdate.availableQuantity, 100, "Stock MUST REMAIN 100 after selling price update");

  // Step 2c: Update product description
  const descUpdate = await DataService.updateProduct(
    String(createdProd._id),
    {
      description: "Updated description for persistence verification",
      availableQuantity: 999, // This should be IGNORED by updateProduct allowlist!
    },
    { userId: "test_admin", userName: "Admin" }
  );
  assert.equal(descUpdate.description, "Updated description for persistence verification");
  assert.equal(descUpdate.availableQuantity, 100, "Stock MUST REMAIN 100 after description update");

  // Step 2d: Perform authorized stock adjustment to 120 (+20)
  const adj2 = await DataService.adjustStock({
    productId: String(createdProd._id),
    type: "stock_in",
    quantity: 20,
    reason: "Authorized stock intake to 120",
    user: { userId: "test_admin", userName: "Admin" },
  });
  assert.equal(adj2.product.availableQuantity, 120, "Quantity must now be 120");

  // Verify stock movements logged
  const movements = await DataService.getStockMovements(String(createdProd._id));
  assert.ok(movements.length >= 3, "Stock movements must be accurately logged");
  const latestMovement = movements[0];
  assert.equal(latestMovement.newQuantity, 120);
  assert.equal(latestMovement.reason, "Authorized stock intake to 120");
  console.log("✓ Test 2: Stock Persistence passed (stock remained 100 during price & desc updates, adjusted to 120 with audit record).");

  // --- TEST 3: Admin Profile Persistence ---
  console.log("\n[RUNNING] Test 3: Admin Profile Persistence...");
  const adminUser = initialUsers.find((u) => u.role === "admin");
  assert.ok(adminUser, "Admin user must exist");
  const originalName = adminUser.name;

  // Update admin authorized profile field
  const updatedAdmin = await DataService.updateUser(String(adminUser._id), {
    name: "Kyra Chief Administrator",
    phone: "+91 99887 76655",
  });
  assert.ok(updatedAdmin, "Admin update must succeed");
  assert.equal(updatedAdmin.name, "Kyra Chief Administrator");

  // Verify reload from DB
  const reloadedAdmin = await DataService.getUserById(String(adminUser._id));
  assert.equal(reloadedAdmin.name, "Kyra Chief Administrator");
  assert.equal(reloadedAdmin.phone, "+91 99887 76655");
  assert.equal(reloadedAdmin.role, "admin");

  // Restore original name to preserve initial records
  await DataService.updateUser(String(adminUser._id), {
    name: originalName,
    phone: adminUser.phone || "",
  });
  const restoredAdmin = await DataService.getUserById(String(adminUser._id));
  assert.equal(restoredAdmin.name, originalName);
  console.log("✓ Test 3: Admin Profile Persistence passed (profile updated, persisted, and role protected).");

  // --- TEST 4 (Post-Operations): Existing Data Integrity Check ---
  console.log("\n[RUNNING] Test 4: Post-Operations Existing Data Protection Verification...");
  const finalProducts = await DataService.getProducts();
  const finalCustomers = await DataService.getCustomers();
  const finalInvoices = await DataService.getInvoices();

  assert.ok(finalProducts.length >= prodCountBefore, "Products must not be lost");
  assert.equal(finalCustomers.length, custCountBefore, "Customer count must remain intact");
  assert.equal(finalInvoices.length, invCountBefore, "Invoice count must remain intact");
  console.log("✓ Test 4: Existing records verified intact.");

  // Clean up test product
  await DataService.deleteProduct(String(createdProd._id), { userId: "test_admin", userName: "Admin" });
  console.log("✓ Cleaned up test product.");

  // --- TEST 5: Production Fail-Safe Check ---
  console.log("\n[RUNNING] Test 5: Production Fail-Safe Check...");
  // Temporarily simulate NODE_ENV="production" with invalid mongo to ensure it refuses silent memory fallback
  const origEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    DataService.resetConnectionCache();
    let threw = false;
    try {
      await DataService.getSettings();
    } catch (err) {
      threw = true;
      assert.ok(
        err.message.includes("CRITICAL") || err.message.includes("Production database"),
        `Expected critical production database error message, got: ${err.message}`
      );
    }
    assert.ok(threw, "Production MUST throw error on failed DB connection rather than silently falling back to mock memory!");
    console.log("✓ Test 5: Production fail-safe verified (silent memory fallback is strictly blocked).");
  } finally {
    process.env.NODE_ENV = origEnv;
    DataService.resetConnectionCache();
  }

  console.log("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY! ✓✓✓");
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
