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
          title: `Invoice ${invoice.invoiceNumber} - ${invoice.seller.businessName}`,
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

      toast.success("Invoice cancelled. Stock restored to warehouse.");
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
  const totalQty = invoice.items.reduce((acc: number, it: any) => acc + (it.quantity || 0), 0);

  // Group by HSN for tax summary table
  const hsnMap: { [key: string]: { taxable: number; tax: number; cgst: number; sgst: number; igst: number } } = {};
  for (const it of invoice.items) {
    const h = it.hsnCode || "General";
    if (!hsnMap[h]) {
      hsnMap[h] = { taxable: 0, tax: 0, cgst: 0, sgst: 0, igst: 0 };
    }
    hsnMap[h].taxable += it.taxableAmount;
    hsnMap[h].tax += it.totalTax;
    hsnMap[h].cgst += it.cgstAmount;
    hsnMap[h].sgst += it.sgstAmount;
    hsnMap[h].igst += it.igstAmount;
  }

  return (
    <div className="space-y-6">
      {/* Top Action Bar (Hidden in Print) */}
      <div className="no-print print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
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
        <div className="no-print print:hidden p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold">This invoice has been CANCELLED</span>
            <p className="mt-0.5 text-red-700">
              Reason: {invoice.cancellationReason || "No reason given"} • Cancelled by{" "}
              {invoice.cancelledBy?.userName || "Staff"} on {formatDateTime(invoice.cancelledAt)}
            </p>
          </div>
        </div>
      )}

      {/* Exact Tax Invoice Representation matching sample bill */}
      <div id="printable-invoice" className="printable-invoice bg-white border-2 border-black rounded-lg p-6 sm:p-10 shadow-sm max-w-4xl mx-auto text-black print:border-none print:p-0 print:shadow-none print:w-full print:max-w-none print:m-0">
        {/* Title */}
        <div className="text-center pb-2 border-b-2 border-black">
          <h2 className="text-base font-bold tracking-wide">Tax Invoice</h2>
        </div>

        {/* Top Grid: Seller vs Meta */}
        <div className="grid grid-cols-2 border-b border-black text-xs">
          {/* Seller Side */}
          <div className="p-3 border-r border-black space-y-1">
            <div className="font-bold text-sm tracking-wide">{invoice.seller.businessName}</div>
            <div>{invoice.seller.address}</div>
            <div className="font-mono">GSTIN/UIN: {invoice.seller.gstin}</div>
            <div>State Name : {invoice.seller.state}, Code : {invoice.seller.stateCode}</div>
          </div>

          {/* Meta Side */}
          <div className="text-xs divide-y divide-black">
            <div className="p-2 grid grid-cols-2">
              <div>
                <span className="font-bold">Invoice No. </span>
                <span className="font-mono">{invoice.invoiceNumber}</span>
              </div>
              <div className="text-right">
                <span className="font-bold">Dated: </span>
                <span>{formatDate(invoice.invoiceDate)}</span>
              </div>
            </div>
            <div className="p-2">
              <span className="font-bold">Mode/Terms of Payment: </span>
              <span>Cash / Current</span>
            </div>
            <div className="p-2">
              <span className="font-bold">Place of Supply: </span>
              <span>{invoice.customer.state} ({invoice.customer.stateCode})</span>
            </div>
          </div>
        </div>

        {/* Buyer Section */}
        <div className="p-3 border-b-2 border-black text-xs space-y-1 bg-slate-50/50">
          <div className="font-bold">Buyer (Bill to) / Consignee:</div>
          <div className="font-bold text-sm">{invoice.customer.businessName || invoice.customer.name}</div>
          <div>{invoice.customer.billingAddress}</div>
          <div className="font-mono">GSTIN/UIN : {invoice.customer.gstin || "Unregistered"}</div>
          <div>State Name : {invoice.customer.state}, Code :{invoice.customer.stateCode}</div>
        </div>

        {/* Items Table with exact columns from sample bill */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs border-b-2 border-black">
            <thead>
              <tr className="border-b border-black bg-slate-100/70 font-bold">
                <th className="py-2 px-2 text-center w-8 border-r border-black">Sl<br/>No.</th>
                <th className="py-2 px-3 border-r border-black">Description of Goods</th>
                <th className="py-2 px-2 text-center border-r border-black">HSNCode</th>
                <th className="py-2 px-2 text-center border-r border-black">Quantity</th>
                <th className="py-2 px-2 text-right border-r border-black">Rate<br/>(Incl. of Tax)</th>
                <th className="py-2 px-2 text-right border-r border-black">Rate</th>
                <th className="py-2 px-2 text-center border-r border-black">per</th>
                <th className="py-2 px-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoice.items.map((it: any, idx: number) => {
                const rateInclTax = it.rateInclusiveTax || Math.round(it.rate * (1 + it.gstRate / 100) * 100) / 100;
                return (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2 px-2 text-center border-r border-black font-mono">{idx + 1}</td>
                    <td className="py-2 px-3 border-r border-black font-semibold">{it.productName}</td>
                    <td className="py-2 px-2 text-center border-r border-black font-mono">{it.hsnCode}</td>
                    <td className="py-2 px-2 text-center border-r border-black font-bold">{it.quantity} {it.uom || "PCS"}</td>
                    <td className="py-2 px-2 text-right border-r border-black font-mono">{rateInclTax.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right border-r border-black font-mono">{it.rate.toFixed(2)}</td>
                    <td className="py-2 px-2 text-center border-r border-black">{it.uom || "PCS"}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">{it.taxableAmount.toFixed(2)}</td>
                  </tr>
                );
              })}

              {/* Taxable Subtotal */}
              <tr className="border-t border-black font-semibold">
                <td colSpan={7} className="py-1.5 px-3 text-right border-r border-black">Taxable Value:</td>
                <td className="py-1.5 px-3 text-right font-mono font-bold">{invoice.taxableAmount.toFixed(2)}</td>
              </tr>

              {/* CGST & SGST or IGST */}
              {invoice.isInterState ? (
                <tr className="font-semibold">
                  <td colSpan={6} className="py-1 px-3 text-right border-r border-black">IGST</td>
                  <td className="py-1 px-2 text-center border-r border-black">18 %</td>
                  <td className="py-1 px-3 text-right font-mono">{invoice.totalIgst.toFixed(2)}</td>
                </tr>
              ) : (
                <>
                  <tr className="font-semibold">
                    <td colSpan={6} className="py-1 px-3 text-right border-r border-black">CGST</td>
                    <td className="py-1 px-2 text-center border-r border-black">9 %</td>
                    <td className="py-1 px-3 text-right font-mono">{invoice.totalCgst.toFixed(2)}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td colSpan={6} className="py-1 px-3 text-right border-r border-black">SGST</td>
                    <td className="py-1 px-2 text-center border-r border-black">9 %</td>
                    <td className="py-1 px-3 text-right font-mono">{invoice.totalSgst.toFixed(2)}</td>
                  </tr>
                </>
              )}

              {/* Grand Total Row */}
              <tr className="border-t-2 border-black font-bold bg-slate-50">
                <td colSpan={3} className="py-2 px-3 text-center border-r border-black">Total</td>
                <td className="py-2 px-2 text-center border-r border-black">{totalQty} PCS</td>
                <td colSpan={3} className="border-r border-black"></td>
                <td className="py-2 px-3 text-right font-mono text-sm">{formatCurrency(invoice.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Amount Chargeable in words */}
        <div className="p-3 border-b border-black text-xs">
          <div className="flex justify-between items-center">
            <span className="font-bold">Amount Chargeable (in words)</span>
            <span className="text-[11px] italic">E. & O.E</span>
          </div>
          <div className="font-bold mt-1 text-sm">{invoice.amountInWords}</div>
        </div>

        {/* HSN/SAC Tax Summary Table */}
        <div className="p-3 border-b border-black overflow-x-auto text-xs">
          <table className="w-full text-right border-collapse text-[11px] border border-black">
            <thead>
              <tr className="bg-slate-100 font-bold border-b border-black text-center">
                <th className="p-1.5 border-r border-black">HSN/SAC</th>
                <th className="p-1.5 border-r border-black">Taxable Value</th>
                {invoice.isInterState ? (
                  <>
                    <th className="p-1.5 border-r border-black">IGST Rate</th>
                    <th className="p-1.5 border-r border-black">IGST Amount</th>
                  </>
                ) : (
                  <>
                    <th className="p-1.5 border-r border-black">CGST Rate</th>
                    <th className="p-1.5 border-r border-black">CGST Amount</th>
                    <th className="p-1.5 border-r border-black">SGST Rate</th>
                    <th className="p-1.5 border-r border-black">SGST Amount</th>
                  </>
                )}
                <th className="p-1.5">Total Tax Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {Object.keys(hsnMap).map((h, i) => {
                const d = hsnMap[h];
                return (
                  <tr key={i}>
                    <td className="p-1.5 text-center border-r border-black font-mono">{h}</td>
                    <td className="p-1.5 border-r border-black font-mono">{d.taxable.toFixed(2)}</td>
                    {invoice.isInterState ? (
                      <>
                        <td className="p-1.5 text-center border-r border-black">18%</td>
                        <td className="p-1.5 border-r border-black font-mono">{d.igst.toFixed(2)}</td>
                      </>
                    ) : (
                      <>
                        <td className="p-1.5 text-center border-r border-black">9%</td>
                        <td className="p-1.5 border-r border-black font-mono">{d.cgst.toFixed(2)}</td>
                        <td className="p-1.5 text-center border-r border-black">9%</td>
                        <td className="p-1.5 border-r border-black font-mono">{d.sgst.toFixed(2)}</td>
                      </>
                    )}
                    <td className="p-1.5 font-mono font-bold">{d.tax.toFixed(2)}</td>
                  </tr>
                );
              })}
              <tr className="font-bold border-t border-black bg-slate-50">
                <td className="p-1.5 text-center border-r border-black">Total</td>
                <td className="p-1.5 border-r border-black font-mono">{invoice.taxableAmount.toFixed(2)}</td>
                {invoice.isInterState ? (
                  <>
                    <td className="p-1.5 border-r border-black"></td>
                    <td className="p-1.5 border-r border-black font-mono">{invoice.totalIgst.toFixed(2)}</td>
                  </>
                ) : (
                  <>
                    <td className="p-1.5 border-r border-black"></td>
                    <td className="p-1.5 border-r border-black font-mono">{invoice.totalCgst.toFixed(2)}</td>
                    <td className="p-1.5 border-r border-black"></td>
                    <td className="p-1.5 border-r border-black font-mono">{invoice.totalSgst.toFixed(2)}</td>
                  </>
                )}
                <td className="p-1.5 font-mono">{invoice.totalTax.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-2 text-xs">
            <span className="font-bold">Tax Amount (in words) : </span>
            <span>{invoice.amountInWords}</span>
          </div>
        </div>

        {/* Bank & Signatory Footer Grid */}
        <div className="grid grid-cols-2 text-xs">
          {/* Bank & Declaration */}
          <div className="p-3 border-r border-black space-y-2">
            <div>
              <div className="font-bold">Bank Name : {invoice.seller.bankDetails.bankName}</div>
              <div className="font-mono">A/c No. : {invoice.seller.bankDetails.accountNumber}</div>
              <div>Branch : {invoice.seller.bankDetails.branch} & IFS Code :- {invoice.seller.bankDetails.ifscCode}</div>
            </div>

            <div className="pt-2 border-t border-black text-[10px] space-y-0.5">
              <div className="font-bold text-xs mb-1">Declaration:</div>
              <div>1. We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</div>
              <div>2. Payments due within 5 days of Invoice date.</div>
              <div>3. In case of a product being defective or having a manufacturing defect, the primary responsibility for repairing or replacing it lies with the company.</div>
              <div>4. Burnt and broken will not be warrented, please check while purchasing.</div>
            </div>
          </div>

          {/* Authorised Signatory */}
          <div className="p-3 flex flex-col justify-between text-right">
            <div className="font-bold text-sm">for {invoice.seller.businessName}</div>
            <div className="pt-16 border-t border-black inline-block self-end text-center w-48 text-xs font-semibold">
              Authorised Signatory
            </div>
          </div>
        </div>

        <div className="text-center pt-2 text-[10px] text-slate-500 border-t border-black">
          This is a Computer Generated Invoice
        </div>
      </div>

      {/* Record Payment Modal */}
      {isPaymentOpen && (
        <div className="no-print print:hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
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
        <div className="no-print print:hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
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
