"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Printer,
  Download,
  CreditCard,
  Ban,
  ArrowLeft,
  Share2,
  Edit2,
  Trash2,
  Eye,
  History,
  X,
  AlertTriangle,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { generateInvoicePdf } from "@/lib/pdf";
import { generateUpiQrDataUrl } from "@/lib/qrcode";
import { KyraBadge } from "@/components/ui/kyra-ui";
import { toast } from "sonner";

export default function InvoiceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [invoice, setInvoice] = useState<any>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>("billing_staff");
  const [loading, setLoading] = useState(true);
  const [upiQrUrl, setUpiQrUrl] = useState<string>("");

  // PDF Preview Modal
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  // Payment Modal
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState<
    "cash" | "upi" | "bank_transfer" | "card" | "credit" | "other"
  >("cash");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Cancel & Delete Modals
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [submittingDelete, setSubmittingDelete] = useState(false);

  const fetchInvoiceData = async () => {
    try {
      setLoading(true);
      const [invRes, revRes, meRes] = await Promise.all([
        fetch(`/api/invoices/${id}`),
        fetch(`/api/invoices/${id}/revisions`),
        fetch("/api/auth/me"),
      ]);
      const data = await invRes.json();
      const revData = await revRes.json();
      const meData = await meRes.json();

      if (!invRes.ok || !data.success) throw new Error(data.error || "Failed to load invoice");

      setInvoice(data.invoice);
      setPayAmount(String(data.invoice.balanceDue || 0));
      if (revData.success) setRevisions(revData.revisions || []);
      if (meData?.user?.role) setUserRole(meData.user.role);

      if (data.invoice.seller?.upiId) {
        const targetAmt =
          data.invoice.balanceDue > 0 ? data.invoice.balanceDue : data.invoice.grandTotal;
        generateUpiQrDataUrl({
          upiId: data.invoice.seller.upiId,
          payeeName: data.invoice.seller.businessName || "Kyra Enterprises",
          amount: targetAmt,
          note: `Inv ${data.invoice.invoiceNumber}`,
        })
          .then(setUpiQrUrl)
          .catch(() => {});
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error loading invoice");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchInvoiceData();
  }, [id]);

  const handlePreviewPdf = async () => {
    if (!invoice) return;
    try {
      const blob = (await generateInvoicePdf(invoice, "blob")) as Blob;
      const objUrl = URL.createObjectURL(blob);
      setPdfPreviewUrl(objUrl);
    } catch {
      toast.error("Failed to generate PDF preview");
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    try {
      await generateInvoicePdf(invoice, "save");
      toast.success("A4 GST Tax Invoice PDF downloaded");
    } catch {
      toast.error("Failed to download PDF");
    }
  };

  const handleShare = async () => {
    if (!invoice) return;
    const shareText = `Kyra Enterprises Tax Invoice #${invoice.invoiceNumber} — Total: ${formatCurrency(
      invoice.grandTotal
    )}, Balance Due: ${formatCurrency(invoice.balanceDue)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice ${invoice.invoiceNumber} - Kyra Enterprises`,
          text: shareText,
          url: window.location.href,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(`${shareText} — ${window.location.href}`);
      toast.success("Invoice summary & link copied to clipboard");
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount || Number(payAmount) <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    try {
      setSubmittingPayment(true);
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice._id,
          amount: Number(payAmount),
          paymentMode: payMode,
          transactionRef: payRef,
          notes: payNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");

      toast.success(
        data.invoice?.balanceDue === 0
          ? "Full balance settled! Automatic payment reminders stopped."
          : "Partial payment recorded! Remaining balance updated."
      );
      setIsPaymentOpen(false);
      setPayRef("");
      setPayNotes("");
      fetchInvoiceData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error recording payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleCancelInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      toast.error("Please enter a cancellation reason");
      return;
    }
    try {
      setSubmittingCancel(true);
      const res = await fetch(`/api/invoices/${invoice._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reason: cancelReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cancellation failed");
      toast.success("Invoice cancelled; stock restored and reminders stopped.");
      setIsCancelOpen(false);
      fetchInvoiceData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error cancelling invoice");
    } finally {
      setSubmittingCancel(false);
    }
  };

  const handleSoftDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteReason.trim() || deleteReason.trim().length < 3) {
      toast.error("Please enter a valid deletion reason");
      return;
    }
    try {
      setSubmittingDelete(true);
      const res = await fetch(`/api/invoices/${invoice._id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deletion failed");
      toast.success(data.message || "Invoice soft-deleted");
      setIsDeleteOpen(false);
      router.push("/invoices");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error deleting invoice");
    } finally {
      setSubmittingDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-medium">Loading GST Tax Invoice...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="py-20 text-center text-xs">
        <p className="font-semibold text-slate-700">Invoice not found</p>
        <Link href="/invoices" className="text-emerald-600 hover:underline mt-2 inline-block">
          &larr; Return to All Invoices
        </Link>
      </div>
    );
  }

  const isCancelled = invoice.status === "cancelled";
  const isDeleted = invoice.isDeleted || invoice.status === "deleted";
  const sellerName = invoice.seller?.businessName || "Kyra Enterprises";

  return (
    <div className="space-y-6">
      {/* Top Action Bar (Hidden on Print) */}
      <div className="no-print print:hidden flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 font-mono">
                {invoice.invoiceNumber}
              </h1>
              <KyraBadge
                tone={
                  isDeleted || isCancelled
                    ? "red"
                    : invoice.paymentStatus === "paid"
                    ? "emerald"
                    : invoice.paymentStatus === "overdue"
                    ? "red"
                    : invoice.paymentStatus === "partial"
                    ? "blue"
                    : "amber"
                }
              >
                {isDeleted
                  ? "Soft-Deleted"
                  : isCancelled
                  ? "Cancelled"
                  : invoice.paymentStatus === "partial"
                  ? "Partially Paid"
                  : invoice.paymentStatus}
              </KyraBadge>
              {invoice.revisionNumber > 1 && (
                <KyraBadge tone="purple">Revision #{invoice.revisionNumber}</KyraBadge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Billed to <strong>{invoice.customer?.name}</strong> on{" "}
              {formatDate(invoice.invoiceDate)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {!isCancelled && !isDeleted && invoice.balanceDue > 0 && (
            <button
              onClick={() => setIsPaymentOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs"
            >
              <CreditCard className="w-4 h-4" />
              <span>Record Payment ({formatCurrency(invoice.balanceDue)} Due)</span>
            </button>
          )}

          <button
            onClick={handlePreviewPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold"
          >
            <Eye className="w-4 h-4 text-emerald-600" />
            <span>Preview PDF</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0e1e32] hover:bg-[#142a45] text-white font-semibold"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Download PDF</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>

          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>

          {!isCancelled && !isDeleted && userRole !== "billing_staff" && (
            <Link
              href={`/invoices/${invoice._id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Invoice</span>
            </Link>
          )}

          {!isCancelled && !isDeleted && userRole !== "billing_staff" && (
            <button
              onClick={() => setIsCancelOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          )}

          {!isDeleted && userRole === "admin" && (
            <button
              onClick={() => setIsDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Soft-Deleted / Cancelled Audit Banner */}
      {(isDeleted || isCancelled) && (
        <div className="no-print p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs space-y-1">
          <div className="font-bold uppercase">
            {isDeleted ? "Soft-Deleted Financial Record (Archived)" : "Cancelled Tax Invoice"}
          </div>
          {isDeleted && (
            <div>
              Deleted by <strong>{invoice.deletedBy?.userName || "Admin"}</strong> on{" "}
              {formatDateTime(invoice.deletedAt)} &bull; Reason:{" "}
              <strong>{invoice.deletionReason}</strong>
            </div>
          )}
          {isCancelled && (
            <div>
              Cancelled by <strong>{invoice.cancelledBy?.userName || "Manager"}</strong> on{" "}
              {formatDateTime(invoice.cancelledAt)} &bull; Reason:{" "}
              <strong>{invoice.cancellationReason}</strong>
            </div>
          )}
        </div>
      )}

      {/* Printable A4 GST TAX INVOICE Document */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-4xl mx-auto print:shadow-none print:border-none print:p-2 print:max-w-none">
        {/* Seller Brand Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-[#0e1e32]">
          <div className="flex items-start gap-3.5">
            <img
              src={invoice.seller?.logoUrl || "/logo.jpeg"}
              alt={sellerName}
              className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
              onError={(e) => ((e.target as HTMLElement).style.display = "none")}
            />
            <div>
              <h2 className="text-xl font-extrabold text-[#0e1e32] tracking-tight">{sellerName}</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {invoice.seller?.address}, {invoice.seller?.city}, {invoice.seller?.state} (
                {invoice.seller?.stateCode}) &ndash; {invoice.seller?.pincode}
              </p>
              <p className="text-xs font-mono font-bold text-emerald-700 mt-1">
                GSTIN: {invoice.seller?.gstin || "N/A"}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs space-y-0.5">
            <div className="inline-block px-3 py-1 rounded-md bg-[#0e1e32] text-white font-bold tracking-wider uppercase text-[11px] mb-1">
              TAX INVOICE
            </div>
            <div className="text-slate-600">Phone: {invoice.seller?.phone}</div>
            <div className="text-slate-600">Email: {invoice.seller?.email}</div>
          </div>
        </div>

        {/* Buyer & Invoice Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-b border-slate-200 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Billed To (Customer)
            </div>
            <div className="font-bold text-sm text-slate-900">
              {invoice.customer?.businessName || invoice.customer?.name}
            </div>
            <div className="text-slate-600">{invoice.customer?.billingAddress}</div>
            <div className="text-slate-600">
              State: <strong>{invoice.customer?.state}</strong> ({invoice.customer?.stateCode})
              &bull; Ph: {invoice.customer?.phone}
            </div>
            <div className="font-mono font-bold text-slate-800">
              Customer GSTIN: {invoice.customer?.gstin || "Unregistered"}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Invoice Details
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice Number:</span>
              <span className="font-mono font-bold text-slate-900">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice Date:</span>
              <span className="font-mono font-semibold">{formatDate(invoice.invoiceDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Due Date:</span>
              <span className="font-mono font-semibold">
                {invoice.dueDate ? formatDate(invoice.dueDate) : "Immediate"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">GST Regime:</span>
              <span className="font-semibold text-emerald-700">
                {invoice.isInterState ? "Inter-State (IGST)" : "Intra-State (CGST + SGST)"}
              </span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="py-4 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0e1e32] text-white">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Product Description</th>
                <th className="py-2.5 px-3 text-center">HSN</th>
                <th className="py-2.5 px-3 text-center">Qty</th>
                <th className="py-2.5 px-3 text-right">Rate</th>
                <th className="py-2.5 px-3 text-right">Disc.</th>
                <th className="py-2.5 px-3 text-right">Taxable</th>
                <th className="py-2.5 px-3 text-center">GST %</th>
                {invoice.isInterState ? (
                  <th className="py-2.5 px-3 text-right">IGST</th>
                ) : (
                  <>
                    <th className="py-2.5 px-3 text-right">CGST</th>
                    <th className="py-2.5 px-3 text-right">SGST</th>
                  </>
                )}
                <th className="py-2.5 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 border-b border-slate-200">
              {(invoice.items || []).map((it: any, idx: number) => (
                <tr key={idx}>
                  <td className="py-2.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-900">{it.productName}</div>
                    <div className="text-[10px] font-mono text-slate-400">{it.sku}</div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">{it.hsnCode}</td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold">
                    {it.quantity} {it.uom}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(it.rate)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {formatCurrency(it.discount || 0)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {formatCurrency(it.taxableAmount)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">{it.gstRate}%</td>
                  {invoice.isInterState ? (
                    <td className="py-2.5 px-3 text-right font-mono">
                      {formatCurrency(it.igstAmount)}
                    </td>
                  ) : (
                    <>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {formatCurrency(it.cgstAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {formatCurrency(it.sgstAmount)}
                      </td>
                    </>
                  )}
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(it.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals + Bank & UPI QR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 text-xs">
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                Amount in Words
              </div>
              <div className="font-semibold italic text-slate-900">{invoice.amountInWords}</div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase text-[#0e1e32]">
                  Bank &amp; UPI Settlement
                </div>
                <div>
                  Bank: <strong>{invoice.seller?.bankDetails?.bankName || "N/A"}</strong>
                </div>
                <div className="font-mono">
                  A/C: {invoice.seller?.bankDetails?.accountNumber || "N/A"} | IFSC:{" "}
                  {invoice.seller?.bankDetails?.ifscCode || "N/A"}
                </div>
                <div className="font-mono text-emerald-700">
                  UPI: {invoice.seller?.upiId || "N/A"}
                </div>
              </div>
              {upiQrUrl && (
                <img
                  src={upiQrUrl}
                  alt="UPI QR"
                  className="w-20 h-20 border border-slate-200 rounded-lg p-1 shrink-0"
                />
              )}
            </div>
          </div>

          <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex justify-between text-slate-600">
              <span>Taxable Amount</span>
              <span className="font-mono">{formatCurrency(invoice.taxableAmount)}</span>
            </div>
            {invoice.totalDiscount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span className="font-mono">-{formatCurrency(invoice.totalDiscount)}</span>
              </div>
            )}
            {invoice.isInterState ? (
              <div className="flex justify-between text-slate-600">
                <span>Total IGST</span>
                <span className="font-mono">+{formatCurrency(invoice.totalIgst)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>Total CGST</span>
                  <span className="font-mono">+{formatCurrency(invoice.totalCgst)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total SGST</span>
                  <span className="font-mono">+{formatCurrency(invoice.totalSgst)}</span>
                </div>
              </>
            )}
            {invoice.roundOff !== 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Round Off</span>
                <span className="font-mono">{Number(invoice.roundOff).toFixed(2)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-300 flex justify-between text-base font-bold text-[#0e1e32]">
              <span>Grand Total</span>
              <span className="font-mono">{formatCurrency(invoice.grandTotal)}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Amount Paid</span>
              <span className="font-mono">{formatCurrency(invoice.amountPaid)}</span>
            </div>
            <div className="flex justify-between text-amber-700 font-bold">
              <span>Remaining Balance</span>
              <span className="font-mono">{formatCurrency(invoice.balanceDue)}</span>
            </div>
          </div>
        </div>

        {/* Terms & Signatory */}
        <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between gap-4 text-[11px] text-slate-500">
          <div className="whitespace-pre-line max-w-xl">{invoice.termsAndConditions}</div>
          <div className="text-right shrink-0">
            <div className="font-bold text-slate-900">For {sellerName}</div>
            <div className="mt-8 text-slate-400">Authorized Signatory</div>
          </div>
        </div>
      </div>

      {/* Payment History & Audit Revision History (Hidden on Print) */}
      <div className="no-print print:hidden grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-4xl mx-auto">
        {/* Payments Recorded on this Invoice */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-3 text-xs">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <span>Payment Transactions ({invoice.payments?.length || 0})</span>
          </h3>
          {!invoice.payments || invoice.payments.length === 0 ? (
            <p className="text-slate-400 py-4">No payments recorded yet on this invoice.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {invoice.payments.map((p: any, i: number) => (
                <div key={i} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-800 uppercase text-[11px]">
                      {String(p.paymentMode || "cash").replace("_", " ")}
                      {p.transactionRef ? ` • Ref: ${p.transactionRef}` : ""}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {formatDateTime(p.paymentDate)}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-emerald-600">
                    +{formatCurrency(p.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Historical Revisions / Audit Trail */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-3 text-xs">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600" />
            <span>Invoice Revision &amp; Audit History ({revisions.length})</span>
          </h3>
          {revisions.length === 0 ? (
            <p className="text-slate-400 py-4">
              Original issued version (Revision #1 &mdash; no amendments recorded).
            </p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {revisions.map((rev: any) => (
                <div key={rev._id} className="py-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 uppercase text-[11px]">
                      Rev #{rev.revisionNumber} &bull; {rev.changeType.replace("_", " ")}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {formatDateTime(rev.createdAt)}
                    </span>
                  </div>
                  <div className="text-slate-600">Reason: {rev.reason}</div>
                  <div className="text-[11px] text-slate-400">
                    By {rev.changedBy?.userName || "Admin"} &bull; Previous Total:{" "}
                    {formatCurrency(rev.previousSnapshot?.grandTotal || 0)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PDF Preview Modal */}
      {pdfPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-3 bg-[#0e1e32] text-white flex items-center justify-between text-xs">
              <span className="font-bold">
                Kyra Enterprises &mdash; PDF Preview ({invoice.invoiceNumber})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPdf}
                  className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 font-semibold"
                >
                  Download PDF
                </button>
                <button
                  onClick={() => {
                    URL.revokeObjectURL(pdfPreviewUrl);
                    setPdfPreviewUrl(null);
                  }}
                  className="p-1 rounded hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <iframe src={pdfPreviewUrl} title="Invoice PDF Preview" className="flex-1 w-full" />
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Record Invoice Payment</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Supports partial or full settlement. Remaining balance:{" "}
              <strong className="text-slate-900">{formatCurrency(invoice.balanceDue)}</strong>
            </p>

            <form onSubmit={handleRecordPayment} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount Paid (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={invoice.balanceDue}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method *</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Card</option>
                  <option value="credit">Credit</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Transaction Reference / UTR
                </label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="Optional UTR / Cheque / UPI Ref"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-5 py-2 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50"
                >
                  {submittingPayment ? "Recording..." : "Save Payment Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Invoice Modal */}
      {isCancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Cancel GST Invoice</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Cancelling reverses stock deductions and stops automatic payment reminders.
            </p>
            <form onSubmit={handleCancelInvoice} className="space-y-4 text-xs">
              <textarea
                rows={3}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancelling this invoice..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCancelOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submittingCancel}
                  className="px-4 py-2 font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg"
                >
                  {submittingCancel ? "Cancelling..." : "Confirm Cancel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Soft Delete Modal */}
      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Soft-Delete Tax Invoice</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Preserves full previous invoice snapshot, deleted-by user, and audit reason.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 mb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice Number:</span>
                <span className="font-mono font-bold text-slate-900">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer Name:</span>
                <span className="font-bold text-slate-900">{invoice.customer?.name}</span>
              </div>
            </div>

            <form onSubmit={handleSoftDelete} className="space-y-4 text-xs">
              <textarea
                rows={2}
                required
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Mandatory audit reason for soft deletion..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDelete}
                  className="px-4 py-2 font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg"
                >
                  {submittingDelete ? "Deleting..." : "Confirm Soft Delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
