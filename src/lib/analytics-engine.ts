import { roundToTwo } from "./gst";

export function isInvoiceOverdue(inv: any, now: Date = new Date()): boolean {
  if (!inv || inv.isDeleted || inv.status === "cancelled" || inv.status === "deleted") {
    return false;
  }
  if ((inv.balanceDue || 0) <= 0 || inv.paymentStatus === "paid") {
    return false;
  }
  if (!inv.dueDate) return false;
  const dueEnd = new Date(inv.dueDate);
  dueEnd.setHours(23, 59, 59, 999);
  return now.getTime() > dueEnd.getTime();
}

export function normalizeInvoiceStatus(inv: any, now: Date = new Date()): any {
  if (!inv) return inv;
  const overdue = isInvoiceOverdue(inv, now);
  const computedPaymentStatus =
    (inv.balanceDue || 0) <= 0
      ? "paid"
      : overdue
      ? "overdue"
      : (inv.amountPaid || 0) > 0
      ? "partial"
      : "unpaid";

  return {
    ...inv,
    paymentStatus: computedPaymentStatus,
    isOverdue: overdue,
  };
}

export function computeDashboardAnalytics(params: {
  products: any[];
  customers: any[];
  invoices: any[];
  payments: any[];
}) {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const activeInvoices = params.invoices
    .filter((i) => !i.isDeleted && i.status !== "cancelled" && i.status !== "deleted")
    .map((i) => normalizeInvoiceStatus(i, now));

  const validPayments = params.payments.filter((p) => p.status !== "voided");

  let totalSales = 0;
  let todaySales = 0;
  let monthlySales = 0;
  let totalOutstanding = 0;
  let overduePayments = 0;
  let overdueCount = 0;
  let paidCount = 0;
  let partialCount = 0;
  let unpaidCount = 0;

  let paidValue = 0;
  let partialBalanceValue = 0;
  let unpaidBalanceValue = 0;

  for (const inv of activeInvoices) {
    const grand = Number(inv.grandTotal || 0);
    const bal = Number(inv.balanceDue || 0);
    totalSales += grand;
    totalOutstanding += bal;

    if (inv.paymentStatus === "paid") {
      paidCount++;
      paidValue += grand;
    } else if (inv.paymentStatus === "overdue") {
      overdueCount++;
      overduePayments += bal;
    } else if (inv.paymentStatus === "partial") {
      partialCount++;
      partialBalanceValue += bal;
    } else {
      unpaidCount++;
      unpaidBalanceValue += bal;
    }

    const d = new Date(inv.invoiceDate || inv.createdAt);
    if (d.toISOString().split("T")[0] === todayStr) {
      todaySales += grand;
    }
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      monthlySales += grand;
    }
  }

  const totalPaymentsReceived = validPayments.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );

  const activeProducts = params.products.filter((p) => !p.isDeleted);
  let totalStockValue = 0;
  let totalRetailStockValue = 0;
  const lowStockProducts: any[] = [];
  const categoryInventoryMap: Record<
    string,
    { category: string; units: number; stockValue: number; productsCount: number }
  > = {};

  for (const p of activeProducts) {
    const qty = Number(p.availableQuantity || 0);
    const cost = Number(p.purchasePrice || 0);
    const sell = Number(p.sellingPrice || 0);
    const val = qty * cost;
    totalStockValue += val;
    totalRetailStockValue += qty * sell;

    if (qty <= Number(p.minStockAlert ?? 5)) {
      lowStockProducts.push(p);
    }

    const cat = p.categoryName || "General";
    if (!categoryInventoryMap[cat]) {
      categoryInventoryMap[cat] = { category: cat, units: 0, stockValue: 0, productsCount: 0 };
    }
    categoryInventoryMap[cat].units += qty;
    categoryInventoryMap[cat].stockValue = roundToTwo(categoryInventoryMap[cat].stockValue + val);
    categoryInventoryMap[cat].productsCount += 1;
  }

  // 1. Monthly Revenue & Sales Overview Chart
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthlyMap: Record<
    string,
    { month: string; sales: number; collected: number; outstanding: number; invoices: number }
  > = {};
  for (const m of monthNames) {
    monthlyMap[m] = { month: m, sales: 0, collected: 0, outstanding: 0, invoices: 0 };
  }

  for (const inv of activeInvoices) {
    const d = new Date(inv.invoiceDate || inv.createdAt);
    if (d.getFullYear() === currentYear) {
      const m = monthNames[d.getMonth()];
      if (monthlyMap[m]) {
        monthlyMap[m].sales = roundToTwo(monthlyMap[m].sales + Number(inv.grandTotal || 0));
        monthlyMap[m].outstanding = roundToTwo(
          monthlyMap[m].outstanding + Number(inv.balanceDue || 0)
        );
        monthlyMap[m].invoices += 1;
      }
    }
  }

  for (const pay of validPayments) {
    const d = new Date(pay.paymentDate || pay.createdAt);
    if (d.getFullYear() === currentYear) {
      const m = monthNames[d.getMonth()];
      if (monthlyMap[m]) {
        monthlyMap[m].collected = roundToTwo(monthlyMap[m].collected + Number(pay.amount || 0));
      }
    }
  }

  // 2. Top Selling Products
  const prodSalesMap: Record<string, { name: string; sku: string; quantity: number; revenue: number }> = {};
  for (const inv of activeInvoices) {
    for (const it of inv.items || []) {
      const key = it.sku || it.productName;
      if (!prodSalesMap[key]) {
        prodSalesMap[key] = {
          name: it.productName,
          sku: it.sku || "",
          quantity: 0,
          revenue: 0,
        };
      }
      prodSalesMap[key].quantity += Number(it.quantity || 0);
      prodSalesMap[key].revenue = roundToTwo(
        prodSalesMap[key].revenue + Number(it.totalAmount || 0)
      );
    }
  }

  const topSellingProducts = Object.values(prodSalesMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  // 3. Pending Payments Overview Chart
  const pendingPaymentsOverview = [
    { name: "Collected", value: roundToTwo(totalPaymentsReceived), count: paidCount, color: "#10b981" },
    { name: "Partially Paid Due", value: roundToTwo(partialBalanceValue), count: partialCount, color: "#3b82f6" },
    { name: "Unpaid (Within Due)", value: roundToTwo(unpaidBalanceValue), count: unpaidCount, color: "#f59e0b" },
    { name: "Overdue", value: roundToTwo(overduePayments), count: overdueCount, color: "#ef4444" },
  ];

  return {
    totalSales: roundToTwo(totalSales),
    todaySales: roundToTwo(todaySales),
    monthlySales: roundToTwo(monthlySales),
    totalInvoices: activeInvoices.length,
    totalProducts: activeProducts.length,
    totalCustomers: params.customers.length,
    totalStockValue: roundToTwo(totalStockValue),
    totalRetailStockValue: roundToTwo(totalRetailStockValue),
    lowStockCount: lowStockProducts.length,
    lowStockProducts: lowStockProducts.slice(0, 8),
    totalPaymentsReceived: roundToTwo(totalPaymentsReceived),
    pendingPayments: roundToTwo(totalOutstanding),
    totalOutstandingPayments: roundToTwo(totalOutstanding),
    overduePayments: roundToTwo(overduePayments),
    overdueCount,
    recentInvoices: activeInvoices.slice(0, 7),
    recentTransactions: validPayments.slice(0, 7),
    monthlySalesChart: Object.values(monthlyMap),
    topSellingProducts,
    inventoryOverviewChart: Object.values(categoryInventoryMap).sort(
      (a, b) => b.stockValue - a.stockValue
    ),
    pendingPaymentsOverview,
  };
}

