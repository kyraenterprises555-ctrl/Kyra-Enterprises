"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { KyraSwitch } from "@/components/ui/kyra-ui";
import { toggleProductActiveAction } from "@/actions/enterprise-actions";
import { toast } from "sonner";

const GST_SLABS = [0, 3, 5, 12, 18, 28];
const UOM_OPTIONS = ["PCS", "NOS", "BOX", "SET", "PKT", "KG", "MTR", "LTR", "PAIR"];

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "low_stock">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 12, totalPages: 1 });
  const [allMetrics, setAllMetrics] = useState({
    total: 0,
    lowStock: 0,
    inactive: 0,
    stockValue: 0,
  });

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [productToDelete, setProductToDelete] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    barcode: "",
    categoryName: "Electrical Appliances",
    description: "",
    uom: "PCS",
    sellingPrice: "",
    purchasePrice: "",
    availableQuantity: "0",
    minStockAlert: "5",
    gstRate: "18",
    hsnCode: "",
    isActive: true,
  });

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (search) query.append("search", search);
      if (selectedCategory) query.append("category", selectedCategory);
      if (statusFilter !== "all") query.append("status", statusFilter);
      query.append("page", String(page));
      query.append("limit", String(pageSize));

      const [pagedRes, summaryRes] = await Promise.all([
        fetch(`/api/products?${query.toString()}`),
        fetch("/api/products"),
      ]);
      const data = await pagedRes.json();
      const summaryData = await summaryRes.json();

      if (data.success) {
        setProducts(data.products);
        if (data.pagination) setPagination(data.pagination);
      }
      if (summaryData.success && Array.isArray(summaryData.products)) {
        const all = summaryData.products;
        setAllMetrics({
          total: all.length,
          lowStock: all.filter((p: any) => Number(p.availableQuantity) <= Number(p.minStockAlert ?? 5)).length,
          inactive: all.filter((p: any) => p.isActive === false).length,
          stockValue: all.reduce(
            (s: number, p: any) => s + Number(p.availableQuantity || 0) * Number(p.purchasePrice || 0),
            0
          ),
        });
      }
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (data.success) setCategories(data.categories);
    } catch {}
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [search, selectedCategory, statusFilter, page, pageSize]);

  const resetForm = () => {
    setFormData({
      name: "",
      sku: "",
      barcode: "",
      categoryName: categories[0]?.name || "Electrical Appliances",
      description: "",
      uom: "PCS",
      sellingPrice: "",
      purchasePrice: "",
      availableQuantity: "0",
      minStockAlert: "5",
      gstRate: "18",
      hsnCode: "",
      isActive: true,
    });
  };

  const openEdit = (p: any) => {
    setSelectedProduct(p);
    setFormData({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || "",
      categoryName: p.categoryName || "General",
      description: p.description || "",
      uom: p.uom || "PCS",
      sellingPrice: String(p.sellingPrice ?? ""),
      purchasePrice: String(p.purchasePrice ?? ""),
      availableQuantity: String(p.availableQuantity ?? 0),
      minStockAlert: String(p.minStockAlert ?? 5),
      gstRate: String(p.gstRate ?? 18),
      hsnCode: p.hsnCode || "",
      isActive: p.isActive !== false,
    });
    setIsEditOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const url = isEditOpen && selectedProduct ? `/api/products/${selectedProduct._id}` : "/api/products";
      const method = isEditOpen ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          sellingPrice: Number(formData.sellingPrice),
          purchasePrice: Number(formData.purchasePrice),
          availableQuantity: Number(formData.availableQuantity),
          minStockAlert: Number(formData.minStockAlert),
          gstRate: Number(formData.gstRate),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save product");

      toast.success(isEditOpen ? "Product updated successfully" : "Product added to Kyra Enterprises catalog");
      setIsAddOpen(false);
      setIsEditOpen(false);
      setSelectedProduct(null);
      resetForm();
      fetchProducts();
      fetchCategories();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error saving product");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (prod: any, checked: boolean) => {
    const res = await toggleProductActiveAction(prod._id, checked);
    if (!res.success) {
      toast.error(res.error || "Could not update product status");
      return;
    }
    toast.success(`"${prod.name}" ${checked ? "activated" : "deactivated"}`);
    fetchProducts();
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/products/${productToDelete._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete product");

      toast.success(data.message || "Product removed");
      setIsDeleteOpen(false);
      setProductToDelete(null);
      fetchProducts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete product");
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add category");
      toast.success(`Category "${newCategoryName.trim()}" created`);
      setNewCategoryName("");
      setIsCategoryOpen(false);
      fetchCategories();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error adding category");
    }
  };

  // Distinct category options combining DB categories + product categoryNames
  const categoryOptions = Array.from(
    new Set([
      ...categories.map((c) => c.name),
      ...products.map((p) => p.categoryName).filter(Boolean),
      "Electrical Appliances",
      "Fans & Ventilation",
      "Home Appliances",
      "Lighting & Switchgear",
    ])
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Product Catalog &amp; Pricing
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage SKUs, HSN codes, GST tax slabs, purchase/selling prices, and minimum stock alerts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsCategoryOpen(true)}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-slate-600" />
            <span>New Category</span>
          </button>
          <Link
            href="/products/bulk-upload"
            className="flex items-center gap-1.5 bg-[#0e1e32] hover:bg-[#142a45] text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Bulk Upload (Excel / CSV)</span>
          </Link>
          <button
            onClick={() => {
              resetForm();
              setIsAddOpen(true);
            }}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Catalog Products</div>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono">{allMetrics.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">Active &amp; archived SKUs</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Inventory Valuation</div>
          <div className="text-xl font-bold text-emerald-600 mt-1 font-mono">
            {formatCurrency(allMetrics.stockValue)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Based on purchase cost</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Low Stock Alerts</div>
          <div className="text-xl font-bold text-amber-600 mt-1 font-mono">{allMetrics.lowStock}</div>
          <div className="text-[11px] text-amber-600 mt-1">At or below min stock level</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Inactive Products</div>
          <div className="text-xl font-bold text-slate-700 mt-1 font-mono">{allMetrics.inactive}</div>
          <div className="text-[11px] text-slate-400 mt-1">Hidden from billing terminal</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by product name, SKU, or HSN code..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Categories</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="low_stock">Low Stock Only</option>
          </select>

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value={12}>12 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>

          <button
            onClick={fetchProducts}
            title="Refresh"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Product &amp; Category</th>
                <th className="py-3 px-4">SKU / HSN</th>
                <th className="py-3 px-4 text-right">Purchase Price</th>
                <th className="py-3 px-4 text-right">Selling Price</th>
                <th className="py-3 px-4 text-center">GST %</th>
                <th className="py-3 px-4 text-center">Available Stock</th>
                <th className="py-3 px-4 text-center">Active</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading product catalog...</span>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">No matching products found</p>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isLow = Number(p.availableQuantity) <= Number(p.minStockAlert ?? 5);
                  const isOut = Number(p.availableQuantity) === 0;
                  return (
                    <tr
                      key={p._id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        p.isActive === false ? "opacity-60 bg-slate-50/40" : ""
                      }`}
                    >
                      <td className="py-3 px-4 max-w-[260px]">
                        <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                            {p.categoryName || "General"}
                          </span>
                          {p.description && (
                            <span className="truncate text-slate-400">{p.description}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-slate-800">{p.sku}</div>
                        <div className="text-[10px] text-slate-500">HSN: {p.hsnCode || "N/A"}</div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {formatCurrency(p.purchasePrice)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(p.sellingPrice)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[10px] font-bold">
                          {p.gstRate}%
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isOut
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : isLow
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {isLow && <AlertTriangle className="w-3 h-3" />}
                          <span>
                            {p.availableQuantity} {p.uom}
                          </span>
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Min: {p.minStockAlert}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <KyraSwitch
                          checked={p.isActive !== false}
                          onCheckedChange={(val) => handleToggleActive(p, val)}
                        />
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setProductToDelete(p);
                              setIsDeleteOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title="Delete / Archive Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="text-slate-500">
            Showing{" "}
            <strong className="text-slate-800">
              {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}
            </strong>{" "}
            to{" "}
            <strong className="text-slate-800">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </strong>{" "}
            of <strong className="text-slate-800">{pagination.total}</strong> products
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="px-3 py-1.5 rounded-lg bg-[#0e1e32] text-white font-semibold">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {(isAddOpen || isEditOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-900">
              {isEditOpen ? "Edit Product Details" : "Add New Product to Kyra Enterprises"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Configure SKU, HSN code, GST percentage, pricing, and inventory alert threshold
            </p>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Bajaj Ceiling Fan 1200mm"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SKU (Unique) *</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value.toUpperCase() })
                    }
                    placeholder="KE-PRD-001"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono uppercase text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">HSN Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.hsnCode}
                    onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                    placeholder="84145110"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                  <input
                    type="text"
                    list="kyra-category-list"
                    required
                    value={formData.categoryName}
                    onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                  <datalist id="kyra-category-list">
                    {categoryOptions.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Unit of Measurement (UOM) *
                  </label>
                  <select
                    value={formData.uom}
                    onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    {UOM_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Purchase Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Selling Price (Taxable ₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    GST Percentage (%) *
                  </label>
                  <select
                    value={formData.gstRate}
                    onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    {GST_SLABS.map((slab) => (
                      <option key={slab} value={slab}>
                        {slab}% GST
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Available Quantity *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.availableQuantity}
                    onChange={(e) =>
                      setFormData({ ...formData, availableQuantity: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Minimum Stock Alert Level *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.minStockAlert}
                    onChange={(e) => setFormData({ ...formData, minStockAlert: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="prodActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600"
                  />
                  <label htmlFor="prodActive" className="font-semibold text-slate-700">
                    Active in Billing Terminal
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Product Description
                  </label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Specifications, warranty notes, or model details..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    setIsEditOpen(false);
                    setSelectedProduct(null);
                  }}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50"
                >
                  {submitting ? "Saving..." : isEditOpen ? "Save Changes" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {isCategoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Add Product Category</h3>
            <p className="text-xs text-slate-500 mb-4">Create a reusable category for Kyra Enterprises</p>
            <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
              <input
                type="text"
                required
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Kitchen Appliances"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryOpen(false)}
                  className="px-3.5 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Soft Delete Confirmation Dialog */}
      {isDeleteOpen && productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Archive / Remove Product</h3>
            <p className="text-xs text-slate-500 mt-1">
              Products referenced by existing invoices are safely soft-deleted and deactivated so historical financial records remain intact.
            </p>
            <div className="my-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="font-bold text-slate-900">{productToDelete.name}</div>
              <div className="font-mono text-slate-500 mt-0.5">SKU: {productToDelete.sku}</div>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => {
                  setIsDeleteOpen(false);
                  setProductToDelete(null);
                }}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-50"
              >
                {deleting ? "Processing..." : "Confirm Archive / Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
