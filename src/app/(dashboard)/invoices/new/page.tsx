"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FilePlus2,
  Building2,
  Users,
  Package,
  Plus,
  Trash2,
  Calculator,
  ShieldCheck,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Info,
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

  // Master data
  const [settings, setSettings] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Customer selection
  const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustId || "");
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerData, setCustomerData] = useState({
    name: "",
    businessName: "",
    phone: "",
    email: "",
    billingAddress: "",
    shippingAddress: "",
    gstin: "",
    state: "Delhi",
    stateCode: "07",
  });

  // Invoice items
  const [items, setItems] = useState<BillingItem[]>([]);

  // Payment
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "bank_transfer" | "card" | "credit">("cash");
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

        if (sData.success) setSettings(sData.settings);
        if (cData.success) {
          setCustomers(cData.customers);
          if (preselectedCustId) {
            const found = cData.customers.find((c: any) => c._id === preselectedCustId);
            if (found) {
              setCustomerData({
                name: found.name,
                businessName: found.businessName || "",
                phone: found.phone,
                email: found.email || "",
                billingAddress: found.billingAddress,
                shippingAddress: found.shippingAddress || found.billingAddress,
                gstin: found.gstin || "",
                state: found.state || "Delhi",
                stateCode: found.stateCode || "07",
              });
            }
          } else if (cData.customers.length > 0) {
            const first = cData.customers[0];
            setSelectedCustomerId(first._id);
            setCustomerData({
              name: first.name,
              businessName: first.businessName || "",
              phone: first.phone,
              email: first.email || "",
              billingAddress: first.billingAddress,
              shippingAddress: first.shippingAddress || first.billingAddress,
              gstin: first.gstin || "",
              state: first.state || "Delhi",
              stateCode: first.stateCode || "07",
            });
          }
        }
        if (pData.success) {
          setProducts(pData.products);
          // Initial empty item row if products exist
          if (pData.products.length > 0) {
            const firstP = pData.products[0];
            setItems([
              {
                productId: firstP._id,
                name: firstP.name,
                sku: firstP.sku,
                hsnCode: firstP.hsnCode,
                uom: firstP.uom,
                availableStock: firstP.availableQuantity,
                rate: firstP.sellingPrice,
                quantity: 1,
                discount: 0,
                discountPercent: 0,
                gstRate: firstP.gstRate,
              },
            ]);
          }
        }
      } catch {
        toast.error("Failed to load billing dependencies");
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, [preselectedCustId]);

  // When customer dropdown changes
  const handleCustomerSelect = (id: string) => {
    setSelectedCustomerId(id);
    if (id === "NEW") {
      setIsNewCustomer(true);
      setCustomerData({
        name: "",
        businessName: "",
        phone: "",
        email: "",
        billingAddress: "",
        shippingAddress: "",
        gstin: "",
        state: settings?.state || "Delhi",
        stateCode: settings?.stateCode || "07",
      });
    } else {
      setIsNewCustomer(false);
      const cust = customers.find((c) => c._id === id);
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

  // Add line item
  const addItemRow = () => {
    if (products.length === 0) return;
    const firstP = products[0];
    setItems((prev) => [
      ...prev,
      {
        productId: firstP._id,
        name: firstP.name,
        sku: firstP.sku,
        hsnCode: firstP.hsnCode,
        uom: firstP.uom,
        availableStock: firstP.availableQuantity,
        rate: firstP.sellingPrice,
        quantity: 1,
        discount: 0,
        discountPercent: 0,
        gstRate: firstP.gstRate,
      },
    ]);
  };

  // Update item product
  const handleProductChange = (index: number, productId: string) => {
    const prod = products.find((p) => p._id === productId);
    if (!prod) return;

    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        productId: prod._id,
        name: prod.name,
        sku: prod.sku,
        hsnCode: prod.hsnCode,
        uom: prod.uom,
        availableStock: prod.availableQuantity,
        rate: prod.sellingPrice,
        gstRate: prod.gstRate,
      };
      return copy;
    });
  };

  const updateItemField = (index: number, field: keyof BillingItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) {
      toast.error("An invoice must contain at least one line item");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate live taxes
  const sellerStateCode = settings?.stateCode || "07";
  const customerStateCode = customerData.stateCode || "07";

  const calculation = useMemo(() => {
    return calculateInvoiceTaxes(
      items.map((it) => ({
        rate: Number(it.rate || 0),
        quantity: Number(it.quantity || 1),
        discount: Number(it.discount || 0),
        discountPercent: Number(it.discountPercent || 0),
        gstRate: Number(it.gstRate || 0),
      })),
      sellerStateCode,
      customerStateCode
    );
  }, [items, sellerStateCode, customerStateCode]);

  // Handle invoice generation
  const handleGenerateInvoice = async () => {
    if (!customerData.name || !customerData.phone || !customerData.billingAddress) {
      toast.error("Please complete the required customer details");
      return;
    }

    // Check stock
    for (const it of items) {
      if (it.quantity > it.availableStock) {
        toast.error(
          `Insufficient stock for "${it.name}". Available: ${it.availableStock}, Requested: ${it.quantity}`
        );
        return;
      }
      if (it.quantity <= 0) {
        toast.error(`Quantity for "${it.name}" must be at least 1`);
        return;
      }
    }

    try {
      setGenerating(true);
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: isNewCustomer ? undefined : selectedCustomerId,
          customerData,
          items: items.map((it) => ({
            productId: it.productId,
            quantity: Number(it.quantity),
            rate: Number(it.rate),
            discount: Number(it.discount || 0),
            discountPercent: Number(it.discountPercent || 0),
          })),
          paymentMode,
          amountPaid: amountPaid ? Number(amountPaid) : calculation.summary.grandTotal,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create invoice");

      toast.success(`Invoice ${data.invoice.invoiceNumber} generated successfully!`);
      router.push(`/invoices/${data.invoice._id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error generating invoice";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-medium">Loading GST Billing Terminal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FilePlus2 className="w-5 h-5 text-emerald-600" />
            <span>New Tax Invoice (GST Billing Terminal)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-calculates CGST, SGST, IGST and generates immutable tax receipts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              calculation.summary.isInterState
                ? "bg-purple-100 text-purple-700 border border-purple-200"
                : "bg-emerald-100 text-emerald-800 border border-emerald-200"
            }`}
          >
            {calculation.summary.isInterState
              ? "⚡ Inter-State Supply (IGST Applicable)"
              : "✓ Intra-State Supply (CGST + SGST Applicable)"}
          </span>
        </div>
      </div>

      {/* Step 1 & 2: Seller & Customer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Step 1: Seller Details Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Step 1: Seller Details (Kayra Enterprises)
            </h2>
          </div>

          <div className="text-xs space-y-1.5 text-slate-600">
            <div className="font-bold text-slate-900 text-sm">{settings?.businessName}</div>
            <div>{settings?.address}</div>
            <div>
              {settings?.city}, {settings?.state} - {settings?.pincode} (State Code:{" "}
              <strong className="text-slate-800 font-mono">{settings?.stateCode}</strong>)
            </div>
            <div className="pt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
              <span>
                GSTIN: <strong className="text-slate-800 font-mono">{settings?.gstin}</strong>
              </span>
              <span>Phone: {settings?.phone}</span>
              <span>Email: {settings?.email}</span>
            </div>
          </div>
        </div>

        {/* Step 2: Customer Selection Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Step 2: Customer / Buyer Information
              </h2>
            </div>

            <select
              value={isNewCustomer ? "NEW" : selectedCustomerId}
              onChange={(e) => handleCustomerSelect(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 font-medium text-slate-700 focus:outline-none focus:border-emerald-500"
            >
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} {c.businessName ? `(${c.businessName})` : ""}
                </option>
              ))}
              <option value="NEW">+ Add New Customer Inline</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                Buyer Name *
              </label>
              <input
                type="text"
                required
                value={customerData.name}
                onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                placeholder="Client Name"
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                value={customerData.phone}
                onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                placeholder="+91..."
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                Buyer GSTIN (Optional)
              </label>
              <input
                type="text"
                value={customerData.gstin}
                onChange={(e) => handleGstinChange(e.target.value)}
                placeholder="e.g. 09AABCS1234E1Z8"
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono uppercase text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                Place of Supply (State) *
              </label>
              <select
                value={customerData.state}
                onChange={(e) => {
                  const s = INDIAN_STATES.find((st) => st.name === e.target.value);
                  setCustomerData({
                    ...customerData,
                    state: e.target.value,
                    stateCode: s ? s.code : customerData.stateCode,
                  });
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.name}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                Billing Address *
              </label>
              <input
                type="text"
                required
                value={customerData.billingAddress}
                onChange={(e) => setCustomerData({ ...customerData, billingAddress: e.target.value })}
                placeholder="Street Address, City, Postal Code"
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Step 3 & 4: Line Items Table & Live Tax Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Step 3: Line Item Catalogue Selection
            </h2>
          </div>

          <button
            type="button"
            onClick={addItemRow}
            className="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            <span>Add Item Row</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-3 w-8 text-center">#</th>
                <th className="py-3 px-3 min-w-[220px]">Product / Item</th>
                <th className="py-3 px-3 text-center">HSN</th>
                <th className="py-3 px-3 text-center w-24">Qty</th>
                <th className="py-3 px-3 text-right w-28">Rate (₹)</th>
                <th className="py-3 px-3 text-right w-24">Disc (₹)</th>
                <th className="py-3 px-3 text-right">Taxable</th>
                <th className="py-3 px-3 text-center">GST %</th>
                <th className="py-3 px-3 text-right">Tax Amount</th>
                <th className="py-3 px-3 text-right">Line Total</th>
                <th className="py-3 px-3 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => {
                const calc = calculation.items[index];
                const isOverStock = item.quantity > item.availableStock;

                return (
                  <tr key={index} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 text-center text-slate-400 font-mono">
                      {index + 1}
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={item.productId}
                        onChange={(e) => handleProductChange(index, e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                      >
                        {products.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} (Stock: {p.availableQuantity} {p.uom})
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2 mt-1 text-[11px]">
                        <span className="font-mono text-slate-400">SKU: {item.sku}</span>
                        <span
                          className={`font-semibold ${
                            isOverStock ? "text-red-600" : "text-emerald-700"
                          }`}
                        >
                          • Available: {item.availableStock} {item.uom}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-500">
                      {item.hsnCode}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItemField(index, "quantity", Math.max(1, parseInt(e.target.value) || 1))
                        }
                        className={`w-20 text-center bg-slate-50 border rounded px-2 py-1 font-semibold text-xs focus:outline-none ${
                          isOverStock
                            ? "border-red-400 text-red-700 bg-red-50"
                            : "border-slate-200 text-slate-900 focus:border-emerald-500"
                        }`}
                      />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) => updateItemField(index, "rate", parseFloat(e.target.value) || 0)}
                        className="w-24 text-right bg-slate-50 border border-slate-200 rounded px-2 py-1 font-medium text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                      />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={item.discount || ""}
                        onChange={(e) =>
                          updateItemField(index, "discount", parseFloat(e.target.value) || 0)
                        }
                        placeholder="0"
                        className="w-20 text-right bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                      />
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-800">
                      {calc ? formatCurrency(calc.taxableAmount) : "-"}
                    </td>
                    <td className="py-3 px-3 text-center font-medium text-slate-700">
                      {item.gstRate}%
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      {calc ? formatCurrency(calc.totalTax) : "-"}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {calc ? formatCurrency(calc.totalAmount) : "-"}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeItemRow(index)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded"
                        title="Remove Item"
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

        {/* Step 4: Live Invoice Calculations Summary Bar */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Notes and Amount in words */}
          <div className="space-y-3">
            <div>
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Amount in Words (INR):
              </span>
              <p className="text-xs font-semibold text-emerald-800 bg-emerald-50/80 border border-emerald-200/60 p-2.5 rounded-lg italic">
                {numberToWordsINR(calculation.summary.grandTotal)}
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Invoice Notes / Remarks
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special delivery instructions or PO reference number..."
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Tax Breakdown Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Total Taxable Value:</span>
              <span className="font-semibold text-slate-800">
                {formatCurrency(calculation.summary.taxableAmount)}
              </span>
            </div>

            {calculation.summary.totalDiscount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Total Discount Given:</span>
                <span className="font-semibold">
                  -{formatCurrency(calculation.summary.totalDiscount)}
                </span>
              </div>
            )}

            {calculation.summary.isInterState ? (
              <div className="flex justify-between text-purple-700">
                <span>Integrated GST (IGST):</span>
                <span className="font-semibold">
                  {formatCurrency(calculation.summary.totalIgst)}
                </span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>Central GST (CGST):</span>
                  <span className="font-semibold">
                    {formatCurrency(calculation.summary.totalCgst)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>State GST (SGST):</span>
                  <span className="font-semibold">
                    {formatCurrency(calculation.summary.totalSgst)}
                  </span>
                </div>
              </>
            )}

            {calculation.summary.roundOff !== 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Round Off:</span>
                <span>{formatCurrency(calculation.summary.roundOff)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
              <span>Grand Total:</span>
              <span className="text-base text-emerald-600">
                {formatCurrency(calculation.summary.grandTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Step 5: Payment Mode & Generation */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-900">Payment Mode:</span>
          </div>

          <div className="flex items-center gap-1.5">
            {(["cash", "upi", "bank_transfer", "card", "credit"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPaymentMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  paymentMode === mode
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {mode.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Amount Paid (₹):</span>
            <input
              type="number"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder={String(calculation.summary.grandTotal)}
              className="w-28 bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerateInvoice}
          disabled={generating}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-6 py-3 rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
        >
          {generating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Generating Invoice & Deducting Stock...</span>
            </>
          ) : (
            <>
              <span>Generate Tax Invoice ({formatCurrency(calculation.summary.grandTotal)})</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-slate-400">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-medium">Loading GST Billing Terminal...</p>
        </div>
      }
    >
      <BillingEngineContent />
    </Suspense>
  );
}
