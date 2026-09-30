# Bar Shop POS

A complete point-of-sale and back-office system for liquor shops and bars in Sri Lanka. It runs the counter, stock, suppliers, several branches and the daily books.

Built for LKR (Rs.). It enforces the Sri Lankan per-bill hard-liquor limit, and every stock and money movement is recorded with who did it, when, where, and why.

- **`pos/`** — the web app staff use (Next.js 14 / React 18), in dark and light themes.
- **`backend/`** — the API (Node.js, Express, Prisma ORM, PostgreSQL). It handles email (Nodemailer / SMTP) and PDF-ready prints, and keeps a full activity log.

---

## Contents

1. [Features at a glance](#features-at-a-glance)
2. [Counter (selling)](#1-bar-counter-selling)
3. [Payments and bills](#2-payments-and-bills)
4. [Loyalty: members, points, wallet](#3-loyalty-customers-points-and-wallet)
5. [Discounts](#4-discounts)
6. [Hard liquor limit](#5-hard-liquor-limit-sri-lankan-law)
7. [Returns & damages](#6-returns--damages)
8. [Products & stock](#7-product-setup-and-stock)
9. [Suppliers & purchase orders](#8-suppliers-and-purchase-orders)
10. [Goods received (GRN) & free issues](#9-goods-received-grn-and-free-issues)
11. [Branches & branch transfers (GTN)](#10-branches-and-branch-transfers-gtn)
12. [Day End (shift close & Z report)](#11-day-end-book-keeping)
13. [Cash book: expenses, money in, banking](#12-cash-book-expenses-money-in-banking)
14. [Reports](#13-reports-daily--weekly--monthly--yearly)
15. [Dashboard, Activity Log, Settings](#14-dashboard-activity-log-shop-settings)
16. [Staff, roles and permissions](#15-staff-roles-and-permissions)
17. [Printing](#16-printing)
18. [How money and stock are counted](#how-money-and-stock-are-counted)
19. [Record-keeping rules](#record-keeping-rules)
20. [Installation (local)](#installation-local)
21. [Configuration (.env)](#configuration)
22. [Database, migrations and backups](#database-migrations-and-backups)
23. [Production deployment](#production-deployment)
    - [Live server & CI/CD pipeline](#live-server--cicd-pipeline)
24. [Project structure](#project-structure)
25. [Troubleshooting](#troubleshooting)

---

## Features at a glance

| Area | What it does |
|---|---|
| Counter | Fast selling with barcode scanner, product grid, cart, empties, discounts, loyalty points, wallet, split payments, 80mm bill |
| Weak / no internet | Bills are never saved twice (safe automatic retries); selling carries on offline and bills upload by themselves when the connection is back |
| Cash drawer | Opens on cash bills; "Open drawer" (no sale) needs a reason and is recorded (`NS-`); works with a USB receipt printer, the printer driver or a COM port |
| Payments | Cash, card, bank transfer / QR, split (cash + card/QR), wallet; change calculation; approval references |
| Loyalty | Members by mobile number; points earned per rupee; points redeemed as a discount; wallet for kept change and refunds; full history per member |
| Hard liquor | Per-product "Hard liquor" tick; max bottles per bill (default 12) enforced at the counter and on the server; printed on the bill |
| Returns & damages | Damaged bottle exchange, return & refund (cash or wallet), store damage, damaged stock kept aside, clearing to supplier / write-off / back to shelf |
| Products | Product setup with barcode, size, cost, tax (% or Rs), selling price, empties price, low-stock alert, photos; bulk price update; restock with cost averaging |
| Suppliers | Supplier records; supplier-filtered product lists everywhere |
| Purchase orders | Draft → email to supplier → part received → received / cancelled; per branch; free-issue deals; A4 print |
| GRN | Goods received notes with supplier invoice check, rejected items, free issues, A4 print |
| Branches | Any number of branches, each with its own stock, till, Day End, cash drawer and reports; branch switcher |
| GTN | Branch-to-branch transfers: send, receive (good / damaged / missing), cancel, A4 print |
| Day End | Shift open with float, expenses & cash in, blind cash count, card machine check, stock count, drawer openings, offline bills, close with Z report; A4 Day End report |
| Cash book | Vouchers (money out), receipts (money in), void with reason, "waiting to be banked" → banked |
| Reports | Daily, weekly, monthly, yearly, custom; per branch or all branches; profit & loss; A4 print |
| Activity Log | Every change, who / role / branch / when, plain-language summary, before → after, blocked attempts |
| Hosting & deploys | Live on a VPS (PM2 + Nginx + HTTPS); every push to `main` is checked and deployed by GitHub Actions |
| Staff & roles | Administrator, Cashier, Inventory Manager, Accountant; cashiers tied to a branch |

---

## 1. Bar Counter (selling)

*Sidebar → Sales → Bar Counter*

- **Showroom-style counter**, in dark and light themes: a product grid by category with photos, stock count and price.
- **Search** by product name, brand, size or barcode.
- **Barcode scanner support.** A USB or Bluetooth scanner works anywhere on the page, with no need to click a box first. Scanning an unknown barcode offers to add the product.
- **Cart:**
  - Change quantities with + and −.
  - The cart can't go above the branch's stock.
  - Low stock is shown on each product.
- **Empty bottles handed in.** For returnable bottles, the customer's empties are taken off the bill at the product's *empty bottle price*. The empties are added to the branch's "empties on hand".
- **Loyalty member** (optional): search by mobile or name, or add a new member without leaving the counter. The member's points and wallet balance are shown.
- **Points:** use points as a discount (1 point = the value set in Shop Settings). Points are earned on every member bill.
- **Wallet:**
  - **Use wallet** pays part or all of the bill from money the member kept at the shop.
  - **Keep change in wallet** keeps some or all of the cash change for the member instead of handing it back.
- **Bill discount:** a percentage or a rupee amount. It can be switched on or off, and cashiers are capped at a set percentage (admins aren't).
- **Hard liquor limit.** A live counter shows "Hard liquor 7 / 12". The counter refuses the 13th hard-liquor bottle, while beer, wine and other drinks can still be added.
- **Payment:** Cash (with quick amounts and change), Card, Transfer / QR, or **Split** (cash + card and/or QR on one bill), with the approval or reference number.
- **A shift must be open** at the branch before selling. It can be started from the counter.
- **After the sale**, an on-screen receipt appears, ready to print (80mm), and can be reprinted any time.
- **Weak or dropping internet is safe.** Each bill carries its own reference from the till. If the connection drops or the reply is lost, the till tries again by itself ("Weak connection · trying again…"), and the server never saves the same bill twice. A bill that still can't be confirmed stays on screen with a clear message: press Complete sale again when the connection is back. If the order was changed in the meantime, or the page was reloaded, the till first checks whether the earlier bill was saved and tells the cashier.
- **Selling continues when the internet is down.** If a bill can't reach the server, the till completes the sale anyway:
  - the bill is saved on that computer and the receipt prints with a "Saved offline" note
  - the drawer opens, and the stock on screen goes down
  - a badge shows "N bills waiting to upload"
  - after the first failure, each sale takes only a second or two

  When the connection returns, the bills upload by themselves in order, with their real sale time, into the stock, the Day End (marked **Offline**) and the Activity Log. Each one is saved exactly once.
  - Paying from a wallet or with points needs the connection; earning points is fine.
  - If more bottles were sold offline than the shelf count showed, the sale is still recorded and the shortage is flagged.
  - The shift can't be closed on a till that still has bills waiting.
  - Keep the Bar Counter page open: reloading it while offline doesn't work yet.
- **Cash drawer.** The drawer opens by itself when a bill with a cash part is completed. The **Open drawer** button opens it without a sale. It appears once a shift is open (next to the shift number in the header, and as *Open cash drawer* in the order ⋮ menu), for administrators and cashiers. Pressing it asks for a reason, and the opening is saved as a numbered **no-sale** record (`NS-000001`) with the name, time, branch and shift, *before* the drawer opens. Card and QR bills don't open it.
  - **Drawer setup** (once per counter computer, in the same window):
    - *USB receipt printer*: Chrome or Edge sends the ESC/POS "open drawer" signal to the printer the drawer is plugged into.
    - *Printer opens it when printing*: turn on "Open cash drawer" in the printer driver; the button prints a small NO SALE slip. Works with any printer, including network ones.
    - *COM port*: serial printers, or drawers with their own USB cable.
    - *No drawer*: openings are still recorded.
  - No-sale opens appear in the Day End (**Drawer opened** tab, A4 report and Z slip), the period reports (count per staff member) and the Activity Log.
- **Recent sales** and **Sold Products** are one click away.
- **Sold Products** (*Sales → Sold Products*) lists every item sold: bill number, date, product, category, brand, customer, quantity and final price, with search and a date range.

## 2. Payments and bills

- **Every bill records exactly how it was paid:** cash part, card part, transfer/QR part, wallet used, change kept in wallet, and change given.
- **Bill numbers** are unique (`POS-…`). The till makes the number before sending the bill, so the printed number stays the same even when the bill is sent again or uploaded later from offline. Each bill stores the branch, the shift, the cashier, the member, the discount and points, and each line (quantity, price, empties, share of the discount).
- **Sales Bills page** (*Billing → Sales Bills*): search and date filters. Open a bill to see the full receipt and reprint it.
- **The printed bill** (80mm) shows:
  - the shop name, and the branch name, address and phone
  - items, empties deducted, discount, points used, wallet used
  - how it was paid, cash received and change given, change kept in wallet
  - points earned and the new balance, wallet balance
  - the hard-liquor bottle count against the limit
  - "Saved offline" for a bill rung up without a connection (member points are added when it uploads)

## 3. Loyalty customers, points and wallet

*People → Loyalty Customers*

- **Members** need a name and mobile number. Email, NIC and address are optional. Each member shows points (with their rupee value), wallet balance, visits, total spent, last visit and date joined.
- **Points:**
  - Earned as `bill total ÷ rupees per point`, rounded down.
  - The earning rate is saved on each bill, so changing the rate later never rewrites history.
- **Wallet:**
  - Money comes in from change a member keeps and from refunds for returned bottles.
  - It's spent on later bills, for part or all of the bill.
- **Wallet & points history** for each member:
  - **Money tab:** money added and spent, with how it came about (for example "gave Rs 1,000 cash for Rs 750, took Rs 150 back, kept Rs 100").
  - **Points tab:** points rewarded, with the working ("Rs 1,700 ÷ Rs 100 per point = 17 points"), points used, and points taken back on refunds.
  - Each entry shows the bill, the shift, and who served.
- **Deleting a member** isn't allowed while their wallet has money. Their past sales stay on record as walk-in sales.
- **Everything shows in the Day End book** (Customer wallets tab, Discounts & loyalty tab) and in the period reports: points earned and used, and wallet money held by members, which the shop owes them.

## 4. Discounts

- **Percentage or fixed-amount discount** on a bill, switched on or off in Shop Settings.
- **Cashier cap:** cashiers can give up to a set percentage. Administrators aren't capped.
- **Where discounts are recorded:**
  - on the bill
  - in the Day End "Discounts & loyalty" tab (who gave what, on which bill)
  - in the period reports (a discount register and totals by staff member)

## 5. Hard liquor limit (Sri Lankan law)

- **Each product is marked** *Hard liquor* (arrack, whisky, rum, gin, vodka, brandy…) or *Not hard liquor* (beer, wine, champagne, cider, soft drinks…) on the product form.
- **New products** start from their category: spirit categories are ticked automatically. You can change the mark on any product.
- **The limit** is at most N hard-liquor bottles per bill, with N set in Shop Settings (default 12). The counter enforces it, and the server refuses larger bills even if someone tries to get around the counter.
- **The mark is saved on each bill line**, so reports keep what counted at the time of sale.
- **Where it shows:**
  - the printed bill: "Hard liquor 12 bottles (limit 12)"
  - Day End and the period reports: hard liquor vs "beer, wine & others" sales
  - bulk price updates: groups by this mark

## 6. Returns & Damages

*Sales → Returns & Damages.* Every return has a number (`RT-00001`), prints an 80mm slip with signature lines, and records the reason, the branch, the shift and who did it.

- **Damaged bottle exchange.** The customer gets a new bottle, which comes off the shelf, and the damaged one goes into *damaged stock*. No money changes hands. The bill number and customer are optional.
- **Return & refund:**
  - Find the bill by number or member mobile, and choose how many bottles came back on each line.
  - Choose the condition: *back on shelf* (unopened) or *damaged* (kept aside).
  - The refund per bottle is what was actually paid (after the discount). You can't return more than was bought or refund more than was paid.
  - Pay back **in cash** from the drawer (needs an open shift and enough cash), or **into the member's wallet**.
  - Points earned on the returned bottles are taken back.
- **Store damage.** Bottles found damaged in the store move off the shelf into damaged stock.
- **Clear damaged stock** (administrators): sent back to the supplier (with a reference), thrown away (written off), or put back on the shelf if it was a mistake.
- **Damaged stock is kept separately** for each product and branch, and is never sold.
- **Page layout:** today's figures (exchanged, returned, store damage, damaged stock and its value), a history with filters, and a damaged-stock tab. Product search accepts barcode scans; scanning the same bottle again adds one.
- **Where returns are recorded:**
  - the Day End book (Returns & damages tab, cash drawer, stock book, A4 and Z)
  - period reports (refunds, damage loss at cost)
  - the member's history
  - the Activity Log

## 7. Product Setup and stock

*Stock → Product Setup*

- **Products** have brand, category, supplier, barcode, size, quantity, cost, tax, other costs, selling price, empty bottle price, a low-stock alert, a description and photos.
- **Tax** can be entered as a **percentage of the purchase price** or as rupees.
- **Add liquor** (a scan-first flow):
  - Scan known bottles to build a receiving list; each extra scan adds one.
  - An unknown barcode opens the new-product form with the barcode filled in.
- **Restock.** Stock goes up, and the cost price is **blended as a weighted average** over the stock on hand.
- **Bulk price update** (for example a government excise change):
  - Choose "Hard liquor" or "Beer, wine & others", or pick categories.
  - Untick products that don't change.
  - Increase or decrease by an amount or a percentage, with rounding, and override single rows.
  - Give a reason. The old and new prices are logged.
- **The list shows:**
  - stock at this branch, plus a count for each branch (for example `MAIN 101 · KDY 13`)
  - damaged bottles kept aside and empties on hand, with "Returned to supplier" for empties
  - a "Hard liquor" badge
  - a supplier filter, and a search by name or barcode
- **Low-stock notifications** appear in the top bar (the bell).
- **Cashiers** see Product Setup read-only, except returning empties.

## 8. Suppliers and purchase orders

*Stock → Suppliers / Purchase Orders* (purchase orders are for administrators)

- **Suppliers** have name, code, contact person, phone, address, email and VAT number, and each supplier's products are shown.
- **Purchase orders:**
  - They move from *Draft* → *Sent* (emailed) → *Part received* / *Received*, or *Cancelled* with a reason.
  - Each line is a product (only **that supplier's products** are listed, with an option to show others) or a free-text item (for example ice, supplies), with quantity, unit price and **"+ free"** (the free-issue deal, for example 10 + 2 free).
  - **Branch:** working at the **Main branch**, an admin can order for **any branch**. Working at a **sub branch**, orders are only for that branch. The server enforces this too.
  - **The list:** a sub branch sees **only its own orders**; the Main branch sees all, with a **branch filter**, a supplier filter, search and status tabs.
- **Emailing an order:**
  - It's sent from the shop's mailbox (SMTP). The From name shows the ordering branch ("BAR SHOP — Kandy"), and supplier replies go to **that branch's email**.
  - The email contains the full order table, the branch's address and phone, the delivery branch, and your message.
  - Every attempt is recorded, including failures, with the reason.
- **Print / PDF:** an A4 purchase order with the branch's details and signature lines.
- **Receiving an order** creates a **GRN** (see below).

## 9. Goods Received (GRN) and free issues

*Stock → Goods Received (GRN)*

- **Every supplier delivery gets a GRN** (`GRN-00001`) at the branch where it arrives. It records the supplier, the purchase order (if any), the supplier's invoice number, date and total, and notes.
- **For each line**, enter:
  - **delivered** and **rejected** (with a reason; rejected bottles go back with the driver and are not stocked)
  - **free** (the free issue)
  - the **unit cost**
- **Stock and cost:** accepted and free bottles go into that branch's stock. The price paid is spread over **all** bottles received, so free issues **lower the cost price**.
  - Example: buy 10 at Rs 300 and get 2 free gives 12 bottles at Rs 250 each.
  - A GRN with **only free bottles** (for example a monthly target bonus) lowers the average cost of the stock already on hand.
- **Invoice check:** it compares the supplier's invoice with the value of the paid bottles accepted, and warns when they differ.
- **Against a purchase order:**
  - The form is pre-filled with what's still due, including free bottles.
  - The order's received quantities update, and the order becomes *Part received* or *Received*.
  - A short free issue is flagged.
  - An order can only be received at its own branch.
- **Cashiers can record deliveries.** The form gets suppliers and open orders from the server.
- **Print:** an A4 GRN with Rejected, Free and "cost each after free" columns, the invoice check, and signatures (driver, receiver, approver).
- **Recorded in:** the Day End "Goods in & out" tab, the stock book, A4 and Z, the period reports ("Free issues from suppliers"), and the Activity Log.

## 10. Branches and branch transfers (GTN)

*Overview → Branches* (administrators), *Stock → Branch Transfers (GTN)*

- **Branches** have a name, short code, address, phone and email. The **Main branch** holds the original stock and records.
- **Each branch has its own:**
  - shelf stock, damaged stock and empties
  - till (shift) and cash drawer
  - Day End book
  - sales, returns, GRNs, reports and log entries
- **Shared across all branches:** the product list, prices, suppliers, loyalty members (points and wallet) and settings.
- **Staff and branches:**
  - **Cashiers** are fixed to one branch.
  - Administrators, inventory managers and accountants can **switch branch** from the top bar. The page reloads, so every figure is that branch's.
- **Branch cards** show bottles, stock value, staff, whether a till is open, transfers waiting, and damaged stock. "Work here" switches to that branch.
- **Closing a branch** isn't allowed while it has stock, an open till, staff, or transfers in transit. The Main branch can't be closed.
- **Branch Transfers (GTN)** (`GTN-00001`):
  - **Send:** choose the branch and the bottles (limited to what the sending branch has), who is carrying them, and a note. The bottles leave the sending branch straight away and are **in transit**.
  - **Receive** (only the destination branch): count **good**, **damaged** and **missing** bottles. Good bottles go on its shelf and damaged ones into its damaged stock. Missing bottles need a note.
  - **Cancel** (before it's received): the bottles go back to the sender's shelf.
  - **Page layout:** a "coming to you" banner, tabs for in, out and all, and an all-branches view.
  - **Print:** an A4 transfer note with sent-by, carried-by and received-by signatures.
- **Recorded in:** the Day End (Goods in & out tab, and From-branch / To-branch columns in the stock book), period reports, the Activity Log, and Product Setup's per-branch counts.

## 11. Day End (book keeping)

*Book Keeping → Day End* — one till session (**shift**) per branch at a time.

- **Open a shift** with an **opening float**. The float left by the last shift is suggested.
- **During the shift:**
  - **Record expense** (a voucher paid from the drawer) and **Cash in**.
  - **Report so far**: a live view. It's hidden from cashiers until they've counted the drawer.
- **Live figures:** bills, net sales, paid out, and expected cash in the drawer.
- **Tabs:**

  | Tab | Contents |
  |---|---|
  | Sales | Each bill: time, number, cashier, customer, items, payment, total. Bills rung up offline carry an **Offline** badge |
  | Payments | Cash, card, transfer / QR, split, and wallet; every split bill spelled out |
  | Customer wallets | Change kept, wallet spent, and refunds into wallets |
  | Returns & damages | Each exchange, refund, store damage and clearing; damaged stock |
  | Goods in & out | GRNs (with free and rejected bottles) and transfers sent / received |
  | By staff | Bills and takings per cashier |
  | Items sold | Units and amounts; hard liquor vs others |
  | Discounts & loyalty | Discounts, points used and earned, per bill and per staff member |
  | Expenses & cash in | Every drawer entry, including voided ones |
  | Drawer opened | How often the drawer opened with a cash bill, and every **no-sale** opening (time, `NS-` number, who, reason) |
  | Stock book | Per product: opening + received + from branch − sold − to branch + returned − damaged ± adjusted = closing |
  | Stock in & changes | Every stock movement other than sales, with who did it |
  | Shift journal | Everything else done during the shift (price changes, orders, settings, sign-ins…) |

- **Close wizard:**
  1. **Count cash** by notes and coins. This is a **blind count**: the cashier doesn't see the expected amount first.
  2. **Card & QR:** the card payments are listed automatically. Enter the **card machine settlement** total; any difference needs a reason. Tick off transfer/QR payments in the bank app.
  3. **Check:** over or short against the expected cash. Any difference needs a reason.
  4. **Stock count:** ✓ when the shelf count matches, otherwise type the count. Differences are shown.
  5. **Close:** choose the float left for the next shift. The rest is cash banked or put in the safe.
- **Close shift is blocked** on a computer that still has bills sold offline waiting to upload, so the Day End can't miss them. Let them upload first (the badge at the bottom shows them).
- **On close:**
  - The **Z report** is frozen and can never change.
  - Takings are added to the cash book as receipts **waiting to be banked**.
- **Prints:**
  - **80mm Z slip**, including "Drawer opened" (with a cash bill / no sale, with reasons) and the number of offline bills.
  - **A4 Day End report:** KPIs, sales summary (with refunds and net sales after returns), cash drawer ledger, cash count by note, payments, card and QR lists, staff, discounts & loyalty, expenses, items, stock book, empties, damaged stock, bills (offline ones marked), cash drawer openings, wallets, goods in & out, returns, stock log, journal and signatures.
  - Both can be saved as PDF.
- **Past shifts** are listed per branch; open one to view or print its report.

## 12. Cash book: expenses, money in, banking

*Book Keeping → Expenses (Vouchers) / Money In (Receipts)*

- **Vouchers** (`VCH-`) are money out, by category (supplier payments, salaries, utilities, repairs, owner drawings…), from the **drawer**, **bank** or **owner**.
- **Receipts** (`RCP-`) are money in.
- **Drawer entries** need an open shift. Paying out more than the drawer holds is refused.
- **Void** with a reason: the entry stays in the book, crossed out, with who voided it. A closed shift's entries can't be voided.
- **Banking:**
  - Shift takings, card settlements and QR payments wait as **"waiting to be banked"** (in the SAFE or with the card company).
  - **Mark as banked** records the deposit reference and date, and can cover several entries on one slip.
  - It can be undone if marked by mistake. Takings are never assumed to be banked.
- **Branches:** each branch has its own entries. Admins and accountants can see all branches.

## 13. Reports (daily / weekly / monthly / yearly)

*Book Keeping → Reports*

- **Period:** a day, week, month, year or custom range, with previous/next.
- **Branch:** **this branch**, a chosen branch, or **all branches together**.
- **Sales summary:** gross, empties, discounts, points, net sales, refunds, net after returns, payment methods, member bills, and hard liquor vs others.
- **Profit & loss:**
  - net sales − refunds − cost of bottles sold = gross profit (and margin)
  - − running expenses − damage loss + other income = **net profit**
- **Breakdowns:** by hour, day or month (with a bar chart), by staff, by category, and by product (sales, cost, profit).
- **Money:** expenses by category, other money in, banked vs waiting to be banked.
- **Shifts:** each closed shift with its drawer result (balanced / over / short) and the reason, plus how many times the drawer was opened **without a sale**, per staff member.
- **Stock movement:** received (with value), sold, from / to branch, returned, damaged, adjusted, empties, stock on hand now and its value at cost, and **free issues** received with their value.
- **Returns & damages:** refunds (cash / wallet), bottles back on the shelf or damaged, exchanged, store damage, sent to supplier, written off, **damage loss at cost**, and damaged stock on hand.
- **Discounts & loyalty:** discount register, points earned, used and held, and wallet money kept, used and held (owed to members).
- **A4 print / PDF.**

## 14. Dashboard, Activity Log, Shop Settings

- **Dashboard** (*Overview*): sales and profit for a date range compared with the previous period, trend charts, top products and categories, stock alerts, and recent bills. It follows the selected branch, or all branches.
- **Activity Log** (*Overview*, administrators):
  - **Every change** made in the system, with **who** (and their role), **which branch**, when, the IP address, and a plain-language summary.
  - **Details:** before → after values (for example prices and settings), items, amounts and reasons.
  - **Blocked attempts** by someone without permission, and **failed** purchase-order emails.
  - **Cash drawer:** every no-sale opening with its reason.
  - **Offline sales:** "sold OFFLINE at 09:56, uploaded later", and "shelf count was short" when more bottles were sold than the count showed. A bill sent again by the till is logged once, not per attempt.
  - **Filters:** category (sign-ins, sales, stock, products, staff, Day End & cash, purchase orders, returns & damages, GRN & transfers, branches, accounts, customers), person, date and text search.
  - Entries can't be edited or deleted.
- **Shop Settings** (administrators):
  - Loyalty: turn point spending on or off, rupees per point, and the value of a point.
  - Discounts: turn them on or off, and the cashier's maximum percentage.
  - Business details: name, address, phone and email (used on orders and emails).
  - The hard liquor limit (on/off and the number of bottles), and which categories start new products as hard liquor.

## 15. Staff, roles and permissions

*People → Staff & Roles* (administrators): create staff with a temporary password, and set each person's role, **branch** and active / disabled status. You can't remove your own administrator access.

| Role | Access |
|---|---|
| **Administrator** | Everything: all branches, settings, staff, branches, purchase orders, clearing damaged stock, activity log |
| **Cashier** | Counter (including offline selling and Open drawer), sold products, sales bills, returns & damages, Day End for their branch (blind count), GRN, GTN send/receive, Product Setup (view; return empties). **Fixed to one branch.** |
| **Inventory Manager** | Product Setup, suppliers, GRN, GTN; can switch branch |
| **Accountant** | Day End (view), expenses & receipts, banking, reports, sales bills, GRN/GTN (view); can switch branch |

Permissions are checked on the **server** for every request, not just hidden in the screens. Blocked attempts are logged.

## 16. Printing

| Document | Size | Contents |
|---|---|---|
| Sales bill | 80mm | Shop + branch header, items, empties, discount, points, wallet, payment, change, hard-liquor count; "Saved offline" note when sold offline |
| Return / exchange slip | 80mm | RT number, bill, items, refund (cash / wallet), points back, reason, signatures |
| Z report | 80mm | Shift summary, payments, drawer, drawer openings (no sale), expenses, goods, returns, stock book, bills (offline marked), signatures |
| Voucher / receipt | 80mm | Cash book entries |
| No-sale slip | 80mm | NS number, branch, time, who opened the drawer and why (printer-driver drawer setup) |
| Day End report | A4 | Full shift book (see §11) |
| Period report | A4 | Full report (see §13) |
| Purchase order | A4 | Branch details, supplier, items with free issues, signatures |
| GRN | A4 | Delivered / rejected / accepted / free, invoice check, signatures |
| GTN | A4 | Sent / received / damaged / missing, signatures |

Every print can be saved as PDF from the print dialog.

---

## How money and stock are counted

- **A bill.**
  - Total = items − empties credit − discount − points.
  - The total is paid by wallet + cash + card + transfer/QR.
  - Change = cash handed over − cash part. Some or all of the change can be kept in the wallet.
- **Expected cash in the drawer:**
  - `opening float + cash parts of bills + change kept in wallets + cash in − paid out − cash refunds`
  - Wallet spending is sales, but not new cash.
  - Opening the drawer without a sale changes nothing here. Cash put in or taken out must be recorded as **Cash in** or an **Expense**.
- **Net sales:**
  - `cash + card + transfer/QR + wallet used`
  - Net after returns = net sales − refunds.
- **Stock book** (per product, per shift, per branch):
  - `opening + received (incl. free issues) + from other branches + returned by customers − sold − to other branches − damaged ± corrections = closing`
- **Offline bills** count on the day and time they were really sold, in the shift that is open at the branch when they upload. If more bottles were sold offline than the shelf count showed, the shelf goes below zero until it is counted and corrected (or restocked), and the shortage is flagged.
- **Cost price:** a weighted average over the stock on hand. A GRN's paid amount is spread over paid + free bottles.
- **Profit:**
  - `net sales − refunds − cost of bottles sold (less bottles back on the shelf) − running expenses − damage loss (at cost) + other income`
- **Points and wallet** held by members are shown as money the shop owes them.

---

## Record-keeping rules

- **No sample data.** Everything shown is real data entered in the system.
- **Every stock or money movement** has a document number, the person, the branch, the shift, the time, and a reason where relevant.
- **Nothing is silently deleted.**
  - Cash entries are *voided*, not deleted.
  - Purchase orders are *cancelled*.
  - Closed shifts are frozen.
- **Opening the cash drawer without a sale** is numbered (`NS-000001`) and saved with the reason before the drawer opens.
- **A bill is saved exactly once**, even if the till sends it again (weak network) or uploads it later (offline).
- **What was true at the time of sale** is kept on the bill (points rate, hard-liquor mark), so later changes never rewrite history.

---

## Installation (local)

**Requirements:** Node.js 20 LTS (18.17+), npm, and PostgreSQL 14+.

```bash
# 1. Database
createdb bar_shop
createuser bar_shop_user --pwprompt
psql -d postgres -c 'ALTER DATABASE bar_shop OWNER TO bar_shop_user;'

# 2. Backend
cd backend
cp .env.example .env          # then edit DATABASE_URL, JWT_SECRET, SMTP_* (see below)
npm install
npx prisma db push            # creates all tables from prisma/schema.prisma
npx prisma db seed            # creates the first administrator + the Main branch (no sample data)
npm run dev                   # API on http://localhost:5010

# 3. Web app (new terminal)
cd pos
echo 'NEXT_PUBLIC_API_URL=http://localhost:5010' > .env.local
npm install
npm run dev -- -p 3001        # open http://localhost:3001
```

**First login:** `manager@barshop.local` / `liquorshop@2026`. **Change this password straight away** (Staff & Roles). Then:

1. Set **Shop Settings** (business details, loyalty, discounts, hard-liquor limit).
2. Rename the **Main branch** and add its address, phone and email. Add other branches.
3. Add **staff** (cashiers need a branch).
4. Add **suppliers**, then **products**: scan with *Add liquor*, and tick *Hard liquor* where it applies.
5. Open a **shift** in Day End and start selling.

---

## Configuration

### `backend/.env`

| Variable | Example | Purpose |
|---|---|---|
| `NODE_ENV` | `production` | |
| `PORT` | `5010` | API port |
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/bar_shop?schema=public` | PostgreSQL connection |
| `JWT_SECRET` | a long random string | Signs login tokens. **Must be secret and unique.** |
| `POS_JWT_EXPIRES_IN` | `7d` | How long a login lasts |
| `CORS_ORIGIN` | `https://pos.yourshop.lk` | The web app's address(es), comma-separated |
| `BCRYPT_ROUNDS` | `12` | Password hashing strength |
| `SMTP_HOST` | `smtp.gmail.com` | Outgoing mail server (purchase-order emails) |
| `SMTP_PORT` | `465` | 465 (SSL) or 587 |
| `SMTP_USER` | `shop@gmail.com` | Mailbox |
| `SMTP_PASS` | Gmail **App Password** | Not the normal password (Google Account → Security → App passwords) |
| `MAIL_FROM` | `"BAR SHOP <shop@gmail.com>"` | Sender; the branch name is added automatically |

Without `SMTP_*`, everything works except emailing purchase orders. The screen says email isn't set up, and orders can still be printed.

### `pos/.env.local` (or `.env.production`)

| Variable | Example |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.yourshop.lk` |

This is built into the web app at `npm run build`, so rebuild after changing it.

`.env` files are git-ignored. Never commit passwords.

---

## Database, migrations and backups

- **The schema** is `backend/prisma/schema.prisma`.
- **A new installation:** run `npx prisma db push` then `npx prisma db seed`.
- **Updating an existing database:** the SQL for each change is in `backend/prisma/migrations/<date>_<name>/migration.sql`. Apply the new ones in date order with `psql -v ON_ERROR_STOP=1 -1 -f migration.sql`, then run `npx prisma generate`.
  - The early migration folders come from the system this was built on. Use `db push` for fresh databases rather than `prisma migrate deploy`.
  - Check nothing is left over with `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` (only unrelated legacy differences should remain).
- **Backups:**
  - Back up **before every update** and **daily**:
    ```bash
    pg_dump -Fc "$DATABASE_URL_WITHOUT_QUERY" -f bar_shop-$(date +%F).dump
    ```
  - Restore with `pg_restore --clean -d bar_shop bar_shop-YYYY-MM-DD.dump`.
  - Keep copies off the server.
- **Uploaded product photos** are stored in `backend/uploads/`. Back this folder up too.

---

## Production deployment

The system needs a server that can run **Node.js all the time** and **PostgreSQL**. For example, a **Linux VPS** (Hostinger KVM VPS, DigitalOcean, AWS Lightsail…) with Ubuntu 22.04/24.04. Shared "web hosting" plans that only offer PHP/MySQL can't run it.

Typical setup on one VPS:

```bash
# Packages
sudo apt update && sudo apt install -y nginx postgresql git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm i -g pm2

# Database
sudo -u postgres createuser bar_shop_user --pwprompt
sudo -u postgres createdb -O bar_shop_user bar_shop

# Code
git clone <repo> /var/www/bar-shop && cd /var/www/bar-shop

# API
cd backend && cp .env.example .env    # set NODE_ENV=production, DATABASE_URL, JWT_SECRET, CORS_ORIGIN, SMTP_*
npm ci && npx prisma db push && npx prisma db seed   # (or restore a pg_dump of existing data instead of seed)
npm run build && pm2 start dist/index.js --name bar-shop-api

# Web app
cd ../pos && echo 'NEXT_PUBLIC_API_URL=https://api.yourshop.lk' > .env.production
npm ci && npm run build && pm2 start "npm run start -- -p 3001" --name bar-shop-web
pm2 save && pm2 startup
```

**Nginx:** add two sites.
- `pos.yourshop.lk` → `http://127.0.0.1:3001`
- `api.yourshop.lk` → `http://127.0.0.1:5010`, with `client_max_body_size 10m;` for photo uploads.

Then add free SSL certificates:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d pos.yourshop.lk -d api.yourshop.lk
```

**Updating a live system:**

```bash
pg_dump …                                        # 1. back up
git pull                                         # 2. get the new code
# 3. apply any new migration.sql files
cd backend && npm ci && npm run build && pm2 restart bar-shop-api
cd ../pos && npm ci && npm run build && pm2 restart bar-shop-web
```

**Moving data from a local install:** `pg_dump -Fc` locally, copy the file to the server, then `pg_restore` into the empty database instead of seeding. Copy `backend/uploads/` too.

All branches use the same web address. Staff sign in from any browser. The counter works on a PC, laptop or tablet with a USB/Bluetooth barcode scanner and an 80mm receipt printer.

**Counter hardware:**
- An 80mm thermal receipt printer with a **cash drawer port (RJ11)**, and a cash drawer plugged into it. This is the standard setup, e.g. Xprinter XP-80 or Epson TM-T82.
- Use **Google Chrome or Microsoft Edge** at the counter. They can send the "open drawer" signal straight to a USB printer or COM port.
- On Windows, the printer driver option ("open cash drawer when printing") is usually the simplest.
- Set the drawer up once per counter computer: *Open drawer → Drawer setup*.
- A **4G backup router** with automatic failover keeps the counter online when the main line drops. Offline selling covers the rest.

### Live server & CI/CD pipeline

The shop runs on a Hostinger VPS (Ubuntu 24.04), and every push to `main` is checked and deployed automatically.

| | |
|---|---|
| Web app | **https://pos.kodearcs.tech** |
| API | **https://api.pos.kodearcs.tech** (health check: `/health`) |
| Server user | `deploy` (the app runs under this user, with its own Node 20 and PM2) |
| Code on the server | `/home/deploy/bar-shop` (a clone of this repository, branch `main`) |
| PM2 processes | `bar-shop-api` (127.0.0.1:5010), `bar-shop-web` (127.0.0.1:3001), from [`ecosystem.config.cjs`](ecosystem.config.cjs); started on boot (`pm2-deploy` service) |
| Nginx | `/etc/nginx/sites-available/pos.kodearcs.tech.conf` and `api.pos.kodearcs.tech.conf`; HTTPS by Let's Encrypt (renews automatically), HTTP redirects to HTTPS |
| Database | PostgreSQL 16 on the server, database `bar_shop`, user `bar_shop` (its password is only in the server's `backend/.env`) |
| Backups | Taken before every deploy into `/home/deploy/backups`; the last 14 are kept |
| Firewall | Only SSH, HTTP and HTTPS are open; the app ports are private behind Nginx |

**Pipeline** ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)):

1. **Check.** On every push and pull request to `main`, both apps are installed, type-checked and built. A broken build never reaches the server.
2. **Deploy.** On pushes to `main` (or "Run workflow" in the Actions tab), GitHub connects to the server over SSH and runs [`scripts/deploy.sh`](scripts/deploy.sh). The script:
   1. backs up the database
   2. updates the code to `origin/main`
   3. brings the database schema up to date with `prisma db push`, which refuses changes that would lose data
   4. builds the API and the web app
   5. reloads PM2
   6. waits until both answer
3. **Live check.** It opens the two public addresses.

**GitHub secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `VPS_HOST` | the server's IP address |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | the private SSH key whose public key is in `/home/deploy/.ssh/authorized_keys` |

**Everyday use**

- **Deploy:** merge or push to `main`, then watch progress in the repository's **Actions** tab.
- **Deploy by hand:** `ssh deploy@<server> 'bash ~/bar-shop/scripts/deploy.sh main'`
- **Logs:** `ssh deploy@<server>` then `pm2 logs` (or `pm2 logs bar-shop-api --lines 200`); `pm2 ls` shows status.
- **Undo a bad release:** `git revert <commit>` and push to `main`. If data must go back too:

  ```bash
  pg_restore --clean -d "<DATABASE_URL without ?schema>" ~/backups/<file>.dump
  ```

- **Settings on the server:** `~/bar-shop/backend/.env` (then `pm2 reload bar-shop-api --update-env`) and `~/bar-shop/pos/.env.production` (then deploy again, because it's built in).

---

## Project structure

```
backend/
  prisma/schema.prisma          database schema
  prisma/migrations/            SQL for each database change
  prisma/seed.ts                first admin + Main branch
  src/app.ts                    routes (all under /api/pos/*)
  src/modules/
    pos-auth/                   sign-in, staff
    pos-user-management/        counter checkout, loyalty members, sales list, dashboard
    inventory-management/       products, brands, categories, suppliers, restock, bulk price
    returns/                    exchanges, refunds, store damage, damaged stock
    purchase-orders/            purchase orders + supplier email
    goods/                      GRN (goods received) and GTN (branch transfers)
    branches/                   branches, branch stock, working-branch switch
    book/                       shifts / Day End, cash book, period reports, stock movements, cash drawer (no sale)
    settings/                   shop settings, hard-liquor limit
    activity-log/               activity log (who / what / where)
  src/common/utils/mailer.ts    SMTP email (Nodemailer)
ecosystem.config.cjs            PM2 processes for the server
scripts/deploy.sh               server deploy (backup, update, build, reload, health check)
.github/workflows/deploy.yml    CI/CD: check on every push/PR, deploy pushes to main
pos/
  app/dashboard/<page>/         one folder per screen
  app/components/               sidebar, top bar (branch switcher), shared UI
  app/components/OfflineSync.tsx       "bills waiting to upload" badge + automatic upload
  app/components/book/CashDrawerModal.tsx  Open drawer (no sale) + drawer setup
  app/lib/                      prints (receipt, Z, Day End A4, reports, PO, GRN, GTN), roles, hooks
  app/lib/safeCheckout.ts       bill reference, automatic retries, "was it saved?" check
  app/lib/offlineSales.ts       bills sold offline (kept in the browser) and their upload
  app/lib/cashDrawer.ts         drawer kick (USB / COM port / printer driver)
  app/lounge.css                design (dark / light themes)
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Start a shift before selling" | Open a shift in Day End (or from the counter) at that branch |
| "Email isn't set up yet" | Add `SMTP_*` to `backend/.env` and restart the API |
| Email fails with Gmail | Use an **App Password** (2-step verification on), port 465 |
| Pages say "not found" in development | Only run **one** `next dev` for `pos/` at a time; stop others, delete `pos/.next`, and start again |
| Cashier sees another branch's data | Check their branch in Staff & Roles (cashiers must have one) |
| Web app can't reach the API | Check `NEXT_PUBLIC_API_URL` (then rebuild) and `CORS_ORIGIN` |
| After changing `schema.prisma` | Run `npx prisma generate` (and apply the migration SQL) |
| No "Open drawer" button | It shows only while a shift is open, for administrators and cashiers. Start a shift on the Bar Counter |
| The drawer doesn't open | *Open drawer → Drawer setup*: choose how it's connected. Use Chrome or Edge for USB / COM port. On Windows, if USB says the printer is busy, use "Printer opens it when printing" and turn on the drawer option in the printer driver |
| "N bills waiting to upload" stays | The till can't reach the server yet; they upload by themselves every 15 seconds. Click the badge → *Upload now*. Don't clear the browser's data while bills are waiting |
| An offline bill "needs attention" | The server refused it (the reason is shown, e.g. a product was deleted). Fix the cause and press *Upload now*; the bill is never dropped |
| Close shift is greyed out | Bills sold offline on this computer are still waiting to upload |
| "Weak connection · trying again" | The till is retrying; the bill won't be saved twice. If the connection stays down it's saved offline |
| GitHub Actions: "account is locked due to a billing issue" | GitHub → Settings → Billing: pay or clear the amount due and set all budgets to $0 with "stop usage", then re-run the failed job. Or deploy by hand (see *Everyday use*) |
