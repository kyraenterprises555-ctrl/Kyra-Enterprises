"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BellRing,
  Play,
  Send,
  Pause,
  CheckCircle2,
  Save,
  RefreshCw,
  Mail,
  MessageSquare,
  Smartphone,
  Bell,
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
import {
  DEFAULT_REMINDER_SUBJECT,
  DEFAULT_REMINDER_TEMPLATE,
  renderReminderTemplate,
} from "@/lib/reminder-templates";
import {
  saveBusinessSettingsAction,
  toggleCustomerReminderAction,
} from "@/actions/enterprise-actions";
import { toast } from "sonner";

function PaymentRemindersContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "settings" ? "settings" : "schedules";

  const [reminders, setReminders] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [fullSettings, setFullSettings] = useState<any>(null);
  const [userRole, setUserRole] = useState("admin");
  const [loading, setLoading] = useState(true);
  const [runningDue, setRunningDue] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Settings form
  const [cfg, setCfg] = useState({
    enabled: true,
    intervalDays: 4 as 3 | 4,
    reminderStartDate: "",
    channels: ["in_app", "email"] as Array<"email" | "whatsapp" | "sms" | "in_app">,
    subjectTemplate: DEFAULT_REMINDER_SUBJECT,
    messageTemplate: DEFAULT_REMINDER_TEMPLATE,
    maxRetries: 3,
    retryDelayMinutes: 60,
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
    whatsappPhoneNumberId: "",
    whatsappAccessToken: "",
    whatsappTemplateName: "",
    smsApiUrl: "",
    smsApiKey: "",
    smsSenderId: "KYRAEN",
  });

  const loadAll = async () => {
    try {
      setLoading(true);
      const [remRes, logRes, custRes, setRes, meRes] = await Promise.all([
        fetch("/api/reminders"),
        fetch("/api/reminders/logs?limit=120"),
        fetch("/api/customers"),
        fetch("/api/settings"),
        fetch("/api/auth/me"),
      ]);
      const remData = await remRes.json();
      const logData = await logRes.json();
      const custData = await custRes.json();
      const setData = await setRes.json();
      const meData = await meRes.json();

      if (remData.success) setReminders(remData.reminders || []);
      if (logData.success) setLogs(logData.logs || []);
      if (custData.success) setCustomers(custData.customers || []);
      if (meData?.user?.role) setUserRole(meData.user.role);

      if (setData.success && setData.settings) {
        setFullSettings(setData.settings);
        const rs = setData.settings.reminderSettings || {};
        const pv = rs.providers || {};
        setCfg({
          enabled: rs.enabled !== false,
          intervalDays: rs.intervalDays === 3 ? 3 : 4,
          reminderStartDate: rs.reminderStartDate
            ? new Date(rs.reminderStartDate).toISOString().split("T")[0]
            : "",
          channels:
            Array.isArray(rs.channels) && rs.channels.length > 0
              ? rs.channels
              : ["in_app", "email"],
          subjectTemplate: rs.subjectTemplate || DEFAULT_REMINDER_SUBJECT,
          messageTemplate: rs.messageTemplate || DEFAULT_REMINDER_TEMPLATE,
          maxRetries: Number(rs.maxRetries ?? 3),
          retryDelayMinutes: Number(rs.retryDelayMinutes ?? 60),
          smtpHost: pv.smtpHost || "",
          smtpPort: Number(pv.smtpPort || 587),
          smtpUser: pv.smtpUser || "",
          smtpPass: pv.smtpPass || "",
          smtpFrom: pv.smtpFrom || "",
          whatsappPhoneNumberId: pv.whatsappPhoneNumberId || "",
          whatsappAccessToken: pv.whatsappAccessToken || "",
          whatsappTemplateName: pv.whatsappTemplateName || "",
          smsApiUrl: pv.smsApiUrl || "",
          smsApiKey: pv.smsApiKey || "",
          smsSenderId: pv.smsSenderId || "KYRAEN",
        });
      }
    } catch {
      toast.error("Failed to load payment reminder data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleRunDueBatch = async () => {
    try {
      setRunningDue(true);
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_due" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to execute reminder batch");

      const s = data.summary;
      toast.success(
        `Cycle complete: ${s.processed} evaluated, ${s.sent} delivered, ${s.skippedDuplicatePeriod} duplicate-period skipped.`
      );
      loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error running reminders");
    } finally {
      setRunningDue(false);
    }
  };

  const handleSendSingleNow = async (invoiceId: string) => {
    try {
      setSendingId(invoiceId);
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_single", invoiceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reminder");

      toast.success(
        `Reminder processed (${data.summary.sent} delivered; check Delivery Logs for provider status)`
      );
      loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error sending reminder");
    } finally {
      setSendingId(null);
    }
  };

  const handleToggleScheduleStatus = async (rem: any) => {
    const nextStatus = rem.status === "paused" ? "active" : "paused";
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_status",
          reminderId: rem._id,
          status: nextStatus,
        }),
      });
      if (res.ok) {
        toast.success(`Schedule ${nextStatus === "paused" ? "paused" : "resumed"}`);
        loadAll();
      }
    } catch {}
  };

  const toggleChannel = (ch: "email" | "whatsapp" | "sms" | "in_app") => {
    setCfg((prev) => {
      const exists = prev.channels.includes(ch);
      const next = exists ? prev.channels.filter((x) => x !== ch) : [...prev.channels, ch];
      return { ...prev, channels: next.length > 0 ? next : ["in_app"] };
    });
  };

  const handleSaveReminderSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullSettings) return;
    try {
      setSavingSettings(true);
      const payload = {
        businessName: fullSettings.businessName || "Kyra Enterprises",
        logoUrl: fullSettings.logoUrl || "/logo.jpeg",
        gstin: fullSettings.gstin || "",
        address: fullSettings.address || "Madhubani",
        city: fullSettings.city || "Madhubani",
        state: fullSettings.state || "Bihar",
        stateCode: fullSettings.stateCode || "10",
        pincode: fullSettings.pincode || "847223",
        phone: fullSettings.phone || "+91 73939 31555",
        email: fullSettings.email || "",
        bankDetails: fullSettings.bankDetails || {},
        upiId: fullSettings.upiId || "",
        invoicePrefix: fullSettings.invoicePrefix || "KE/26-27/",
        defaultDueDays: Number(fullSettings.defaultDueDays ?? 5),
        invoiceTerms: fullSettings.invoiceTerms || "",
        reminderSettings: {
          enabled: cfg.enabled,
          intervalDays: cfg.intervalDays,
          reminderStartDate: cfg.reminderStartDate || null,
          startDaysAfterInvoice: 0,
          channels: cfg.channels,
          subjectTemplate: cfg.subjectTemplate,
          messageTemplate: cfg.messageTemplate,
          maxRetries: Number(cfg.maxRetries),
          retryDelayMinutes: Number(cfg.retryDelayMinutes),
          providers: {
            smtpHost: cfg.smtpHost,
            smtpPort: Number(cfg.smtpPort),
            smtpSecure: Number(cfg.smtpPort) === 465,
            smtpUser: cfg.smtpUser,
            smtpPass: cfg.smtpPass,
            smtpFrom: cfg.smtpFrom,
            whatsappPhoneNumberId: cfg.whatsappPhoneNumberId,
            whatsappAccessToken: cfg.whatsappAccessToken,
            whatsappTemplateName: cfg.whatsappTemplateName,
            smsApiUrl: cfg.smsApiUrl,
            smsApiKey: cfg.smsApiKey,
            smsSenderId: cfg.smsSenderId,
          },
        },
      };

      const res = await saveBusinessSettingsAction(payload);
      if (!res.success) throw new Error(res.error || "Failed to save reminder settings");
      toast.success("Kyra Enterprises Payment Reminder Settings saved!");
      loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const activeCount = reminders.filter((r) => r.status === "active").length;
  const completedCount = reminders.filter((r) => r.status === "completed").length;
  const dueNowCount = reminders.filter(
    (r) => r.status === "active" && new Date(r.nextReminderDate).getTime() <= Date.now()
  ).length;

  const livePreviewBody = renderReminderTemplate(cfg.messageTemplate, {
    customerName: "Dev Electric",
    invoiceNumber: "KE/26-27/11",
    invoiceAmount: 100,
    amountPaid: 70,
    remainingBalance: 30,
    dueDate: new Date(),
    enterpriseName: "Kyra Enterprises",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BellRing className="w-5 h-5 text-emerald-600" />
            <span>Automatic Payment Reminder System &mdash; Kyra Enterprises</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Recurring {cfg.intervalDays}-day follow-ups with real-time balance recalculation after partial payments &amp; instant completion at â‚¹0
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunDueBatch}
            disabled={runningDue}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            <span>
              {runningDue ? "Executing Due Reminders..." : `Run Due Reminders Now (${dueNowCount})`}
            </span>
          </button>
          <button
            onClick={loadAll}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Active Schedules</div>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono">{activeCount}</div>
          <div className="text-[11px] text-emerald-600 mt-1">
            Every {cfg.intervalDays} days interval
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Eligible Due Right Now</div>
          <div className="text-xl font-bold text-amber-600 mt-1 font-mono">{dueNowCount}</div>
          <div className="text-[11px] text-amber-600 mt-1">Past next reminder date</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Completed Schedules</div>
          <div className="text-xl font-bold text-emerald-600 mt-1 font-mono">{completedCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Auto-stopped at â‚¹0 due</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Reminder Logs Recorded</div>
          <div className="text-xl font-bold text-blue-600 mt-1 font-mono">{logs.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Idempotent audit history</div>
        </div>
      </div>

      <KyraTabs defaultValue={initialTab} className="space-y-4">
        <KyraTabsList>
          <KyraTabsTrigger value="schedules">
            Reminder Schedules ({reminders.length})
          </KyraTabsTrigger>
          <KyraTabsTrigger value="logs">
            Delivery &amp; Retry Logs ({logs.length})
          </KyraTabsTrigger>
          <KyraTabsTrigger value="customers">
            Customer-Wise Enable/Disable ({customers.length})
          </KyraTabsTrigger>
          {userRole === "admin" && (
            <KyraTabsTrigger value="settings">
              Reminder Settings &amp; Providers
            </KyraTabsTrigger>
          )}
        </KyraTabsList>

        {/* Tab 1: Schedules */}
        <KyraTabsContent value="schedules">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4 text-right">Invoice Total</th>
                    <th className="py-3 px-4 text-right">Amount Paid</th>
                    <th className="py-3 px-4 text-right">Remaining Due</th>
                    <th className="py-3 px-4 text-center">Interval</th>
                    <th className="py-3 px-4">Next Reminder</th>
                    <th className="py-3 px-4 text-center">Sent #</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        Loading schedules...
                      </td>
                    </tr>
                  ) : reminders.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        No reminder schedules found
                      </td>
                    </tr>
                  ) : (
                    reminders.map((rem) => (
                      <tr key={rem._id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          <Link
                            href={`/invoices/${rem.invoiceId}`}
                            className="hover:text-emerald-600"
                          >
                            {rem.invoiceNumber}
                          </Link>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{rem.customerName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {rem.customerPhone}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(rem.invoiceTotal)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600">
                          {formatCurrency(rem.amountPaid)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-600">
                          {formatCurrency(rem.remainingBalance)}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          Every {rem.intervalDays}d
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                          {rem.status === "completed" || rem.status === "cancelled"
                            ? "Stopped"
                            : formatDate(rem.nextReminderDate)}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold">
                          {rem.reminderCount || 0}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <KyraBadge
                            tone={
                              rem.status === "completed"
                                ? "emerald"
                                : rem.status === "active"
                                ? "blue"
                                : rem.status === "paused"
                                ? "amber"
                                : "red"
                            }
                          >
                            {rem.status}
                          </KyraBadge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {rem.remainingBalance > 0 &&
                            rem.status !== "completed" &&
                            rem.status !== "cancelled" && (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => handleSendSingleNow(String(rem.invoiceId))}
                                  disabled={sendingId === String(rem.invoiceId)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold disabled:opacity-50"
                                  title="Recalculate balance and dispatch reminder now"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>Send</span>
                                </button>
                                <button
                                  onClick={() => handleToggleScheduleStatus(rem)}
                                  className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                                  title={rem.status === "paused" ? "Resume" : "Pause"}
                                >
                                  {rem.status === "paused" ? (
                                    <Play className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Pause className="w-3 h-3 text-amber-600" />
                                  )}
                                </button>
                              </div>
                            )}
                          {rem.status === "completed" && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Settled</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </KyraTabsContent>

        {/* Tab 2: PaymentReminderLogs */}
        <KyraTabsContent value="logs">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Invoice / Customer</th>
                    <th className="py-3 px-4 text-center">Channel</th>
                    <th className="py-3 px-4 text-right">Balance Snapshot</th>
                    <th className="py-3 px-4 text-center">Delivery Status</th>
                    <th className="py-3 px-4">Message / Provider Diagnostics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No reminder execution logs recorded yet
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log._id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-900">
                            {log.invoiceNumber}
                          </div>
                          <div className="text-[11px] text-slate-500">{log.customerName}</div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <KyraBadge tone="slate">{log.channel}</KyraBadge>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          <div className="font-bold text-amber-600">
                            Due: {formatCurrency(log.remainingBalance)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Paid {formatCurrency(log.amountPaid)} / {formatCurrency(log.invoiceAmount)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <KyraBadge
                            tone={
                              log.deliveryStatus === "sent"
                                ? "emerald"
                                : log.deliveryStatus === "retrying"
                                ? "amber"
                                : "red"
                            }
                          >
                            {String(log.deliveryStatus).replace(/_/g, " ")}
                          </KyraBadge>
                        </td>
                        <td className="py-3 px-4 max-w-md">
                          <div className="text-[11px] text-slate-700 line-clamp-2 whitespace-pre-line">
                            {log.messageBody}
                          </div>
                          {log.errorMessage && (
                            <div className="text-[10px] text-red-600 font-semibold mt-1">
                              Note: {log.errorMessage}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </KyraTabsContent>

        {/* Tab 3: Customer-wise Enable / Disable */}
        <KyraTabsContent value="customers">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Phone / Email</th>
                    <th className="py-3 px-4 text-right">Current Balance Due</th>
                    <th className="py-3 px-4 text-center">Automatic Reminders Enabled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((c) => (
                    <tr key={c._id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                      <td className="py-3 px-4 text-slate-500">
                        {c.phone} {c.email ? `â€¢ ${c.email}` : ""}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-600">
                        {formatCurrency(c.balance || 0)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <KyraSwitch
                          checked={c.remindersEnabled !== false}
                          onCheckedChange={async (val) => {
                            await toggleCustomerReminderAction(c._id, val);
                            toast.success(`Updated reminder setting for ${c.name}`);
                            loadAll();
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </KyraTabsContent>

        {/* Tab 4: Reminder Settings & Providers */}
        {userRole === "admin" && (
          <KyraTabsContent value="settings">
            <form onSubmit={handleSaveReminderSettings} className="space-y-6 text-xs">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Core Schedule & Channels */}
                <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
                  <h2 className="font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
                    Schedule Cadence &amp; Delivery Channels
                  </h2>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div>
                      <div className="font-bold text-slate-900">
                        Enable Automatic Payment Reminders
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Scheduled cron worker sends reminders until balance reaches â‚¹0
                      </div>
                    </div>
                    <KyraSwitch
                      checked={cfg.enabled}
                      onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Reminder Interval *
                      </label>
                      <select
                        value={cfg.intervalDays}
                        onChange={(e) =>
                          setCfg({
                            ...cfg,
                            intervalDays: Number(e.target.value) === 3 ? 3 : 4,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-900"
                      >
                        <option value={4}>Every 4 Days (Default)</option>
                        <option value={3}>Every 3 Days</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Reminder Start Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={cfg.reminderStartDate}
                        onChange={(e) => setCfg({ ...cfg, reminderStartDate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-2">
                      Active Delivery Channels
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { id: "in_app", label: "In-App Notification", icon: Bell },
                        { id: "email", label: "Email (SMTP)", icon: Mail },
                        { id: "whatsapp", label: "WhatsApp Cloud API", icon: MessageSquare },
                        { id: "sms", label: "SMS Gateway", icon: Smartphone },
                      ].map((ch) => {
                        const Icon = ch.icon;
                        const active = cfg.channels.includes(ch.id as any);
                        return (
                          <button
                            type="button"
                            key={ch.id}
                            onClick={() => toggleChannel(ch.id as any)}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border font-semibold transition-colors ${
                              active
                                ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                                : "border-slate-200 bg-slate-50 text-slate-600"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{ch.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Message Template + Live Partial Payment Preview */}
                <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
                  <h2 className="font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
                    Reminder Message Template &amp; Live Preview
                  </h2>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Email / Alert Subject
                    </label>
                    <input
                      type="text"
                      value={cfg.subjectTemplate}
                      onChange={(e) => setCfg({ ...cfg, subjectTemplate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Body Template (Variables: {"{{customerName}}"}, {"{{invoiceNumber}}"},{" "}
                      {"{{invoiceAmount}}"}, {"{{amountPaid}}"}, {"{{remainingBalance}}"})
                    </label>
                    <textarea
                      rows={6}
                      value={cfg.messageTemplate}
                      onChange={(e) => setCfg({ ...cfg, messageTemplate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-[11px] text-slate-900"
                    />
                  </div>

                  <div className="p-3 rounded-lg bg-[#0e1e32] text-slate-200 text-[11px] whitespace-pre-line">
                    <div className="text-emerald-400 font-bold mb-1">
                      Sample Output (Invoice â‚¹100, Paid â‚¹70, Remaining â‚¹30):
                    </div>
                    {livePreviewBody}
                  </div>
                </div>
              </div>

              {/* Provider Credentials (Honest Delivery â€” No Fake Simulation) */}
              <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
                <div>
                  <h2 className="font-bold text-slate-900 uppercase tracking-wider">
                    External Delivery Provider Credentials (Optional)
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Kyra Enterprises never simulates fake delivery: unconfigured external channels log explicit <code className="font-mono">provider_not_configured</code> diagnostics while In-App notifications deliver immediately.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="font-bold text-slate-900">SMTP Email Provider</div>
                    <input
                      type="text"
                      placeholder="SMTP Host (e.g. smtp.gmail.com)"
                      value={cfg.smtpHost}
                      onChange={(e) => setCfg({ ...cfg, smtpHost: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                    <input
                      type="text"
                      placeholder="SMTP Username"
                      value={cfg.smtpUser}
                      onChange={(e) => setCfg({ ...cfg, smtpUser: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                    <input
                      type="password"
                      placeholder="SMTP App Password"
                      value={cfg.smtpPass}
                      onChange={(e) => setCfg({ ...cfg, smtpPass: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="font-bold text-slate-900">WhatsApp Business Cloud API</div>
                    <input
                      type="text"
                      placeholder="Phone Number ID"
                      value={cfg.whatsappPhoneNumberId}
                      onChange={(e) => setCfg({ ...cfg, whatsappPhoneNumberId: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                    <input
                      type="password"
                      placeholder="Permanent Access Token"
                      value={cfg.whatsappAccessToken}
                      onChange={(e) => setCfg({ ...cfg, whatsappAccessToken: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                    <input
                      type="text"
                      placeholder="Approved Template Name"
                      value={cfg.whatsappTemplateName}
                      onChange={(e) => setCfg({ ...cfg, whatsappTemplateName: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="font-bold text-slate-900">SMS Gateway Provider</div>
                    <input
                      type="text"
                      placeholder="SMS API Endpoint URL"
                      value={cfg.smsApiUrl}
                      onChange={(e) => setCfg({ ...cfg, smsApiUrl: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                    <input
                      type="password"
                      placeholder="SMS API Key"
                      value={cfg.smsApiKey}
                      onChange={(e) => setCfg({ ...cfg, smsApiKey: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                    <input
                      type="text"
                      placeholder="Sender ID (e.g. KYRAEN)"
                      value={cfg.smsSenderId}
                      onChange={(e) => setCfg({ ...cfg, smsSenderId: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingSettings ? "Saving..." : "Save Payment Reminder Settings"}</span>
                  </button>
                </div>
              </div>
            </form>
          </KyraTabsContent>
        )}
      </KyraTabs>
    </div>
  );
}

export default function PaymentRemindersPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-xs text-slate-400">Loading...</div>}>
      <PaymentRemindersContent />
    </Suspense>
  );
}

