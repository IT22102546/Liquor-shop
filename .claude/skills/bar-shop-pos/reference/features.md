# Features — what the POS does

Sidebar sections (filtered by role, `pos/app/components/Sidebar.tsx`):

- **Sales:** Bar Counter · Sold Products · Returns & Damages
- **Overview:** Dashboard · Activity Log · Shop Settings · Branches
- **Stock:** Product Setup · Suppliers · Purchase Orders · Goods Received (GRN) · Branch Transfers (GTN)
- **People:** Loyalty Customers · Staff & Roles
- **Billing:** Sales Bills
- **Book Keeping:** Day End · Expenses (Vouchers) · Money In (Receipts) · Reports

Hidden legacy pages from the old bike/invoice system still exist but aren't in the sidebar and must stay hidden unless asked: Invoice Bank Details, Terms & Conditions, General Ledger, Manage Accounts, Supplier Requests, the `bikes` backend module.

## Roles (`pos/app/lib/roles.ts`, backend `authorizePosRoles`)

| Role | Can |
|---|---|
| ADMIN | Everything. Only role for purchase orders, branches, staff, settings, clearing damaged stock, activity log. |
| CASHIER | Counter, sold products, sales bills, Day End (their branch, blind count), returns & damages, GRN, GTN send/receive, Product Setup read-only (except empties returned to supplier). Fixed to one branch. |
| INVENTORY_MANAGER | Product Setup, suppliers, GRN, GTN. Can switch branch. |
| ACCOUNTANT | Day End (read), vouchers/receipts, reports, sales, GRN/GTN (view only). Can switch branch. |

Staff without a fixed branch switch branches with the selector in the top bar. The page reloads so every figure follows the new branch.

## Counter (`/dashboard/inventory`)

- Showroom design, light and dark, with a hero photo (`public/counter/hero-bottles.jpg`).
- Product grid by category, plus search.
- **Barcode scanner.** A reader types fast and ends with Enter, and `useBarcodeScanner` catches it anywhere on the page.
- Cart.
- **Empties handed back** reduce the bill by `emptyBottlePrice` each. They're collected into that branch's empties on hand.
- **Bill discount**, as a percentage or a rupee amount:
  - Switched on in Shop Settings.
  - Cashiers are capped at `maxCashierDiscountPercent`.
- **Loyalty member.** Pick one with `MemberPicker`. Mobile number is the key.
- **Points:**
  - Members earn `floor(total / loyaltyRupeesPerPoint)` points on each bill, and the rate is stored on the bill as `pointsRate`.
  - They can spend points at `loyaltyPointValue` rupees each, when redemption is switched on.
- **Wallet:**
  - "Use wallet" pays part or all of the bill from the member's wallet.
  - "Keep change in wallet" keeps some or all of the cash change for the member. That cash stays in the drawer.
- **Payment:**
  - Cash, Card, Transfer/QR, or Split (cash plus card or QR).
  - Approval code or reference for card and QR.
  - Quick cash amounts, and the change due.
