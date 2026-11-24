"use client";

import { useState, useEffect } from "react";
import {
  ShoppingBag,
  Plus,
  Search,
  Building,
  Phone,
  Package,
  Trash2,
  Calendar,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isOpen, setIsOpen] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [supplierGstin, setSupplierGstin] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [purchaseItems, setPurchaseItems] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [purchRes, prodRes] = await Promise.all([
        fetch("/api/purchases"),
        fetch("/api/products"),
      ]);
      const purchData = await purchRes.json();
      const prodData = await prodRes.json();
      if (purchData.success) setPurchases(purchData.purchases);
      if (prodData.success) {
        setProducts(prodData.products);
        if (prodData.products.length > 0) {
          const p = prodData.products[0];
          setPurchaseItems([
            {
              productId: p._id,
              productName: p.name,
              sku: p.sku,
              quantity: 10,
              purchasePrice: p.purchasePrice,
              gstRate: p.gstRate,
            },
          ]);
        }
      }
    } catch {
      toast.error("Failed to load purchases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addRow = () => {
    if (products.length === 0) return;
    const p = products[0];
    setPurchaseItems((prev) => [
      ...prev,
      {
        productId: p._id,
        productName: p.name,
        sku: p.sku,
        quantity: 10,
        purchasePrice: p.purchasePrice,
        gstRate: p.gstRate,
      },
    ]);
  };

  const handleProductSelect = (index: number, pId: string) => {
    const p = products.find((prod) => prod._id === pId);
    if (!p) return;
    setPurchaseItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        productId: p._id,
        productName: p.name,
        sku: p.sku,
        purchasePrice: p.purchasePrice,
        gstRate: p.gstRate,
      };
      return copy;
    });
  };

  const updateField = (index: number, field: string, val: any) => {
    setPurchaseItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const removeRow = (index: number) => {
    if (purchaseItems.length <= 1) return;
    setPurchaseItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName) {
      toast.error("Supplier name is required");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName,
          supplierGstin,
          supplierPhone,
          items: purchaseItems,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record purchase");

      toast.success("Purchase recorded & warehouse stock updated!");
      setIsOpen(false);
      setSupplierName("");
      setSupplierGstin("");
      setSupplierPhone("");
      setNotes("");
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error recording purchase";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const totalInwardAmount = purchases.reduce((acc, p) => acc + (p.totalAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Supplier Purchases (Stock In)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record incoming inventory shipments and vendor purchase invoices
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Record New Purchase</span>
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total Purchase Shipments</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{purchases.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Vendor bills received</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total Inward Procurement</div>
          <div className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(totalInwardAmount)}</div>
          <div className="text-[11px] text-emerald-600 mt-1">Stock additions recorded</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Active Suppliers</div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {new Set(purchases.map((p) => p.supplierName)).size}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Unique supply vendors</div>
        </div>
      </div>

      {/* Purchases Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Purchase Inward Ledger</h2>
          <button
            onClick={() => fetchData()}
            title="Refresh"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">PO # / Bill #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Supplier GSTIN</th>
                <th className="py-3 px-4 text-center">Items Count</th>
                <th className="py-3 px-4 text-right">Taxable</th>
                <th className="py-3 px-4 text-right">Tax</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading purchase entries...</span>
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium text-slate-600">No purchase entries yet</p>
                    <p className="text-[11px] text-slate-400">Record incoming vendor goods to replenish inventory</p>
                  </td>
                </tr>
              ) : (
                purchases.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {p.purchaseNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {formatDate(p.purchaseDate || p.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{p.supplierName}</div>
                      {p.supplierPhone && (
                        <div className="text-[11px] text-slate-400">{p.supplierPhone}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {p.supplierGstin || "-"}
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-slate-700">
                      {p.items?.length || 0} items
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {formatCurrency(p.totalTaxable)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {formatCurrency(p.totalTax)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(p.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                        {p.status || "Received"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Purchase Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-900">Record Inward Stock Purchase</h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Enter supplier details and item quantities. Available stock will be updated automatically.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supplier / Vendor Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. Dell India Distribution"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supplier GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    value={supplierGstin}
                    onChange={(e) => setSupplierGstin(e.target.value.toUpperCase())}
                    placeholder="07AAAAA0000A1Z5"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono uppercase text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supplier Phone
                  </label>
                  <input
                    type="tel"
                    value={supplierPhone}
                    onChange={(e) => setSupplierPhone(e.target.value)}
                    placeholder="+91..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">Purchased Items</span>
                  <button
                    type="button"
                    onClick={addRow}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {purchaseItems.map((item, idx) => (
                    <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="flex-1 min-w-[150px]">
                        <select
                          value={item.productId}
                          onChange={(e) => handleProductSelect(idx, e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium"
                        >
                          {products.map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-24">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateField(idx, "quantity", parseInt(e.target.value) || 1)}
                          placeholder="Qty"
                          className="w-full text-center bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                        />
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          step="0.01"
                          value={item.purchasePrice}
                          onChange={(e) => updateField(idx, "purchasePrice", parseFloat(e.target.value) || 0)}
                          placeholder="Cost Price"
                          className="w-full text-right bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="text-slate-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes / Shipment Remarks
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Carrier name, tracking #, invoice details..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Record Inward & Add Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
