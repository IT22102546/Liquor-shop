---
name: bar-shop-pos
description: Build, change, test or explain the Bar Shop POS — a Sri Lankan liquor shop point-of-sale (Next.js "pos" app + Express/Prisma/PostgreSQL "backend") with multi-branch stock, counter sales, split payments, loyalty points and wallets, returns & damages, purchase orders, GRN, GTN, Day End book keeping and period reports. Use for any work in the "bar shop" project, or when asked to add a POS feature, fix a POS bug, or explain how the shop's stock and money are recorded.
---

# Bar Shop POS

A liquor shop POS for Sri Lanka (LKR, "Rs."). Two apps in `bar shop/`:

- `backend/` — Express + Prisma + PostgreSQL. API under `/api/pos/*`. Runs on **:5010** (`npx tsx src/index.ts`).
- `pos/` — Next.js app router UI (`pos/app/…`). Runs on **:3001** (`next dev -p 3001`).

Read the reference files when the task touches them:

| File | Read it when |
|---|---|
| [reference/features.md](reference/features.md) | You need to know what exists (every screen, flow and rule) |
| [reference/architecture.md](reference/architecture.md) | You change code — where things live, key helpers, API routes |
| [reference/accounting.md](reference/accounting.md) | Anything touching money, stock counts, Day End, reports |
| [reference/testing.md](reference/testing.md) | You need to verify a change (temp DB + browser tests) |

## Non-negotiable rules

