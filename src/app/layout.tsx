import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Kyra Enterprises | Enterprise Billing, Inventory & Payment Management",
    template: "%s | Kyra Enterprises",
  },
  applicationName: "Kyra Enterprises",
  description:
    "Enterprise-grade GST Billing, Inventory, Invoice & Automatic Payment Reminder System for Kyra Enterprises.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
