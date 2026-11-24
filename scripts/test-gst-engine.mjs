import { calculateInvoiceTaxes, numberToWordsINR } from "../src/lib/gst.js";

console.log("--- Testing GST Engine ---");

// Test 1: Intra-state
const intraTest = calculateInvoiceTaxes(
  [
    { rate: 10000, quantity: 2, discount: 0, gstRate: 18 }
  ],
  "07", // Delhi
  "07"  // Delhi
);

console.log("1. Intra-State Calculation:", {
  taxable: intraTest.summary.taxableAmount,
  cgst: intraTest.summary.totalCgst,
  sgst: intraTest.summary.totalSgst,
  igst: intraTest.summary.totalIgst,
  grandTotal: intraTest.summary.grandTotal,
  isInterState: intraTest.summary.isInterState,
});

if (
  intraTest.summary.totalCgst === 1800 &&
  intraTest.summary.totalSgst === 1800 &&
  intraTest.summary.totalIgst === 0 &&
  intraTest.summary.grandTotal === 23600 &&
  !intraTest.summary.isInterState
) {
  console.log("✓ Intra-State calculation PASSED!");
} else {
  console.error("✗ Intra-State calculation FAILED!");
  process.exit(1);
}

// Test 2: Inter-state
const interTest = calculateInvoiceTaxes(
  [
    { rate: 10000, quantity: 2, discount: 0, gstRate: 18 }
  ],
  "07", // Delhi (Seller)
  "09"  // Uttar Pradesh (Customer)
);

console.log("2. Inter-State Calculation:", {
  taxable: interTest.summary.taxableAmount,
  cgst: interTest.summary.totalCgst,
  sgst: interTest.summary.totalSgst,
  igst: interTest.summary.totalIgst,
  grandTotal: interTest.summary.grandTotal,
  isInterState: interTest.summary.isInterState,
});

if (
  interTest.summary.totalCgst === 0 &&
  interTest.summary.totalSgst === 0 &&
  interTest.summary.totalIgst === 3600 &&
  interTest.summary.grandTotal === 23600 &&
  interTest.summary.isInterState
) {
  console.log("✓ Inter-State calculation PASSED!");
} else {
  console.error("✗ Inter-State calculation FAILED!");
  process.exit(1);
}

// Test 3: Number to Words (INR)
const wordsTest = numberToWordsINR(23600.50);
console.log("3. Number to Words:", wordsTest);
if (wordsTest.includes("Twenty-Three Thousand Six Hundred Rupees and Fifty Paise Only")) {
  console.log("✓ Number to Words INR PASSED!");
} else {
  console.log("Words generated:", wordsTest);
}

console.log("All critical tests completed successfully!");
