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
  ArrowUpRight,
  ArrowDownRight,
  Boxes,
  Plus,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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
      toast.error("Failed to load dashboard metrics");
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
        <p className="text-xs font-medium">Aggregating live business metrics...</p>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational snapshot, revenue velocity, and real-time inventory ledger
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/invoices/new"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Invoice</span>
          </Link>
          <button
            onClick={() => fetchMetrics()}
            title="Refresh Data"
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Sales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Total Sales</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 mt-2 font-mono">
            {formatCurrency(metrics.totalSales)}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1 font-medium flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            <span>Lifetime Gross</span>
          </div>
        </div>

        {/* Today's Sales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Today's Sales</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 mt-2 font-mono">
            {formatCurrency(metrics.todaySales)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Live POS receipts</div>
        </div>

        {/* Monthly Sales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Monthly Sales</span>
            <CalendarIcon className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 mt-2 font-mono">
            {formatCurrency(metrics.monthlySales)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Current calendar month</div>
        </div>

        {/* Total Stock Value */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Stock Value</span>
            <Boxes className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 mt-2 font-mono">
            {formatCurrency(metrics.totalStockValue)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {metrics.totalProducts} catalog products
          </div>
        </div>

        {/* Pending Payments */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Pending Dues</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-lg font-bold text-amber-600 mt-2 font-mono">
            {formatCurrency(metrics.pendingPayments)}
          </div>
          <div className="text-[11px] text-amber-700 mt-1 font-medium">
            Across {metrics.totalInvoices} invoices
          </div>
        </div>
      </div>

      {/* Interactive Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Monthly Revenue Trend Area Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Monthly Revenue Trend (FY 2026-27)
              </h2>
              <p className="text-[11px] text-slate-400">Total invoiced sales turnover by month</p>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
              Interactive
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.monthlySalesChart}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `₹${val / 1000}k`}
                />
                <Tooltip
                  formatter={(val: any) => [formatCurrency(Number(val)), "Sales Turnover"]}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "11px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#salesGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Selling Products Bar Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
              Top Selling Products
            </h2>
            <p className="text-[11px] text-slate-400 mb-4">Ranked by unit order volume</p>

            {metrics.topSellingProducts.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <span>Sales volume will populate here as invoices are generated</span>
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.topSellingProducts.map((p: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="truncate max-w-[170px]">
                      <div className="font-semibold text-slate-800 truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {p.quantity} units sold
                      </div>
                    </div>
                    <div className="font-mono font-bold text-emerald-600">
                      {formatCurrency(p.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 text-center">
            <Link
              href="/products"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center justify-center gap-1"
            >
              <span>Manage Products</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Section: Low Stock Warnings & Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Low Stock Watchlist */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Low Stock Threshold Alerts ({metrics.lowStockCount})
              </h2>
            </div>
            <Link
              href="/inventory"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              View Ledger
            </Link>
          </div>

          {metrics.lowStockProducts.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              <span className="text-emerald-600 font-medium">✓ All stock levels optimal</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {metrics.lowStockProducts.map((p: any) => (
                <div key={p._id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">SKU: {p.sku}</div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        p.availableQuantity === 0
                          ? "bg-red-50 text-red-600 border border-red-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {p.availableQuantity} {p.uom} left (Min: {p.minStockAlert})
                    </span>
                  </div>
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
                Recent Tax Invoices
              </h2>
            </div>
            <Link
              href="/invoices"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              View All
            </Link>
          </div>

          {metrics.recentInvoices.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              <span>No transactions recorded yet</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {metrics.recentInvoices.map((inv: any) => (
                <Link
                  key={inv._id}
                  href={`/invoices/${inv._id}`}
                  className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/70 rounded px-1 transition-colors"
                >
                  <div>
                    <div className="font-bold text-slate-900 font-mono">
                      {inv.invoiceNumber}
                    </div>
                    <div className="text-[11px] text-slate-500">{inv.customer.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold font-mono text-slate-900">
                      {formatCurrency(inv.grandTotal)}
                    </div>
                    <div className="text-[10px] uppercase font-semibold text-slate-400">
                      {inv.paymentStatus}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarIcon(props: any) {
  return <Clock {...props} />;
}

function ArrowRight(props: any) {
  return <ArrowUpRight {...props} />;
}
