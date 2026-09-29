# Money and stock — the formulas

Every figure below is already implemented. Keep new work consistent with it, and when you add a new way for money or stock to move, update **every** formula it touches.

## A bill (checkout, `pos-user-management.service.ts → checkoutSale`)

```
gross        = Σ unitPrice × qty
afterEmpties = gross − Σ emptiesReturned × emptyBottlePrice          (priced on the server)
afterDiscount= afterEmpties − discount (PERCENT or AMOUNT; cashier cap %)
total        = afterDiscount − pointsRedeemed × loyaltyPointValue     (totalAmount)
due          = total − walletUsed                                     (≤ wallet balance, ≤ total)
due is paid by: CASH → cashPaid | CARD → cardPaid | BANK_TRANSFER → transferPaid
                SPLIT → card/transfer parts given, cashPaid = the rest
changeDue    = cashTendered − cashPaid
walletCredit = change kept in wallet (≤ changeDue, members only)
changeGiven  = changeDue − walletCredit
pointsEarned = floor(total / loyaltyRupeesPerPoint)  → stored with pointsRate
```

The bill discount and points are shared across the lines by value, and stored as `billDiscount`. So each line's `finalSellingPrice` is its true revenue.

## Cash drawer (per shift = per branch till)

```
expectedCash = openingFloat
             + Σ cashPaid            (cash part of every bill)
             + Σ walletCredit        (change kept in wallets stayed in the drawer)
             + drawer cash-in entries − drawer cash-out entries (not voided)
             − Σ cash refunds        (returns paid back in cash)
```

This is used in `drawerCash()` (to stop paying out more than the drawer holds) and in `summarizeShift().cash.expectedCash`. At close, the difference is counted cash minus expected; anything not zero needs a reason. Cash banked is counted cash minus the float left.

## Sales totals

```
netSales        = Σ cashPaid + Σ cardPaid + Σ transferPaid + Σ walletUsed
grossSales      = netSales + empties deduction + discounts + points value
refunds         = Σ REFUND refundAmount (cash + wallet)
netAfterReturns = netSales − refunds
```

- `walletUsed` counts as sales but not as new money today. It was received on an earlier bill.
- Card is checked against the card machine settlement slip at close, and the card difference needs a reason.
- Transfer/QR payments are listed so they can be ticked off in the bank app.

## Hard liquor vs other

`sales.byType`, in both the Day End and the period report, splits units and amounts using the **bill line's** `isHardLiquor`. That mark is set from the product at the time of sale, and the product's current mark is never used. Amounts are nulled in the blind view.

## Stock book (per product, per shift, at the shift's branch)

```
closing  = the branch's shelf quantity now
opening  = closing − received − adjusted − returned − transferIn + sold + damaged + transferOut
received = RECEIVED + OPENING        (GRN / restock / new product)
sold     = −SOLD
returned = CUSTOMER_RETURN + RESTORED
damaged  = −(EXCHANGED + DAMAGED)
transferIn / transferOut = TRANSFER_IN / −TRANSFER_OUT
adjusted = everything else on STOCK (corrections in Product Setup)
```

The `DAMAGED` kind (IN/CLEARED) and the `EMPTIES` kind (COLLECTED/RETURNED/ADJUSTED) have their own small books: added, cleared or returned, and on hand. If you add a new movement type, give it its own column or bucket rather than letting it fall into "adjusted", and update the period report too.

## Period report profit (`period-report.service.ts`)

```
costOfSales   = Σ line qty × current unit cost − cost of bottles returned to the shelf
grossProfit   = netSales − refunds − costOfSales
damageLoss    = cost of (EXCHANGE + STORE_DAMAGE) − cost of damaged put back on the shelf
netProfit     = grossProfit − running expenses − damageLoss + other income (not owner cash-in)
```

- Running expenses exclude stock purchases and staff advances (`NOT_OPERATING`).
- Points held and wallet money held are owed to members. They're shown as liabilities, and are company-wide because members are shared across branches.

## Returns

- **Refund per bottle** is `min(listPrice, (line finalSellingPrice + emptyDeduction) / qty)`. So it's what the customer paid after the discount, and the empties credit isn't taken off.
- **The total** for a bill is capped at what's still refundable (`totalAmount − refunded so far`).
- **Points taken back** is `min(floor(refund / bill pointsRate), earned − already reversed, current balance)`.
- **Totals and the wallet:**
  - `totalSpent` goes down by the refund.
  - A wallet refund adds a REFUND wallet transaction.
  - A cash refund needs an open shift and enough cash in the drawer.

## Branch transfers (GTN)

- **When it's sent**, stock comes off the sender's shelf (TRANSFER_OUT) and is in transit. The company total drops until the transfer is received.
- **When it's received:**
  - Good bottles go onto the receiver's shelf (TRANSFER_IN).
  - Damaged bottles go into the receiver's damaged stock (DAMAGED IN).
  - Missing bottles are only recorded, with a note, and are lost.
- **When it's cancelled**, the stock goes back to the sender (TRANSFER_IN with a "cancelled" reference).

## Goods received (GRN)

- Accepted = delivered − rejected. Only accepted bottles are restocked at the GRN's branch, with the cost blended as a weighted average over the company stock.
- Against a purchase order, accepted counts toward `receivedQty`. Rejected bottles stay "still due".
- Invoice difference = invoice total − value accepted. It's shown as a warning to check before paying.

## Cash book banking

- Closing a shift writes automatic receipts:
  - SHIFT_TAKINGS, held in SAFE, with status PENDING.
  - CARD_SETTLEMENT, held in CARD, with status PENDING.
  - TRANSFER_SALES.
- They stay "waiting to be banked" until someone marks them as banked with a deposit reference. Only then does the source become BANK.

## Blind view (cashier before counting)

These are set to null: cash sales, wallet kept, expected cash, drawer in and out, cash refunds, net and gross sales, bill totals, cash parts of split bills, discount amounts, and wallet CREDIT amounts. Card and QR amounts and counts stay visible.
