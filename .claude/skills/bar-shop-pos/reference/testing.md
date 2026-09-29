# Testing a change

Always test against a **temporary database** and a **temporary backend on :5030**. Never test by writing to the real database, and never start a second `next dev`: drive the user's own :3001 app and redirect its API calls. Use the scratchpad for scripts, screenshots and backups.

## 1. Temporary database + backend

```bash
cd "bar shop/backend"
createdb bar_shop_tmptest
export DATABASE_URL="postgresql://sanjananimesh@localhost:5432/bar_shop_tmptest?schema=public"
npx prisma db push --skip-generate      # schema as it is in schema.prisma
npx tsx prisma/seed.ts                   # admin login + Main branch only (no demo data)
```

Run the backend in the background with `run_in_background`:

```bash
DATABASE_URL="postgresql://sanjananimesh@localhost:5432/bar_shop_tmptest?schema=public" PORT=5030 npx tsx src/index.ts
```

- **Admin login:** `manager@barshop.local` / `liquorshop@2026`.
- **Cashiers:** create them with `POST /api/pos/auth/staff` and give each a `branchId`, which is required for cashiers.
- **tsx doesn't watch for changes.** After changing backend code, restart the :5030 process.
- **Resetting:** `dropdb` then `createdb` for a clean run. Running a test twice on the same data fails on unique codes (branch codes, emails).

## 2. API checks

Copy [test-harness.js](test-harness.js) into the scratchpad. It needs `npm i puppeteer-core` there once; it uses the Chrome installed on the Mac. Write checks for:

- **Normal flow:** the numbers you expect, like totals, stock after the action, and the document number.
- **Every refusal:** expect **422** for validation, **403** for the wrong role or branch, **409** for a conflict. Check that the message a user sees is clear.
- **Branches:** stock at the branch that acted, company totals, and the other branch unchanged.
- **Day End:** `GET /api/pos/shifts/:id/report`:
  - as an admin, to see the full figures
  - as a cashier, to confirm the blind view hides cash
  - expected drawer cash, stock-book row (opening + in − out = closing), and the new section
- **Period report:** `GET /api/pos/reports/period?from&to[&branch=all|&branchId=]`.
- **Activity log:** `GET /api/pos/activity-logs?category=…`. Check the summary text and the branch.

## 3. Browser checks (user's :3001)

- Use `openAs(browser, session, path)` from the harness. Fill forms with `page.type` / `page.select`, click with `clickText`, and scan barcodes with `scan()`.
- Take screenshots and **look at them** with Read, in dark and light (`openAs(..., { theme: "light" })`).
- For prints, capture the HTML:
  - from `iframe.lx-report-frame` `srcdoc`, or
  - by hooking `document.body.appendChild` to catch the print iframe,

  then use `renderHtml()` to make a PNG and look at it.
- **Small CSS fixes:** render only the affected markup with `globals.css` + `lounge.css` inlined, and screenshot that.

## 4. Clean up and report

```bash
lsof -ti :5030 | xargs kill; dropdb bar_shop_tmptest
```

The background task ending with exit code 143 is that kill; it's expected.

Report the pass count honestly. If a failure was the test's own mistake (a wrong expectation), say so and why, and fix the test rather than the code.

## Handy facts

- `purchasePrice` when creating a product is the **batch total**: 100 bottles for Rs 30,000 is Rs 300 each. Restocking blends the cost as a weighted average.
- Bills need an open shift at that branch: `POST /api/pos/shifts/open { openingFloat }`.
- Checkout: `POST /api/pos/user-management/checkout`

  ```
  { items:[{productId,quantity,unitPrice,emptiesReturned?}], paymentMethod, amountReceived?, split?{card,transfer}, paymentReference?, customerId?, discount?{type,value}, redeemPoints?, walletUse?, changeToWallet? }
  ```

- Closing a shift: `POST /shifts/:id/count { counts: { "5000": 1, ... } }`, then `POST /shifts/:id/close { floatLeft, cardSlipTotal?, differenceReason?, stockCounts? }`.
- Validation errors come back as `{ message: "Validation failed", errors: { field: [msg] } }`.
- Before migrating the real database, back up with `pg_dump -Fc "${DB%%\?*}" -f <scratchpad>/bar_shop-backup-before-<name>.dump`.

  After migrating, check the real database has no drift left for your tables:

  ```
  npx prisma migrate diff --from-url "$DB" --to-schema-datamodel prisma/schema.prisma --script | grep -i <table>
  ```

  It should print nothing.
