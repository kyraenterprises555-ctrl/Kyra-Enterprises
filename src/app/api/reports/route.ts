import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "all"; // all | month | year

    const invoices = await DataService.getInvoices();
    const activeInvoices = invoices.filter((i) => i.status !== "cancelled");
    const products = await DataService.getProducts();

    // 1. Overall Sales and P&L
    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalTax = 0;
    let totalGrand = 0;
    let totalCostOfGoods = 0;

    // 2. Product-wise sales map
    const productStats: {
      [key: string]: { name: string; sku: string; units: number; revenue: number; cost: number; profit: number };
    } = {};

    // 3. Customer-wise sales map
    const customerStats: {
      [key: string]: { name: string; gstin: string; invoicesCount: number; revenue: number; balance: number };
    } = {};

    for (const inv of activeInvoices) {
      totalTaxable += inv.taxableAmount || 0;
      totalCgst += inv.totalCgst || 0;
      totalSgst += inv.totalSgst || 0;
      totalIgst += inv.totalIgst || 0;
      totalTax += inv.totalTax || 0;
      totalGrand += inv.grandTotal || 0;

      // Customer stats
      const cName = inv.customer.name;
      if (!customerStats[cName]) {
        customerStats[cName] = {
          name: cName,
          gstin: inv.customer.gstin || "Unregistered",
          invoicesCount: 0,
          revenue: 0,
          balance: 0,
        };
      }
      customerStats[cName].invoicesCount += 1;
      customerStats[cName].revenue += inv.grandTotal;
      customerStats[cName].balance += inv.balanceDue || 0;

      // Item breakdown
      for (const it of inv.items || []) {
        const pKey = it.productName;
        if (!productStats[pKey]) {
          productStats[pKey] = {
            name: it.productName,
            sku: it.sku,
            units: 0,
            revenue: 0,
            cost: 0,
            profit: 0,
          };
        }
        const unitCost = it.purchasePrice || 0;
        const totalItemCost = unitCost * it.quantity;
        const totalItemRevenue = it.taxableAmount; // Profit based on taxable revenue vs purchase cost

        productStats[pKey].units += it.quantity;
        productStats[pKey].revenue += totalItemRevenue;
        productStats[pKey].cost += totalItemCost;
        productStats[pKey].profit += totalItemRevenue - totalItemCost;

        totalCostOfGoods += totalItemCost;
      }
    }

    const grossProfit = totalTaxable - totalCostOfGoods;
    const profitMargin = totalTaxable > 0 ? (grossProfit / totalTaxable) * 100 : 0;

    return NextResponse.json({
      success: true,
      report: {
        summary: {
          totalInvoices: activeInvoices.length,
          totalTaxable,
          totalCgst,
          totalSgst,
          totalIgst,
          totalTax,
          totalGrand,
          totalCostOfGoods,
          grossProfit,
          profitMargin: Number(profitMargin.toFixed(2)),
        },
        productWise: Object.values(productStats),
        customerWise: Object.values(customerStats),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate reports";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