export function computeComprehensiveReports(params: {
  invoices: any[];
  payments: any[];
  products: any[];
  customers: any[];
  purchases: any[];
  startDate?: string;
  endDate?: string;
}) {
  const now = new Date();
  const startMs = params.startDate ? new Date(`${params.startDate}T00:00:00`).getTime() : null;
  const endMs = params.endDate ? new Date(`${params.endDate}T23:59:59.999`).getTime() : null;

  const inRange = (dVal: any) => {
    if (!startMs && !endMs) return true;
    const t = new Date(dVal).getTime();
    if (startMs && t < startMs) return false;
    if (endMs && t > endMs) return false;
    return true;
  };

  const allActiveInvoices = params.invoices
    .filter((i) => !i.isDeleted && i.status !== "cancelled" && i.status !== "deleted")
    .map((i) => normalizeInvoiceStatus(i, now));

  const filteredInvoices = allActiveInvoices.filter((i) => inRange(i.invoiceDate || i.createdAt));
  const filteredPayments = params.payments.filter(
    (p) => p.status !== "voided" && inRange(p.paymentDate || p.createdAt)
  );
  const filteredPurchases = params.purchases.filter(
    (p) => p.status !== "cancelled" && inRange(p.purchaseDate || p.createdAt)
  );

  // Totals & GST Summary
  let totalTaxable = 0;
  let totalDiscount = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalTax = 0;
  let totalGrand = 0;
  let totalCostOfGoods = 0;

  const dailyMap: Record<string, { date: string; invoicesCount: number; taxable: number; tax: number; total: number; collected: number }> = {};
  const monthlyMap: Record<string, { month: string; invoicesCount: number; taxable: number; tax: number; total: number }> = {};
  const yearlyMap: Record<string, { year: string; invoicesCount: number; taxable: number; tax: number; total: number }> = {};
  const hsnMap: Record<string, { hsnCode: string; gstRate: number; quantity: number; taxableAmount: number; cgst: number; sgst: number; igst: number; totalTax: number; totalAmount: number }> = {};
  const productStats: Record<string, { name: string; sku: string; hsnCode: string; units: number; revenue: number; taxCollected: number; cost: number; profit: number }> = {};
  const customerStats: Record<string, { customerId?: string; name: string; phone: string; gstin: string; invoicesCount: number; revenue: number; paid: number; balance: number }> = {};

  for (const inv of filteredInvoices) {
    const taxable = Number(inv.taxableAmount || 0);
    const disc = Number(inv.totalDiscount || 0);
    const cgst = Number(inv.totalCgst || 0);
    const sgst = Number(inv.totalSgst || 0);
    const igst = Number(inv.totalIgst || 0);
    const tax = Number(inv.totalTax || 0);
    const grand = Number(inv.grandTotal || 0);
    const paid = Number(inv.amountPaid || 0);
    const bal = Number(inv.balanceDue || 0);

    totalTaxable += taxable;
    totalDiscount += disc;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;
    totalTax += tax;
    totalGrand += grand;

    const d = new Date(inv.invoiceDate || inv.createdAt);
    const dayKey = d.toISOString().split("T")[0];
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const yearKey = String(d.getFullYear());

    if (!dailyMap[dayKey]) {
      dailyMap[dayKey] = { date: dayKey, invoicesCount: 0, taxable: 0, tax: 0, total: 0, collected: 0 };
    }
    dailyMap[dayKey].invoicesCount += 1;
    dailyMap[dayKey].taxable = roundToTwo(dailyMap[dayKey].taxable + taxable);
    dailyMap[dayKey].tax = roundToTwo(dailyMap[dayKey].tax + tax);
    dailyMap[dayKey].total = roundToTwo(dailyMap[dayKey].total + grand);
    dailyMap[dayKey].collected = roundToTwo(dailyMap[dayKey].collected + paid);

    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = { month: monthKey, invoicesCount: 0, taxable: 0, tax: 0, total: 0 };
    }
    monthlyMap[monthKey].invoicesCount += 1;
    monthlyMap[monthKey].taxable = roundToTwo(monthlyMap[monthKey].taxable + taxable);
    monthlyMap[monthKey].tax = roundToTwo(monthlyMap[monthKey].tax + tax);
    monthlyMap[monthKey].total = roundToTwo(monthlyMap[monthKey].total + grand);

    if (!yearlyMap[yearKey]) {
      yearlyMap[yearKey] = { year: yearKey, invoicesCount: 0, taxable: 0, tax: 0, total: 0 };
    }
    yearlyMap[yearKey].invoicesCount += 1;
    yearlyMap[yearKey].taxable = roundToTwo(yearlyMap[yearKey].taxable + taxable);
    yearlyMap[yearKey].tax = roundToTwo(yearlyMap[yearKey].tax + tax);
    yearlyMap[yearKey].total = roundToTwo(yearlyMap[yearKey].total + grand);

    const cKey = String(inv.customerId || inv.customer?.phone || inv.customer?.name);
    if (!customerStats[cKey]) {
      customerStats[cKey] = {
        customerId: inv.customerId ? String(inv.customerId) : undefined,
        name: inv.customer?.name || "Walk-in",
        phone: inv.customer?.phone || "",
        gstin: inv.customer?.gstin || "Unregistered",
        invoicesCount: 0,
        revenue: 0,
        paid: 0,
        balance: 0,
      };
    }
    customerStats[cKey].invoicesCount += 1;
    customerStats[cKey].revenue = roundToTwo(customerStats[cKey].revenue + grand);
    customerStats[cKey].paid = roundToTwo(customerStats[cKey].paid + paid);
    customerStats[cKey].balance = roundToTwo(customerStats[cKey].balance + bal);

    for (const it of inv.items || []) {
      const pKey = it.sku || it.productName;
      if (!productStats[pKey]) {
        productStats[pKey] = {
          name: it.productName,
          sku: it.sku || "",
          hsnCode: it.hsnCode || "",
          units: 0,
          revenue: 0,
          taxCollected: 0,
          cost: 0,
          profit: 0,
        };
      }
      const itemQty = Number(it.quantity || 0);
      const itemCost = Number(it.purchasePrice || 0) * itemQty;
      const itemTaxable = Number(it.taxableAmount || 0);
      const itemTax = Number(it.totalTax || 0);

      productStats[pKey].units += itemQty;
      productStats[pKey].revenue = roundToTwo(productStats[pKey].revenue + itemTaxable);
      productStats[pKey].taxCollected = roundToTwo(productStats[pKey].taxCollected + itemTax);
      productStats[pKey].cost = roundToTwo(productStats[pKey].cost + itemCost);
      productStats[pKey].profit = roundToTwo(productStats[pKey].profit + (itemTaxable - itemCost));
      totalCostOfGoods += itemCost;

      const hsnKey = `${it.hsnCode || "NA"}_${it.gstRate || 0}`;
      if (!hsnMap[hsnKey]) {
        hsnMap[hsnKey] = {
          hsnCode: it.hsnCode || "N/A",
          gstRate: Number(it.gstRate || 0),
          quantity: 0,
          taxableAmount: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalTax: 0,
          totalAmount: 0,
        };
      }
      hsnMap[hsnKey].quantity += itemQty;
      hsnMap[hsnKey].taxableAmount = roundToTwo(hsnMap[hsnKey].taxableAmount + itemTaxable);
      hsnMap[hsnKey].cgst = roundToTwo(hsnMap[hsnKey].cgst + Number(it.cgstAmount || 0));
      hsnMap[hsnKey].sgst = roundToTwo(hsnMap[hsnKey].sgst + Number(it.sgstAmount || 0));
      hsnMap[hsnKey].igst = roundToTwo(hsnMap[hsnKey].igst + Number(it.igstAmount || 0));
      hsnMap[hsnKey].totalTax = roundToTwo(hsnMap[hsnKey].totalTax + itemTax);
      hsnMap[hsnKey].totalAmount = roundToTwo(
        hsnMap[hsnKey].totalAmount + Number(it.totalAmount || 0)
      );
    }
  }

  const activeProducts = params.products.filter((p) => !p.isDeleted);
  const stockReport = activeProducts.map((p) => ({
    _id: p._id,
    name: p.name,
    sku: p.sku,
    category: p.categoryName || "General",
    uom: p.uom || "PCS",
    availableQuantity: Number(p.availableQuantity || 0),
    minStockAlert: Number(p.minStockAlert || 0),
    purchasePrice: Number(p.purchasePrice || 0),
    sellingPrice: Number(p.sellingPrice || 0),
    stockValue: roundToTwo(Number(p.availableQuantity || 0) * Number(p.purchasePrice || 0)),
    retailValue: roundToTwo(Number(p.availableQuantity || 0) * Number(p.sellingPrice || 0)),
    isLowStock: Number(p.availableQuantity || 0) <= Number(p.minStockAlert || 0),
    isActive: p.isActive !== false,
  }));

  const lowStockReport = stockReport.filter((p) => p.isLowStock);

  const outstandingReport = allActiveInvoices
    .filter((i) => Number(i.balanceDue || 0) > 0)
    .map((i) => ({
      _id: i._id,
      invoiceNumber: i.invoiceNumber,
      invoiceDate: i.invoiceDate,
      dueDate: i.dueDate,
      customerName: i.customer?.name || "",
      customerPhone: i.customer?.phone || "",
      grandTotal: Number(i.grandTotal || 0),
      amountPaid: Number(i.amountPaid || 0),
      balanceDue: Number(i.balanceDue || 0),
      paymentStatus: i.paymentStatus,
      isOverdue: i.isOverdue,
      daysOverdue: i.dueDate
        ? Math.max(0, Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / (24 * 3600 * 1000)))
        : 0,
    }));

  const overdueReport = outstandingReport.filter((i) => i.isOverdue);

  const paymentCollectionByMode: Record<string, { mode: string; count: number; amount: number }> = {};
  for (const p of filteredPayments) {
    const mode = p.paymentMode || "cash";
    if (!paymentCollectionByMode[mode]) {
      paymentCollectionByMode[mode] = { mode, count: 0, amount: 0 };
    }
    paymentCollectionByMode[mode].count += 1;
    paymentCollectionByMode[mode].amount = roundToTwo(
      paymentCollectionByMode[mode].amount + Number(p.amount || 0)
    );
  }

  const totalPurchasesSpend = filteredPurchases.reduce(
    (s, p) => s + Number(p.totalAmount || 0),
    0
  );
  const grossProfit = roundToTwo(totalTaxable - totalCostOfGoods);
  const profitMargin = totalTaxable > 0 ? roundToTwo((grossProfit / totalTaxable) * 100) : 0;

  return {
    summary: {
      totalInvoices: filteredInvoices.length,
      totalTaxable: roundToTwo(totalTaxable),
      totalDiscount: roundToTwo(totalDiscount),
      totalCgst: roundToTwo(totalCgst),
      totalSgst: roundToTwo(totalSgst),
      totalIgst: roundToTwo(totalIgst),
      totalTax: roundToTwo(totalTax),
      totalGrand: roundToTwo(totalGrand),
      totalCostOfGoods: roundToTwo(totalCostOfGoods),
      grossProfit,
      profitMargin,
      totalPurchasesSpend: roundToTwo(totalPurchasesSpend),
      totalCollected: roundToTwo(
        filteredPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
      ),
      totalOutstanding: roundToTwo(
        outstandingReport.reduce((s, i) => s + i.balanceDue, 0)
      ),
      totalOverdue: roundToTwo(overdueReport.reduce((s, i) => s + i.balanceDue, 0)),
    },
    dailySales: Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date)),
    monthlySales: Object.values(monthlyMap).sort((a, b) => b.month.localeCompare(a.month)),
    yearlySales: Object.values(yearlyMap).sort((a, b) => b.year.localeCompare(a.year)),
    hsnSummary: Object.values(hsnMap),
    productWise: Object.values(productStats).sort((a, b) => b.revenue - a.revenue),
    customerWise: Object.values(customerStats).sort((a, b) => b.revenue - a.revenue),
    stockReport,
    lowStockReport,
    outstandingReport,
    overdueReport,
    paymentCollections: {
      byMode: Object.values(paymentCollectionByMode),
      transactions: filteredPayments,
    },
  };
}
