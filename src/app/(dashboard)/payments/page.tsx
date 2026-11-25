"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CreditCard,
  Search,
  Filter,
  Plus,
  RefreshCw,
  ExternalLink,
  BellRing,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { KyraBadge } from "@/components/ui/kyra-ui";
import { toast } from "sonner";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [openInvoices, setOpenInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMode, setSelectedMode] = useState("");

  // Record Payment Modal
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<
    "cash" | "upi" | "bank_transfer" | "card" | "credit" | "other"
  >("cash");
  const [transactionRef, setTransactionRef] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [payRes, invRes] = await Promise.all([
        fetch("/api/payments"),
        fetch("/api/invoices"),
      ]);
      const payData = await payRes.json();
      const invData = await invRes.json();

      if (payData.success) setPayments(payData.payments || []);
      if (invData.success) {
        const unpaidList = (invData.invoices || []).filter(
          (i: any) =>
            !i.isDeleted &&
            i.status !== "cancelled" &&
            i.status !== "deleted" &&
            Number(i.balanceDue || 0) > 0
        );
        setOpenInvoices(unpaidList);
        if (unpaidList.length > 0 && !selectedInvoiceId) {
          setSelectedInvoiceId(unpaidList[0]._id);
          setAmount(String(unpaidList[0].balanceDue));
        }
      }
    } catch {
      toast.error("Failed to load payment records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedInvoice = openInvoices.find((i) => String(i._id) === String(selectedInvoiceId));

  const handleInvoiceChoice = (invId: string) => {
    setSelectedInvoiceId(invId);
    const found = openInvoices.find((i) => String(i._id) === String(invId));
    if (found) setAmount(String(found.balanceDue));
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId || Number(amount) <= 0) {
      toast.error("Select an invoice and enter a positive payment amount");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": `ui_pay_${selectedInvoiceId}_${Date.now()}`,
        },
        body: JSON.stringify({
          invoiceId: selectedInvoiceId,
          amount: Number(amount),
          paymentMode,
          transactionRef,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");

      toast.success(
        data.invoice?.balanceDue === 0
          ? `Full settlement recorded for ${data.payment.invoiceNumber}! Automatic reminders completed.`
          : `Partial payment recorded! Remaining due: ${formatCurrency(data.invoice.balanceDue)}`
      );
      setIsRecordOpen(false);
      setTransactionRef("");
      setNotes("");
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error recording payment");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    const matchSearch =
      !search ||
      p.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      p.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      (p.transactionRef && p.transactionRef.toLowerCase().includes(search.toLowerCase()));
    const matchMode = !selectedMode || p.paymentMode === selectedMode;
    return matchSearch && matchMode;
  });

  const totalCollected = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const totalOpenReceivables = openInvoices.reduce(
    (acc, i) => acc + Number(i.balanceDue || 0),
    0
  );
  const upiCollected = payments
    .filter((p) => p.paymentMode === "upi")
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const cashAndBank = payments
    .filter((p) => p.paymentMode === "cash" || p.paymentMode === "bank_transfer")
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Payment Management &amp; Partial Settlements
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Independent transaction ledger supporting Cash, UPI, Bank Transfer, Card, Credit &amp; Other modes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/payment-reminders"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold"
          >
            <BellRing className="w-4 h-4 text-emerald-600" />
            <span>Payment Reminders</span>
          </Link>
          <button
            onClick={() => {
              if (openInvoices.length > 0) {
                setSelectedInvoiceId(openInvoices[0]._id);
                setAmount(String(openInvoices[0].balanceDue));
              }
              setIsRecordOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total Payments Received</div>
          <div className="text-xl font-bold text-emerald-600 mt-1 font-mono">
            {formatCurrency(totalCollected)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{payments.length} receipts</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Remaining Receivable</div>
          <div className="text-xl font-bold text-amber-600 mt-1 font-mono">
            {formatCurrency(totalOpenReceivables)}
          </div>
          <div className="text-[11px] text-amber-600 mt-1">
            Across {openInvoices.length} open invoices
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">UPI Digital Collections</div>
          <div className="text-xl font-bold text-purple-600 mt-1 font-mono">
            {formatCurrency(upiCollected)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">QR &amp; instant UPI</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Cash &amp; Bank Settlements</div>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
            {formatCurrency(cashAndBank)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Counter &amp; NEFT/RTGS</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by invoice #, customer name, or UTR ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
          >
            <option value="">All Payment Modes</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="card">Card</option>
            <option value="credit">Credit</option>
            <option value="other">Other</option>
          </select>
          <button
            onClick={fetchData}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-center">Method</th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4 text-right">Amount Paid</th>
                <th className="py-3 px-4 text-right">Balance After</th>
                <th className="py-3 px-4">Recorded By</th>
                <th className="py-3 px-4 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Loading payment transactions...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p>No payment transactions found</p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {formatDateTime(p.paymentDate || p.createdAt)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {p.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{p.customerName}</td>
                    <td className="py-3 px-4 text-center">
                      <KyraBadge tone="slate">
                        {String(p.paymentMode || "cash").replace("_", " ")}
                      </KyraBadge>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {p.transactionRef || "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                      +{formatCurrency(p.amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {p.balanceAfterPayment !== undefined
                        ? formatCurrency(p.balanceAfterPayment)
                        : "-"}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {p.recordedBy?.userName || "Admin"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {p.invoiceId && (
                        <Link
                          href={`/invoices/${p.invoiceId}`}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded inline-block"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {isRecordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Record Full or Partial Customer Payment
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Every payment is stored as an independent transaction; previous payments are never overwritten.
            </p>

            {openInvoices.length === 0 ? (
              <div className="py-8 text-center text-xs text-emerald-600 font-semibold">
                All active invoices are already 100% paid!
              </div>
            ) : (
              <form onSubmit={handleRecordSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Unpaid / Partially Paid Invoice *
                  </label>
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => handleInvoiceChoice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-900"
                  >
                    {openInvoices.map((inv) => (
                      <option key={inv._id} value={inv._id}>
                        {inv.invoiceNumber} &mdash; {inv.customer?.name} (Remaining:{" "}
                        {formatCurrency(inv.balanceDue)})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedInvoice && (
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">
                        Invoice Total
                      </div>
                      <div className="font-mono font-bold text-slate-900 mt-0.5">
                        {formatCurrency(selectedInvoice.grandTotal)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">
                        Already Paid
                      </div>
                      <div className="font-mono font-bold text-emerald-600 mt-0.5">
                        {formatCurrency(selectedInvoice.amountPaid)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">
                        Remaining Due
                      </div>
                      <div className="font-mono font-bold text-amber-600 mt-0.5">
                        {formatCurrency(selectedInvoice.balanceDue)}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Payment Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={selectedInvoice?.balanceDue}
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Payment Method *
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as any)}
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
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Transaction Ref / UTR
                  </label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="Optional UTR / Receipt #"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Partial installment received"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRecordOpen(false)}
                    className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Record Transaction"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
