"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FileSpreadsheet,
  Boxes,
  Users,
  FilePlus2,
  FileText,
  CreditCard,
  BellRing,
  ShoppingBag,
  BarChart3,
  Settings,
  UserCheck,
  ShieldAlert,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  userRole?: string;
  businessName?: string;
  logoUrl?: string;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  userRole = "admin",
  businessName = "Kyra Enterprises",
  logoUrl = "/logo.jpeg",
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();

  // Exact 13-module enterprise navigation order + Security Audit Logs
  const navItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      roles: ["admin", "manager", "billing_staff"],
    },
    {
      title: "Products",
      href: "/products",
      icon: Package,
      roles: ["admin", "manager", "billing_staff"],
      exactOrSub: (p: string) => p === "/products",
    },
    {
      title: "Bulk Product Upload",
      href: "/products/bulk-upload",
      icon: FileSpreadsheet,
      roles: ["admin", "manager"],
    },
    {
      title: "Inventory",
      href: "/inventory",
      icon: Boxes,
      roles: ["admin", "manager"],
    },
    {
      title: "Customers",
      href: "/customers",
      icon: Users,
      roles: ["admin", "manager", "billing_staff"],
    },
    {
      title: "Create Invoice",
      href: "/invoices/new",
      icon: FilePlus2,
      roles: ["admin", "manager", "billing_staff"],
      highlight: true,
    },
    {
      title: "All Invoices",
      href: "/invoices",
      icon: FileText,
      roles: ["admin", "manager", "billing_staff"],
      exactOrSub: (p: string) => p === "/invoices" || (p.startsWith("/invoices/") && p !== "/invoices/new"),
    },
    {
      title: "Payments",
      href: "/payments",
      icon: CreditCard,
      roles: ["admin", "manager", "billing_staff"],
    },
    {
      title: "Payment Reminders",
      href: "/payment-reminders",
      icon: BellRing,
      roles: ["admin", "manager", "billing_staff"],
    },
    {
      title: "Purchases",
      href: "/purchases",
      icon: ShoppingBag,
      roles: ["admin", "manager"],
    },
    {
      title: "Reports",
      href: "/reports",
      icon: BarChart3,
      roles: ["admin", "manager"],
    },
    {
      title: "Business Settings",
      href: "/settings",
      icon: Settings,
      roles: ["admin"],
    },
    {
      title: "User Management",
      href: "/users",
      icon: UserCheck,
      roles: ["admin"],
    },
    {
      title: "Audit Logs",
      href: "/audit-logs",
      icon: ShieldAlert,
      roles: ["admin"],
    },
  ];

  const renderSidebarBody = () => (
    <aside className="w-64 bg-[#0e1e32] text-slate-300 flex flex-col shrink-0 h-full min-h-screen border-r border-slate-800 selection:bg-emerald-500 selection:text-white">
      <div className="h-16 flex items-center justify-between gap-3 px-5 border-b border-slate-800 bg-[#091422]">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-800 text-white flex items-center justify-center font-bold text-sm shadow-xs border border-slate-700 shrink-0">
            <img
              src={logoUrl || "/logo.jpeg"}
              alt={businessName}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </div>
          <div className="overflow-hidden">
            <h1 className="font-bold text-white text-sm truncate tracking-wide">
              {businessName || "Kyra Enterprises"}
            </h1>
            <p className="text-[11px] text-emerald-400 font-medium">Enterprise ERP</p>
          </div>
        </div>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          Workspace Navigation
        </div>

        {navItems
          .filter((item) => item.roles.includes(userRole))
          .map((item) => {
            const Icon = item.icon;
            const isActive = item.exactOrSub
              ? item.exactOrSub(pathname)
              : item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === item.href || pathname.startsWith(item.href + "/");

            if (item.highlight) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all my-1.5 shadow-xs",
                    isActive
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30"
                  )}
                >
                  <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-emerald-400")} />
                  <span>{item.title}</span>
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  isActive
                    ? "bg-slate-800/90 text-white border-l-2 border-emerald-400 font-semibold"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0",
                    isActive ? "text-emerald-400" : "text-slate-400"
                  )}
                />
                <span className="truncate">{item.title}</span>
              </Link>
            );
          })}
      </div>

      <div className="p-3 border-t border-slate-800 bg-[#091422] text-xs">
        <div className="flex items-center justify-between text-slate-400">
          <span>Access Level</span>
          <span className="capitalize px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-emerald-400 border border-slate-700">
            {userRole.replace("_", " ")}
          </span>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:block no-print print:hidden shrink-0">{renderSidebarBody()}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print print:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full">{renderSidebarBody()}</div>
        </div>
      )}
    </>
  );
}
