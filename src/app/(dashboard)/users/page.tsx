"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Shield,
  ShieldCheck,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  RefreshCw,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

export default function UsersManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & User State
  const [currentSessionUser, setCurrentSessionUser] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState<any>(null);
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [confirmStaffPassword, setConfirmStaffPassword] = useState("");
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Delete Staff Modal
  const [isDeleteStaffOpen, setIsDeleteStaffOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<any>(null);
  const [deletingStaff, setDeletingStaff] = useState(false);

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "billing_staff",
    phone: "",
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const [uRes, meRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/auth/me"),
      ]);
      const data = await uRes.json();
      const meData = await meRes.json();

      if (data.success) setUsers(data.users);
      if (meData.success && meData.user) setCurrentSessionUser(meData.user);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");

      toast.success("User created successfully");
      setIsOpen(false);
      resetForm();
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creating user";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/users/${selectedUser._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user");

      toast.success("User updated successfully");
      setIsEditOpen(false);
      setSelectedUser(null);
      resetForm();
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error updating user";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTargetUser) return;

    if (newStaffPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    if (newStaffPassword !== confirmStaffPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setUpdatingPassword(true);
      const res = await fetch(`/api/users/${passwordTargetUser._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newStaffPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");

      toast.success(`Password for "${passwordTargetUser.name}" updated successfully!`);
      setIsPasswordModalOpen(false);
      setPasswordTargetUser(null);
      setNewStaffPassword("");
      setConfirmStaffPassword("");
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error changing password";
      toast.error(msg);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleDeleteStaffConfirm = async () => {
    if (!staffToDelete) return;

    if (currentSessionUser && currentSessionUser.userId === staffToDelete._id) {
      toast.error("You cannot delete your own active admin account");
      return;
    }

    try {
      setDeletingStaff(true);
      const res = await fetch(`/api/users/${staffToDelete._id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");

      toast.success(data.message || `Staff account "${staffToDelete.name}" deleted successfully`);
      setIsDeleteStaffOpen(false);
      setStaffToDelete(null);
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error deleting user";
      toast.error(msg);
    } finally {
      setDeletingStaff(false);
    }
  };

  const openEdit = (u: any) => {
    setSelectedUser(u);
    setFormData({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      phone: u.phone || "",
      isActive: u.isActive,
    });
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "billing_staff",
      phone: "",
      isActive: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <span>Staff & Access Management (RBAC)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Administer roles, user accounts, and system access levels
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              resetForm();
              setIsOpen(true);
            }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Staff Account</span>
          </button>
        </div>
      </div>

      {/* Roles Legend Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Admin / Owner</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Complete unrestricted access to all modules, financial settings, user permissions, and audit logs.
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
            <Shield className="w-4 h-4 text-blue-600" />
            <span>Manager</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Manage product catalog, inventory stock movements, purchases, customers, and view financial reports.
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
            <Shield className="w-4 h-4 text-purple-600" />
            <span>Billing Staff</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Generate GST tax invoices, register buyers, record incoming payments, and print/download bills.
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Registered Staff Accounts</h2>
          <button
            onClick={() => fetchUsers()}
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
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4 text-center">Assigned Role</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading staff directory...</span>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{u.name}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{u.email}</td>
                    <td className="py-3 px-4 text-slate-600">{u.phone || "-"}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          u.role === "admin"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : u.role === "manager"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}
                      >
                        {u.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          u.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                        <span>{u.isActive ? "Active" : "Disabled"}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {u.lastLogin ? formatDateTime(u.lastLogin) : "Never"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setPasswordTargetUser(u);
                            setNewStaffPassword("");
                            setConfirmStaffPassword("");
                            setIsPasswordModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-emerald-700 hover:bg-emerald-50 rounded border border-emerald-200 text-xs font-medium transition-colors"
                          title="Change Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Password</span>
                        </button>
                        <button
                          onClick={() => openEdit(u)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded border border-slate-200 text-xs font-medium transition-colors"
                          title="Edit User Profile & Role"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          onClick={() => {
                            if (currentSessionUser && (currentSessionUser.userId === u._id || currentSessionUser.email === u.email)) {
                              toast.error("You cannot delete your own active admin account");
                              return;
                            }
                            setStaffToDelete(u);
                            setIsDeleteStaffOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 text-xs font-medium transition-colors"
                          title="Delete Staff Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Delete</span>
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

      {/* Add / Edit User Modal */}
      {(isOpen || isEditOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              {isOpen ? "Create Staff Account" : "Edit User Profile"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Configure credentials and role permissions
            </p>

            <form onSubmit={isOpen ? handleCreateSubmit : handleEditSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  disabled={isEditOpen}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@kyra.com"
                  className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none ${
                    isEditOpen
                      ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                      : "bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500"
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isOpen ? "Password *" : "Reset Password (Leave blank to keep current)"}
                </label>
                <input
                  type="password"
                  required={isOpen}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  System Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  <option value="admin">Admin / Business Owner (Full Access)</option>
                  <option value="manager">Manager (Stock, Products, Purchases)</option>
                  <option value="billing_staff">Billing Staff (Point of Sale & Invoices)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {isEditOpen && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300"
                  />
                  <label htmlFor="isActive" className="text-xs font-medium text-slate-700">
                    Account Active (Uncheck to suspend login)
                  </label>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-2.5">
                {isEditOpen && selectedUser ? (
                  <button
                    type="button"
                    onClick={() => {
                      const u = selectedUser;
                      if (currentSessionUser && (currentSessionUser.userId === u._id || currentSessionUser.email === u.email)) {
                        toast.error("You cannot delete your own active admin account");
                        return;
                      }
                      setIsEditOpen(false);
                      setStaffToDelete(u);
                      setIsDeleteStaffOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-colors mr-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Account</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setIsEditOpen(false);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : isOpen ? "Create User" : "Update User"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Change Staff Password Modal */}
      {isPasswordModalOpen && passwordTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Change Staff Password</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update login password for <strong className="text-slate-800">{passwordTargetUser.name}</strong> ({passwordTargetUser.email})
                </p>
              </div>
            </div>

            <form onSubmit={handleAdminResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password * (Minimum 6 characters)
                </label>
                <div className="relative">
                  <input
                    type={showStaffPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={newStaffPassword}
                    onChange={(e) => setNewStaffPassword(e.target.value)}
                    placeholder="Enter new staff password"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-3 pr-9 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPassword(!showStaffPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showStaffPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
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
                  value={confirmStaffPassword}
                  onChange={(e) => setConfirmStaffPassword(e.target.value)}
                  placeholder="Re-enter new staff password"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsPasswordModalOpen(false);
                    setPasswordTargetUser(null);
                    setNewStaffPassword("");
                    setConfirmStaffPassword("");
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50 shadow-sm"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{updatingPassword ? "Updating..." : "Update Staff Password"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Staff Confirmation Modal */}
      {isDeleteStaffOpen && staffToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Staff Account</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Revoke system credentials and user permissions
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-4 space-y-1.5 text-xs">
              <div className="font-bold text-slate-900 text-sm">{staffToDelete.name}</div>
              <div className="text-slate-500 font-mono text-[11px]">{staffToDelete.email}</div>
              <div className="pt-1 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-800">
                  Role: {staffToDelete.role?.replace("_", " ")}
                </span>
                <span className="text-[11px] text-slate-500">
                  {staffToDelete.phone || "No phone registered"}
                </span>
              </div>
              <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5 mt-2.5 leading-relaxed">
                <strong>Warning:</strong> Deleting this staff account will permanently remove their access to Kyra Enterprises. Historical invoices and audit records created by this user will remain preserved with their name for legal compliance.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteStaffOpen(false);
                  setStaffToDelete(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteStaffConfirm}
                disabled={deletingStaff}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingStaff ? "Deleting..." : "Yes, Delete Account"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
