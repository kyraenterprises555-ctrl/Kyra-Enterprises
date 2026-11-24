"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User, Bell, Shield } from "lucide-react";
import { toast } from "sonner";

interface HeaderProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        toast.success("Logged out successfully");
        router.push("/login");
        router.refresh();
      }
    } catch {
      toast.error("Error logging out");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-3">
        <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-medium text-slate-500">
          GST Ready System • <strong className="text-slate-800">FY 2026-27</strong>
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* User profile dropdown info */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-slate-900 leading-tight flex items-center gap-1.5">
              {user.name}
              {user.role === "admin" && (
                <Shield className="w-3 h-3 text-emerald-600 inline" />
              )}
            </div>
            <div className="text-[11px] text-slate-500 capitalize">{user.role.replace("_", " ")}</div>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Log out"
            className="ml-2 p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
