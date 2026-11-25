"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Plus,
  Search,
  Phone,
  Edit2,
  FilePlus2,
  BookOpen,
  RefreshCw,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { INDIAN_STATES, extractStateCodeFromGstin } from "@/lib/gst";
import { KyraSwitch } from "@/components/ui/kyra-ui";
import { toggleCustomerReminderAction } from "@/actions/enterprise-actions";
import { toast } from "sonner";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    businessName: "",
    phone: "",
    email: "",
    billingAddress: "",
    shippingAddress: "",
    gstin: "",
    state: "Bihar",
    stateCode: "10",
    customerType: "unregistered",
    remindersEnabled: true,
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const query = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/customers${query}`);
      const data = await res.json();
      if (data.success) setCustomers(data.customers);
    } catch {
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const handleGstinChange = (gstinVal: string) => {
    const upper = gstinVal.toUpperCase().trim();
    const detectedCode = extractStateCodeFromGstin(upper);
    const matchedState = INDIAN_STATES.find((s) => s.code === detectedCode);

    setFormData((prev) => ({
      ...prev,
      gstin: upper,
      customerType: upper.length >= 15 ? "registered" : prev.customerType,
      state: matchedState ? matchedState.name : prev.state,
      stateCode: detectedCode || prev.stateCode,
    }));
  };

  const handleStateChange = (stateName: string) => {
    const s = INDIAN_STATES.find((item) => item.name === stateName);
    setFormData((prev) => ({
      ...prev,
      state: stateName,
      stateCode: s ? s.code : prev.stateCode,
    }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      businessName: "",
      phone: "",
      email: "",
      billingAddress: "",
      shippingAddress: "",
      gstin: "",
      state: "Bihar",
      stateCode: "10",
      customerType: "unregistered",
      remindersEnabled: true,
    });
  };

  const openEdit = (c: any) => {
    setSelectedCustomer(c);
    setFormData({
      name: c.name,
      businessName: c.businessName || "",
      phone: c.phone,
      email: c.email || "",
      billingAddress: c.billingAddress,
      shippingAddress: c.shippingAddress || c.billingAddress,
      gstin: c.gstin || "",
      state: c.state || "Bihar",
      stateCode: c.stateCode || "10",
      customerType: c.customerType || "unregistered",
      remindersEnabled: c.remindersEnabled !== false,
    });
    setIsEditOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const url =
        isEditOpen && selectedCustomer ? `/api/customers/${selectedCustomer._id}` : "/api/customers";
      const method = isEditOpen ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save customer");

      toast.success(isEditOpen ? "Customer updated" : "Customer added to Kyra Enterprises");
      setIsAddOpen(false);
      setIsEditOpen(false);
      setSelectedCustomer(null);
      resetForm();
      fetchCustomers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error saving customer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleReminders = async (cust: any, checked: boolean) => {
    const res = await toggleCustomerReminderAction(cust._id, checked);
    if (!res.success) {
      toast.error(res.error || "Failed to update reminder preference");
      return;
    }
    toast.success(`Payment reminders ${checked ? "enabled" : "disabled"} for ${cust.name}`);
    fetchCustomers();
  };

  const totalPurchasesAll = customers.reduce((s, c) => s + Number(c.totalPurchases || 0), 0);
  const totalPaidAll = customers.reduce((s, c) => s + Number(c.totalPaid || 0), 0);
  const totalReceivables = customers.reduce((s, c) => s + Number(c.balance || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Customer Management &amp; Accounts Receivable
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Client profiles, GSTIN state mapping, lifetime purchases, outstanding balances, and Customer Payment Ledgers
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsAddOpen(true);
          }}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total Customers</div>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono">{customers.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {customers.filter((c) => c.customerType === "registered").length} GST registered
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Lifetime Purchases</div>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
            {formatCurrency(totalPurchasesAll)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Total billed volume</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total Payments Received</div>
          <div className="text-xl font-bold text-emerald-600 mt-1 font-mono">
            {formatCurrency(totalPaidAll)}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1">Settled receipts</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Outstanding Receivable</div>
          <div className="text-xl font-bold text-amber-600 mt-1 font-mono">
            {formatCurrency(totalReceivables)}
          </div>
          <div className="text-[11px] text-amber-600 mt-1">Pending collection</div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, business, phone, or GSTIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <button
          onClick={fetchCustomers}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Customer / Business</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">GSTIN &amp; State</th>
                <th className="py-3 px-4 text-right">Total Purchases</th>
                <th className="py-3 px-4 text-right">Total Paid</th>
                <th className="py-3 px-4 text-right">Outstanding</th>
                <th className="py-3 px-4 text-center">Auto Reminders</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading customer directory...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p>No customers found</p>
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <Link
                        href={`/customers/${c._id}`}
                        className="font-bold text-slate-900 hover:text-emerald-600"
                      >
                        {c.name}
                      </Link>
                      {c.businessName && c.businessName !== c.name && (
                        <div className="text-[11px] text-slate-500">{c.businessName}</div>
                      )}
                      <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                        {c.billingAddress}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 font-mono text-slate-700">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{c.phone}</span>
                      </div>
                      {c.email && <div className="text-[11px] text-slate-400">{c.email}</div>}
                    </td>

                    <td className="py-3 px-4">
                      {c.gstin ? (
                        <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                          {c.gstin}
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-semibold text-slate-400">
                          Unregistered
                        </span>
                      )}
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {c.state} ({c.stateCode})
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-slate-800">
                      {formatCurrency(c.totalPurchases || 0)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-emerald-600 font-semibold">
                      {formatCurrency(c.totalPaid || 0)}
                    </td>

                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        Number(c.balance || 0) > 0 ? "text-amber-600" : "text-slate-500"
                      }`}
                    >
                      {formatCurrency(c.balance || 0)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <KyraSwitch
                        checked={c.remindersEnabled !== false}
                        onCheckedChange={(val) => handleToggleReminders(c, val)}
                      />
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/customers/${c._id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0e1e32] hover:bg-[#142a45] text-white text-[11px] font-semibold"
                          title="Open Customer Payment Ledger"
                        >
                          <BookOpen className="w-3 h-3 text-emerald-400" />
                          <span>Ledger</span>
                        </Link>
                        <Link
                          href={`/invoices/new?customerId=${c._id}`}
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          title="Create Invoice for Customer"
                        >
                          <FilePlus2 className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          title="Edit Customer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {(isAddOpen || isEditOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-900">
              {isEditOpen ? "Edit Customer Profile" : "Register New Customer"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Configure billing/shipping addresses, GSTIN, state code, and reminder preferences
            </p>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Business Name</label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    GSTIN (Optional for B2C)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={formData.gstin}
                    onChange={(e) => handleGstinChange(e.target.value)}
                    placeholder="10AAAAA0000A1Z5"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono uppercase text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customer Type</label>
                  <select
                    value={formData.customerType}
                    onChange={(e) => setFormData({ ...formData, customerType: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  >
                    <option value="unregistered">Unregistered / Retail (B2C)</option>
                    <option value="registered">GST Registered Business (B2B)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">State *</label>
                  <select
                    value={formData.state}
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
                  <label className="block font-semibold text-slate-700 mb-1">State Code</label>
                  <input
                    type="text"
                    readOnly
                    value={formData.stateCode}
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 font-mono font-bold text-slate-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Billing Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.billingAddress}
                    onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Shipping Address (Defaults to Billing Address if blank)
                  </label>
                  <input
                    type="text"
                    value={formData.shippingAddress}
                    onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="custRem"
                    checked={formData.remindersEnabled}
                    onChange={(e) =>
                      setFormData({ ...formData, remindersEnabled: e.target.checked })
                    }
                    className="w-4 h-4 accent-emerald-600"
                  />
                  <label htmlFor="custRem" className="font-semibold text-slate-700">
                    Enable Automatic Payment Reminders for this customer
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    setIsEditOpen(false);
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
                  {submitting ? "Saving..." : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
