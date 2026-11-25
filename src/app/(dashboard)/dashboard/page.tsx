"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  DollarSign,
  FileText,
  Package,
  Users,
  AlertTriangle,
  Clock,
  Boxes,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertOctagon,
  Calendar,
  CreditCard,
  FileSpreadsheet,
  ArrowRight,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { toast } from "sonner";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics);
      }
    } catch {
      toast.error("Failed to load Kyra Enterprises dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-medium">Loading Kyra Enterprises Executive Dashboard...</p>
      </div>
    );
  }

  if (!metrics) return null;

  const kpiCards = [
    {
      label: "Total Sales",
      value: formatCurrency(metrics.totalSales),
      sub: "Gross invoiced turnover",
      icon: TrendingUp,
      tone: "text-emerald-600",
    },
    {
      label: "Today's Sales",
      value: formatCurrency(metrics.todaySales),
      sub: "Today's GST billing",
      icon: DollarSign,
      tone: "text-sky-600",
    },
    {
      label: "Monthly Sales",
      value: formatCurrency(metrics.monthlySales),
      sub: "Current calendar month",
      icon: Calendar,
      tone: "text-indigo-600",
    },
    {
      label: "Total Invoices",
      value: String(metrics.totalInvoices),
      sub: "Active tax invoices",
      icon: FileText,
      tone: "text-slate-800",
    },
    {
      label: "Total Products",
      value: String(metrics.totalProducts),
      sub: "Active catalog SKUs",
      icon: Package,
      tone: "text-teal-600",
    },
    {
      label: "Total Customers",
      value: String(metrics.totalCustomers),
      sub: "Registered & retail accounts",
      icon: Users,
      tone: "text-blue-600",
    },
    {
      label: "Total Stock Value",
      value: formatCurrency(metrics.totalStockValue),
      sub: "At purchase valuation",
      icon: Boxes,
      tone: "text-slate-900",
    },
    {
      label: "Low Stock Alerts",
      value: String(metrics.lowStockCount),
      sub: metrics.lowStockCount > 0 ? "Needs replenishment" : "Optimal levels",
      icon: AlertTriangle,
      tone: metrics.lowStockCount > 0 ? "text-amber-600" : "text-emerald-600",
    },
    {
      label: "Payments Received",
      value: formatCurrency(metrics.totalPaymentsReceived),
      sub: "Verified collections",
      icon: CheckCircle2,
      tone: "text-emerald-600",
    },
    {
      label: "Outstanding Payments",
      value: formatCurrency(metrics.totalOutstandingPayments),
      sub: "Total receivable balance",
      icon: Clock,
      tone: "text-amber-600",
    },
    {
      label: "Overdue Payments",
      value: formatCurrency(metrics.overduePayments),
      sub: `${metrics.overdueCount || 0} past-due invoices`,
      icon: AlertOctagon,
      tone: metrics.overduePayments > 0 ? "text-red-600" : "text-slate-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Kyra Enterprises &mdash; Executive Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Live GST billing velocity, inventory valuation, payment collections, and overdue alerts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/products/bulk-upload"
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Bulk Upload</span>
          </Link>
          <Link
            href="/invoices/new"
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Invoice</span>
          </Link>
          <button
            onClick={fetchMetrics}
            title="Refresh live metrics"
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 11 KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-slate-500 gap-2">
                <span className="text-[11px] font-semibold truncate">{kpi.label}</span>
                <Icon className={`w-4 h-4 shrink-0 ${kpi.tone}`} />
              </div>
              <div className={`text-base sm:text-lg font-bold mt-2 font-mono truncate ${kpi.tone}`}>
                {kpi.value}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 truncate">{kpi.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Charts Row 1: Monthly Revenue + Sales vs Collections Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Monthly Revenue
              </h2>
              <p className="text-[11px] text-slate-400">Gross GST invoiced revenue across the year</p>
            </div>
            <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              Live MongoDB
            </span>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.monthlySalesChart}>
                <defs>
                  <linearGradient id="kyraRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip
                  formatter={(val: any) => [formatCurrency(Number(val)), "Revenue"]}
                  contentStyle={{
                    backgroundColor: "#0e1e32",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "11px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#059669"
                  strokeWidth={2.5}
                  fill="url(#kyraRevGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="mb-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Sales Overview (Billed vs Collected)
            </h2>
            <p className="text-[11px] text-slate-400">
              Monthly sales billed compared against payments received
            </p>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.monthlySalesChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip
                  formatter={(val: any) => formatCurrency(Number(val))}
                  contentStyle={{
                    backgroundColor: "#0e1e32",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "11px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="sales" name="Billed Sales" fill="#0e1e32" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collected" name="Payments Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2: Top Selling Products + Inventory Overview + Pending Payments Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Top Selling Products */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Top Selling Products
            </h2>
            <p className="text-[11px] text-slate-400 mb-4">Highest revenue SKUs</p>

            {metrics.topSellingProducts.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No product sales recorded yet
              </div>
            ) : (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.topSellingProducts.map((p: any) => ({
                      ...p,
                      shortName: p.name.length > 18 ? p.name.slice(0, 18) + "…" : p.name,
                    }))}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      stroke="#94a3b8"
                      fontSize={10}
                      tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    />
                    <YAxis
                      type="category"
                      dataKey="shortName"
                      width={105}
                      stroke="#475569"
                      fontSize={10}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(Number(val)), "Revenue"]}
                      contentStyle={{
                        backgroundColor: "#0e1e32",
                        border: "none",
                        borderRadius: "8px",
                        color: "#fff",
                        fontSize: "11px",
                      }}
                    />
                    <Bar dataKey="revenue" fill="#059669" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <Link
            href="/products"
            className="pt-3 border-t border-slate-100 text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center justify-center gap-1"
          >
            <span>Open Product Catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Inventory Overview */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Inventory Overview
            </h2>
            <p className="text-[11px] text-slate-400 mb-4">Stock valuation by product category</p>

            {metrics.inventoryOverviewChart?.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">No inventory items</div>
            ) : (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(metrics.inventoryOverviewChart || []).slice(0, 5).map((c: any) => ({
                      ...c,
                      shortCat: c.category.length > 14 ? c.category.slice(0, 14) + "…" : c.category,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="shortCat" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                      tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(Number(val)), "Stock Cost Value"]}
                      contentStyle={{
                        backgroundColor: "#0e1e32",
                        border: "none",
                        borderRadius: "8px",
                        color: "#fff",
                        fontSize: "11px",
                      }}
                    />
                    <Bar dataKey="stockValue" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <Link
            href="/inventory"
            className="pt-3 border-t border-slate-100 text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center justify-center gap-1"
          >
            <span>Inspect Stock Ledger</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Pending Payments Overview */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Pending Payments Overview
            </h2>
            <p className="text-[11px] text-slate-400 mb-2">
              Collections vs Partial, Unpaid &amp; Overdue balances
            </p>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(metrics.pendingPaymentsOverview || []).filter((d: any) => d.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={68}
                    paddingAngle={3}
                  >
                    {(metrics.pendingPaymentsOverview || [])
                      .filter((d: any) => d.value > 0)
                      .map((entry: any, index: number) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[11px] mt-1">
              {(metrics.pendingPaymentsOverview || []).map((p: any) => (
                <div key={p.name} className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded">
                  <span className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="truncate text-slate-600">{p.name}</span>
                  </span>
                  <span className="font-mono font-bold text-slate-900 ml-1">
                    {formatCurrency(p.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/payment-reminders"
            className="pt-3 mt-3 border-t border-slate-100 text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center justify-center gap-1"
          >
            <span>Open Payment Reminders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Bottom Tables: Low Stock Alerts + Recent Invoices + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Low Stock Watchlist */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Low Stock Alerts ({metrics.lowStockCount})
              </h2>
            </div>
            <Link href="/inventory" className="text-xs font-semibold text-emerald-600">
              Restock
            </Link>
          </div>

          {metrics.lowStockProducts.length === 0 ? (
            <div className="py-10 text-center text-xs text-emerald-600 font-medium">
              All products are above minimum stock levels
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {metrics.lowStockProducts.map((p: any) => (
                <div key={p._id} className="py-2.5 flex items-center justify-between text-xs gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">SKU: {p.sku}</div>
                  </div>
                  <span
                    className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      p.availableQuantity === 0
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    {p.availableQuantity} {p.uom}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Invoices */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Recent Invoices
              </h2>
            </div>
            <Link href="/invoices" className="text-xs font-semibold text-emerald-600">
              View All
            </Link>
          </div>

          {metrics.recentInvoices.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">No invoices generated yet</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {metrics.recentInvoices.map((inv: any) => (
                <Link
                  key={inv._id}
                  href={`/invoices/${inv._id}`}
                  className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 px-1 rounded transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {inv.customer?.name} &bull; {formatDate(inv.invoiceDate)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-slate-900">
                      {formatCurrency(inv.grandTotal)}
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase ${
                        inv.paymentStatus === "paid"
                          ? "text-emerald-600"
                          : inv.paymentStatus === "overdue"
                          ? "text-red-600"
                          : "text-amber-600"
                      }`}
                    >
                      {inv.paymentStatus === "partial" ? "Partially Paid" : inv.paymentStatus}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Recent Transactions
              </h2>
            </div>
            <Link href="/payments" className="text-xs font-semibold text-emerald-600">
              Ledger
            </Link>
          </div>

          {!metrics.recentTransactions || metrics.recentTransactions.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No payment transactions recorded yet
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {metrics.recentTransactions.map((tx: any) => (
                <div key={tx._id} className="py-2.5 flex items-center justify-between text-xs gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{tx.customerName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {tx.invoiceNumber} &bull; {formatDateTime(tx.paymentDate || tx.createdAt)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-emerald-600">
                      +{formatCurrency(tx.amount)}
                    </div>
                    <div className="text-[10px] uppercase font-semibold text-slate-500">
                      {String(tx.paymentMode || "cash").replace("_", " ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
