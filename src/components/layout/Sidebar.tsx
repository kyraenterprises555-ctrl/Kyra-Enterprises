"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Users,
  FilePlus2,
  FileText,
  ShoppingBag,
  CreditCard,
  BarChart3,
  Settings,
  ShieldAlert,
  UserCheck,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  userRole?: string;
  businessName?: string;
}

export function Sidebar({ userRole = "admin", businessName = "Kayra Enterprises" }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
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
    },
    {
      title: "Products",
      href: "/products",
      icon: Package,
      roles: ["admin", "manager", "billing_staff"],
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
      title: "Purchases",
      href: "/purchases",
      icon: ShoppingBag,
      roles: ["admin", "manager"],
    },
    {
      title: "Payments",
      href: "/payments",
      icon: CreditCard,
      roles: ["admin", "manager", "billing_staff"],
    },
    {
      title: "Reports & Analytics",
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

  return (
    <aside className="w-64 bg-[#0e1e32] text-slate-300 flex flex-col shrink-0 min-h-screen border-r border-slate-800 selection:bg-emerald-500 selection:text-white">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800 bg-[#091422]">
        <div className="w-9 h-9 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="overflow-hidden">
          <h1 className="font-semibold text-white text-sm truncate tracking-wide">{businessName}</h1>
          <p className="text-[11px] text-emerald-400 font-medium">Billing & Inventory</p>
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          Menu
        </div>

        {navItems
          .filter((item) => item.roles.includes(userRole))
          .map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.href || (item.href !== "/invoices" && pathname.startsWith(item.href));

            if (item.highlight) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all mb-2 shadow-sm",
                    isActive
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30"
                  )}
                >
                  <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold">{item.title}</span>
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  isActive
                    ? "bg-slate-800/90 text-white border-l-2 border-emerald-400 font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
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

      {/* Role Badge */}
      <div className="p-3 border-t border-slate-800 bg-[#091422] text-xs">
        <div className="flex items-center justify-between text-slate-400">
          <span>Active Role</span>
          <span className="capitalize px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-emerald-400 border border-slate-700">
            {userRole.replace("_", " ")}
          </span>
        </div>
      </div>
    </aside>
  );
}
