"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Plus, Trash2, Edit3, ShieldAlert } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { INDIAN_STATES, calculateInvoiceTaxes, extractStateCodeFromGstin } from "@/lib/gst";
import { toast } from "sonner";

interface EditableLine {
  productId: string;
  name: string;
  sku: string;
  hsnCode: string;
  uom: string;
  rate: number;
  quantity: number;
  discount: number;
  discountPercent: number;
  gstRate: number;
}

export default function EditInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [invoice, setInvoice] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerData, setCustomerData] = useState({
    name: "",
    businessName: "",
    phone: "",
    email: "",
    billingAddress: "",
    shippingAddress: "",
    gstin: "",
    state: "Bihar",
    stateCode: "10",
  });
  const [items, setItems] = useState<EditableLine[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [amendmentReason, setAmendmentReason] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [invRes, pRes] = await Promise.all([
          fetch(`/api/invoices/${id}`),
          fetch("/api/products"),
        ]);
        const invData = await invRes.json();
        const pData = await pRes.json();

        if (!invRes.ok || !invData.success) {
          throw new Error(invData.error || "Invoice not found");
        }

        const inv = invData.invoice;
        setInvoice(inv);
        if (pData.success) setProducts(pData.products);

        setCustomerData({
          name: inv.customer?.name || "",
          businessName: inv.customer?.businessName || "",
          phone: inv.customer?.phone || "",
          email: inv.customer?.email || "",
          billingAddress: inv.customer?.billingAddress || "",
          shippingAddress: inv.customer?.shippingAddress || inv.customer?.billingAddress || "",
          gstin: inv.customer?.gstin || "",
          state: inv.customer?.state || "Bihar",
          stateCode: inv.customer?.stateCode || "10",
        });

        setDueDate(
          inv.dueDate ? new Date(inv.dueDate).toISOString().split("T")[0] : ""
        );
        setNotes(inv.notes || "");

        setItems(
          (inv.items || []).map((it: any) => ({
            productId: String(it.productId),
            name: it.productName,
            sku: it.sku,
            hsnCode: it.hsnCode,
            uom: it.uom || "PCS",
            rate: Number(it.rate),
            quantity: Number(it.quantity),
            discount: Number(it.discount || 0),
            discountPercent: Number(it.discountPercent || 0),
            gstRate: Number(it.gstRate || 0),
          }))
        );
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to load invoice for editing");
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  const handleStateChange = (stateName: string) => {
    const s = INDIAN_STATES.find((x) => x.name === stateName);
    setCustomerData((prev) => ({
      ...prev,
      state: stateName,
      stateCode: s ? s.code : prev.stateCode,
    }));
  };

  const handleGstinChange = (val: string) => {
    const upper = val.toUpperCase().trim();
    const code = extractStateCodeFromGstin(upper);
    const matched = INDIAN_STATES.find((x) => x.code === code);
    setCustomerData((prev) => ({
      ...prev,
      gstin: upper,
      state: matched ? matched.name : prev.state,
      stateCode: code || prev.stateCode,
    }));
  };

  const handleProductChange = (idx: number, prodId: string) => {
    const prod = products.find((p) => String(p._id) === String(prodId));
    if (!prod) return;
    const next = items.slice();
    next[idx] = {
      productId: String(prod._id),
      name: prod.name,
      sku: prod.sku,
      hsnCode: prod.hsnCode,
      uom: prod.uom,
      rate: prod.sellingPrice,
      quantity: 1,
      discount: 0,
      discountPercent: 0,
      gstRate: prod.gstRate,
    };
    setItems(next);
  };

  const handleAddLine = () => {
    const first = products[0];
    if (!first) return;
    setItems((prev) => [
      ...prev,
      {
        productId: String(first._id),
        name: first.name,
        sku: first.sku,
        hsnCode: first.hsnCode,
        uom: first.uom,
        rate: first.sellingPrice,
        quantity: 1,
        discount: 0,
        discountPercent: 0,
        gstRate: first.gstRate,
      },
    ]);
  };

  const sellerStateCode = invoice?.seller?.stateCode || "10";
  const taxCalc = useMemo(() => {
    return calculateInvoiceTaxes(
      items.map((it) => ({
        rate: Number(it.rate || 0),
        quantity: Number(it.quantity || 0),
        discount: Number(it.discount || 0),
        discountPercent: Number(it.discountPercent || 0),
        gstRate: Number(it.gstRate || 0),
      })),
      sellerStateCode,
      customerData.stateCode || sellerStateCode
    );
  }, [items, sellerStateCode, customerData.stateCode]);

  const alreadyPaid = Number(invoice?.amountPaid || 0);
  const newRemaining = Math.max(0, taxCalc.summary.grandTotal - alreadyPaid);

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amendmentReason.trim() || amendmentReason.trim().length < 3) {
      toast.error("Please provide an amendment reason for the audit revision history");
      return;
    }
    if (items.length === 0) {
      toast.error("Invoice must contain at least one item");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerData,
          items: items.map((it) => ({
            productId: it.productId,
            quantity: Number(it.quantity),
            rate: Number(it.rate),
            discount: Number(it.discount || 0),
            discountPercent: Number(it.discountPercent || 0),
          })),
          dueDate: dueDate || undefined,
          notes,
          amendmentReason: amendmentReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update invoice");

      toast.success(`Invoice ${invoice.invoiceNumber} amended (Revision #${data.invoice.revisionNumber})!`);
      router.push(`/invoices/${id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error saving amended invoice");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 text-xs">
        Loading invoice amendment workspace...
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <form onSubmit={handleSubmitEdit} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/invoices/${id}`}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-emerald-600" />
              <span>Edit / Amend Invoice #{invoice.invoiceNumber}</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Recalculates GST, outstanding balance, and warehouse stock deltas automatically while archiving Revision #{invoice.revisionNumber || 1}
            </p>
          </div>
        </div>
      </div>

      {/* Audit Notice */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-start gap-3 text-xs">
        <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong>Controlled GST Invoice Amendment:</strong> Previous invoice snapshot, stock delta movements, and your amendment reason will be permanently recorded in <code className="font-mono">InvoiceRevisions</code> and <code className="font-mono">AuditLogs</code>.
        </div>
      </div>

      {/* Customer Details */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4 text-xs">
        <h2 className="font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
          Customer Information &amp; Due Date
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Customer Name *</label>
            <input
              type="text"
              required
              value={customerData.name}
              onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Phone *</label>
            <input
              type="tel"
              required
              value={customerData.phone}
              onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Customer GSTIN</label>
            <input
              type="text"
              maxLength={15}
              value={customerData.gstin}
              onChange={(e) => handleGstinChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono uppercase text-slate-900"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Billing Address *</label>
            <input
              type="text"
              required
              value={customerData.billingAddress}
              onChange={(e) =>
                setCustomerData({ ...customerData, billingAddress: e.target.value })
              }
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">State *</label>
            <select
              value={customerData.state}
              onChange={(e) => handleStateChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
            >
              {INDIAN_STATES.map((s) => (
                <option key={s.code} value={s.name}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Payment Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Line Items, Quantities &amp; Pricing</h2>
          <button
            type="button"
            onClick={handleAddLine}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0e1e32] text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Add Item</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3 min-w-[220px]">Product</th>
                <th className="py-2.5 px-3 text-center w-24">Qty</th>
                <th className="py-2.5 px-3 text-right w-28">Rate (₹)</th>
                <th className="py-2.5 px-3 text-right w-24">Disc %</th>
                <th className="py-2.5 px-3 text-right">Taxable</th>
                <th className="py-2.5 px-3 text-center">GST %</th>
                <th className="py-2.5 px-3 text-right">Line Total</th>
                <th className="py-2.5 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it, idx) => {
                const calc = taxCalc.items[idx];
                return (
                  <tr key={idx}>
                    <td className="py-2 px-3">
                      <select
                        value={it.productId}
                        onChange={(e) => handleProductChange(idx, e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-semibold text-slate-900"
                      >
                        {products.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => {
                          const next = items.slice();
                          next[idx] = { ...next[idx], quantity: Number(e.target.value) };
                          setItems(next);
                        }}
                        className="w-full text-center bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono font-bold"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={it.rate}
                        onChange={(e) => {
                          const next = items.slice();
                          next[idx] = { ...next[idx], rate: Number(e.target.value) };
                          setItems(next);
                        }}
                        className="w-full text-right bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        max={100}
                        value={it.discountPercent}
                        onChange={(e) => {
                          const next = items.slice();
                          next[idx] = { ...next[idx], discountPercent: Number(e.target.value) };
                          setItems(next);
                        }}
                        className="w-full text-right bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono"
                      />
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {formatCurrency(calc?.taxableAmount || 0)}
                    </td>
                    <td className="py-2 px-3 text-center font-mono">{it.gstRate}%</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(calc?.totalAmount || 0)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setItems(items.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Amendment Reason & Recalculated Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-900 mb-1">
              Mandatory Amendment / Edit Reason *
            </label>
            <textarea
              rows={3}
              required
              value={amendmentReason}
              onChange={(e) => setAmendmentReason(e.target.value)}
              placeholder="e.g. Updated item quantity and applied authorized trade discount as requested by customer"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Invoice Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
            />
          </div>
        </div>

        <div className="bg-[#0e1e32] text-white p-6 rounded-2xl space-y-2.5 text-xs flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex justify-between text-slate-300">
              <span>Previous Grand Total</span>
              <span className="font-mono">{formatCurrency(invoice.grandTotal)}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Recalculated Taxable + GST</span>
              <span className="font-mono">
                {formatCurrency(taxCalc.summary.taxableAmount)} +{" "}
                {formatCurrency(taxCalc.summary.totalTax)}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-700 flex justify-between text-base font-bold text-emerald-400">
              <span>Amended Grand Total</span>
              <span className="font-mono">{formatCurrency(taxCalc.summary.grandTotal)}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Verified Payments Already Received</span>
              <span className="font-mono">{formatCurrency(alreadyPaid)}</span>
            </div>
            <div className="flex justify-between text-amber-400 font-bold">
              <span>Recalculated Remaining Balance</span>
              <span className="font-mono">{formatCurrency(newRemaining)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving Amended Invoice..." : "Save Invoice Amendment"}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
