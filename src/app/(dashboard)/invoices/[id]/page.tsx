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
import { generateUpiQrDataUrl } from "@/lib/qrcode";
import { toast } from "sonner";

export default function InvoiceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upiQrUrl, setUpiQrUrl] = useState<string>("");

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

      if (data.invoice.seller?.upiId) {
        generateUpiQrDataUrl({
          upiId: data.invoice.seller.upiId,
          payeeName: data.invoice.seller.businessName || "KYRA ENTERPRISES",
          amount: data.invoice.grandTotal,
          note: `Inv ${data.invoice.invoiceNumber}`,
        })
          .then(setUpiQrUrl)
          .catch(() => {});
      }
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

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    try {
      await generateInvoicePdf(invoice);
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

      {/* Printable Invoice matching the requested Proforma/Tax Invoice design */}
      <div
        id="printable-invoice"
        className="printable-invoice bg-white border border-[#E2D7CF] rounded-xl p-6 sm:p-10 shadow-sm max-w-4xl mx-auto text-slate-800 print:border-none print:p-0 print:shadow-none print:w-full print:max-w-none print:m-0 space-y-4"
      >
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-900 border border-slate-700 shrink-0">
                <img
                  src="/logo.jpeg"
                  alt={invoice.seller.businessName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#8B1E1E] tracking-tight">
                {invoice.seller.businessName}
              </h1>
            </div>
            <p className="text-[11px] font-medium text-[#8B1E1E]/90 pl-0.5">
              Quality Electrical & Home Appliances • Wholesale & Retail Solutions
            </p>
          </div>

          <div className="text-right text-xs space-y-0.5 sm:max-w-xs">
            <div className="font-bold text-slate-900">{invoice.seller.businessName}</div>
            <div className="text-slate-600 text-[11px]">
              Registered Enterprise, {invoice.seller.address}, {invoice.seller.city}, {invoice.seller.state} - {invoice.seller.pincode || "847223"}
            </div>
            <div className="text-slate-600 text-[11px]">
              GSTIN: <span className="font-mono font-semibold text-slate-800">{invoice.seller.gstin}</span> | Contact: {invoice.seller.phone}
            </div>
            <div className="text-slate-600 text-[11px]">
              Email: <span className="text-slate-700">{invoice.seller.email}</span>
            </div>
          </div>
        </div>

        {/* Maroon Accent Divider */}
        <div className="border-b-2 border-[#8B1E1E]" />

        {/* Centered Document Title */}
        <div className="text-center py-1">
          <h2 className="text-base sm:text-lg font-bold text-[#8B1E1E] tracking-[0.25em] uppercase">
            P R O F O R M A &nbsp; I N V O I C E
          </h2>
        </div>

        {/* Two Column Cards: INVOICE DETAILS & REFERENCE & SUPPLY */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Invoice Details Box */}
          <div className="border border-[#E2D7CF] rounded-lg p-3 bg-white space-y-1.5 text-xs">
            <div className="text-[10px] font-bold text-[#8B1E1E] uppercase tracking-wider">
              INVOICE DETAILS
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-500">Invoice No:</span>
              <span className="font-bold font-mono text-slate-900">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-500">Invoice Date:</span>
              <span className="font-bold text-slate-900">{formatDate(invoice.invoiceDate)}</span>
            </div>
          </div>

          {/* Reference & Supply Box */}
          <div className="border border-[#E2D7CF] rounded-lg p-3 bg-white space-y-1.5 text-xs">
            <div className="text-[10px] font-bold text-[#8B1E1E] uppercase tracking-wider">
              REFERENCE & SUPPLY
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-500">Place of Supply:</span>
              <span className="font-bold text-slate-900">
                {invoice.customer.state} ({invoice.customer.stateCode})
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-500">Client / Order Ref:</span>
              <span className="font-bold text-slate-900">
                {invoice.paymentStatus.toUpperCase()} / {invoice.payments?.[0]?.paymentMode?.toUpperCase() || "OFFLINE"}
              </span>
            </div>
          </div>
        </div>

        {/* Client Details Box */}
        <div className="border border-[#E2D7CF] rounded-lg p-3.5 bg-white text-xs space-y-2">
          <div className="text-[10px] font-bold text-[#8B1E1E] uppercase tracking-wider">
            CLIENT DETAILS & BILLING COMPOSITION
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="space-y-0.5 max-w-lg">
              <div className="font-bold text-sm text-slate-900">
                {invoice.customer.businessName || invoice.customer.name}
              </div>
              <div className="text-slate-600 text-[11px] leading-relaxed">
                {invoice.customer.billingAddress}
              </div>
              {invoice.customer.gstin && (
                <div className="text-[11px] text-slate-700 font-mono pt-0.5">
                  GSTIN: <span className="font-semibold">{invoice.customer.gstin}</span>
                </div>
              )}
            </div>

            <div className="text-right text-xs space-y-1 shrink-0">
              <div>
                <span className="text-slate-500">Email: </span>
                <span className="font-semibold text-slate-800">{invoice.customer.email || "N/A"}</span>
              </div>
              <div>
                <span className="text-slate-500">Mobile: </span>
                <span className="font-semibold text-slate-800 font-mono">{invoice.customer.phone || "N/A"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-[#E2D7CF] rounded-lg overflow-hidden text-xs bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF4EF] text-[#8B1E1E] border-b border-[#E2D7CF] font-bold text-[11px] tracking-wide">
                <th className="py-2.5 px-3">PRODUCT DESCRIPTION</th>
                <th className="py-2.5 px-3 text-center">HSN/SAC</th>
                <th className="py-2.5 px-3 text-center">QTY</th>
                <th className="py-2.5 px-3 text-right">RATE (₹)</th>
                <th className="py-2.5 px-3 text-right">TOTAL (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2D7CF]/60 text-slate-800">
              {invoice.items.map((it: any, idx: number) => (
                <tr key={idx} className="hover:bg-[#FAF4EF]/30 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-900">{it.productName}</div>
                    {it.sku && <div className="text-[10px] text-slate-400 font-mono">SKU: {it.sku}</div>}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-600 text-[11px]">
                    {it.hsnCode}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-slate-800">
                    {it.quantity}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                    {formatCurrency(it.rate)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(it.taxableAmount)}
                  </td>
                </tr>
              ))}

              {/* Subtotal */}
              <tr className="border-t border-[#E2D7CF] bg-white">
                <td colSpan={4} className="py-2 px-3 text-right font-medium text-slate-600">
                  Subtotal
                </td>
                <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                  {formatCurrency(invoice.taxableAmount)}
                </td>
              </tr>

              {/* Tax Details (CGST + SGST or IGST) */}
              {invoice.isInterState ? (
                <tr className="bg-white">
                  <td colSpan={4} className="py-1.5 px-3 text-right font-medium text-slate-600">
                    IGST (18%)
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-slate-800">
                    + {formatCurrency(invoice.totalIgst)}
                  </td>
                </tr>
              ) : (
                <>
                  <tr className="bg-white">
                    <td colSpan={4} className="py-1 px-3 text-right font-medium text-slate-600">
                      CGST (9%)
                    </td>
                    <td className="py-1 px-3 text-right font-mono text-slate-800">
                      + {formatCurrency(invoice.totalCgst)}
                    </td>
                  </tr>
                  <tr className="bg-white">
                    <td colSpan={4} className="py-1 px-3 text-right font-medium text-slate-600">
                      SGST (9%)
                    </td>
                    <td className="py-1 px-3 text-right font-mono text-slate-800">
                      + {formatCurrency(invoice.totalSgst)}
                    </td>
                  </tr>
                </>
              )}

              {invoice.roundOff !== 0 && (
                <tr className="bg-white">
                  <td colSpan={4} className="py-1 px-3 text-right font-medium text-slate-600">
                    Round Off
                  </td>
                  <td className="py-1 px-3 text-right font-mono text-slate-800">
                    {invoice.roundOff > 0 ? `+ ${formatCurrency(invoice.roundOff)}` : formatCurrency(invoice.roundOff)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Highlighted Total Payable Amount Bar */}
          <div className="bg-[#F8ECE8] border-t-2 border-[#E2D7CF] py-2.5 px-4 flex items-center justify-between">
            <span className="font-bold text-sm text-[#8B1E1E] uppercase tracking-wide">
              Total Payable Amount
            </span>
            <span className="font-bold text-base sm:text-lg text-[#8B1E1E] font-mono">
              {formatCurrency(invoice.grandTotal)}
            </span>
          </div>
        </div>

        {/* Net Payable Note in words */}
        <div className="text-xs font-medium text-slate-700 italic px-1">
          Net Payable to {invoice.seller.businessName}: <strong className="font-bold text-slate-900 not-italic">Rs. {invoice.amountInWords}</strong>
        </div>

        {/* Banking Settlement vs Pay Via UPI QR Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
          {/* Banking Details Box (2 Columns) */}
          <div className="sm:col-span-2 border border-[#E2D7CF] rounded-lg p-3.5 bg-white text-xs space-y-2">
            <div className="text-[10px] font-bold text-[#8B1E1E] uppercase tracking-wider mb-1.5">
              BANKING & PAYMENT SETTLEMENT
            </div>
            <div className="grid grid-cols-3 gap-y-1.5 text-[11px]">
              <span className="text-slate-500">In Favour of:</span>
              <span className="col-span-2 font-bold text-slate-900">
                {invoice.seller.bankDetails.accountHolder || invoice.seller.businessName}
              </span>

              <span className="text-slate-500">Bank Name:</span>
              <span className="col-span-2 font-bold text-slate-900">
                {invoice.seller.bankDetails.bankName}
              </span>

              <span className="text-slate-500">Current / Settlement A/C:</span>
              <span className="col-span-2 font-bold font-mono text-slate-900">
                {invoice.seller.bankDetails.accountNumber}
              </span>

              <span className="text-slate-500">IFSC Code:</span>
              <span className="col-span-2 font-bold font-mono text-slate-900">
                {invoice.seller.bankDetails.ifscCode}
              </span>

              <span className="text-slate-500">UPI ID:</span>
              <span className="col-span-2 font-bold font-mono text-[#8B1E1E]">
                {invoice.seller.upiId || "N/A"}
              </span>

              <span className="text-slate-500">Branch:</span>
              <span className="col-span-2 font-semibold text-slate-800">
                {invoice.seller.bankDetails.branch || "Madhubani"}
              </span>
            </div>
          </div>

          {/* Pay Via UPI QR Code Box (1 Column) */}
          <div className="border border-[#E2D7CF] rounded-lg p-3 bg-white flex flex-col items-center justify-center text-center">
            <div className="text-[10px] font-bold text-[#8B1E1E] uppercase tracking-wider mb-2">
              PAY VIA UPI
            </div>

            {upiQrUrl ? (
              <div className="w-28 h-28 border border-slate-200 rounded-md p-1 bg-white shadow-2xs">
                <img src={upiQrUrl} alt="Scan & Pay via UPI" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-28 h-28 border border-dashed border-slate-300 rounded-md flex items-center justify-center text-[10px] text-slate-400">
                UPI QR Ready
              </div>
            )}

            <div className="mt-2 text-[10px] font-bold text-slate-800 tracking-wider uppercase">
              SCAN & PAY WITH ANY UPI APP
            </div>
            <div className="text-[9px] text-slate-500 mt-0.5">
              G Pay • PhonePe • Paytm • BHIM
            </div>
          </div>
        </div>

        {/* Policies & Dispatch Terms */}
        <div className="pt-2 text-xs space-y-1 text-slate-600">
          <div className="text-[10px] font-bold text-[#8B1E1E] uppercase tracking-wider">
            POLICIES & DISPATCH TERMS
          </div>
          <ul className="text-[10px] sm:text-[11px] space-y-1 text-slate-600 list-disc pl-4 leading-relaxed">
            <li>100% Genuine Certified Goods sourced directly with authentic manufacturer warranty.</li>
            <li>This Proforma/Tax Invoice acts as an official billing and quotation record.</li>
            <li>Payments due within 5 days of Invoice date. Interest @18% p.a. charged on overdue bills.</li>
            <li>Primary responsibility for repair or replacement lies under manufacturer warranty terms.</li>
            <li>Burnt, physical breakage, or liquid damage are not covered under company warranty.</li>
            <li>Subject exclusively to the legal jurisdiction of Madhubani / Patna, Bihar courts.</li>
          </ul>
        </div>

        {/* Thank You Note & Business Footer */}
        <div className="pt-3 border-t border-[#8B1E1E] text-center space-y-0.5 text-xs">
          <div className="font-bold text-[#8B1E1E] tracking-wider uppercase text-[11px]">
            THANK YOU FOR SUPPORTING {invoice.seller.businessName.toUpperCase()}
          </div>
          <div className="text-[10px] text-slate-500">
            {invoice.seller.businessName} • {invoice.seller.address}, {invoice.seller.city}, {invoice.seller.state} | {invoice.seller.email}
          </div>
          <div className="text-[9px] text-slate-400 pt-0.5">
            This is a Computer Generated Commercial Invoice
          </div>
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
