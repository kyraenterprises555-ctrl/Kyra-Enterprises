import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/DashboardShell";
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

  let businessName = "Kyra Enterprises";
  let logoUrl = "/logo.jpeg";
  try {
    const settings = await DataService.getSettings();
    if (settings?.businessName) {
      businessName = settings.businessName;
    }
    if (settings?.logoUrl) {
      logoUrl = settings.logoUrl;
    }
  } catch {}

  return (
    <DashboardShell user={user} businessName={businessName} logoUrl={logoUrl}>
      {children}
    </DashboardShell>
  );
}
