"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LogOut,
  User,
  KeyRound,
  Shield,
  Eye,
  EyeOff,
  Lock,
  UserCheck,
  Phone,
  Mail,
  Edit3,
  Menu,
  Bell,
  CheckCheck,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

interface HeaderProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
  businessName?: string;
  onOpenMobileMenu?: () => void;
}

export function Header({
  user: initialUser,
  businessName = "Kyra Enterprises",
  onOpenMobileMenu,
}: HeaderProps) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [loggingOut, setLoggingOut] = useState(false);

  // In-app reminder notifications
  const [unreadNotifications, setUnreadNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Profile Modal
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState(initialUser.name);
  const [profilePhone, setProfilePhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Change Password Modal
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const loadNotifications = async () => {
    try {
      const res = await fetch("/api/reminders/logs?unreadInAppOnly=true&limit=10");
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setUnreadNotifications(data.logs);
      }
    } catch {}
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markAllRead = async () => {
    try {
      await fetch("/api/reminders/logs", { method: "PUT" });
      setUnreadNotifications([]);
      toast.success("Notifications marked as read");
    } catch {}
  };

  const openProfileModal = async () => {
    try {
      setProfileName(user.name);
      setIsProfileOpen(true);
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.success && data.user) {
        setProfilePhone(data.user.phone || "");
        if (data.user.name) {
          setProfileName(data.user.name);
          setUser((prev) => ({ ...prev, name: data.user.name }));
        }
      }
    } catch {}
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      toast.error("Full Name is required");
      return;
    }

    try {
      setSavingProfile(true);
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName.trim(),
          phone: profilePhone.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");

      setUser((prev) => ({ ...prev, name: data.user.name }));
      toast.success("Profile updated successfully!");
      setIsProfileOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error updating profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        toast.success("Signed out of Kyra Enterprises");
        router.push("/login");
        router.refresh();
      }
    } catch {
      toast.error("Error signing out");
    } finally {
      setLoggingOut(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    try {
      setSavingPassword(true);
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");

      toast.success(data.message || "Password updated successfully!");
      setIsPasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error changing password");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <header className="no-print print:hidden h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          {onOpenMobileMenu && (
            <button
              onClick={onOpenMobileMenu}
              aria-label="Open navigation"
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-slate-600 truncate max-w-[200px] sm:max-w-none">
            <strong className="text-[#0e1e32]">{businessName}</strong>{" "}
            <span className="hidden md:inline">&bull; GST Billing &amp; Inventory Suite</span>
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* In-App Payment Reminder Notification Bell */}
          <div className="relative">
            <button
              onClick={() => {
                setIsNotifOpen(!isNotifOpen);
                if (!isNotifOpen) loadNotifications();
              }}
              title="In-App Payment Reminders"
              className="relative p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadNotifications.length}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 bg-[#0e1e32] text-white flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold">Payment Reminder Alerts</div>
                    <div className="text-[10px] text-slate-300">Kyra Enterprises In-App Feed</div>
                  </div>
                  {unreadNotifications.length > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {unreadNotifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No unread payment reminder notifications
                    </div>
                  ) : (
                    unreadNotifications.map((item) => (
                      <Link
                        key={item._id}
                        href={`/invoices/${item.invoiceId}`}
                        onClick={() => setIsNotifOpen(false)}
                        className="block p-3 hover:bg-slate-50 transition-colors text-xs"
                      >
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span>{item.customerName}</span>
                          <span className="text-amber-600 font-mono">
                            {formatCurrency(item.remainingBalance)} Due
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          Invoice <span className="font-mono font-semibold">{item.invoiceNumber}</span>{" "}
                          (Paid: {formatCurrency(item.amountPaid)} of {formatCurrency(item.invoiceAmount)})
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {formatDateTime(item.createdAt)}
                        </div>
                      </Link>
                    ))
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                  <Link
                    href="/payment-reminders"
                    onClick={() => setIsNotifOpen(false)}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-600"
                  >
                    Manage All Payment Reminders &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-200">
            <button
              onClick={openProfileModal}
              title="Edit Profile"
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-50 transition-colors text-left group"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
                <User className="w-4 h-4" />
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-semibold text-slate-900 leading-tight flex items-center gap-1">
                  <span>{user.name}</span>
                  {user.role === "admin" && <Shield className="w-3 h-3 text-emerald-600 inline" />}
                </div>
                <div className="text-[11px] text-slate-500 capitalize flex items-center gap-1">
                  <span>{user.role.replace("_", " ")}</span>
                  <Edit3 className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100" />
                </div>
              </div>
            </button>

            <button
              onClick={() => setIsPasswordOpen(true)}
              title="Change Password"
              className="hidden md:flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 rounded-lg transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
              <span>Password</span>
            </button>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              title="Log out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start gap-3.5 mb-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Update Staff Profile</h3>
                <p className="text-xs text-slate-500 mt-0.5">Kyra Enterprises Identity Settings</p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="+91 73939 31555"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50"
                >
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start gap-3.5 mb-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Change Your Password</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update credentials for <strong className="text-slate-800">{user.email}</strong>
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Password *
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-3 pr-9 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password * (Min 6 chars)
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-3 pr-9 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPasswordOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{savingPassword ? "Updating..." : "Update Password"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

