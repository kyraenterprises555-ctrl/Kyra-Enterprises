# Kayra Enterprises – Billing & Inventory Management System

A commercial-grade, GST-compliant Billing and Inventory Management System designed specifically for **Kayra Enterprises**.

## System Architecture

### 1. Technology Stack
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS with custom enterprise palette (Deep Navy, Slate Gray, Emerald Green)
- **Database & ODM**: MongoDB Atlas & Mongoose with atomic transaction support and resilient offline/local store fallback
- **Authentication**: JWT authentication with Jose & BCrypt, HttpOnly security cookies, and Role-Based Access Control (RBAC)
- **GST Tax Engine**: High-precision dual-mode GST calculation (Intra-State CGST/SGST vs Inter-State IGST, HSN lookup, and Indian Rupee words conversion)
- **PDF Generation**: Vector PDF invoice generation using jsPDF & jsPDF-Autotable with downloadable files and print styles
- **Analytics & Visuals**: Recharts interactive time-series revenue graphs and top-selling product bars

---

## 2. Default Authorized Credentials

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin / Owner** | `admin@kayra.com` | `Admin@123` | Full administrative control, settings configuration, user management, audit logs, invoice cancellation. |
| **Manager** | `manager@kayra.com` | `Manager@123` | Stock movements, manual inventory adjustments, supplier purchases, product catalogue, financial reporting. |
| **Billing Staff** | `staff@kayra.com` | `Staff@123` | Point of Sale billing terminal, client registration, payment recordings, invoice downloads & printing. |

*Quick 1-click role selection is available on the login screen.*

---

## 3. Core Modules & Features

### 🏢 Business Settings
- Configurable **Kayra Enterprises** identity, official GSTIN, address, state, phone, and billing email.
- Banking & payment details (Bank name, Account number, IFSC, Branch, and UPI ID) automatically rendered on invoices.
- Configurable invoice sequence prefixes (`KE/2026-27/`) and legal terms & conditions.

### ⚡ GST Billing Terminal (`/invoices/new`)
- Step-by-step workflow: Auto-populated seller details, buyer selection (with inline quick-add), line item catalogue picker.
- Live GST calculation:
  - Intra-State transactions (Delhi to Delhi) calculate **CGST (9%) + SGST (9%)**.
  - Inter-State transactions (Delhi to other states) calculate **IGST (18%)**.
  - Never charges both simultaneously.
- Real-time stock validation prevents billing quantities greater than available stock.
- Instant invoice generation with automated stock deduction and ledger recording.

### 📦 Inventory & Stock Movement Ledger (`/inventory`)
- Real-time stock balance tracking with automated low-stock warnings.
- Complete audit ledger of all stock ins, sales deductions, supplier purchases, manual adjustments, and cancellation reversals.

### 🛍️ Product Catalog (`/products`)
- Search by product name, SKU, or barcode.
- Category filtering and stock status indicators.
- Soft-deletion safeguards preserve historical pricing and tax integrity on finalized invoices.

### 👥 Customer Management (`/customers`)
- Registered (B2B with GSTIN) vs Unregistered (Retail) customer profiles.
- Automatic State and State Code deduction from the first 2 digits of the GSTIN.
- Customer ledger tracking outstanding balances and lifetime receivables.

### 💳 Payment Collections (`/payments`)
- Multi-mode payment tracking: Cash, UPI, Bank Transfer (NEFT/RTGS), Card, and Credit.
- Supports full settlements as well as partial payments against invoices.

### 📊 Reports & Analytics (`/reports`)
- Gross Profit & Loss analysis comparing invoiced revenue against recorded purchase costs.
- GST Output Liability breakdown for tax filings.
- One-click CSV exports for product sales and customer balances.

### 🛡️ Audit Trail & Security (`/audit-logs`)
- Chronological, tamper-evident log of all sensitive operations (logins, stock adjustments, invoice cancellations, and user permission changes).

---

## 4. Running the Application

### Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
```bash
npm run build
npm run start
```
