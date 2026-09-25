# Bar Shop POS — Project Documentation

**A Point-of-Sale and Inventory Management System for Bar & Liquor Retail Operations**

---

## Table of Contents

1. Introduction
2. Objectives
3. System Architecture
4. Technology Stack
5. User Roles & Permissions
6. Core Features / Modules
7. Backend Module Map
8. Database Design
9. Installation & Setup
10. Project Background & Recent Engineering Work
11. Conclusion & Future Enhancements

---

## 1. Introduction

**Bar Shop POS** is a full-stack point-of-sale (POS) and back-office management system built for a bar / liquor retail business. It replaces manual sales and stock tracking with a role-based web application that covers the day-to-day operational needs of a bar shop: selling products at the counter, managing inventory and suppliers, tracking customer purchases and installment payments, generating invoices, and maintaining a full accounting ledger.

The system is composed of two independent applications working together:

- An **admin/POS web dashboard** used by staff (cashiers, inventory managers, accountants, and administrators) to run daily operations.
- A **backend REST API** that stores all business data in a PostgreSQL database and enforces authentication, validation, and business rules.

## 2. Objectives

The system is designed to:

- Provide a fast, simple point-of-sale screen for recording bar counter sales.
- Maintain an accurate, real-time inventory of products (brands, categories, stock levels, low-stock alerts).
- Track suppliers and supplier-related purchasing requests.
- Manage customer records and their purchase history, including down-payment and installment-based sales.
- Generate and manage sales invoices, including bulk/grouped invoices.
- Maintain a complete accounts module: receipts, vouchers, cheques, bank/cash accounts, deposits, and a general ledger.
- Enforce role-based access so each staff member only sees the functionality relevant to their job.
- Record and respond to customer contact/support requests.

## 3. System Architecture

The project is a **monorepo** containing two applications:

| Application | Path | Role |
|---|---|---|
| **POS Admin Dashboard** | `pos/` | Next.js 14 (App Router) frontend used by staff to operate the system |
| **Backend API** | `backend/` | Express + Prisma REST API backed by PostgreSQL |

```
                 ┌────────────────────────┐        JWT-authenticated       ┌───────────────────────────┐
   Staff Browser │   POS Admin Dashboard  │ ─────── REST / JSON API ─────▶ │        Backend API        │
                 │   (Next.js, React)     │ ◀────────────────────────────  │  (Express + Prisma ORM)   │
                 └────────────────────────┘                                └─────────────┬─────────────┘
                                                                                           │
                                                                                           ▼
                                                                              ┌─────────────────────────┐
                                                                              │   PostgreSQL Database   │
                                                                              └─────────────────────────┘
```

- The frontend communicates with the backend exclusively through a versioned REST API (`/api/...`) using JSON.
- Authentication is JWT-based: POS staff log in through `/api/pos/auth` and receive a bearer token used on every subsequent request.
- File uploads (product images) are handled via `multer` and served as static files from the backend's `/uploads` directory.
- The backend uses **Prisma ORM** as a type-safe data access layer over PostgreSQL, with schema-driven migrations.

## 4. Technology Stack

### Backend (`backend/`)

| Category | Technology |
|---|---|
| Runtime | Node.js (≥ 18.17.0) |
| Language | TypeScript |
| Web framework | Express 4 |
| ORM / Database | Prisma 5 + PostgreSQL |
| Authentication | JSON Web Tokens (`jsonwebtoken`), password hashing with `bcryptjs` |
| Validation | Zod schemas + `class-validator` |
| File uploads | Multer |
| Dev tooling | `tsx` (dev server with hot reload), TypeScript compiler for production builds |

### Frontend (`pos/`)

| Category | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| UI library | React 18 |
| Language | TypeScript |
| Data fetching / caching | TanStack Query (React Query) |
| Styling | Global CSS (custom design system, light/dark theme support) |

## 5. User Roles & Permissions

Access to the dashboard is controlled by four staff roles, each restricted to the sections of the system relevant to their job:

| Role | Description | Default Landing Page | Primary Access |
|---|---|---|---|
| **Administrator (ADMIN)** | Full system access | Sell Products screen | All modules, including the main analytics dashboard |
| **Cashier (CASHIER)** | Front-counter sales staff | Sell Products screen | Bar counter sell screen and recent sales only |
| **Inventory Manager (INVENTORY_MANAGER)** | Stock and supplier management | Product Setup | Product setup, beverage suppliers, supplier/purchasing requests |
| **Accountant (ACCOUNTANT)** | Financial operations | Accounts | Accounts, invoice management |

Route-level access is enforced in the frontend (`pos/app/lib/roles.ts`) and re-validated by the backend on every authenticated request, so a role restriction cannot be bypassed by navigating directly to a URL.

## 6. Core Features / Modules

The dashboard is organized around the following functional areas (see `pos/app/dashboard/`):

- **Sell Products (Bar Counter)** — the primary point-of-sale screen for recording counter sales, viewing recent sales, and (for authorized roles) jumping into product setup.
- **Dashboard / Analytics** — a management overview showing revenue trends, inventory health, recent activity, and outstanding balances.
- **Staff & Roles** — administration of POS staff accounts and their assigned roles.
- **Customer Management** — customer records, purchase history, down-payment/installment purchases, and installment settlement.
- **Beverage Suppliers** — supplier directory used across the inventory catalog.
- **Supplier & Purchasing Requests** — tracking of purchasing/restocking requests and incoming customer/supplier contact requests.
- **Invoice Management** — generation and management of sales invoices (including bulk/grouped invoices), invoice payment accounts, and invoice terms & conditions.
- **Accounts** — the full accounting suite:
  - **Receipts** — customer payment receipts, including cheque tracking (pending / cleared / bounced).
  - **Vouchers** — outgoing payment vouchers (bills, salaries, loan payments, refunds, account transfers, etc.).
  - **General Ledger** — a consolidated transaction ledger across all accounts.
  - **Chart of Accounts** — bank and cash account management.
