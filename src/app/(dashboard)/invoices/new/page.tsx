"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FilePlus2,
  Building2,
  Users,
  Package,
  Plus,
  Trash2,
  Calculator,
  CreditCard,
  AlertCircle,
  Search,
  Calendar,
  Scan,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  INDIAN_STATES,
  calculateInvoiceTaxes,
  numberToWordsINR,
  extractStateCodeFromGstin,
} from "@/lib/gst";
import { toast } from "sonner";

interface BillingItem {
  productId: string;
  name: string;
  sku: string;
  hsnCode: string;
  uom: string;
  availableStock: number;
  rate: number;
  quantity: number;
  discount: number;
  discountPercent: number;
  gstRate: number;
}

function BillingEngineContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustId = searchParams.get("customerId");

  const [settings, setSettings] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [productQuery, setProductQuery] = useState("");

  // Customer selection
  const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustId || "");
  const [saveNewCustomer, setSaveNewCustomer] = useState(true);
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

  // Items, Due Date & Payment
  const [items, setItems] = useState<BillingItem[]>([]);
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date(Date.now() + 5 * 24 * 3600 * 1000);
    return d.toISOString().split("T")[0];
  });
  const [paymentMode, setPaymentMode] = useState<
    "cash" | "upi" | "bank_transfer" | "card" | "credit" | "other"
  >("cash");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        const [sRes, cRes, pRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/customers"),
          fetch("/api/products?activeOnly=true"),
        ]);
        const sData = await sRes.json();
        const cData = await cRes.json();
        const pData = await pRes.json();

        const loadedSettings = sData.settings || {};
        if (sData.success) {
          setSettings(loadedSettings);
          const dueDays = Number(loadedSettings.defaultDueDays ?? 5);
          setDueDate(
            new Date(Date.now() + dueDays * 24 * 3600 * 1000).toISOString().split("T")[0]
          );
        }

        if (cData.success) {
          setCustomers(cData.customers);
          const targetCust = preselectedCustId
            ? cData.customers.find((c: any) => String(c._id) === String(preselectedCustId))
            : cData.customers[0];

          if (targetCust) {
            setSelectedCustomerId(targetCust._id);
            setCustomerData({
              name: targetCust.name,
              businessName: targetCust.businessName || "",
              phone: targetCust.phone,
              email: targetCust.email || "",
              billingAddress: targetCust.billingAddress,
              shippingAddress: targetCust.shippingAddress || targetCust.billingAddress,
              gstin: targetCust.gstin || "",
              state: targetCust.state || loadedSettings.state || "Bihar",
              stateCode: targetCust.stateCode || loadedSettings.stateCode || "10",
            });
          } else {
            setSelectedCustomerId("NEW");
            setCustomerData((prev) => ({
              ...prev,
              state: loadedSettings.state || "Bihar",
              stateCode: loadedSettings.stateCode || "10",
            }));
          }
        }

        if (pData.success) {
          setProducts(pData.products);
          const inStockProd = pData.products.find((p: any) => p.availableQuantity > 0);
          if (inStockProd) {
            setItems([
              {
                productId: inStockProd._id,
                name: inStockProd.name,
                sku: inStockProd.sku,
                hsnCode: inStockProd.hsnCode,
                uom: inStockProd.uom,
                availableStock: inStockProd.availableQuantity,
                rate: inStockProd.sellingPrice,
                quantity: 1,
                discount: 0,
                discountPercent: 0,
                gstRate: inStockProd.gstRate,
              },
            ]);
          }
        }
      } catch {
        toast.error("Failed to load GST billing configuration");
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, [preselectedCustId]);

  const handleCustomerSelect = (id: string) => {
    setSelectedCustomerId(id);
    if (id === "NEW") {
      setCustomerData({
        name: "",
        businessName: "",
        phone: "",
        email: "",
        billingAddress: "",
        shippingAddress: "",
        gstin: "",
        state: settings?.state || "Bihar",
        stateCode: settings?.stateCode || "10",
      });
    } else {
      const cust = customers.find((c) => String(c._id) === String(id));
      if (cust) {
        setCustomerData({
          name: cust.name,
          businessName: cust.businessName || "",
          phone: cust.phone,
          email: cust.email || "",
          billingAddress: cust.billingAddress,
          shippingAddress: cust.shippingAddress || cust.billingAddress,
          gstin: cust.gstin || "",
          state: cust.state,
          stateCode: cust.stateCode,
        });
      }
    }
  };

  const handleGstinChange = (gstinVal: string) => {
    const upper = gstinVal.toUpperCase().trim();
    const detectedCode = extractStateCodeFromGstin(upper);
    const matchedState = INDIAN_STATES.find((s) => s.code === detectedCode);

    setCustomerData((prev) => ({
      ...prev,
      gstin: upper,
      state: matchedState ? matchedState.name : prev.state,
      stateCode: detectedCode || prev.stateCode,
    }));
  };

  const handleStateChange = (stateName: string) => {
    const s = INDIAN_STATES.find((item) => item.name === stateName);
    setCustomerData((prev) => ({
      ...prev,
      state: stateName,
      stateCode: s ? s.code : prev.stateCode,
    }));
  };

  const filteredQuickProducts = useMemo(() => {
    if (!productQuery.trim()) return [];
    const q = productQuery.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.hsnCode && String(p.hsnCode).includes(q)) ||
          (p.barcode && String(p.barcode).toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [products, productQuery]);

  const handleProductSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const raw = productQuery.trim();
      if (!raw) return;

      const q = raw.toLowerCase();
      // First look for exact match on RFID / Barcode or SKU
      const matched =
        products.find(
          (p) =>
            (p.barcode && String(p.barcode).trim().toLowerCase() === q) ||
            (p.sku && String(p.sku).trim().toLowerCase() === q)
        ) || (filteredQuickProducts.length > 0 ? filteredQuickProducts[0] : null);

      if (matched) {
        addProductToInvoice(matched);
      } else {
        toast.error(`No product found matching "${raw}"`);
      }
    }
  };

  const addProductToInvoice = (prod: any) => {
    if (prod.availableQuantity <= 0) {
      toast.error(`"${prod.name}" is currently out of stock (0 available)`);
      return;
    }
    const existingIdx = items.findIndex((it) => it.productId === prod._id);
    if (existingIdx !== -1) {
      const next = items.slice();
      if (next[existingIdx].quantity + 1 > prod.availableQuantity) {
        toast.error(`Cannot exceed available stock (${prod.availableQuantity} ${prod.uom})`);
        return;
      }
      next[existingIdx].quantity += 1;
      setItems(next);
      toast.success(`Qty +1: "${prod.name}" (${next[existingIdx].quantity})`);
    } else {
      setItems((prev) => [
        ...prev,
        {
          productId: prod._id,
          name: prod.name,
          sku: prod.sku,
          hsnCode: prod.hsnCode,
          uom: prod.uom,
          availableStock: prod.availableQuantity,
          rate: prod.sellingPrice,
          quantity: 1,
          discount: 0,
          discountPercent: 0,
          gstRate: prod.gstRate,
        },
      ]);
      toast.success(`Added "${prod.name}"`);
    }
    setProductQuery("");
  };

  const handleAddRow = () => {
    const availableProd = products.find((p) => p.availableQuantity > 0) || products[0];
    if (!availableProd) return;
    setItems((prev) => [
      ...prev,
      {
        productId: availableProd._id,
        name: availableProd.name,
        sku: availableProd.sku,
        hsnCode: availableProd.hsnCode,
        uom: availableProd.uom,
        availableStock: availableProd.availableQuantity,
        rate: availableProd.sellingPrice,
        quantity: 1,
        discount: 0,
        discountPercent: 0,
        gstRate: availableProd.gstRate,
      },
    ]);
  };

  const handleProductRowSelect = (rowIdx: number, prodId: string) => {
    const prod = products.find((p) => String(p._id) === String(prodId));
    if (!prod) return;
    const next = items.slice();
    next[rowIdx] = {
      productId: prod._id,
      name: prod.name,
      sku: prod.sku,
      hsnCode: prod.hsnCode,
      uom: prod.uom,
      availableStock: prod.availableQuantity,
      rate: prod.sellingPrice,
      quantity: 1,
      discount: 0,
      discountPercent: 0,
      gstRate: prod.gstRate,
    };
    setItems(next);
  };

  const updateRowField = (rowIdx: number, field: keyof BillingItem, val: number) => {
    const next = items.slice();
    next[rowIdx] = { ...next[rowIdx], [field]: val };
    setItems(next);
  };

  const removeRow = (rowIdx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== rowIdx));
  };

  const sellerStateCode = settings?.stateCode || "10";
  const taxResult = useMemo(() => {
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

  const paidNum = Math.min(Math.max(0, Number(amountPaid || 0)), taxResult.summary.grandTotal);
  const balancePreview = Math.max(0, taxResult.summary.grandTotal - paidNum);

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerData.name.trim() || !customerData.phone.trim() || !customerData.billingAddress.trim()) {
      toast.error("Customer Name, Phone, and Billing Address are required");
      return;
    }
    if (items.length === 0) {
      toast.error("Please add at least one product to the invoice");
      return;
    }
    for (const it of items) {
      if (it.quantity > it.availableStock) {
        toast.error(
          `Insufficient stock for "${it.name}". Available: ${it.availableStock}, Requested: ${it.quantity}`
        );
        return;
      }
    }

    try {
      setGenerating(true);
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId !== "NEW" ? selectedCustomerId : undefined,
          saveNewCustomer: selectedCustomerId === "NEW" ? saveNewCustomer : false,
          customerData,
          items: items.map((it) => ({
            productId: it.productId,
            quantity: Number(it.quantity),
            rate: Number(it.rate),
            discount: Number(it.discount || 0),
            discountPercent: Number(it.discountPercent || 0),
          })),
          dueDate,
          paymentMode,
          amountPaid: paidNum,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate GST invoice");

      toast.success(`GST Tax Invoice ${data.invoice.invoiceNumber} generated!`);
      router.push(`/invoices/${data.invoice._id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error generating invoice");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-medium">Initializing Kyra Enterprises GST Billing Terminal...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleGenerateInvoice} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FilePlus2 className="w-5 h-5 text-emerald-600" />
            <span>Create GST Tax Invoice &mdash; Kyra Enterprises</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatic Seller Snapshot, Intra/Inter-State GST Calculation, Stock Validation &amp; Payment Recording
          </p>
        </div>

        <div className="px-3.5 py-2 rounded-xl bg-[#0e1e32] text-white text-xs flex items-center gap-2">
          <span className="text-slate-300">Tax Mode:</span>
          <span className="font-bold text-emerald-400">
            {taxResult.summary.isInterState
              ? "Inter-State Supply (IGST)"
              : "Intra-State Supply (CGST + SGST)"}
          </span>
        </div>
      </div>

      {/* Seller + Customer Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Seller Card (Auto-fetched from Business Settings) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-2.5 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>Seller (Business Settings)</span>
          </div>
          <div className="text-sm font-bold text-[#0e1e32]">
            {settings?.businessName || "Kyra Enterprises"}
          </div>
          <div className="text-slate-600">
            {settings?.address}, {settings?.city}, {settings?.state} ({settings?.stateCode}) &ndash;{" "}
            {settings?.pincode}
          </div>
          <div className="font-mono font-bold text-emerald-700">
            GSTIN: {settings?.gstin || "Configure in Business Settings"}
          </div>
          <div className="text-slate-500">
            Phone: {settings?.phone} &bull; {settings?.email}
          </div>
        </div>

        {/* Customer Information */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-900 uppercase tracking-wider">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Customer / Buyer Information</span>
            </div>

            <select
              value={selectedCustomerId}
              onChange={(e) => handleCustomerSelect(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-semibold text-slate-900"
            >
              <option value="NEW">+ Enter / Add New Customer</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.phone}) &mdash; {c.state}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
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
                placeholder="Optional (B2B)"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono uppercase text-slate-900"
              />
            </div>

            <div className="sm:col-span-2">
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
              <label className="block font-semibold text-slate-700 mb-1">Customer State *</label>
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
          </div>

          {selectedCustomerId === "NEW" && (
            <label className="inline-flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={saveNewCustomer}
                onChange={(e) => setSaveNewCustomer(e.target.checked)}
                className="w-4 h-4 accent-emerald-600"
              />
              <span>Save this buyer to Kyra Enterprises Customer Directory</span>
            </label>
          )}
        </div>
      </div>

      {/* Product Selection & Line Items */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Product Line Items &amp; GST Slab</h2>
          </div>

          {/* Quick Search by Name or SKU */}
          <div className="flex items-center gap-2 w-full md:w-auto relative">
            <div className="relative w-full md:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                onKeyDown={handleProductSearchKeyDown}
                placeholder="Scan RFID / Barcode, or search Name / SKU..."
                className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
              />
              {!productQuery && (
                <span
                  title="RFID Scanner Ready (Keyboard Wedge)"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors"
                >
                  <Scan className="w-3.5 h-3.5 text-emerald-600/70" />
                </span>
              )}
              {filteredQuickProducts.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {filteredQuickProducts.map((p) => (
                    <button
                      type="button"
                      key={p._id}
                      onClick={() => addProductToInvoice(p)}
                      className="w-full p-2.5 text-left hover:bg-emerald-50 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                        <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5 flex-wrap">
                          <span>SKU: {p.sku}</span>
                          <span>&bull;</span>
                          <span>HSN: {p.hsnCode}</span>
                          {p.barcode && (
                            <>
                              <span>&bull;</span>
                              <span className="text-emerald-700 font-semibold">RFID: {p.barcode}</span>
                            </>
                          )}
                          <span>&bull;</span>
                          <span>GST: {p.gstRate}%</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-emerald-700">
                          {formatCurrency(p.sellingPrice)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Stock: {p.availableQuantity} {p.uom}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0e1e32] hover:bg-[#142a45] text-white text-xs font-semibold shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Add Row</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3 min-w-[230px]">Product</th>
                <th className="py-2.5 px-3 text-center">HSN</th>
                <th className="py-2.5 px-3 text-center">Stock</th>
                <th className="py-2.5 px-3 text-center w-24">Qty</th>
                <th className="py-2.5 px-3 text-right w-28">Rate (₹)</th>
                <th className="py-2.5 px-3 text-right w-24">Disc %</th>
                <th className="py-2.5 px-3 text-right">Taxable</th>
                <th className="py-2.5 px-3 text-center">GST %</th>
                <th className="py-2.5 px-3 text-right">Tax Amt</th>
                <th className="py-2.5 px-3 text-right">Line Total</th>
                <th className="py-2.5 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it, idx) => {
                const calc = taxResult.items[idx];
                const overStock = it.quantity > it.availableStock;
                return (
                  <tr key={idx} className={overStock ? "bg-red-50/50" : ""}>
                    <td className="py-2 px-3">
                      <select
                        value={it.productId}
                        onChange={(e) => handleProductRowSelect(idx, e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-semibold text-slate-900"
                      >
                        {products.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-slate-500">{it.hsnCode}</td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`font-mono font-bold text-[11px] ${
                          overStock ? "text-red-600" : "text-emerald-700"
                        }`}
                      >
                        {it.availableStock} {it.uom}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min={1}
                        max={it.availableStock}
                        value={it.quantity}
                        onChange={(e) => updateRowField(idx, "quantity", Number(e.target.value))}
                        className="w-full text-center bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono font-bold"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={it.rate}
                        onChange={(e) => updateRowField(idx, "rate", Number(e.target.value))}
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
                        onChange={(e) =>
                          updateRowField(idx, "discountPercent", Number(e.target.value))
                        }
                        className="w-full text-right bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono"
                      />
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {formatCurrency(calc?.taxableAmount || 0)}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-semibold text-blue-700">
                      {it.gstRate}%
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600">
                      {formatCurrency(calc?.totalTax || 0)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(calc?.totalAmount || 0)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
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

      {/* Bottom Payment & GST Tax Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Payment & Due Date */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <span>Payment Collection &amp; Credit Due Date</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Card</option>
                <option value="credit">Credit (Pay Later)</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Amount Received Now (₹)
              </label>
              <div className="flex gap-1">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={taxResult.summary.grandTotal}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setAmountPaid(String(taxResult.summary.grandTotal))}
                  className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-[10px] shrink-0"
                >
                  Full
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Payment Due Date</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900"
              />
            </div>
          </div>

          {balancePreview > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2 text-[11px]">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Remaining balance of <strong>{formatCurrency(balancePreview)}</strong> will be tracked in the Customer Ledger and automatically scheduled for recurring{" "}
                <strong>{settings?.reminderSettings?.intervalDays || 4}-day payment reminders</strong> until fully paid.
              </span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Invoice Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional dispatch note, vehicle number, or PO reference..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
            />
          </div>
        </div>

        {/* GST Summary & Submit */}
        <div className="bg-[#0e1e32] text-white p-6 rounded-2xl shadow-lg flex flex-col justify-between space-y-4">
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider pb-2 border-b border-slate-800">
              <Calculator className="w-4 h-4" />
              <span>Server-Validated GST Summary</span>
            </div>

            <div className="flex justify-between text-slate-300">
              <span>Taxable Value</span>
              <span className="font-mono">{formatCurrency(taxResult.summary.taxableAmount)}</span>
            </div>
            {taxResult.summary.totalDiscount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Total Discount</span>
                <span className="font-mono">-{formatCurrency(taxResult.summary.totalDiscount)}</span>
              </div>
            )}

            {taxResult.summary.isInterState ? (
              <div className="flex justify-between text-slate-300">
                <span>IGST (Inter-State)</span>
                <span className="font-mono">+{formatCurrency(taxResult.summary.totalIgst)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-slate-300">
                  <span>CGST (Intra-State)</span>
                  <span className="font-mono">+{formatCurrency(taxResult.summary.totalCgst)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>SGST (Intra-State)</span>
                  <span className="font-mono">+{formatCurrency(taxResult.summary.totalSgst)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between text-slate-400">
              <span>Round Off</span>
              <span className="font-mono">{taxResult.summary.roundOff.toFixed(2)}</span>
            </div>

            <div className="pt-3 border-t border-slate-700 flex items-baseline justify-between">
              <span className="text-sm font-bold">Grand Total</span>
              <span className="text-2xl font-bold font-mono text-emerald-400">
                {formatCurrency(taxResult.summary.grandTotal)}
              </span>
            </div>

            <div className="text-[11px] text-slate-400 italic">
              {numberToWordsINR(taxResult.summary.grandTotal)}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between text-xs">
              <span className="text-slate-300">Paid: {formatCurrency(paidNum)}</span>
              <span className="font-mono font-bold text-amber-400">
                Balance Due: {formatCurrency(balancePreview)}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={generating || items.length === 0}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50 shadow-md"
          >
            {generating ? "Generating GST Tax Invoice..." : "Finalize & Issue GST Tax Invoice"}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-xs text-slate-400">Loading...</div>}>
      <BillingEngineContent />
    </Suspense>
  );
}
