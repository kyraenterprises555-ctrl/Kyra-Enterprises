import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { DataService } from "@/lib/db-store";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  let businessName = "Kayra Enterprises";
  try {
    const settings = await DataService.getSettings();
    if (settings && settings.businessName) {
      businessName = settings.businessName;
    }
  } catch {
    // Fallback to default name
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden print:h-auto print:overflow-visible print:bg-white print:block">
      {/* Sidebar */}
      <div className="no-print print:hidden shrink-0">
        <Sidebar userRole={user.role} businessName={businessName} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:block print:w-full print:p-0 print:m-0">
        <div className="no-print print:hidden">
          <Header user={user} />
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 print:p-0 print:m-0 print:overflow-visible print:block print:w-full">
          <div className="max-w-7xl mx-auto space-y-6 print:max-w-none print:m-0 print:p-0 print:space-y-0 print:w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
