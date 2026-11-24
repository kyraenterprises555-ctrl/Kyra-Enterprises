"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  Percent,
  FileSpreadsheet,
  RefreshCw,
  Building2,
  Package,
  Users,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

export default function ReportsPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/reports");
      const data = await res.json();
      if (data.success) {
        setReport(data.report);
      }
    } catch {
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const exportProductCsv = () => {
    if (!report || !report.productWise.length) return;
    const headers = ["Product Name", "SKU", "Units Sold", "Taxable Revenue", "Cost of Goods", "Gross Profit"];
    const rows = report.productWise.map((p: any) => [
      `"${p.name}"`,
      `"${p.sku}"`,
      p.units,
      p.revenue.toFixed(2),
      p.cost.toFixed(2),
      p.profit.toFixed(2),
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e: any) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Product_Sales_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV export downloaded");
  };

  const exportCustomerCsv = () => {
    if (!report || !report.customerWise.length) return;
    const headers = ["Customer Name", "GSTIN", "Invoices Count", "Total Billed", "Outstanding Balance"];
    const rows = report.customerWise.map((c: any) => [
      `"${c.name}"`,
      `"${c.gstin}"`,
      c.invoicesCount,
      c.revenue.toFixed(2),
      c.balance.toFixed(2),
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e: any) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Customer_Ledger_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV export downloaded");
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-medium">Computing financial analytics and GST summaries...</p>
      </div>
    );
  }

  if (!report) return null;

  const { summary, productWise, customerWise } = report;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Financial & GST Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            P&L analysis, tax breakdowns for GST compliance, and profitability analytics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchReports()}
            title="Refresh"
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total Billed Revenue</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(summary.totalGrand)}</div>
          <div className="text-[11px] text-slate-400 mt-1">{summary.totalInvoices} finalized invoices</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total Cost of Goods (COGS)</div>
          <div className="text-xl font-bold text-slate-700 mt-1">{formatCurrency(summary.totalCostOfGoods)}</div>
          <div className="text-[11px] text-slate-400 mt-1">Based on purchase costs</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Gross Profit</div>
          <div className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(summary.grossProfit)}</div>
          <div className="text-[11px] text-emerald-600 mt-1 font-semibold">
            {summary.profitMargin}% gross margin
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total GST Collected</div>
          <div className="text-xl font-bold text-purple-600 mt-1">{formatCurrency(summary.totalTax)}</div>
          <div className="text-[11px] text-slate-400 mt-1">Payable under GST rules</div>
        </div>
      </div>

      {/* GST Breakdown Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100">
          GST Summary (Tax Output Liability)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block mb-1">Total Taxable Value:</span>
            <span className="text-base font-bold text-slate-900 font-mono">
              {formatCurrency(summary.totalTaxable)}
            </span>
          </div>

          <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200/70">
            <span className="text-blue-700 font-medium block mb-1">Central GST (CGST):</span>
            <span className="text-base font-bold text-blue-900 font-mono">
              {formatCurrency(summary.totalCgst)}
            </span>
            <span className="text-[10px] text-blue-600 block mt-0.5">Intra-state share</span>
          </div>

          <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200/70">
            <span className="text-blue-700 font-medium block mb-1">State GST (SGST):</span>
            <span className="text-base font-bold text-blue-900 font-mono">
              {formatCurrency(summary.totalSgst)}
            </span>
            <span className="text-[10px] text-blue-600 block mt-0.5">Intra-state share</span>
          </div>

          <div className="p-3 bg-purple-50/60 rounded-lg border border-purple-200/70">
            <span className="text-purple-700 font-medium block mb-1">Integrated GST (IGST):</span>
            <span className="text-base font-bold text-purple-900 font-mono">
              {formatCurrency(summary.totalIgst)}
            </span>
            <span className="text-[10px] text-purple-600 block mt-0.5">Inter-state transactions</span>
          </div>
        </div>
      </div>

      {/* Product-wise Sales and Profitability */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Product-Wise Sales & Profit Margins</h2>
          </div>
          <button
            onClick={exportProductCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4 text-center">Units Sold</th>
                <th className="py-3 px-4 text-right">Taxable Turnover</th>
                <th className="py-3 px-4 text-right">Cost of Goods</th>
                <th className="py-3 px-4 text-right">Gross Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {productWise.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No product sales recorded yet
                  </td>
                </tr>
              ) : (
                productWise.map((p: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-slate-900">{p.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{p.sku}</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">{p.units}</td>
                    <td className="py-3 px-4 text-right font-mono">{formatCurrency(p.revenue)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500">{formatCurrency(p.cost)}</td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        p.profit >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {formatCurrency(p.profit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer-wise Volume */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Customer-Wise Sales & Balances</h2>
          </div>
          <button
            onClick={exportCustomerCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">GSTIN</th>
                <th className="py-3 px-4 text-center">Invoices</th>
                <th className="py-3 px-4 text-right">Total Invoiced</th>
                <th className="py-3 px-4 text-right">Outstanding Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customerWise.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No customer data available yet
                  </td>
                </tr>
              ) : (
                customerWise.map((c: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-slate-900">{c.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{c.gstin}</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">{c.invoicesCount}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(c.revenue)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        c.balance > 0 ? "text-amber-600" : "text-slate-500"
                      }`}
                    >
                      {formatCurrency(c.balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
