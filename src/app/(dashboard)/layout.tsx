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

  // Always fetch live user details from persistent storage to guarantee the current saved admin name is displayed
  let liveUser = user;
  try {
    const dbUser = await DataService.getUserById(user.userId);
    if (dbUser) {
      liveUser = {
        userId: user.userId,
        name: dbUser.name || user.name,
        email: dbUser.email || user.email,
        role: dbUser.role || user.role,
      };
    }
  } catch {}

  return (
    <DashboardShell user={liveUser} businessName={businessName} logoUrl={logoUrl}>
      {children}
    </DashboardShell>
  );
}
