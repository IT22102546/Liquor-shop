# Architecture — where things live

## Backend (`backend/src`)

- `app.ts` mounts `recordPosActivity` on `/api/pos` **before** all POS routers, then each router.
- Responses are `sendSuccess` / `sendCreated`, which give `{ success, data }`.
- Errors are `AppError` (`common/utils/errors.ts`). `validate(zodSchema, input)` throws a 422 with `errors: { field: [msg] }`.
- Auth is in `common/middleware/pos-auth.middleware.ts`:
  - `authenticatePosAdmin` sets `req.user = { id, email, role }` from the JWT.
  - `authorizePosRoles("ADMIN", …)` limits a route to those roles.
- Prisma client is generated to `src/generated/prisma`. Import `prisma` from `database/prisma.client`.

| API prefix | Module | Main file(s) |
|---|---|---|
| `/api/pos/auth` | pos-auth | login, `/me`, staff CRUD (with `branchId`) |
| `/api/pos/inventory-management` | inventory-management | brands, categories, suppliers, products, restock, empties return, bulk price, images |
| `/api/pos/user-management` | pos-user-management | loyalty members, **checkout**, sales list, dashboard, member wallet & points history `/:id/history` |
| `/api/pos/settings` | settings | shop settings, `assertHardLiquorLimit` |
| `/api/pos/shifts` | book (`book.routes.ts`) | current / open / report / count / close (shift.service.ts), `drawer-open` (drawer.service.ts) |
| `/api/pos/cash-book` | book | vouchers & receipts, bank, void (cash-book.service.ts) |
| `/api/pos/reports/period` | book | period-report.service.ts |
| `/api/pos/purchase-orders` | purchase-orders | admin only; email via `common/utils/mailer.ts`; receive creates a GRN |
| `/api/pos/returns` | returns | exchange, refund, damage, clear, bills lookup, overview |
| `/api/pos/gift-vouchers` | gift-vouchers | list (ADMIN, ACCOUNTANT), `check/:code` (ADMIN, CASHIER), create / `:id/cancel` / `:id/print` (ADMIN) |
| `/api/pos/branches` | branches | list, current, switch, stock-by-branch, create/update |
| `/api/pos/grns`, `/api/pos/gtns` | goods | grn.service.ts, gtn.service.ts, goods.routes.ts |
| `/api/pos/activity-logs` | activity-log | read-only list (admin) |

### Key helpers (use them, don't re-invent)

- **`modules/branches/branch-context.ts`**
  - `requestBranch(req)` gives `{ id, name, code, address, phone, isMain, fixed }`, cached per request.
  - `requestBranchScope(req)` gives a branch id, or `null` for `?branch=all`. Anyone can pass `?branchId=`, unless they're fixed to a branch.
  - `branchOfUser(userId)` and `mainBranch()`, which creates Main if it's missing.
- **`modules/branches/branch-stock.ts`**
  - `changeStock(db, branchId, productId, { quantity?, damaged?, empties? })` is the only way stock moves. It keeps the product totals in sync and throws "Only N … in stock at <branch>".
  - `forBranch(branchId, products)` gives products as a branch sees them: `quantity` / `damagedQuantity` / `emptyBottlesOnHand` become that branch's counts, with `totalQuantity` etc. added.
  - `countsAt()` and `branchCounts()` read one or many products' counts at a branch.
- **`modules/book/stock-movements.ts`**
  - `findOpenShift(db, branchId)`.
  - `recordMovements(db, rows, { branchId, shiftId? })`. Leave `shiftId` out to use the branch's open shift.
  - Kinds: `STOCK` | `EMPTIES` | `DAMAGED`.
  - Types: OPENING, RECEIVED, SOLD, ADJUSTED, COLLECTED, RETURNED, CUSTOMER_RETURN, EXCHANGED, DAMAGED, RESTORED, IN, CLEARED, TRANSFER_OUT, TRANSFER_IN.
- **`modules/book/cash-book.service.ts`** — `drawerCash(shiftId)` is the cash that should be in the drawer now. Use it to refuse paying out more than the drawer holds.
- **`modules/book/shift.service.ts`**
  - `summarizeShift(shiftId)` builds the whole Day End report object.
  - `getShiftReport` adds the blind view.
  - `closeShift` freezes the report and writes the automatic receipts.
- **`modules/inventory-management/inventory-management.service.ts`** — `restockProduct(id, {quantity, purchasePrice(batch total), taxPaid?}, actorId, branchId, reference, db?)` does the weighted-average cost, changes stock and records the movement. GRN uses it inside its transaction.
- **`modules/activity-log/activity-describe.ts`**
  - `describePosChange(method, path, body, response, before)` gives `{ action, category, summary, entityType, entityId, details }`.
  - `activity-log.middleware.ts` has `snapshotBefore()` for before → after, and records the branch (null for company-wide paths).
- **Document numbers** use a `pg_advisory_xact_lock(<unique int>)`, then the last number + 1:
  - RT- 740301 and 740302, shifts 740303, GRN- 740311, GTN- 740312, NS- (no-sale drawer opens) 740321, GV- (gift vouchers) 740331
  - bill numbers are `POS-<base36 time>-<rand>`
  - SH-, VCH-, RCP- and PO- are count-based
  - Use a new lock number for a new sequence.

### Data model highlights (`prisma/schema.prisma`)

