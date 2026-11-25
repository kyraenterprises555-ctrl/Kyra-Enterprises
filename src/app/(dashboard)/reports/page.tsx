"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { generateTableReportPdf } from "@/lib/pdf";
import {
  KyraBadge,
  KyraTabs,
  KyraTabsContent,
  KyraTabsList,
  KyraTabsTrigger,
} from "@/components/ui/kyra-ui";
import { toast } from "sonner";

type ReportCategoryKey =
  | "pnl"
  | "daily"
  | "monthly"
  | "yearly"
  | "gst"
  | "product"
  | "customer"
  | "stock"
  | "low_stock"
  | "outstanding"
  | "overdue"
  | "collections";

export default function ReportsPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReportCategoryKey>("pnl");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchReports = async (sDate = startDate, eDate = endDate) => {
    try {
      setLoading(true);
      const q = new URLSearchParams();
      if (sDate) q.append("startDate", sDate);
      if (eDate) q.append("endDate", eDate);
      const res = await fetch(`/api/reports?${q.toString()}`);
      const data = await res.json();
      if (data.success) setReport(data.report);
    } catch {
      toast.error("Failed to compute Kyra Enterprises financial reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const applyPreset = (preset: "all" | "today" | "month" | "year") => {
    const now = new Date();
    const isoToday = now.toISOString().split("T")[0];
    if (preset === "all") {
      setStartDate("");
      setEndDate("");
      fetchReports("", "");
    } else if (preset === "today") {
      setStartDate(isoToday);
      setEndDate(isoToday);
      fetchReports(isoToday, isoToday);
    } else if (preset === "month") {
      const s = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      setStartDate(s);
      setEndDate(isoToday);
      fetchReports(s, isoToday);
    } else if (preset === "year") {
      const s = `${now.getFullYear()}-01-01`;
      setStartDate(s);
      setEndDate(isoToday);
      fetchReports(s, isoToday);
    }
  };

  const getActiveExportDataset = (): {
    title: string;
    headers: string[];
    rows: Array<Array<string | number>>;
  } => {
    if (!report) return { title: "Report", headers: [], rows: [] };
    switch (activeTab) {
      case "daily":
        return {
          title: "Daily Sales Report",
          headers: ["Date", "Invoices", "Taxable Value", "GST Tax", "Grand Total", "Collected"],
          rows: report.dailySales.map((d: any) => [
            d.date,
            d.invoicesCount,
            d.taxable.toFixed(2),
            d.tax.toFixed(2),
            d.total.toFixed(2),
            d.collected.toFixed(2),
          ]),
        };
      case "monthly":
        return {
          title: "Monthly Sales Report",
          headers: ["Month", "Invoices", "Taxable Value", "GST Tax", "Grand Total"],
          rows: report.monthlySales.map((m: any) => [
            m.month,
            m.invoicesCount,
            m.taxable.toFixed(2),
            m.tax.toFixed(2),
            m.total.toFixed(2),
          ]),
        };
      case "yearly":
        return {
          title: "Yearly Sales Report",
          headers: ["Year", "Invoices", "Taxable Value", "GST Tax", "Grand Total"],
          rows: report.yearlySales.map((y: any) => [
            y.year,
            y.invoicesCount,
            y.taxable.toFixed(2),
            y.tax.toFixed(2),
            y.total.toFixed(2),
          ]),
        };
      case "gst":
        return {
          title: "GST & HSN Tax Liability Summary",
          headers: ["HSN Code", "GST %", "Qty", "Taxable", "CGST", "SGST", "IGST", "Total Tax", "Total"],
          rows: report.hsnSummary.map((h: any) => [
            h.hsnCode,
            `${h.gstRate}%`,
            h.quantity,
            h.taxableAmount.toFixed(2),
            h.cgst.toFixed(2),
            h.sgst.toFixed(2),
            h.igst.toFixed(2),
            h.totalTax.toFixed(2),
            h.totalAmount.toFixed(2),
          ]),
        };
      case "product":
        return {
          title: "Product-Wise Sales & Margin Report",
          headers: ["Product Name", "SKU", "HSN", "Units Sold", "Taxable Revenue", "COGS", "Gross Profit"],
          rows: report.productWise.map((p: any) => [
            p.name,
            p.sku,
            p.hsnCode,
            p.units,
            p.revenue.toFixed(2),
            p.cost.toFixed(2),
            p.profit.toFixed(2),
          ]),
        };
      case "customer":
        return {
          title: "Customer-Wise Sales & Receivable Report",
          headers: ["Customer", "Phone", "GSTIN", "Invoices", "Total Billed", "Total Paid", "Balance Due"],
          rows: report.customerWise.map((c: any) => [
            c.name,
            c.phone,
            c.gstin,
            c.invoicesCount,
            c.revenue.toFixed(2),
            c.paid.toFixed(2),
            c.balance.toFixed(2),
          ]),
        };
      case "stock":
        return {
          title: "Warehouse Stock Valuation Report",
          headers: ["Product", "SKU", "Category", "Stock", "UOM", "Unit Cost", "Stock Cost Value", "Retail Value"],
          rows: report.stockReport.map((s: any) => [
            s.name,
            s.sku,
            s.category,
            s.availableQuantity,
            s.uom,
            s.purchasePrice.toFixed(2),
            s.stockValue.toFixed(2),
            s.retailValue.toFixed(2),
          ]),
        };
      case "low_stock":
        return {
          title: "Low Stock Replenishment Report",
          headers: ["Product", "SKU", "Category", "Current Stock", "Min Alert Level", "UOM"],
          rows: report.lowStockReport.map((s: any) => [
            s.name,
            s.sku,
            s.category,
            s.availableQuantity,
            s.minStockAlert,
            s.uom,
          ]),
        };
      case "outstanding":
        return {
          title: "Outstanding Payment Receivables Report",
          headers: ["Invoice #", "Invoice Date", "Due Date", "Customer", "Phone", "Total", "Paid", "Balance Due"],
          rows: report.outstandingReport.map((o: any) => [
            o.invoiceNumber,
            formatDate(o.invoiceDate),
            formatDate(o.dueDate),
            o.customerName,
            o.customerPhone,
            o.grandTotal.toFixed(2),
            o.amountPaid.toFixed(2),
            o.balanceDue.toFixed(2),
          ]),
        };
      case "overdue":
        return {
          title: "Overdue Invoices Report",
          headers: ["Invoice #", "Due Date", "Days Overdue", "Customer", "Phone", "Total", "Balance Due"],
          rows: report.overdueReport.map((o: any) => [
            o.invoiceNumber,
            formatDate(o.dueDate),
            o.daysOverdue,
            o.customerName,
            o.customerPhone,
            o.grandTotal.toFixed(2),
            o.balanceDue.toFixed(2),
          ]),
        };
      case "collections":
        return {
          title: "Payment Collection Report",
          headers: ["Date", "Invoice #", "Customer", "Method", "Reference", "Amount"],
          rows: (report.paymentCollections?.transactions || []).map((t: any) => [
            formatDate(t.paymentDate || t.createdAt),
            t.invoiceNumber,
            t.customerName,
            t.paymentMode,
            t.transactionRef || "-",
            Number(t.amount || 0).toFixed(2),
          ]),
        };
      default: {
        const s = report.summary;
        return {
          title: "Profit and Loss Statement",
          headers: ["Metric", "Amount (INR)"],
          rows: [
            ["Total Taxable Sales Revenue", s.totalTaxable.toFixed(2)],
            ["Cost of Goods Sold (COGS)", s.totalCostOfGoods.toFixed(2)],
            ["Gross Profit", s.grossProfit.toFixed(2)],
            ["Gross Margin %", `${s.profitMargin}%`],
            ["Total GST Output Tax Collected", s.totalTax.toFixed(2)],
            ["Gross Billed Turnover (Incl. GST)", s.totalGrand.toFixed(2)],
            ["Total Supplier Purchases Spend", s.totalPurchasesSpend.toFixed(2)],
            ["Payments Collected in Period", s.totalCollected.toFixed(2)],
          ],
        };
      }
    }
  };

  const handleExportCsv = () => {
    const ds = getActiveExportDataset();
    if (!ds.rows.length) {
      toast.info("No records in current report view to export");
      return;
    }
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [ds.headers.map(esc).join(","), ...ds.rows.map((r) => r.map(esc).join(","))].join(
      "\n"
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Kyra_Enterprises_${activeTab}_report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV report exported");
  };

  const handleExportPdf = () => {
    const ds = getActiveExportDataset();
    if (!ds.rows.length) {
      toast.info("No records in current report view to export");
      return;
    }
    generateTableReportPdf({
      title: ds.title,
      subtitle: `Period: ${startDate || "Inception"} to ${endDate || "Today"}`,
      headers: ds.headers,
      rows: ds.rows,
      fileName: `Kyra_Enterprises_${activeTab}_report.pdf`,
    });
    toast.success("PDF report downloaded");
  };

  if (loading && !report) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-medium">Aggregating 12-Module Enterprise Reports...</p>
      </div>
    );
  }

  if (!report) return null;
  const { summary } = report;

  return (
    <div className="space-y-6">
      {/* Header & Export Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <span>Reports &amp; Financial Analytics &mdash; Kyra Enterprises</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Daily/Monthly/Yearly Sales, GST &amp; HSN Summaries, Stock, Receivables, Overdue Bills, Collections &amp; P&amp;L
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Current CSV</span>
          </button>
          <button
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0e1e32] hover:bg-[#142a45] text-white text-xs font-semibold"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export Current PDF</span>
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold text-slate-700">Date Filter:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono"
          />
          <button
            onClick={() => fetchReports(startDate, endDate)}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
          >
            Apply
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "today", label: "Today" },
            { id: "month", label: "This Month" },
            { id: "year", label: "This Year" },
            { id: "all", label: "All Time" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id as any)}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => fetchReports()}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Top Executive Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] text-slate-500 font-semibold">Gross Sales</div>
          <div className="text-base font-bold text-slate-900 font-mono mt-1">
            {formatCurrency(summary.totalGrand)}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] text-slate-500 font-semibold">Taxable Revenue</div>
          <div className="text-base font-bold text-slate-800 font-mono mt-1">
            {formatCurrency(summary.totalTaxable)}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] text-slate-500 font-semibold">Gross Profit</div>
          <div className="text-base font-bold text-emerald-600 font-mono mt-1">
            {formatCurrency(summary.grossProfit)} ({summary.profitMargin}%)
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] text-slate-500 font-semibold">GST Output Tax</div>
          <div className="text-base font-bold text-indigo-600 font-mono mt-1">
            {formatCurrency(summary.totalTax)}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] text-slate-500 font-semibold">Collections</div>
          <div className="text-base font-bold text-emerald-700 font-mono mt-1">
            {formatCurrency(summary.totalCollected)}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] text-slate-500 font-semibold">Overdue Receivables</div>
          <div className="text-base font-bold text-red-600 font-mono mt-1">
            {formatCurrency(summary.totalOverdue)}
          </div>
        </div>
      </div>

      {/* All 12 Reports Tabs */}
      <KyraTabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ReportCategoryKey)}
        className="space-y-4"
      >
        <KyraTabsList>
          <KyraTabsTrigger value="pnl">Profit &amp; Loss</KyraTabsTrigger>
          <KyraTabsTrigger value="daily">Daily Sales</KyraTabsTrigger>
          <KyraTabsTrigger value="monthly">Monthly Sales</KyraTabsTrigger>
          <KyraTabsTrigger value="yearly">Yearly Sales</KyraTabsTrigger>
          <KyraTabsTrigger value="gst">GST Summary</KyraTabsTrigger>
          <KyraTabsTrigger value="product">Product-Wise</KyraTabsTrigger>
          <KyraTabsTrigger value="customer">Customer-Wise</KyraTabsTrigger>
          <KyraTabsTrigger value="stock">Stock Report</KyraTabsTrigger>
          <KyraTabsTrigger value="low_stock">Low Stock</KyraTabsTrigger>
          <KyraTabsTrigger value="outstanding">Outstanding</KyraTabsTrigger>
          <KyraTabsTrigger value="overdue">Overdue Invoices</KyraTabsTrigger>
          <KyraTabsTrigger value="collections">Payment Collections</KyraTabsTrigger>
        </KyraTabsList>

        {/* 1. Profit & Loss */}
        <KyraTabsContent value="pnl">
          <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs max-w-3xl space-y-4 text-xs">
            <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              Profit &amp; Loss Statement &mdash; Kyra Enterprises
            </h2>
            <div className="divide-y divide-slate-100">
              {[
                ["Gross Billed Turnover (Incl. GST)", formatCurrency(summary.totalGrand), "text-slate-900 font-bold"],
                ["Less: Output GST Tax Liability", `- ${formatCurrency(summary.totalTax)}`, "text-indigo-600"],
                ["Net Taxable Operating Revenue", formatCurrency(summary.totalTaxable), "text-slate-900 font-bold"],
                ["Less: Cost of Goods Sold (Historical Purchase Price Snapshot)", `- ${formatCurrency(summary.totalCostOfGoods)}`, "text-red-600"],
                ["Gross Trading Profit", formatCurrency(summary.grossProfit), "text-emerald-600 text-sm font-bold"],
                ["Gross Profit Margin (%)", `${summary.profitMargin}%`, "text-emerald-700 font-bold"],
                ["Supplier Inventory Purchases in Period", formatCurrency(summary.totalPurchasesSpend), "text-slate-600"],
                ["Cash / UPI / Bank Collections Realized", formatCurrency(summary.totalCollected), "text-emerald-700 font-semibold"],
              ].map(([lbl, val, cls], idx) => (
                <div key={idx} className="py-3 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">{lbl}</span>
                  <span className={`font-mono ${cls}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </KyraTabsContent>

        {/* 2. Daily Sales */}
        <KyraTabsContent value="daily">
          <ReportTable
            headers={["Date", "Invoices", "Taxable", "GST Tax", "Grand Total", "Collected"]}
            rows={report.dailySales.map((d: any) => [
              d.date,
              d.invoicesCount,
              formatCurrency(d.taxable),
              formatCurrency(d.tax),
              formatCurrency(d.total),
              formatCurrency(d.collected),
            ])}
          />
        </KyraTabsContent>

        {/* 3. Monthly Sales */}
        <KyraTabsContent value="monthly">
          <ReportTable
            headers={["Month (YYYY-MM)", "Invoices", "Taxable Value", "GST Tax", "Grand Total"]}
            rows={report.monthlySales.map((m: any) => [
              m.month,
              m.invoicesCount,
              formatCurrency(m.taxable),
              formatCurrency(m.tax),
              formatCurrency(m.total),
            ])}
          />
        </KyraTabsContent>

        {/* 4. Yearly Sales */}
        <KyraTabsContent value="yearly">
          <ReportTable
            headers={["Financial Year", "Invoices", "Taxable Value", "GST Tax", "Grand Total"]}
            rows={report.yearlySales.map((y: any) => [
              y.year,
              y.invoicesCount,
              formatCurrency(y.taxable),
              formatCurrency(y.tax),
              formatCurrency(y.total),
            ])}
          />
        </KyraTabsContent>

        {/* 5. GST & HSN Summary */}
        <KyraTabsContent value="gst" className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-slate-500">Taxable Turnover</div>
              <div className="text-base font-bold font-mono mt-1">
                {formatCurrency(summary.totalTaxable)}
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
              <div className="text-blue-700 font-semibold">CGST (Intra-State)</div>
              <div className="text-base font-bold font-mono text-blue-900 mt-1">
                {formatCurrency(summary.totalCgst)}
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
              <div className="text-blue-700 font-semibold">SGST (Intra-State)</div>
              <div className="text-base font-bold font-mono text-blue-900 mt-1">
                {formatCurrency(summary.totalSgst)}
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
              <div className="text-purple-700 font-semibold">IGST (Inter-State)</div>
              <div className="text-base font-bold font-mono text-purple-900 mt-1">
                {formatCurrency(summary.totalIgst)}
              </div>
            </div>
          </div>

          <ReportTable
            headers={["HSN Code", "GST %", "Qty", "Taxable", "CGST", "SGST", "IGST", "Total Tax", "Total"]}
            rows={report.hsnSummary.map((h: any) => [
              h.hsnCode,
              `${h.gstRate}%`,
              h.quantity,
              formatCurrency(h.taxableAmount),
              formatCurrency(h.cgst),
              formatCurrency(h.sgst),
              formatCurrency(h.igst),
              formatCurrency(h.totalTax),
              formatCurrency(h.totalAmount),
            ])}
          />
        </KyraTabsContent>

        {/* 6. Product-wise Sales */}
        <KyraTabsContent value="product">
          <ReportTable
            headers={["Product Name", "SKU", "HSN", "Units Sold", "Taxable Revenue", "COGS", "Gross Profit"]}
            rows={report.productWise.map((p: any) => [
              p.name,
              p.sku,
              p.hsnCode,
              p.units,
              formatCurrency(p.revenue),
              formatCurrency(p.cost),
              formatCurrency(p.profit),
            ])}
          />
        </KyraTabsContent>

        {/* 7. Customer-wise Sales */}
        <KyraTabsContent value="customer">
          <ReportTable
            headers={["Customer Name", "Phone", "GSTIN", "Invoices", "Total Billed", "Total Paid", "Balance Due"]}
            rows={report.customerWise.map((c: any) => [
              c.name,
              c.phone,
              c.gstin,
              c.invoicesCount,
              formatCurrency(c.revenue),
              formatCurrency(c.paid),
              formatCurrency(c.balance),
            ])}
          />
        </KyraTabsContent>

        {/* 8. Stock Report */}
        <KyraTabsContent value="stock">
          <ReportTable
            headers={["Product", "SKU", "Category", "Current Stock", "Unit Cost", "Stock Cost Value", "Retail Value"]}
            rows={report.stockReport.map((s: any) => [
              s.name,
              s.sku,
              s.category,
              `${s.availableQuantity} ${s.uom}`,
              formatCurrency(s.purchasePrice),
              formatCurrency(s.stockValue),
              formatCurrency(s.retailValue),
            ])}
          />
        </KyraTabsContent>

        {/* 9. Low Stock Report */}
        <KyraTabsContent value="low_stock">
          <ReportTable
            headers={["Product", "SKU", "Category", "Available Qty", "Min Alert Threshold"]}
            rows={report.lowStockReport.map((s: any) => [
              s.name,
              s.sku,
              s.category,
              `${s.availableQuantity} ${s.uom}`,
              `${s.minStockAlert} ${s.uom}`,
            ])}
          />
        </KyraTabsContent>

        {/* 10. Outstanding Payment Report */}
        <KyraTabsContent value="outstanding">
          <ReportTable
            headers={["Invoice #", "Invoice Date", "Due Date", "Customer", "Phone", "Total", "Paid", "Balance Due"]}
            rows={report.outstandingReport.map((o: any) => [
              o.invoiceNumber,
              formatDate(o.invoiceDate),
              formatDate(o.dueDate),
              o.customerName,
              o.customerPhone,
              formatCurrency(o.grandTotal),
              formatCurrency(o.amountPaid),
              formatCurrency(o.balanceDue),
            ])}
          />
        </KyraTabsContent>

        {/* 11. Overdue Invoice Report */}
        <KyraTabsContent value="overdue">
          <ReportTable
            headers={["Invoice #", "Due Date", "Days Overdue", "Customer", "Phone", "Grand Total", "Balance Due"]}
            rows={report.overdueReport.map((o: any) => [
              o.invoiceNumber,
              formatDate(o.dueDate),
              `${o.daysOverdue} days`,
              o.customerName,
              o.customerPhone,
              formatCurrency(o.grandTotal),
              formatCurrency(o.balanceDue),
            ])}
          />
        </KyraTabsContent>

        {/* 12. Payment Collection Report */}
        <KyraTabsContent value="collections" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {(report.paymentCollections?.byMode || []).map((m: any) => (
              <div
                key={m.mode}
                className="bg-white px-4 py-3 rounded-xl border border-slate-200 text-xs"
              >
                <KyraBadge tone="emerald">{String(m.mode).replace("_", " ")}</KyraBadge>
                <div className="font-mono font-bold text-base text-slate-900 mt-1">
                  {formatCurrency(m.amount)}
                </div>
                <div className="text-[10px] text-slate-400">{m.count} receipts</div>
              </div>
            ))}
          </div>

          <ReportTable
            headers={["Date", "Invoice #", "Customer", "Mode", "Ref / UTR", "Amount"]}
            rows={(report.paymentCollections?.transactions || []).map((t: any) => [
              formatDate(t.paymentDate || t.createdAt),
              t.invoiceNumber,
              t.customerName,
              String(t.paymentMode || "cash").toUpperCase(),
              t.transactionRef || "-",
              formatCurrency(t.amount),
            ])}
          />
        </KyraTabsContent>
      </KyraTabs>
    </div>
  );
}

function ReportTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              {headers.map((h, i) => (
                <th key={i} className="py-3 px-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="py-10 text-center text-slate-400">
                  No records match the selected date criteria
                </td>
              </tr>
            ) : (
              rows.map((r, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/70">
                  {r.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className={`py-2.5 px-4 ${
                        cIdx === 0 ? "font-semibold text-slate-900" : "font-mono text-slate-700"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
