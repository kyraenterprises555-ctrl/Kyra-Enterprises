"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface DashboardShellProps {
  user: {
    userId: string;
    name: string;
    email: string;
    role: string;
  };
  businessName: string;
  logoUrl?: string;
  children: React.ReactNode;
}

export function DashboardShell({
  user,
  businessName,
  logoUrl,
  children,
}: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden print:h-auto print:overflow-visible print:bg-white print:block">
      <Sidebar
        userRole={user.role}
        businessName={businessName}
        logoUrl={logoUrl}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:block print:w-full print:p-0 print:m-0">
        <Header
          user={user}
          businessName={businessName}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 print:p-0 print:m-0 print:overflow-visible print:block print:w-full">
          <div className="max-w-7xl mx-auto space-y-6 print:max-w-none print:m-0 print:p-0 print:space-y-0 print:w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
