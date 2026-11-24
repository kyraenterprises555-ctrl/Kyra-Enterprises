"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  CreditCard,
  Ban,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { generateInvoicePdf } from "@/lib/pdf";
import { toast } from "sonner";

export default function InvoicesListPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);
      if (paymentStatusFilter) params.append("paymentStatus", paymentStatusFilter);

      const res = await fetch(`/api/invoices?${params.toString()}`);
      const data = await res.json();
      if (data.success) setInvoices(data.invoices);
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [search, statusFilter, paymentStatusFilter]);

  const handleDownloadPdf = (inv: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      generateInvoicePdf(inv);
      toast.success("PDF downloaded");
    } catch {
      toast.error("Error generating PDF");
    }
  };

  const totalInvoices = invoices.length;
  const activeInvoices = invoices.filter((i) => i.status !== "cancelled");
  const totalRevenue = activeInvoices.reduce((acc, i) => acc + (i.grandTotal || 0), 0);
  const totalPending = activeInvoices.reduce((acc, i) => acc + (i.balanceDue || 0), 0);
  const cancelledCount = invoices.filter((i) => i.status === "cancelled").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Invoice Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View, track, print, and manage all GST tax invoices and payment statuses
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/invoices/new"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Generate New Invoice</span>
          </Link>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total Invoices</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{totalInvoices}</div>
          <div className="text-[11px] text-slate-400 mt-1">{activeInvoices.length} active billings</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total Invoiced Volume</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totalRevenue)}</div>
          <div className="text-[11px] text-emerald-600 mt-1">Across all clients</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Outstanding Due</div>
          <div className="text-xl font-bold text-amber-600 mt-1">{formatCurrency(totalPending)}</div>
          <div className="text-[11px] text-amber-600 mt-1">Pending collection</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Cancelled Invoices</div>
          <div className="text-xl font-bold text-red-600 mt-1">{cancelledCount}</div>
          <div className="text-[11px] text-red-500 mt-1">Stock movements reversed</div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by invoice # or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Payment Statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Statuses</option>
            <option value="finalized">Finalized</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            onClick={() => fetchInvoices()}
            title="Refresh"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-center">Supply Type</th>
                <th className="py-3 px-4 text-right">Taxable</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading invoices...</span>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium text-slate-600">No invoices found</p>
                    <p className="text-[11px] text-slate-400">Create your first invoice to get started</p>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const isCancelled = inv.status === "cancelled";
                  const isPaid = inv.paymentStatus === "paid";
                  const isPartial = inv.paymentStatus === "partial";

                  return (
                    <tr
                      key={inv._id}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      onClick={() => (window.location.href = `/invoices/${inv._id}`)}
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900 hover:text-emerald-600">
                          {inv.invoiceNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {formatDate(inv.invoiceDate)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{inv.customer.name}</div>
                        {inv.customer.businessName && (
                          <div className="text-[11px] text-slate-400">{inv.customer.businessName}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            inv.isInterState
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {inv.isInterState ? "IGST (Inter)" : "CGST/SGST (Intra)"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 font-mono">
                        {formatCurrency(inv.taxableAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                        {formatCurrency(inv.grandTotal)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-bold ${
                          inv.balanceDue > 0 ? "text-amber-600" : "text-emerald-700"
                        }`}
                      >
                        {formatCurrency(inv.balanceDue)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isCancelled
                              ? "bg-red-100 text-red-700 border border-red-200"
                              : isPaid
                              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                              : isPartial
                              ? "bg-amber-100 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {isCancelled ? "Cancelled" : inv.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleDownloadPdf(inv, e)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                            title="Download PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <Link
                            href={`/invoices/${inv._id}`}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                            title="View Invoice"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
