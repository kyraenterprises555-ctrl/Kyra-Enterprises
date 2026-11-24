import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import connectToDatabase from "@/lib/mongodb";
import BusinessSettings from "@/models/BusinessSettings";

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
    await connectToDatabase();
    const settings = await BusinessSettings.findOne({}).lean();
    if (settings && typeof settings === "object" && "businessName" in settings) {
      businessName = (settings as { businessName: string }).businessName || businessName;
    }
  } catch {
    // Fallback to default name if db is loading
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar userRole={user.role} businessName={businessName} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
