"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Edit2,
  Trash2,
  RefreshCw,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { generateInvoicePdf } from "@/lib/pdf";
import { KyraBadge } from "@/components/ui/kyra-ui";
import { toast } from "sonner";

export default function InvoicesListPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>("billing_staff");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);

  // Soft-Delete Confirmation Dialog
  const [invoiceToDelete, setInvoiceToDelete] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);
      if (paymentStatusFilter) params.append("paymentStatus", paymentStatusFilter);
      if (showDeleted) params.append("includeDeleted", "true");

      const [invRes, meRes] = await Promise.all([
        fetch(`/api/invoices?${params.toString()}`),
        fetch("/api/auth/me"),
      ]);
      const data = await invRes.json();
      const meData = await meRes.json();

      if (data.success) setInvoices(data.invoices);
      if (meData?.user?.role) setUserRole(meData.user.role);
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [search, statusFilter, paymentStatusFilter, showDeleted]);

  const handleDownloadPdf = async (inv: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await generateInvoicePdf(inv, "save");
      toast.success(`Invoice ${inv.invoiceNumber} PDF downloaded`);
    } catch {
      toast.error("Error generating PDF");
    }
  };

  const handleConfirmSoftDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceToDelete) return;
    if (!deleteReason.trim() || deleteReason.trim().length < 3) {
      toast.error("Please provide a valid deletion reason for the audit record");
      return;
    }

    try {
      setDeleting(true);
      const res = await fetch(`/api/invoices/${invoiceToDelete._id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete invoice");

      toast.success(data.message || "Invoice soft-deleted safely");
      setInvoiceToDelete(null);
      setDeleteReason("");
      fetchInvoices();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Deletion failed");
    } finally {
      setDeleting(false);
    }
  };

  const activeInvoices = invoices.filter(
    (i) => !i.isDeleted && i.status !== "cancelled" && i.status !== "deleted"
  );
  const totalRevenue = activeInvoices.reduce((acc, i) => acc + Number(i.grandTotal || 0), 0);
  const totalPending = activeInvoices.reduce((acc, i) => acc + Number(i.balanceDue || 0), 0);
  const overdueCount = activeInvoices.filter((i) => i.paymentStatus === "overdue").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Invoice Management &mdash; Kyra Enterprises
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create, view, edit/amend, print, download PDF, collect payments, and audit GST tax invoices
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Invoice</span>
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Active Invoices</div>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
            {activeInvoices.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Issued GST bills</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total Billed Value</div>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
            {formatCurrency(totalRevenue)}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1">Gross sales turnover</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Outstanding Balance</div>
          <div className="text-xl font-bold text-amber-600 mt-1 font-mono">
            {formatCurrency(totalPending)}
          </div>
          <div className="text-[11px] text-amber-600 mt-1">Receivable due</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Overdue Invoices</div>
          <div className="text-xl font-bold text-red-600 mt-1 font-mono">{overdueCount}</div>
          <div className="text-[11px] text-red-500 mt-1">Past payment due date</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row gap-3 items-center justify-between">
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by invoice #, customer name, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
          <select
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
          >
            <option value="">All Payment Statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partially Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="overdue">Overdue</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
          >
            <option value="">All Document States</option>
            <option value="finalized">Finalized</option>
            <option value="amended">Amended</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {userRole === "admin" && (
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="accent-emerald-600"
              />
              <span>Show Soft-Deleted</span>
            </label>
          )}

          <button
            onClick={fetchInvoices}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date / Due</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-center">GST Type</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p>No invoices found</p>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const isCancelled = inv.status === "cancelled";
                  const isDeleted = inv.isDeleted || inv.status === "deleted";
                  return (
                    <tr
                      key={inv._id}
                      onClick={() => router.push(`/invoices/${inv._id}`)}
                      className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${
                        isDeleted ? "opacity-60 bg-red-50/30" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">
                          {inv.invoiceNumber}
                        </div>
                        {inv.revisionNumber > 1 && (
                          <span className="text-[10px] text-blue-600 font-semibold">
                            Rev #{inv.revisionNumber}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div className="text-slate-700">{formatDate(inv.invoiceDate)}</div>
                        {inv.dueDate && (
                          <div className="text-[10px] text-slate-400">
                            Due: {formatDate(inv.dueDate)}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{inv.customer?.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {inv.customer?.phone}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <KyraBadge tone={inv.isInterState ? "purple" : "blue"}>
                          {inv.isInterState ? "IGST" : "CGST+SGST"}
                        </KyraBadge>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(inv.grandTotal)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-emerald-600">
                        {formatCurrency(inv.amountPaid)}
                      </td>

                      <td
                        className={`py-3 px-4 text-right font-mono font-bold ${
                          inv.balanceDue > 0 ? "text-amber-600" : "text-slate-400"
                        }`}
                      >
                        {formatCurrency(inv.balanceDue)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {isDeleted ? (
                          <KyraBadge tone="red">Soft-Deleted</KyraBadge>
                        ) : isCancelled ? (
                          <KyraBadge tone="red">Cancelled</KyraBadge>
                        ) : inv.paymentStatus === "paid" ? (
                          <KyraBadge tone="emerald">Paid</KyraBadge>
                        ) : inv.paymentStatus === "overdue" ? (
                          <KyraBadge tone="red">Overdue</KyraBadge>
                        ) : inv.paymentStatus === "partial" ? (
                          <KyraBadge tone="blue">Partially Paid</KyraBadge>
                        ) : (
                          <KyraBadge tone="amber">Unpaid</KyraBadge>
                        )}
                      </td>

                      <td
                        className="py-3 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <Link
                            href={`/invoices/${inv._id}`}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title="View Invoice"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>

                          {!isCancelled && !isDeleted && userRole !== "billing_staff" && (
                            <Link
                              href={`/invoices/${inv._id}/edit`}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Edit / Amend Invoice"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Link>
                          )}

                          <button
                            onClick={(e) => handleDownloadPdf(inv, e)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title="Download PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {!isDeleted && userRole === "admin" && (
                            <button
                              onClick={() => {
                                setInvoiceToDelete(inv);
                                setDeleteReason("");
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Delete Invoice (Soft Delete)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* Soft Delete Confirmation Dialog */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Invoice Soft-Deletion</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Accounting records are never silently erased. Previous invoice data, deleted-by user, and timestamp are preserved in audit history.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 mb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice Number:</span>
                <span className="font-mono font-bold text-slate-900">
                  {invoiceToDelete.invoiceNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer Name:</span>
                <span className="font-bold text-slate-900">
                  {invoiceToDelete.customer?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Grand Total:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatCurrency(invoiceToDelete.grandTotal)}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmSoftDelete} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mandatory Deletion Reason *
                </label>
                <textarea
                  rows={2}
                  required
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="State why this invoice is being archived/deleted..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInvoiceToDelete(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleting}
                  className="px-4 py-2 font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-50"
                >
                  {deleting ? "Archiving..." : "Confirm Soft Delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