- **Hard-liquor limit.** At most 12 hard-liquor bottles per bill (Sri Lankan rule). The limit is set in Shop Settings.
  - Each product is marked **Hard liquor** or **Not hard liquor** on the product form. Beer, wine, champagne, cider and soft drinks are not hard liquor.
  - New products start from their category (Shop Settings' hard liquor categories, else spirit names such as arrack, whisky, rum). Staff can change it.
  - The mark is also saved on each bill line (`PosCustomerPurchase.isHardLiquor`), so reports keep what counted at the time of sale.
  - The printed bill shows "Hard liquor N bottles (limit 12)".
- **A shift must be open** at the branch before anything can be sold.
- **Bill:** an 80mm receipt showing the branch name and address, loyalty points and wallet, and change given or kept.

## Returns & Damages (`/dashboard/returns`)

Numbered RT-00001 and so on. Each return prints an 80mm slip with signature lines.

- **Damaged bottle exchange.** A new bottle comes off the shelf and the damaged one goes into damaged stock. No money changes hands.
- **Return & refund:**
  - Find the bill by number or the member's mobile.
  - Choose the quantity per line and the condition: back on shelf, or damaged.
  - Pay back in cash from the drawer, or into the member's wallet.
  - Points earned on those bottles are taken back at the bill's own rate.
  - You can't return more than was bought, or refund more than was paid.
- **Store damage.** Moves bottles from the shelf to damaged stock.
- **Clear damaged stock** (admin only): sent back to the supplier (with a reference), thrown away, or put back on the shelf.
- **Page layout:** today's KPIs, a history table, and a damaged-stock tab. The product search accepts barcode scans; scanning the same bottle again adds one.

## Loyalty Customers (`/dashboard/users`)

- A member needs a name and mobile. Each member row shows points, wallet, visits and total spent.
- **Wallet & points history.** Six summary tiles and two tabs:
  - Money added and spent, with how each came about.
  - Points rewarded and used, with the working ("Rs 1,700 ÷ Rs 100 = 17 points"), plus points taken back on refunds.
- A member can't be deleted while their wallet has money in it.

## Product Setup (`/dashboard/inventory/manage`)

- **Add liquor** (`ProductFormModal`):
  - Brand, category, supplier, barcode, size, stock, cost and selling price.
  - Tax as a percentage of the purchase price, or as rupees.
  - Empty-bottle price.
  - Low-stock alert.
- **Bulk price update** (`BulkPriceModal`) for government price changes:
  - Choose "Beer, wine & others" or "Hard liquor" (by each product's mark), or pick categories, then untick the products that shouldn't change.
  - Change by a percentage or a set amount, with a reason.
- **Restock.** Cost is blended as a weighted average over the stock on hand.
- **Supplier filter** on the product list, and a "Hard liquor" badge on those products.
- **Wherever a supplier is picked** (purchase order, GRN), only that supplier's products are listed. A "Show other suppliers' products" option covers products with no supplier set.
- Shows the stock at this branch, a count for each branch (MAIN 101 · KDY 13), damaged bottles, and empties on hand, with "Returned to supplier" for empties.

## Purchase Orders (`/dashboard/purchase-orders`, admin)

- Draft → Sent (by email) → Partly received / Received, or Cancelled.
- **Email** goes out over SMTP using `common/utils/mailer.ts` (nodemailer), set up with the `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM` settings. Every attempt is logged, including failures.
- **A4 print and preview.**
- **Branch details.** Each order is from, and delivered to, the branch that created it.
  - The printed order and the email show "BAR SHOP — <branch>", with the branch's address, phone and email. Anything the branch hasn't set falls back to Shop Settings.
  - The email is sent from the shop's one Gmail address. Supplier replies go to the branch's email (Reply-To).
  - Branch email is set on the Branches page.
- **Which branch an order is for:**
  - Working at the Main branch, an admin chooses any open branch ("Order for branch").
  - Working at any other branch, orders are only for that branch.
  - The server enforces this for new orders and for edits to drafts.
  - The list shows each order's branch.
  - A sub branch sees only its own orders. Another branch's order is blocked (403) for opening, editing, sending, receiving and cancelling.
  - The Main branch sees all orders, with a branch filter. Receiving it creates a GRN at that branch, with invoice number, rejected quantities and reasons.

## Goods Received — GRN (`/dashboard/grn`)

- **Free issues:** a Free column (for example 10 + 2 free). The free bottles go into stock and lower the cost per bottle. Nothing extra is owed. The form shows the cost per bottle after the free issue, and flags when fewer free bottles arrived than the order agreed.

- **Where from:** a supplier delivery, with or without a purchase order.
- **What's recorded:** the supplier's invoice number, date and total.
- **Per line:** delivered, rejected with a reason, and cost.
- **Stock:** accepted bottles go into this branch's stock through restock (cost is blended). Rejected ones are only recorded.
- **Invoice check:** it warns when the invoice total differs from the value accepted.
- **Print:** A4 with signature lines for the driver, the receiver and the approver.
- **Cashier access:** the form's supplier list and open purchase orders come from `GET /grns/setup`, because cashiers can't read those lists directly.

## Branch Transfers — GTN (`/dashboard/transfers`)

- **Send:** stock leaves the sending branch straight away and the transfer is marked SENT ("in transit"). Record who carried it and any note.
- **Receive:** only the destination branch can receive it.
  - For each line, enter arrived good, damaged, and missing.
  - Good bottles go on the shelf and damaged ones into damaged stock.
  - Missing bottles need a note.
- **Cancel:** the sender (or an admin) can cancel a transfer that hasn't been received. The stock goes back.
- **Page layout:** a "coming to you" banner, tabs for in, out and all, an all-branches toggle, and A4 print.

## Branches (`/dashboard/branches`, admin)

- A card for each branch: bottles, stock value, staff, open till, transfers waiting, and damaged bottles.
- Add, edit, close or reopen a branch, and "Work here".
- A branch can't be closed while it has stock, an open shift, staff, or transfers in transit.
- The Main branch can't be closed.

## Day End (`/dashboard/day-end`) — one till session (shift) per branch

- **Open a shift** with an opening float. The float left by the last shift is suggested.
- **During the shift:** record an expense (voucher) or cash in, and view the report so far (hidden while a blind count is in progress).
- **Close wizard:**
  1. Count the cash by notes and coins, blind.
  2. Check card and QR payments against the card machine settlement slip.
  3. Review the check: the difference needs a reason.
  4. Stock count: ✓ when the shelf matches, otherwise type the count.
  5. Choose the float left and close.
- **What closing does:** freezes the Z report and creates automatic receipts (shift takings held in the SAFE, and card settlement), both waiting to be banked.
- **Tabs:** Sales, Payments (with split bills), Customer wallets, Returns & damages, Goods in & out, By staff, Items sold, Discounts & loyalty, Expenses & cash in, Stock book, Stock in & changes, Shift journal (everything else done during the shift).
- **Prints:**
  - A4 Day End report (`dayEndReport.ts`): KPIs, sales summary, cash drawer ledger, cash count, payments, card and QR lists, staff, discounts and loyalty, expenses, items, stock book, empties, bills, wallets, goods, returns, damaged stock, stock log, journal, signatures.
  - 80mm Z slip (`bookPrint.ts`).

## Cash book (`/dashboard/accounts/vouchers`, `/receipts`, `CashBookPage.tsx`)

- **Voucher** (VCH-) is money out; **receipt** (RCP-) is money in.
- **Source:** the drawer (needs an open shift), the bank, or the owner.
- **Voiding** needs a reason and keeps the entry, crossed out. A closed shift's entries can't be voided.
- **Takings** stay "waiting to be banked" until someone marks them as banked with a deposit reference. They are never assumed banked.

## Reports (`/dashboard/reports`)

- Daily, weekly, monthly, yearly or a custom range, for this branch, a chosen branch, or all branches together.
- Sales, profit and loss, payments, breakdown by hour, day or month, staff, categories, products, expenses, money in and banking, shifts, stock movement (with transfer, returned and damaged columns), returns and damages, discounts, and loyalty (points and wallets owed).
- A4 print.

## Shop Settings (`pos_settings` key "shop", `settings.service.ts`)

- `loyaltyRedemptionEnabled`, `loyaltyRupeesPerPoint`, `loyaltyPointValue`
- `discountsEnabled`, `maxCashierDiscountPercent`
- `businessName`, `businessAddress`, `businessPhone`, `businessEmail`
- `hardLiquorLimitEnabled`, `hardLiquorLimit` (12), `hardLiquorCategoryIds` (null means worked out from category names)

## Activity Log (`/dashboard/logs`, admin)

- Every successful change made through the POS, plus blocked attempts (403) and failed purchase-order emails.
- Each entry records who, their role, the branch, and a plain summary, plus facts or before → after changes and the IP address.
- Filter by category: sign-ins, sales, stock, products, staff, Day End & cash, purchase orders, returns & damages, GRN & transfers, branches, accounts, customers.
