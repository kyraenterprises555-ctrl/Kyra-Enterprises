"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Boxes,
  ArrowUpCircle,
  ArrowDownCircle,
  Sliders,
  AlertTriangle,
  History,
  Search,
  RefreshCw,
  ShoppingBag,
  FileSpreadsheet,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { KyraTabs, KyraTabsContent, KyraTabsList, KyraTabsTrigger } from "@/components/ui/kyra-ui";
import { toast } from "sonner";

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [productFilterId, setProductFilterId] = useState("");

  // Stock Action Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [actionMode, setActionMode] = useState<"stock_in" | "stock_out" | "adjustment" | "return">(
    "stock_in"
  );
  const [qtyInput, setQtyInput] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const movUrl = productFilterId
        ? `/api/inventory/movements?productId=${productFilterId}`
        : "/api/inventory/movements";
      const [pRes, mRes] = await Promise.all([fetch("/api/products"), fetch(movUrl)]);
      const pData = await pRes.json();
      const mData = await mRes.json();
      if (pData.success) setProducts(pData.products);
      if (mData.success) setMovements(mData.movements);
    } catch {
      toast.error("Failed to load inventory data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [productFilterId]);

  const openStockModal = (mode: "stock_in" | "stock_out" | "adjustment" | "return", prodId?: string) => {
    setActionMode(mode);
    setSelectedProductId(prodId || products[0]?._id || "");
    setQtyInput("");
    setReason("");
    setIsModalOpen(true);
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !qtyInput || Number(qtyInput) === 0 || !reason.trim()) {
      toast.error("Please select a product, non-zero quantity, and audit reason");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          quantity: Number(qtyInput),
          type: actionMode,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Inventory update failed");

      toast.success("Stock movement recorded in MongoDB ledger");
      setIsModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error recording stock movement");
    } finally {
      setSubmitting(false);
    }
  };

  const exportInventoryCsv = () => {
    if (!products.length) return;
    const headers = [
      "Product Name",
      "SKU",
      "Category",
      "UOM",
      "Current Stock",
      "Min Stock Alert",
      "Purchase Price",
      "Selling Price",
      "Stock Cost Value",
      "Retail Stock Value",
    ];
    const rows = products.map((p) => [
      `"${String(p.name).replace(/"/g, '""')}"`,
      `"${p.sku}"`,
      `"${p.categoryName || "General"}"`,
      p.uom,
      p.availableQuantity,
      p.minStockAlert,
      Number(p.purchasePrice || 0).toFixed(2),
      Number(p.sellingPrice || 0).toFixed(2),
      (Number(p.availableQuantity || 0) * Number(p.purchasePrice || 0)).toFixed(2),
      (Number(p.availableQuantity || 0) * Number(p.sellingPrice || 0)).toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Kyra_Enterprises_Stock_Report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lowStockItems = products.filter(
    (p) => Number(p.availableQuantity) <= Number(p.minStockAlert ?? 5)
  );
  const totalUnits = products.reduce((s, p) => s + Number(p.availableQuantity || 0), 0);
  const totalCostVal = products.reduce(
    (s, p) => s + Number(p.availableQuantity || 0) * Number(p.purchasePrice || 0),
    0
  );
  const totalRetailVal = products.reduce(
    (s, p) => s + Number(p.availableQuantity || 0) * Number(p.sellingPrice || 0),
    0
  );

  const filteredProducts = products.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.categoryName && p.categoryName.toLowerCase().includes(q))
    );
  });

  const filteredMovements = movements.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.productName.toLowerCase().includes(q) ||
      m.sku.toLowerCase().includes(q) ||
      (m.referenceNumber && m.referenceNumber.toLowerCase().includes(q)) ||
      (m.reason && m.reason.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Inventory &amp; Warehouse Stock Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Stock In, Stock Out, Manual Adjustments, Purchase Entries, Low Stock Alerts &amp; Product Stock Reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => openStockModal("stock_in")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs"
          >
            <ArrowUpCircle className="w-4 h-4" />
            <span>Stock In</span>
          </button>
          <button
            onClick={() => openStockModal("stock_out")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-xs"
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span>Stock Out</span>
          </button>
          <button
            onClick={() => openStockModal("adjustment")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0e1e32] hover:bg-[#142a45] text-white text-xs font-semibold shadow-xs"
          >
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Manual Adjustment</span>
          </button>
          <Link
            href="/purchases"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold"
          >
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            <span>Purchase Entry</span>
          </Link>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total Units in Stock</div>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono">{totalUnits}</div>
          <div className="text-[11px] text-slate-400 mt-1">Across {products.length} SKUs</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Stock Valuation (Cost)</div>
          <div className="text-xl font-bold text-emerald-600 mt-1 font-mono">
            {formatCurrency(totalCostVal)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Purchase price basis</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Retail Stock Value</div>
          <div className="text-xl font-bold text-blue-700 mt-1 font-mono">
            {formatCurrency(totalRetailVal)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Taxable selling basis</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Low Stock Alerts</div>
          <div className="text-xl font-bold text-amber-600 mt-1 font-mono">
            {lowStockItems.length}
          </div>
          <div className="text-[11px] text-amber-600 mt-1">Requires replenishment</div>
        </div>
      </div>

      {/* Low Stock Banner */}
      {lowStockItems.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-bold">
              Low Stock Alerts ({lowStockItems.length} products at or below safety level)
            </div>
            <p className="text-[11px] text-amber-800 mt-0.5">
              {lowStockItems
                .slice(0, 8)
                .map((p) => `${p.name} (${p.availableQuantity} ${p.uom})`)
                .join(" • ")}
            </p>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name, SKU, invoice ref, or reason..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={productFilterId}
            onChange={(e) => setProductFilterId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 max-w-[220px]"
          >
            <option value="">All Products History</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.sku} &mdash; {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={exportInventoryCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={fetchData}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs: Current Stock & Product-wise Report | Stock Movement History | Low Stock Alerts */}
      <KyraTabs defaultValue="stock" className="space-y-4">
        <KyraTabsList>
          <KyraTabsTrigger value="stock">
            Current Stock &amp; Product-Wise Report ({filteredProducts.length})
          </KyraTabsTrigger>
          <KyraTabsTrigger value="movements">
            Stock Movement History ({filteredMovements.length})
          </KyraTabsTrigger>
          <KyraTabsTrigger value="low">
            Low Stock Alerts ({lowStockItems.length})
          </KyraTabsTrigger>
        </KyraTabsList>

        <KyraTabsContent value="stock">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Current Stock</th>
                    <th className="py-3 px-4 text-center">Min Alert</th>
                    <th className="py-3 px-4 text-right">Unit Cost</th>
                    <th className="py-3 px-4 text-right">Stock Cost Value</th>
                    <th className="py-3 px-4 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => {
                    const isLow = Number(p.availableQuantity) <= Number(p.minStockAlert ?? 5);
                    return (
                      <tr key={p._id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{p.name}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">{p.sku}</td>
                        <td className="py-2.5 px-4 text-slate-500">{p.categoryName}</td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                              isLow
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            {p.availableQuantity} {p.uom}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-500">
                          {p.minStockAlert}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono">
                          {formatCurrency(p.purchasePrice)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(
                            Number(p.availableQuantity || 0) * Number(p.purchasePrice || 0)
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex gap-1">
                            <button
                              onClick={() => openStockModal("stock_in", p._id)}
                              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-[11px]"
                            >
                              + In
                            </button>
                            <button
                              onClick={() => openStockModal("stock_out", p._id)}
                              className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-[11px]"
                            >
                              &minus; Out
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </KyraTabsContent>

        <KyraTabsContent value="movements">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Product &amp; SKU</th>
                    <th className="py-3 px-4 text-center">Movement Type</th>
                    <th className="py-3 px-4 text-right">Qty Delta</th>
                    <th className="py-3 px-4 text-center">Previous</th>
                    <th className="py-3 px-4 text-center">New Stock</th>
                    <th className="py-3 px-4">Reference &amp; Reason</th>
                    <th className="py-3 px-4">Performed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        Loading stock movement history...
                      </td>
                    </tr>
                  ) : filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <History className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                        <span>No stock movements found</span>
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((m) => {
                      const pos = Number(m.quantity) > 0;
                      return (
                        <tr key={m._id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                            {formatDateTime(m.createdAt)}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-slate-900">{m.productName}</div>
                            <div className="text-[10px] font-mono text-slate-400">{m.sku}</div>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase text-[10px] font-bold">
                              {String(m.type).replace(/_/g, " ")}
                            </span>
                          </td>
                          <td
                            className={`py-2.5 px-4 text-right font-mono font-bold ${
                              pos ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            {pos ? `+${m.quantity}` : m.quantity}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono text-slate-500">
                            {m.previousQuantity}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-900">
                            {m.newQuantity}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">
                            {m.referenceNumber && (
                              <span className="font-mono font-bold text-slate-800 mr-1.5">
                                [{m.referenceNumber}]
                              </span>
                            )}
                            <span>{m.reason || "-"}</span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-500">
                            {m.performedBy?.userName || "System"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </KyraTabsContent>

        <KyraTabsContent value="low">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4 text-center">Current Stock</th>
                    <th className="py-3 px-4 text-center">Min Stock Alert</th>
                    <th className="py-3 px-4 text-right">Replenish</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lowStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-emerald-600 font-semibold">
                        All products are comfortably stocked above minimum alert thresholds!
                      </td>
                    </tr>
                  ) : (
                    lowStockItems.map((p) => (
                      <tr key={p._id} className="hover:bg-amber-50/40">
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{p.name}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">{p.sku}</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-red-600">
                          {p.availableQuantity} {p.uom}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-600">
                          {p.minStockAlert} {p.uom}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => openStockModal("stock_in", p._id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                          >
                            + Restock Now
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </KyraTabsContent>
      </KyraTabs>

      {/* Stock In / Out / Adjustment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 capitalize">
              Record {actionMode.replace("_", " ")}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Every inventory change is permanently recorded in the StockMovement audit collection
            </p>

            <form onSubmit={handleStockSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Operation Type *</label>
                <select
                  value={actionMode}
                  onChange={(e) => setActionMode(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-900"
                >
                  <option value="stock_in">Stock In (Add Inventory)</option>
                  <option value="stock_out">Stock Out (Deduct Inventory)</option>
                  <option value="adjustment">Manual Signed Adjustment (+ / -)</option>
                  <option value="return">Customer Return Intake (+)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Product *</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                >
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.sku}) &mdash; Current: {p.availableQuantity} {p.uom}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {actionMode === "adjustment"
                    ? "Signed Quantity Change (e.g. 10 or -4) *"
                    : "Quantity *"}
                </label>
                <input
                  type="number"
                  required
                  min={actionMode === "adjustment" ? undefined : 1}
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  placeholder={actionMode === "adjustment" ? "e.g. -3 or 12" : "Enter units"}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason / Reference *</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Warehouse count reconciliation / Damaged unit write-off"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50"
                >
                  {submitting ? "Recording..." : "Save Stock Movement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