- **Reports** — printable/exportable business reports (PDF and Excel export supported).
- **Contact Requests** — customer inquiries submitted through the public-facing contact channel.

## 7. Backend Module Map

The backend is organized into focused Express modules, each owning its own routes, controllers, services, and DTOs (`backend/src/modules/`):

| Module | Mounted at | Responsibility |
|---|---|---|
| `auth` | `/api/auth` | General user authentication (registration, login, refresh, session) |
| `pos-auth` | `/api/pos/auth` | POS staff login and staff account management |
| `pos-user-management` | `/api/pos/user-management` | Customer records, purchases, installments, invoice accounts, and invoice terms |
| `inventory-management` | `/api/pos/inventory-management` | Suppliers, product brands, product categories, and the product catalog (stock, pricing, images, sales, low-stock health) |
| `accounts` | `/api/pos/accounts` | Chart of accounts, receipts, vouchers, deposits, and the general ledger |
| `contact-requests` | `/api/contact-requests` (public) and `/api/pos/contact-requests` (staff) | Customer contact/support request intake and management |
| `bikes` | `/api/bikes` (public) | Public, unauthenticated catalog listing endpoint (kept for an external storefront integration) |

All staff-facing modules require a valid JWT bearer token issued by `pos-auth`, and enforce role-based authorization at the route level.

## 8. Database Design

The database schema (managed with Prisma, `backend/prisma/schema.prisma`) is organized around the following domains:

**Identity & Staff**
- `User` — general application users.
- `PosAdmin` — POS staff accounts (Admin, Cashier, Inventory Manager, Accountant).

**Inventory**
- `Supplier` — beverage suppliers.
- `InventoryBrand`, `InventoryCategory` — product classification.
- `InventoryProduct` — the product catalog (stock quantity, pricing, low-stock threshold).
- `InventoryProductExpense`, `InventoryProductImage` — supporting product data.
- `PosCounterSale` — direct bar-counter sale records.

**Customers & Purchases**
- `PosCustomer` — customer directory.
- `PosCustomerPurchase` — purchase records, supporting direct payment or down-payment with an installment plan.
- `PosInstallment`, `PosInstallmentPayment` — installment schedules and payment history for down-payment purchases.

**Invoicing**
- `PosInvoiceTerm` — configurable invoice terms & conditions text.
- `InvoicePayment` — payments linked to generated invoices.

**Accounts / Finance**
- `Account`, `AccountRelationship` — chart of accounts (bank/cash accounts).
- `AccountReceipt` — incoming customer payments, including cheque status tracking.
- `AccountVoucher` — outgoing payment vouchers.
- `AccountTransaction` — the general ledger transaction log.
- `AccountDeposit`, `AccountDepositItem` — bank deposit records.

**Support**
- `ContactRequest` — inbound customer contact/support submissions.

Referential integrity between purchases, invoices, installments, and the accounting ledger is enforced at the database level through Prisma-managed foreign keys and indexes.

## 9. Installation & Setup

### Prerequisites
- Node.js 18.17.0 or newer (Node 20 LTS recommended)
- PostgreSQL installed locally

### Database Setup
```bash
createdb bar_shop
createuser bar_shop_user --pwprompt
psql -d postgres -c 'ALTER DATABASE bar_shop OWNER TO bar_shop_user;'
```

Create `backend/.env`:
```env
DATABASE_URL="postgresql://bar_shop_user:YOUR_PASSWORD@localhost:5432/bar_shop?schema=public"
PORT=5010
JWT_SECRET="replace-with-a-long-random-secret"
CORS_ORIGIN="http://localhost:3010"
```

### Backend
```bash
cd backend
npm install
npm run db:generate
npm run db:push
npx prisma db seed
npm run dev
```

### Frontend
```bash
cd pos
npm install
printf 'NEXT_PUBLIC_API_URL=http://localhost:5010\n' > .env.local
npm run dev -- --port 3010
```

The application is then available at `http://localhost:3010`, with a seeded default administrator login for initial access (see `backend/prisma/seed.ts`; the password should be changed before any real-world use).

## 10. Project Background & Recent Engineering Work

The codebase originated from an existing motorcycle-dealership POS system and was repurposed for a bar/liquor retail business. As part of that transition, a significant engineering effort was carried out to fully remove all motorcycle/vehicle-dealership-specific functionality that had been left over from the original template, including:

- Vehicle catalog management (bike brands, models, and vehicle records).
- Vehicle sales via leasing companies and installment financing tied specifically to vehicle purchases.
- Customer "dream bike" wishlists and vehicle pre-order management.
- Vehicle-specific accounting voucher categories.

The relevant database schema, backend modules, and frontend screens were restructured accordingly, and the shared supplier and inventory infrastructure (which had been built on top of the vehicle-management module) was cleanly separated into a dedicated inventory management module. The result is a data model and codebase focused entirely on liquor/beverage retail operations, while the generic, reusable functionality that was already business-agnostic — such as down-payment installment plans, invoicing, and the accounting ledger — was preserved.

## 11. Conclusion & Future Enhancements

Bar Shop POS provides a complete, role-based operational platform for running a bar or liquor retail outlet — from counter sales and inventory control to customer credit management and full financial reconciliation. Potential future enhancements include:

- Expanded analytics and business intelligence reporting.
- Multi-branch / multi-location support.
- A dedicated mobile or tablet-optimized point-of-sale interface.
- Integration with external payment gateways and accounting export formats.

---

*This document describes the system as implemented at the time of writing and should be updated as the project evolves.*
