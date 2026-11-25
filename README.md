# Kyra Enterprises â€” Enterprise Billing, Inventory & Payment Management System

A production-ready, GST-compliant Enterprise Billing, Inventory, Invoice, and Automatic Payment Reminder System built for **Kyra Enterprises**.

---

## 1. Technology Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript (Strict Mode)
- **UI & Styling**: Tailwind CSS, Radix UI / `shadcn/ui` primitives, Lucide React, Sonner notifications (Deep Navy `#0e1e32`, Emerald `#059669`, Slate Gray palette)
- **Database & ODM**: MongoDB Atlas & Mongoose 8 (14 collections, ACID transactions via `session.withTransaction`, compound idempotency indexes, and resilient local store synchronization)
- **Validation & Forms**: Zod & React Hook Form
- **Bulk Import Engine**: ExcelJS & SheetJS (`xlsx`) supporting `.xlsx`, `.xls`, and `.csv` uploads with custom column mapping
- **PDF & QR Generation**: `jsPDF`, `jspdf-autotable`, and `qrcode` for printable A4 GST Tax Invoices and financial reports
- **Analytics**: Recharts interactive visualizations
- **Authentication & Security**: `jose` HS256 HttpOnly JWT sessions, `bcryptjs` password hashing, Edge Middleware RBAC, and server-side `AuditLog` tracking
- **Scheduled Background Jobs**: Vercel Cron (`vercel.json`) + Node Instrumentation (`src/instrumentation.ts`) + `CRON_SECRET`-protected `/api/cron/payment-reminders` worker

---

## 2. Authorized Staff Roles & Default Credentials

| Role | Email | Password | Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin / Owner** | `admin@kyra.com` | `Admin@123` | Full control: Business Settings, User Management, Audit Logs, Soft Invoice Deletion, Reminder Provider Config |
| **Manager** | `manager@kyra.com` | `Manager@123` | Products, Bulk Upload, Inventory Adjustments, Purchases, Invoice Amendments, Reports |
| **Billing Staff** | `staff@kyra.com` | `Staff@123` | Create GST Invoices, Customer Registration, Payment Collections, Invoice PDF & Print |

---

## 3. Core Modules

1. **Executive Dashboard (`/dashboard`)**: 13 real-time KPIs + 5 Recharts visualizations (Monthly Revenue, Billed vs Collected, Top Selling Products, Category Stock Valuation, Pending Payments Breakdown).
2. **Product Catalog (`/products`)**: Full CRUD, HSN & GST slab config, pagination, active/inactive switches, and soft-deletion safeguards for invoiced items.
3. **Bulk Product Upload (`/products/bulk-upload`)**: 7-step Excel/CSV workflow â€” sample template downloads, drag-and-drop upload, custom header column mapper, inline preview editing, validation, duplicate SKU strategies (`skip`, `update`, `new_only`) with stock protection, and downloadable error CSV reports.
4. **Inventory Management (`/inventory`)**: Stock In, Stock Out, Manual Adjustments, Low Stock Alerts, Stock Movement History, and Product-Wise Stock Reports.
5. **Customer Management & Ledger (`/customers` & `/customers/[id]`)**: GSTIN state auto-detection, per-customer reminder toggles, and chronological **Customer Payment Ledger** tracking every partial payment down to â‚¹0.
6. **GST Billing & Invoice Management (`/invoices/new`, `/invoices`, `/invoices/[id]`, `/invoices/[id]/edit`)**: Dynamic Seller snapshot from Business Settings, Intra-State (`CGST + SGST`) vs Inter-State (`IGST`), controlled **Invoice Amendments** (`InvoiceRevision` history + stock delta reconciliation), **Soft Deletion** with audit snapshots, and printable A4 **TAX INVOICE** PDFs with UPI QR codes.
7. **Payments & Automatic Payment Reminders (`/payments` & `/payment-reminders`)**: Multi-mode partial & full payments (`Cash`, `UPI`, `Bank Transfer`, `Card`, `Credit`, `Other`) with idempotency keys, plus recurring 3-day or 4-day (default 4-day) reminders across In-App, Email (SMTP), WhatsApp Cloud API, and SMS.
8. **Reports & Analytics (`/reports`)**: All 12 reports (Daily, Monthly, Yearly, GST/HSN, Product-wise, Customer-wise, Stock, Low Stock, Outstanding, Overdue, Payment Collections, Profit & Loss) with date filtering and PDF/CSV exports.

---

## 4. Environment Configuration (`.env.local`)

```env
MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/kyra_enterprises?retryWrites=true&w=majority"
JWT_SECRET="<strong-random-secret>"
CRON_SECRET="<strong-cron-secret>"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 5. Development & Production Commands

```bash
# Start development server
npm run dev

# Type-check entire codebase
npm run typecheck

# Build & start production server
npm run build
npm run start
```