- **`InventoryProduct`** — `quantity`, `damagedQuantity` and `emptyBottlesOnHand` are **company totals** (the sum over `BranchStock`). The cost per unit is `purchasePrice + taxPaid + additionalExpenses`, company-wide. `soldQuantity` and `lastSoldAt` also live here.
- **`BranchStock`** — one row per (branch, product): `quantity`, `damagedQuantity`, `emptyBottlesOnHand`.
- **`PosCounterSale`** — the bill: `totalAmount`, the paid-parts columns, `walletUsed`/`walletCredit`, discount, `pointsEarned` / `pointsRate` / `pointsRedeemed` / `pointsValue`, empties, `shiftId`, `branchId`, `customerId`.
- **`PosCustomerPurchase`** — the bill lines, linked by `invoiceGroupCode`: `finalSellingPrice` is the line after empties and its share of the discount. `billDiscount` and `emptyDeduction` are also stored per line.
- **`PosCustomer`** — a loyalty member: `loyaltyPoints`, `walletBalance`, `totalSpent`, `visits`. The walk-in customer has mobile `WALK-IN`.
- **`PosWalletTransaction`** — CREDIT (change kept), REFUND, or DEBIT (spent). Stores `balanceAfter`.
- **`PosShift`** — float, blind count and denominations, expected cash, differences, card slip, float left, cash banked, `report` JSON (frozen at close), `branchId`.
- **`PosCashEntry`** — direction, category, source (DRAWER/BANK/OWNER, SAFE/CARD while waiting), `bankStatus`, voiding, `automatic`, `branchId`.
- **`InventoryMovement`** — the stock day book.
- **Returns and goods:** `PosReturn` (RT-), `PurchaseOrder` and its items and emails, `Grn`/`GrnItem`, `Gtn`/`GtnItem`, `Branch`.
- **`ActivityLog`** (with `branchId`) and **`PosSetting`**.
- **Legacy tables** from the old bike and invoice system are untouched. Don't drop them.

## Frontend (`pos/app`)

- **`dashboard/<page>/page.tsx`**, one folder per screen. The common page pattern:
  - `const { token, admin, logout } = useAdmin()`.
  - A local `api<T>(path, init)` that adds `Authorization`, logs out on 401, and throws the first `errors` message.
  - `load()` in a `useCallback`, called from a `useEffect`.
  - Classes `bm-page`, `bm-page-header`, `page-title-row`, `page-title-icon`, `page-title`, `page-subtitle`.
  - Cards are `lx-card lx-log-card`, the toolbar is `po-toolbar`, tabs are `lx-seg-plain` with `.active` buttons.
  - Tables are `data-table-wrap` > `data-table`, with an empty row `bm-table-empty`. Paging is `TablePagination`.
  - Modals are `bm-modal-backdrop` > `bm-modal po-modal`, head `po-modal-head` + `po-close`, form grid `lx-member-grid` (labels; `.wide` spans both columns), actions `bm-modal-actions`.
  - Errors are `bm-alert bm-alert-error`. Toasts are `lx-toasts` > `lx-toast ok`.
  - KPI tiles are `rt-kpis` > `rt-kpi` (`.warn`). Totals strips are `lx-book-totals`.
  - Amounts use `lx-amount-in` / `lx-amount-out`, muted text `td-muted`.
  - Report preview is `lx-report-modal` + `iframe.lx-report-frame` with `srcDoc`.
- **Hooks:**
  - `lib/useShopSettings.ts` gives settings (react-query).
  - `lib/useBranch.ts` gives `{ branch, state }` and `switchBranch()`, which reloads the page.
  - `lib/useBarcodeScanner.ts` gives `useBarcodeScanner(onScan, enabled)`, `normalizeBarcode()` and `looksLikeBarcode()`.
- **Prints:**
  - `lib/print.ts`: `printThermal` (80mm, measured height), `printA4`, `THERMAL_BASE_CSS`, `escapeHtml`.
  - `lib/receipt.ts` (bill), `lib/bookPrint.ts` (Z slip + the `ShiftReport` type + vouchers), `lib/dayEndReport.ts` (A4 Day End + `REPORT_CSS`).
  - `lib/periodReport.ts`, `lib/purchaseOrderPrint.ts`, `lib/returnSlip.ts`, `lib/goodsPrint.ts` (GRN/GTN A4).
  - `lib/shop.ts` holds `SHOP` (name, tagline, fallback address).
- **Layout:**
  - `components/Sidebar.tsx`: the nav, filtered by `canAccessPath`.
  - `components/Topbar.tsx`: breadcrumbs map, clock, branch selector, low-stock bell.
  - `lib/roles.ts`: `ROLE_PATHS`, `ROLE_HOME`, `ROLE_LABELS`.
  - `lib/icons.tsx`: sidebar icons are `() => JSX` at 18px; line icons take `{ size }`.
- **Styles:** `app/globals.css` (base) + `app/lounge.css` (the design).
  - Theme tokens: `--panel`, `--panel-2`, `--panel-border`, `--text`, `--text-soft`, `--text-xsoft`, `--accent`, `--accent-bg`, `--success(-bg)`, `--warning(-bg)`, `--danger(-bg)`, `--soft-gold`, `--soft-gold-border`, `--soft-gold-text`, `--c1`…`--c6`.
  - Always use tokens so light and dark both work.
  - Watch for wide rules like `.pos-cash-area input` / `label`, which hit nested checkboxes. Scope fixes with a more specific selector.
- **Counter:** `dashboard/inventory/page.tsx`, a large file with the till state (cart, member, discount, points, wallet, split). Member search is `components/customers/MemberPicker.tsx`.
- **Product Setup:** `components/products/*` (ProductStockTable, ProductFormModal, AddLiquorModal, BulkPriceModal).
- **Cash book pages:** `components/book/CashBookPage.tsx` + `CashEntryModal.tsx`.
