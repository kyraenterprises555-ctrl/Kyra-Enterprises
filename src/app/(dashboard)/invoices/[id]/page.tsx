"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Printer,
  Download,
  CreditCard,
  Ban,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Share2,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { generateInvoicePdf } from "@/lib/pdf";
import { toast } from "sonner";

export default function InvoiceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState<"cash" | "upi" | "bank_transfer" | "card" | "credit">("cash");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/invoices/${id}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to load invoice");
      setInvoice(data.invoice);
      setPayAmount(String(data.invoice.balanceDue || 0));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading invoice";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchInvoice();
  }, [id]);

  const handleDownloadPdf = () => {
    if (!invoice) return;
    try {
      generateInvoicePdf(invoice);
      toast.success("PDF downloaded successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice ${invoice.invoiceNumber} - Kayra Enterprises`,
          text: `Invoice #${invoice.invoiceNumber} for ${formatCurrency(invoice.grandTotal)}`,
          url: window.location.href,
        });
      } catch {
        // ignore
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Invoice URL copied to clipboard");
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

      toast.success("Payment recorded successfully");
      setIsPaymentOpen(false);
      fetchInvoice();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error recording payment";
      toast.error(msg);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleCancelInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason) {
      toast.error("Please provide a reason for cancellation");
      return;
    }

    try {
      setSubmittingCancel(true);
      const res = await fetch(`/api/invoices/${invoice._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          reason: cancelReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel invoice");

      toast.success("Invoice cancelled. Stock reversed to warehouse.");
      setIsCancelOpen(false);
      fetchInvoice();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error cancelling invoice";
      toast.error(msg);
    } finally {
      setSubmittingCancel(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-medium">Loading Tax Invoice...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm font-semibold text-slate-700">Invoice not found</p>
        <Link href="/invoices" className="text-xs text-emerald-600 hover:underline mt-2 inline-block">
          Return to Invoice Listing
        </Link>
      </div>
    );
  }

  const isCancelled = invoice.status === "cancelled";
  const isPaid = invoice.paymentStatus === "paid";
  const isPartial = invoice.paymentStatus === "partial";

  return (
    <div className="space-y-6">
      {/* Top Action Bar (Hidden in Print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Back to Invoices"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">{invoice.invoiceNumber}</h1>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  isCancelled
                    ? "bg-red-100 text-red-700 border border-red-200"
                    : isPaid
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                    : isPartial
                    ? "bg-amber-100 text-amber-700 border border-amber-200"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                {isCancelled ? "Cancelled" : invoice.paymentStatus}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Issued on {formatDate(invoice.invoiceDate)} • Created by {invoice.createdBy?.userName || "Admin"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isCancelled && invoice.balanceDue > 0 && (
            <button
              onClick={() => setIsPaymentOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Record Payment</span>
            </button>
          )}

          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          <button
            onClick={handleShare}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs"
            title="Share"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>

          {!isCancelled && (
            <button
              onClick={() => setIsCancelOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium border border-red-200"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Cancel Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* Cancelled Banner if applicable */}
      {isCancelled && (
        <div className="no-print p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold">This invoice has been CANCELLED</span>
            <p className="mt-0.5 text-red-700">
              Reason: {invoice.cancellationReason || "No reason given"} • Cancelled by{" "}
              {invoice.cancelledBy?.userName || "Staff"} on {formatDateTime(invoice.cancelledAt)}
            </p>
            <p className="text-[11px] text-red-600 mt-1">
              Note: All item quantities were safely restored back to available inventory.
            </p>
          </div>
        </div>
      )}

      {/* Printable Invoice Container */}
      <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 shadow-sm max-w-4xl mx-auto print:border-none print:p-0 print:shadow-none">
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b-2 border-slate-900">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#1e3a5f] text-white flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black text-[#1e3a5f] tracking-tight uppercase">
                {invoice.seller.businessName}
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium">TAX INVOICE / BILL OF SUPPLY</p>
            <p className="text-xs text-slate-600 mt-1">
              GSTIN: <strong className="font-mono text-slate-900">{invoice.seller.gstin}</strong>
            </p>
          </div>

          <div className="sm:text-right">
            <div className="text-sm font-black text-slate-900 tracking-wide font-mono">
              INVOICE NO: {invoice.invoiceNumber}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              Date: <strong className="text-slate-900">{formatDate(invoice.invoiceDate)}</strong>
            </div>
            <div className="text-xs text-slate-600">
              Place of Supply:{" "}
              <strong className="text-slate-900">
                {invoice.customer.state} ({invoice.customer.stateCode})
              </strong>
            </div>
            <div className="mt-1">
              <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-800 text-[10px] font-bold rounded">
                {invoice.isInterState ? "INTER-STATE SUPPLY (IGST)" : "INTRA-STATE SUPPLY (CGST + SGST)"}
              </span>
            </div>
          </div>
        </div>

        {/* Seller & Customer Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-200 text-xs">
          {/* Seller Details */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="font-bold text-[#1e3a5f] uppercase tracking-wider mb-2">
              Billed By (Seller):
            </div>
            <div className="font-bold text-slate-900 text-sm">{invoice.seller.businessName}</div>
            <div className="text-slate-600 mt-1">{invoice.seller.address}</div>
            <div className="text-slate-600">
              {invoice.seller.city}, {invoice.seller.state} - {invoice.seller.pincode} (Code:{" "}
              {invoice.seller.stateCode})
            </div>
            <div className="text-slate-600 mt-1">Phone: {invoice.seller.phone}</div>
            <div className="text-slate-600">Email: {invoice.seller.email}</div>
            <div className="text-slate-800 font-semibold mt-1">GSTIN: {invoice.seller.gstin}</div>
          </div>

          {/* Customer Details */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="font-bold text-[#1e3a5f] uppercase tracking-wider mb-2">
              Billed To (Buyer):
            </div>
            <div className="font-bold text-slate-900 text-sm">
              {invoice.customer.businessName || invoice.customer.name}
            </div>
            {invoice.customer.businessName && (
              <div className="text-slate-600">Attn: {invoice.customer.name}</div>
            )}
            <div className="text-slate-600 mt-1">{invoice.customer.billingAddress}</div>
            <div className="text-slate-600">
              State: {invoice.customer.state} (Code: {invoice.customer.stateCode})
            </div>
            <div className="text-slate-600 mt-1">Phone: {invoice.customer.phone}</div>
            {invoice.customer.email && (
              <div className="text-slate-600">Email: {invoice.customer.email}</div>
            )}
            <div className="text-slate-800 font-semibold mt-1">
              GSTIN: {invoice.customer.gstin || "Unregistered Buyer"}
            </div>
          </div>
        </div>

        {/* Itemized Products Table */}
        <div className="py-6 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#1e3a5f] text-white">
                <th className="py-2.5 px-3 text-center w-8 font-semibold">#</th>
                <th className="py-2.5 px-3 font-semibold">Item Description</th>
                <th className="py-2.5 px-3 text-center font-semibold">HSN</th>
                <th className="py-2.5 px-3 text-center font-semibold">Qty</th>
                <th className="py-2.5 px-3 text-right font-semibold">Rate</th>
                <th className="py-2.5 px-3 text-right font-semibold">Taxable</th>
                {invoice.isInterState ? (
                  <>
                    <th className="py-2.5 px-3 text-center font-semibold">IGST %</th>
                    <th className="py-2.5 px-3 text-right font-semibold">IGST</th>
                  </>
                ) : (
                  <>
                    <th className="py-2.5 px-3 text-right font-semibold">CGST</th>
                    <th className="py-2.5 px-3 text-right font-semibold">SGST</th>
                  </>
                )}
                <th className="py-2.5 px-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoice.items.map((it: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 text-center text-slate-500">{idx + 1}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900">{it.productName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">SKU: {it.sku}</div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600">
                    {it.hsnCode}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-slate-800">
                    {it.quantity} {it.uom}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                    {formatCurrency(it.rate)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                    {formatCurrency(it.taxableAmount)}
                  </td>

                  {invoice.isInterState ? (
                    <>
                      <td className="py-2.5 px-3 text-center text-slate-600">{it.gstRate}%</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {formatCurrency(it.igstAmount)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {formatCurrency(it.cgstAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
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

        {/* Calculation & Bank Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4 border-t border-slate-200 text-xs">
          {/* Left Column: Words, Bank Info */}
          <div className="space-y-4">
            <div>
              <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                Amount Chargeable (in words):
              </div>
              <div className="font-semibold text-emerald-900 bg-emerald-50 p-3 rounded-lg italic border border-emerald-200">
                {invoice.amountInWords}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div className="font-bold text-[#1e3a5f] uppercase tracking-wider text-[11px] mb-2">
                Bank & Payment Details
              </div>
              <div className="text-slate-600 space-y-1">
                <div>Bank Name: <strong className="text-slate-800">{invoice.seller.bankDetails?.bankName}</strong></div>
                <div>A/C Holder: <strong className="text-slate-800">{invoice.seller.bankDetails?.accountHolder}</strong></div>
                <div>A/C Number: <strong className="text-slate-800 font-mono">{invoice.seller.bankDetails?.accountNumber}</strong></div>
                <div>IFSC Code: <strong className="text-slate-800 font-mono">{invoice.seller.bankDetails?.ifscCode}</strong></div>
                <div>Branch: <strong className="text-slate-800">{invoice.seller.bankDetails?.branch}</strong></div>
                {invoice.seller.upiId && (
                  <div className="pt-1 text-emerald-700 font-semibold">
                    UPI ID: {invoice.seller.upiId}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Tax Breakdown */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex justify-between text-slate-600">
              <span>Taxable Amount:</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatCurrency(invoice.taxableAmount)}
              </span>
            </div>

            {invoice.totalDiscount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Total Discount:</span>
                <span className="font-mono font-semibold">
                  -{formatCurrency(invoice.totalDiscount)}
                </span>
              </div>
            )}

            {invoice.isInterState ? (
              <div className="flex justify-between text-purple-700">
                <span>IGST:</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(invoice.totalIgst)}
                </span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>Central GST (CGST):</span>
                  <span className="font-mono font-semibold">
                    {formatCurrency(invoice.totalCgst)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>State GST (SGST):</span>
                  <span className="font-mono font-semibold">
                    {formatCurrency(invoice.totalSgst)}
                  </span>
                </div>
              </>
            )}

            {invoice.roundOff !== 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Round Off:</span>
                <span className="font-mono">{formatCurrency(invoice.roundOff)}</span>
              </div>
            )}

            <div className="pt-3 border-t-2 border-slate-900 flex justify-between items-center text-sm font-black text-slate-900">
              <span className="uppercase tracking-wider">Grand Total:</span>
              <span className="text-lg text-[#1e3a5f] font-mono">
                {formatCurrency(invoice.grandTotal)}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Amount Paid:</span>
                <span className="font-mono text-emerald-700 font-semibold">
                  {formatCurrency(invoice.amountPaid)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-slate-900">
                <span>Balance Due:</span>
                <span className="font-mono text-red-600">
                  {formatCurrency(invoice.balanceDue)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Terms & Signatures */}
        <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-2 gap-6 text-xs">
          <div>
            <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
              Terms & Conditions:
            </div>
            <p className="text-[11px] text-slate-500 whitespace-pre-line leading-relaxed">
              {invoice.termsAndConditions ||
                "1. Goods once sold will not be taken back without original invoice.\n2. Interest @ 18% p.a. will be charged for overdue payments."}
            </p>
          </div>

          <div className="text-right flex flex-col justify-between items-end">
            <div className="font-bold text-[#1e3a5f]">
              For {invoice.seller.businessName}
            </div>
            <div className="pt-12 text-slate-500 border-t border-slate-300 w-48 text-center text-[11px]">
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {isPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900">Record Invoice Payment</h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Apply customer payment against invoice #{invoice.invoiceNumber}
            </p>

            <form onSubmit={handleRecordPayment} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={invoice.balanceDue}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  Current Balance Due: {formatCurrency(invoice.balanceDue)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Mode *
                </label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI (GPay, PhonePe, Paytm)</option>
                  <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="card">Credit / Debit Card</option>
                  <option value="credit">Credit / Account</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transaction / Reference ID (Optional)
                </label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. UTR / UPI Ref / Cheque No."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Additional payment notes..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPaymentOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50"
                >
                  {submittingPayment ? "Recording..." : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Invoice Modal */}
      {isCancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h2 className="text-base font-bold text-red-600">Cancel Tax Invoice</h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Cancelling will reverse product stock movements back to warehouse inventory and create an audit log.
            </p>

            <form onSubmit={handleCancelInvoice} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Cancellation Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Customer cancelled order / Incorrect items billed"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCancelOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submittingCancel}
                  className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-50"
                >
                  {submittingCancel ? "Cancelling..." : "Confirm Cancellation & Restore Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
