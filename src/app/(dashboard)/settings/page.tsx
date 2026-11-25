"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  Save,
  CreditCard,
  FileText,
  MapPin,
  Upload,
  BellRing,
  Clock,
  ImageIcon,
} from "lucide-react";
import { INDIAN_STATES, extractStateCodeFromGstin } from "@/lib/gst";
import { saveBusinessSettingsAction } from "@/actions/enterprise-actions";
import { toast } from "sonner";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    businessName: "Kyra Enterprises",
    logoUrl: "/logo.jpeg",
    gstin: "",
    address: "",
    city: "",
    state: "Bihar",
    stateCode: "10",
    pincode: "",
    phone: "",
    email: "",
    bankName: "",
    accountHolder: "Kyra Enterprises",
    accountNumber: "",
    ifscCode: "",
    branch: "",
    upiId: "",
    invoicePrefix: "KE/26-27/",
    defaultDueDays: 5,
    invoiceTerms: "",
    reminderEnabled: true,
    reminderIntervalDays: 4 as 3 | 4,
  });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.success && data.settings) {
        const s = data.settings;
        setFormData({
          businessName: s.businessName || "Kyra Enterprises",
          logoUrl: s.logoUrl || "/logo.jpeg",
          gstin: s.gstin || "",
          address: s.address || "",
          city: s.city || "",
          state: s.state || "Bihar",
          stateCode: s.stateCode || "10",
          pincode: s.pincode || "",
          phone: s.phone || "",
          email: s.email || "",
          bankName: s.bankDetails?.bankName || "",
          accountHolder: s.bankDetails?.accountHolder || "Kyra Enterprises",
          accountNumber: s.bankDetails?.accountNumber || "",
          ifscCode: s.bankDetails?.ifscCode || "",
          branch: s.bankDetails?.branch || "",
          upiId: s.upiId || "",
          invoicePrefix: s.invoicePrefix || "KE/26-27/",
          defaultDueDays: Number(s.defaultDueDays ?? 5),
          invoiceTerms: s.invoiceTerms || "",
          reminderEnabled: s.reminderSettings?.enabled !== false,
          reminderIntervalDays: s.reminderSettings?.intervalDays === 3 ? 3 : 4,
        });
      }
    } catch {
      toast.error("Failed to load business settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleGstinChange = (gstinVal: string) => {
    const upper = gstinVal.toUpperCase().trim();
    const detectedCode = extractStateCodeFromGstin(upper);
    const matchedState = INDIAN_STATES.find((s) => s.code === detectedCode);

    setFormData((prev) => ({
      ...prev,
      gstin: upper,
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

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      toast.error("Logo image must be under 1.5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setFormData((prev) => ({ ...prev, logoUrl: reader.result as string }));
        toast.success("Business logo staged — click Save Configuration to persist");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const currentRes = await fetch("/api/settings");
      const currentJson = await currentRes.json();
      const existingReminder = currentJson?.settings?.reminderSettings || {};

      const payload = {
        businessName: formData.businessName,
        logoUrl: formData.logoUrl,
        gstin: formData.gstin,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        stateCode: formData.stateCode,
        pincode: formData.pincode,
        phone: formData.phone,
        email: formData.email,
        bankDetails: {
          bankName: formData.bankName,
          accountHolder: formData.accountHolder,
          accountNumber: formData.accountNumber,
          ifscCode: formData.ifscCode,
          branch: formData.branch,
        },
        upiId: formData.upiId,
        invoicePrefix: formData.invoicePrefix,
        defaultDueDays: Number(formData.defaultDueDays),
        invoiceTerms: formData.invoiceTerms,
        reminderSettings: {
          ...existingReminder,
          enabled: formData.reminderEnabled,
          intervalDays: formData.reminderIntervalDays,
        },
      };

      const actionRes = await saveBusinessSettingsAction(payload);
      if (!actionRes.success) {
        throw new Error(actionRes.error || "Failed to save settings");
      }

      toast.success(
        "Kyra Enterprises settings updated! All new invoices & reminders will use these details."
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error saving settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-medium">Loading Kyra Enterprises Business Settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <span>Business Settings &mdash; Kyra Enterprises</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Seller profile, GSTIN, banking, UPI QR, invoice numbering, and automatic reminder interval
          </p>
        </div>

        <Link
          href="/payment-reminders?tab=settings"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0e1e32] hover:bg-[#142a45] text-white text-xs font-semibold transition-colors"
        >
          <BellRing className="w-4 h-4 text-emerald-400" />
          <span>Configure Reminder Channels &amp; Templates</span>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identity & Logo */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>Enterprise Identity, Logo &amp; GST Registration</span>
          </h2>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 pb-3 border-b border-slate-100">
            <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
              {formData.logoUrl ? (
                <img
                  src={formData.logoUrl}
                  alt="Kyra Enterprises Logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div className="flex-1 space-y-1.5 text-xs">
              <div className="font-semibold text-slate-800">Business Logo (Invoice &amp; Sidebar)</div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold border border-slate-200">
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Upload Image</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogoFileUpload}
                    className="hidden"
                  />
                </label>
                <input
                  type="text"
                  value={formData.logoUrl}
                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  placeholder="/logo.jpeg or https://..."
                  className="flex-1 min-w-[200px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Enterprise Name *</label>
              <input
                type="text"
                required
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">GSTIN *</label>
              <input
                type="text"
                maxLength={15}
                value={formData.gstin}
                onChange={(e) => handleGstinChange(e.target.value)}
                placeholder="15-character GSTIN"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono uppercase font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Invoice Prefix *</label>
              <input
                type="text"
                required
                value={formData.invoicePrefix}
                onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value })}
                placeholder="KE/26-27/"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Default Credit Due Days
              </label>
              <input
                type="number"
                min={0}
                max={365}
                value={formData.defaultDueDays}
                onChange={(e) =>
                  setFormData({ ...formData, defaultDueDays: Number(e.target.value) })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Registered Address & Contacts */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>Registered Address &amp; Official Contacts</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Business Address *</label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">City *</label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">State *</label>
              <select
                value={formData.state}
                onChange={(e) => handleStateChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
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

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pincode *</label>
              <input
                type="text"
                required
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Bank Details & UPI */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <span>Bank Settlement Account &amp; UPI QR Details</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
              <input
                type="text"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Holder Name</label>
              <input
                type="text"
                value={formData.accountHolder}
                onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Number</label>
              <input
                type="text"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">IFSC Code</label>
              <input
                type="text"
                value={formData.ifscCode}
                onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono uppercase text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Branch</label>
              <input
                type="text"
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                UPI ID (Dynamic Invoice QR)
              </label>
              <input
                type="text"
                value={formData.upiId}
                onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                placeholder="merchant@bank"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Automatic Reminder Cadence + Invoice Terms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Automatic Payment Reminder Cadence</span>
            </h2>

            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                <div>
                  <div className="font-bold text-slate-900">Enable Automatic Payment Reminders</div>
                  <div className="text-[11px] text-slate-500">
                    Automatically follow up on unpaid &amp; partially paid invoices until ₹0 due
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.reminderEnabled}
                  onChange={(e) =>
                    setFormData({ ...formData, reminderEnabled: e.target.checked })
                  }
                  className="w-4 h-4 accent-emerald-600"
                />
              </label>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Recurring Reminder Interval (Default: 4 Days)
                </label>
                <select
                  value={formData.reminderIntervalDays}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reminderIntervalDays: Number(e.target.value) === 3 ? 3 : 4,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  <option value={4}>Every 4 Days (Recommended Default)</option>
                  <option value={3}>Every 3 Days</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>Invoice Terms &amp; Conditions</span>
            </h2>
            <textarea
              rows={5}
              value={formData.invoiceTerms}
              onChange={(e) => setFormData({ ...formData, invoiceTerms: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
              placeholder="Enter standard GST invoice terms..."
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-2.5 rounded-xl text-xs shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving Configuration..." : "Save Kyra Enterprises Configuration"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