1. **No demo data, ever.** Everything shown comes from the real database. Never seed sample products, sales or customers. (The seed only creates the admin login and the Main branch.)
2. **Record everything.** Every action that changes stock or money must be traceable to *who*, *when*, *which branch*, *which shift*, with a number (bill, RT-, GRN-, GTN-, PO-, VCH-, RCP-) and a reason. It must appear in: its own page's history, the **Day End book** (screen tab + A4 report + Z slip), the **period reports**, and the **Activity Log** (plain-language summary).
3. **Stock only moves through `changeStock()`** (`backend/src/modules/branches/branch-stock.ts`). It moves a branch's shelf / damaged / empties counts *and* the product's company totals in one transaction, and refuses to go below zero. Never write `inventoryProduct.quantity` directly. Every change also gets `recordMovements()` with the branch and shift.
4. **Everything is per branch.** Shifts, sales, cash entries, returns, movements, GRNs and GTNs carry a `branchId`. Get it with `requestBranch(req)` (the user's working branch) or `requestBranchScope(req)` (null = "all branches" for people who can switch). Cashiers are fixed to one branch.
5. **Money is split by how it was paid**: `cashPaid`, `cardPaid`, `transferPaid`, `walletUsed`, `walletCredit` on every counter sale. Totals are always built from these columns — never from `paymentMethod` alone. See accounting.md for the drawer and net-sales formulas.
6. **Blind count**: a cashier must not see expected cash (or anything that reveals it) until the drawer is counted. Any new cash figure in the shift report must be nulled in the blind view (`getShiftReport` in `shift.service.ts`).
7. **Closed shifts are frozen** — the Z report JSON is stored at close; never recompute a closed shift.
8. **Plain language for shop staff.** Labels like "Change kept in wallet", "Sent to another branch", not technical terms. Sri Lankan context: the hard-liquor limit per bill (default 12) is decided by each product's "Hard liquor" mark; beer, wine, champagne and other drinks don't count. Money is formatted with `toLocaleString("en-LK")`.
   - **Bills keep their history.** Anything recorded on a bill keeps its value at the time of sale (for example `pointsRate`, and the line's `isHardLiquor`). Later product or settings changes never rewrite old bills.
   - **Supplier-filtered lists.** Wherever a supplier is chosen, list only that supplier's products, with an opt-in to show others.
9. **Database changes are manual migrations** — see below. Always back up first.
10. **Never start a second `next dev`** in `pos/` — it shares `.next` with the user's :3001 server and breaks it (404s everywhere). Test the UI through the user's :3001 app, redirecting API calls to a temporary backend.

## Adding a feature — checklist

Work through every layer; a feature is not done until each applies or is consciously skipped.

1. **Schema** — edit `backend/prisma/schema.prisma` (add `branchId Int?` + `@@index([branchId])` to new record tables). Write the SQL by hand in `backend/prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql` (use `prisma migrate diff --from-url … --to-schema-datamodel … --script` and copy **only** your statements — the DB has unrelated legacy drift that must not be dropped). Apply:
   ```bash
   cd backend && DB=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')
   pg_dump -Fc "${DB%%\?*}" -f <scratchpad>/bar_shop-backup-before-<name>.dump
   psql "${DB%%\?*}" -v ON_ERROR_STOP=1 -1 -q -f prisma/migrations/<dir>/migration.sql
   npx prisma generate
   ```
   There is no `_prisma_migrations` table; don't run `prisma migrate dev/deploy`. Additive changes can be applied before the code is finished (the running app keeps working).
2. **Service + routes** — new module under `backend/src/modules/<name>/`, zod validation via `validate()`, errors via `AppError` (`AppError.validation({ field: ["message"] })` → 422 shown to the user). Guard with `authenticatePosAdmin` + `authorizePosRoles(...)`. Number documents with an advisory lock (`pg_advisory_xact_lock`) + last number + 1. Mount in `backend/src/app.ts`.
3. **Stock / money** — use `changeStock`, `recordMovements({ branchId, shiftId })`, `findOpenShift(db, branchId)`; cash leaving the drawer must be subtracted in `drawerCash()` (cash-book.service) *and* `expectedCash` (shift.service).
4. **Activity Log** — add a branch in `describePosChange` (`activity-log/activity-describe.ts`) with an `action`, `category`, one-line `summary` and `details.facts`. Handle the "blocked attempt" case (no response data). New categories go in `ActivityCategory`, the logs route enum and the logs page `CATEGORIES`.
5. **Day End** — add to `summarizeShift()` (shift.service): a section, totals, stock-book columns if stock moves, blind-view nulling. Then the UI tab in `pos/app/dashboard/day-end/page.tsx`, the A4 report `pos/app/lib/dayEndReport.ts`, the Z slip `buildZReportHtml` in `pos/app/lib/bookPrint.ts`, and the `ShiftReport` type there. Exclude the new category from the shift journal if it has its own section.
6. **Period reports** — `period-report.service.ts` (respect `inBranch`), type + A4 in `pos/app/lib/periodReport.ts`, card in `pos/app/dashboard/reports/page.tsx`.
7. **Frontend page** — `pos/app/dashboard/<name>/page.tsx` following the existing page pattern (see architecture.md), sidebar link in `components/Sidebar.tsx`, breadcrumb in `components/Topbar.tsx`, role paths in `lib/roles.ts`, styles in `pos/app/lounge.css` using the theme tokens (works in light and dark).
8. **Prints** — 80mm slips via `printThermal` + `THERMAL_BASE_CSS`; A4 documents via `printA4` + `REPORT_CSS` (from dayEndReport.ts). Include branch name, number, who, signatures.
9. **Type-check both apps**: `cd backend && npx tsc --noEmit -p .` and `cd pos && npx tsc --noEmit -p .`.
10. **Test on a temporary database** (testing.md): API checks for every rule and refusal, then a browser run through the user's :3001 with screenshots in light/dark, and render any print to PNG to look at it. Clean up (`kill :5030`, `dropdb bar_shop_tmptest`).
11. **Report** to the user in plain words: what they can now do, where it is recorded, test results, DB migration + backup file name, and that nothing was committed to git (only commit when asked).

## Working with the user

- The user is the shop's developer/owner (Sri Lanka), writes short informal messages, often with a screenshot. Read the screenshot carefully; small UI complaints ("not aligned", "keep gap") need a precise CSS fix and a rendered check.
- For ambiguous product decisions, ask one short question with options (recommended first). Otherwise pick sensible defaults and list them at the end so the user can change them.
- Keep replies short and in plain language; no code dumps.
