"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  FilePlus2,
  Printer,
  FileSpreadsheet,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  BellRing,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  KyraBadge,
  KyraSwitch,
  KyraTabs,
  KyraTabsContent,
  KyraTabsList,
  KyraTabsTrigger,
} from "@/components/ui/kyra-ui";
import { toggleCustomerReminderAction } from "@/actions/enterprise-actions";
import { toast } from "sonner";

export default function CustomerLedgerPage() {
  const params = useParams();
  const id = params?.id as string;

  const [ledgerData, setLedgerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/customers/${id}/ledger`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to load ledger");
      setLedgerData(data.ledger);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error loading customer ledger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchLedger();
  }, [id]);

  const handleToggleReminders = async (val: boolean) => {
    const res = await toggleCustomerReminderAction(id, val);
    if (res.success) {
      toast.success(`Automatic payment reminders ${val ? "enabled" : "disabled"}`);
      fetchLedger();
    } else {
      toast.error(res.error || "Failed to update setting");
    }
  };

  const exportStatementCsv = () => {
    if (!ledgerData) return;
    const headers = [
      "Date",
      "Entry Type",
      "Invoice Number",
      "Invoice Amount",
      "Payment Amount",
      "Payment Method",
      "Invoice Remaining Balance",
      "Running Account Balance",
      "Payment Status",
    ];
    const rows = (ledgerData.chronologicalLedger || []).map((row: any) => [
      formatDate(row.date),
      row.entryType,
      `"${row.invoiceNumber}"`,
      Number(row.invoiceAmount || 0).toFixed(2),
      Number(row.paymentAmount || 0).toFixed(2),
      row.paymentMode || "-",
      Number(row.invoiceRemainingBalance || 0).toFixed(2),
      Number(row.accountBalance || 0).toFixed(2),
      row.paymentStatus,
    ]);
    const csv = [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Kyra_Customer_Ledger_${ledgerData.customer.name.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-medium">Loading Customer Payment Ledger...</p>
      </div>
    );
  }

  if (!ledgerData) {
    return (
      <div className="py-20 text-center text-xs">
        <p className="font-bold text-slate-700">Customer not found</p>
        <Link href="/customers" className="text-emerald-600 hover:underline mt-2 inline-block">
          &larr; Back to Customers
        </Link>
      </div>
    );
  }

  const { customer, summary, invoiceLedgers, chronologicalLedger, invoices, payments } = ledgerData;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <Link
            href="/customers"
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-600" />
              <span>Customer Payment Ledger &mdash; {customer.name}</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kyra Enterprises Statement of Account, Partial Payment Trail &amp; Purchase History
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportStatementCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <Printer className="w-4 h-4" />
            <span>Print Ledger</span>
          </button>
          <Link
            href={`/invoices/new?customerId=${customer._id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>New Invoice</span>
          </Link>
        </div>
      </div>

      {/* Customer Profile & Summary KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-3 text-xs">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-base font-bold text-slate-900">{customer.name}</div>
              {customer.businessName && (
                <div className="text-slate-500 font-medium">{customer.businessName}</div>
              )}
            </div>
            <KyraBadge tone={customer.gstin ? "emerald" : "slate"}>
              {customer.gstin ? `GSTIN: ${customer.gstin}` : "Unregistered"}
            </KyraBadge>
          </div>

          <div className="space-y-1.5 text-slate-600 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-mono">{customer.phone}</span>
            </div>
            {customer.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{customer.email}</span>
              </div>
            )}
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>
                {customer.billingAddress}, {customer.state} ({customer.stateCode})
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between no-print">
            <span className="flex items-center gap-1.5 font-semibold text-slate-700">
              <BellRing className="w-3.5 h-3.5 text-emerald-600" />
              <span>Automatic Payment Reminders</span>
            </span>
            <KyraSwitch
              checked={customer.remindersEnabled !== false}
              onCheckedChange={handleToggleReminders}
            />
          </div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="text-xs font-medium text-slate-500">Total Purchases</div>
            <div className="text-2xl font-bold text-slate-900 font-mono mt-2">
              {formatCurrency(summary.totalPurchases)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Across {summary.invoicesCount} GST invoices
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="text-xs font-medium text-slate-500">Total Payments Made</div>
            <div className="text-2xl font-bold text-emerald-600 font-mono mt-2">
              {formatCurrency(summary.totalPayments)}
            </div>
            <div className="text-[11px] text-emerald-600 mt-1">
              {summary.paymentsCount} verified receipts
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="text-xs font-medium text-slate-500">Outstanding Balance</div>
            <div
              className={`text-2xl font-bold font-mono mt-2 ${
                summary.outstandingBalance > 0 ? "text-amber-600" : "text-emerald-700"
              }`}
            >
              {formatCurrency(summary.outstandingBalance)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {summary.outstandingBalance > 0 ? "Pending settlement" : "Account fully settled"}
            </div>
          </div>
        </div>
      </div>

      {/* Ledger Views */}
      <KyraTabs defaultValue="invoice_breakdown" className="space-y-4">
        <KyraTabsList className="no-print">
          <KyraTabsTrigger value="invoice_breakdown">
            Invoice-Wise Payment Progression ({invoiceLedgers.length})
          </KyraTabsTrigger>
          <KyraTabsTrigger value="master_statement">
            Chronological Master Statement ({chronologicalLedger.length})
          </KyraTabsTrigger>
          <KyraTabsTrigger value="history">
            Invoices &amp; Payment Receipts
          </KyraTabsTrigger>
        </KyraTabsList>

        {/* Tab 1: Per-Invoice Running Balance Progression */}
        <KyraTabsContent value="invoice_breakdown" className="space-y-4">
          {invoiceLedgers.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
              No invoices recorded for this customer yet
            </div>
          ) : (
            invoiceLedgers.map((invLedger: any) => (
              <div
                key={invLedger.invoiceId}
                className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden"
              >
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/invoices/${invLedger.invoiceId}`}
                      className="font-mono font-bold text-sm text-[#0e1e32] hover:text-emerald-600 flex items-center gap-1"
                    >
                      <span>Invoice #{invLedger.invoiceNumber}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                    <span className="text-slate-500">
                      Dated: {formatDate(invLedger.invoiceDate)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      Invoice Amount:{" "}
                      <strong className="font-mono text-slate-900">
                        {formatCurrency(invLedger.invoiceAmount)}
                      </strong>
                    </span>
                    <span>
                      Paid:{" "}
                      <strong className="font-mono text-emerald-600">
                        {formatCurrency(invLedger.amountPaid)}
                      </strong>
                    </span>
                    <span>
                      Remaining:{" "}
                      <strong className="font-mono text-amber-600">
                        {formatCurrency(invLedger.remainingBalance)}
                      </strong>
                    </span>
                    <KyraBadge
                      tone={
                        invLedger.paymentStatus === "paid"
                          ? "emerald"
                          : invLedger.paymentStatus === "overdue"
                          ? "red"
                          : "amber"
                      }
                    >
                      {invLedger.paymentStatus === "partial"
                        ? "Partially Paid"
                        : invLedger.paymentStatus}
                    </KyraBadge>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500 font-semibold">
                        <th className="py-2.5 px-4">Transaction</th>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Payment Method</th>
                        <th className="py-2.5 px-4 text-right">Amount</th>
                        <th className="py-2.5 px-4 text-right">Remaining Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invLedger.entries.map((entry: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            {entry.label}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                            {formatDateTime(entry.date)}
                          </td>
                          <td className="py-2.5 px-4 uppercase text-[10px] font-semibold text-slate-600">
                            {entry.paymentMode
                              ? `${entry.paymentMode.replace("_", " ")}${
                                  entry.transactionRef ? ` (${entry.transactionRef})` : ""
                                }`
                              : "GST Billing"}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">
                            {entry.type === "invoice"
                              ? "₹0 Paid"
                              : formatCurrency(entry.amount)}
                          </td>
                          <td
                            className={`py-2.5 px-4 text-right font-mono font-bold ${
                              entry.remainingBalance === 0
                                ? "text-emerald-700"
                                : "text-slate-900"
                            }`}
                          >
                            {formatCurrency(entry.remainingBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </KyraTabsContent>

        {/* Tab 2: Unified Chronological Master Ledger */}
        <KyraTabsContent value="master_statement">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Entry</th>
                    <th className="py-3 px-4 text-right">Invoice Amount</th>
                    <th className="py-3 px-4 text-right">Payment Amount</th>
                    <th className="py-3 px-4 text-center">Method</th>
                    <th className="py-3 px-4 text-right">Invoice Remaining</th>
                    <th className="py-3 px-4 text-right">Account Balance</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chronologicalLedger.map((ev: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                        <Link href={`/invoices/${ev.invoiceId}`} className="hover:text-emerald-600">
                          {ev.invoiceNumber}
                        </Link>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                        {formatDateTime(ev.date)}
                      </td>
                      <td className="py-2.5 px-4 font-semibold">
                        {ev.entryType === "INVOICE" ? "Invoice Billed" : "Payment Received"}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        {ev.entryType === "INVOICE" ? formatCurrency(ev.invoiceAmount) : "-"}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">
                        {ev.entryType === "PAYMENT" ? formatCurrency(ev.paymentAmount) : "-"}
                      </td>
                      <td className="py-2.5 px-4 text-center uppercase text-[10px] font-semibold text-slate-600">
                        {ev.paymentMode ? ev.paymentMode.replace("_", " ") : "-"}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        {formatCurrency(ev.invoiceRemainingBalance)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(ev.accountBalance)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <KyraBadge
                          tone={
                            ev.paymentStatus === "paid"
                              ? "emerald"
                              : ev.paymentStatus === "overdue"
                              ? "red"
                              : "amber"
                          }
                        >
                          {ev.paymentStatus === "partial" ? "Partially Paid" : ev.paymentStatus}
                        </KyraBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </KyraTabsContent>

        {/* Tab 3: Invoices & Payment Receipts */}
        <KyraTabsContent value="history" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-900">
              Purchase History ({invoices.length} Invoices)
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {invoices.map((inv: any) => (
                <Link
                  key={inv._id}
                  href={`/invoices/${inv._id}`}
                  className="p-3.5 flex items-center justify-between hover:bg-slate-50"
                >
                  <div>
                    <div className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</div>
                    <div className="text-[11px] text-slate-500">
                      {formatDate(inv.invoiceDate)} &bull; {inv.items?.length || 0} items
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-slate-900">{formatCurrency(inv.grandTotal)}</div>
                    <div className="text-[11px] text-amber-600">
                      Due: {formatCurrency(inv.balanceDue)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-900">
              Payment History ({payments.length} Transactions)
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {payments.length === 0 ? (
                <div className="p-8 text-center text-slate-400">No payments recorded yet</div>
              ) : (
                payments.map((p: any) => (
                  <div key={p._id} className="p-3.5 flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-slate-900">{p.invoiceNumber}</div>
                      <div className="text-[11px] text-slate-500">
                        {formatDateTime(p.paymentDate || p.createdAt)} &bull;{" "}
                        <span className="uppercase font-semibold">
                          {String(p.paymentMode).replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    <div className="font-mono font-bold text-emerald-600">
                      +{formatCurrency(p.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </KyraTabsContent>
      </KyraTabs>
    </div>
  );
}
