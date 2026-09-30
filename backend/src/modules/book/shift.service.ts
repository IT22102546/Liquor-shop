import { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";
import { EXPENSE_CATEGORIES, HOLDING_SOURCE, INCOME_CATEGORIES, SOURCE_LABELS } from "./cash-book.service";
import { findOpenShift } from "./stock-movements";
import { mainBranch } from "../branches/branch-context";
import { forBranch } from "../branches/branch-stock";
import { shiftDrawerOpens } from "./drawer.service";
import { DISPOSAL_LABELS as RETURN_DISPOSAL_LABELS, TYPE_LABELS as RETURN_TYPE_LABELS } from "../returns/returns.service";

/** Sri Lankan notes and coins counted at the till. */
export const DENOMINATIONS = [5000, 2000, 1000, 500, 100, 50, 20, 10, 5, 2, 1] as const;

const round2 = (value: number) => Math.round(value * 100) / 100;
const PAYMENT_LABELS: Record<string, string> = { CASH: "Cash", CARD: "Card", BANK_TRANSFER: "Transfer / QR", CHEQUE: "Cheque", SPLIT: "Split" };
/** The amount paid each way. Card = card machine; transfer = bank transfer / QR / cheque (checked in the bank). */
type Paid = { cashPaid: number; cardPaid: number; transferPaid: number; walletUsed: number; walletCredit: number; paymentMethod: string };
/**
 * How a bill was paid, e.g. "Split: cash 1,000 + card 2,650", "Wallet 500 + cash 320",
 * with "· 80 change to wallet" when the member kept change.
 */
const paymentLabel = (sale: Paid) => {
  const kept = sale.walletCredit > 0 ? ` · ${sale.walletCredit.toLocaleString("en-LK")} change to wallet` : "";
  if (sale.walletUsed > 0) {
    const rest = [
      sale.cashPaid > 0 ? `cash ${sale.cashPaid.toLocaleString("en-LK")}` : "",
      sale.cardPaid > 0 ? `card ${sale.cardPaid.toLocaleString("en-LK")}` : "",
      sale.transferPaid > 0 ? `QR ${sale.transferPaid.toLocaleString("en-LK")}` : "",
    ].filter(Boolean);
    return `Wallet ${sale.walletUsed.toLocaleString("en-LK")}${rest.length ? ` + ${rest.join(" + ")}` : ""}${kept}`;
  }
  if (sale.paymentMethod !== "SPLIT") return `${PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod}${kept}`;
  const parts = [
    sale.cashPaid > 0 ? `cash ${sale.cashPaid.toLocaleString("en-LK")}` : "",
    sale.cardPaid > 0 ? `card ${sale.cardPaid.toLocaleString("en-LK")}` : "",
    sale.transferPaid > 0 ? `QR ${sale.transferPaid.toLocaleString("en-LK")}` : "",
  ].filter(Boolean);
  return `Split: ${parts.join(" + ")}${kept}`;
};

async function staffNames(ids: Array<number | null | undefined>) {
  const unique = [...new Set(ids.filter((id): id is number => Boolean(id)))];
  const staff = await prisma.posAdmin.findMany({ where: { id: { in: unique } }, select: { id: true, name: true, role: true } });
  return new Map(staff.map((member) => [member.id, member]));
}

/**
 * Everything the Z report needs for one shift: every bill with who made it, totals by payment and by
 * staff member, discounts, points, empties, drawer cash in/out, expected cash and the stock day book.
 */
export async function summarizeShift(shiftId: number) {
  const shift = await prisma.posShift.findUnique({ where: { id: shiftId } });
  if (!shift) throw AppError.notFound("Shift not found");

  const branch = shift.branchId ? await prisma.branch.findUnique({ where: { id: shift.branchId } }) : await mainBranch();
  if (!branch) throw AppError.notFound("Branch not found");
  const [sales, entries, movements, allProducts, noSaleOpens] = await Promise.all([
    prisma.posCounterSale.findMany({
      where: { shiftId },
      orderBy: { createdAt: "asc" },
      include: { cashier: { select: { id: true, name: true, role: true } }, customer: { select: { firstName: true, lastName: true } } },
    }),
    prisma.posCashEntry.findMany({ where: { shiftId }, orderBy: { entryDate: "asc" } }),
    prisma.inventoryMovement.findMany({ where: { shiftId } }),
    prisma.inventoryProduct.findMany({
      select: { id: true, name: true, compatibleWith: true, quantity: true, emptyBottlesOnHand: true, damagedQuantity: true, sellingPrice: true, brand: { select: { name: true } }, category: { select: { name: true } } },
      orderBy: [{ categoryId: "asc" }, { name: "asc" }],
    }),
    shiftDrawerOpens(shiftId),
  ]);
  // Stock as this branch holds it (closing = its shelf count now).
  const products = await forBranch(branch.id, allProducts);
  const lines = await prisma.posCustomerPurchase.findMany({
    where: { invoiceGroupCode: { in: sales.map((sale) => sale.invoiceGroupCode) } },
    select: { invoiceGroupCode: true, quantity: true, finalSellingPrice: true, billDiscount: true, isHardLiquor: true, inventoryProduct: { select: { id: true, name: true } } },
  });
  const staff = await staffNames([shift.openedById, shift.countedById, shift.closedById, ...entries.map((entry) => entry.createdById), ...entries.map((entry) => entry.voidedById)]);

  // ── Sales ──
  const bills = sales.map((sale) => {
    const items = lines.filter((line) => line.invoiceGroupCode === sale.invoiceGroupCode);
    return {
      billNo: sale.invoiceGroupCode,
      time: sale.createdAt,
      cashier: sale.cashier.name,
      customer: sale.customer ? [sale.customer.firstName, sale.customer.lastName].filter(Boolean).join(" ") : "Walk-in",
      payment: paymentLabel(sale),
      reference: sale.paymentReference,
      items: items.map((line) => `${line.quantity} × ${line.inventoryProduct?.name ?? "Item"}`).join(", "),
      units: items.reduce((sum, line) => sum + line.quantity, 0),
      emptyDeduction: sale.emptyDeduction,
      discount: round2(sale.discountAmount + sale.pointsValue),
      discountAmount: sale.discountAmount,
      pointsValue: sale.pointsValue,
      total: sale.totalAmount,
      /** Rung up while the till had no connection, uploaded later. */
      offline: sale.soldOffline,
    };
  });

  // ── Discounts & loyalty: every bill where money was taken off or points moved, with who did it ──
  const memberName = (sale: (typeof sales)[number]) => (sale.customer ? [sale.customer.firstName, sale.customer.lastName].filter(Boolean).join(" ") : null);
  const adjustments = sales
    .filter((sale) => sale.discountAmount > 0 || sale.pointsRedeemed > 0 || sale.pointsEarned > 0)
    .map((sale) => ({
      billNo: sale.invoiceGroupCode,
      time: sale.createdAt,
      cashier: sale.cashier.name,
      member: memberName(sale),
      billBefore: round2(sale.totalAmount + sale.discountAmount + sale.pointsValue),
      discountType: sale.discountType,
      discountValue: sale.discountValue,
      discountAmount: sale.discountAmount,
      pointsRedeemed: sale.pointsRedeemed,
      pointsValue: sale.pointsValue,
      pointsEarned: sale.pointsEarned,
      total: sale.totalAmount,
    }));
  const discountByStaff = new Map<string, { name: string; bills: number; amount: number }>();
  sales.filter((sale) => sale.discountAmount > 0).forEach((sale) => {
    const row = discountByStaff.get(sale.cashier.name) ?? { name: sale.cashier.name, bills: 0, amount: 0 };
    row.bills += 1;
    row.amount = round2(row.amount + sale.discountAmount);
    discountByStaff.set(sale.cashier.name, row);
  });
  const loyalty = {
    memberBills: sales.filter((sale) => sale.customerId != null).length,
    discountBills: sales.filter((sale) => sale.discountAmount > 0).length,
    discountByStaff: [...discountByStaff.values()].sort((a, b) => b.amount - a.amount),
    pointsEarned: sales.reduce((sum, sale) => sum + sale.pointsEarned, 0),
    redeemBills: sales.filter((sale) => sale.pointsRedeemed > 0).length,
    rows: adjustments,
  };
  // Amounts actually paid each way (a split bill adds to more than one).
  const cashSales = round2(sales.reduce((sum, sale) => sum + sale.cashPaid, 0));
  const cardSales = round2(sales.reduce((sum, sale) => sum + sale.cardPaid, 0));
  const transferSales = round2(sales.reduce((sum, sale) => sum + sale.transferPaid, 0));
  // Wallet: bill parts paid from members' wallets (received on earlier bills) and change they kept today.
  const walletUsedTotal = round2(sales.reduce((sum, sale) => sum + sale.walletUsed, 0));
  const walletKept = round2(sales.reduce((sum, sale) => sum + sale.walletCredit, 0));
  const netSales = round2(cashSales + cardSales + transferSales + walletUsedTotal);
  // Non-cash payments are recorded automatically at the till; listed so they can be ticked off
  // against the card machine settlement slip and the bank app. A split bill lists only its card / QR part.
  const paymentList = (kind: "card" | "transfer") => sales
    .filter((sale) => (kind === "card" ? sale.cardPaid : sale.transferPaid) > 0)
    .map((sale) => ({
      billNo: sale.invoiceGroupCode, time: sale.createdAt, cashier: sale.cashier.name,
      amount: kind === "card" ? sale.cardPaid : sale.transferPaid,
      reference: sale.paymentReference,
      method: sale.paymentMethod === "SPLIT" ? `Split (of ${sale.totalAmount.toLocaleString("en-LK")})` : PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod,
    }));
  const cardPayments = paymentList("card");
  const transferPayments = paymentList("transfer");
  const emptyDeduction = round2(sales.reduce((sum, sale) => sum + sale.emptyDeduction, 0));
  const discounts = round2(sales.reduce((sum, sale) => sum + sale.discountAmount, 0));
  const pointsValue = round2(sales.reduce((sum, sale) => sum + sale.pointsValue, 0));
  const pointsRedeemed = sales.reduce((sum, sale) => sum + sale.pointsRedeemed, 0);
  const grossSales = round2(netSales + emptyDeduction + discounts + pointsValue);

  const byStaffMap = new Map<string, { name: string; bills: number; cash: number; card: number; transfer: number; wallet: number; total: number }>();
  sales.forEach((sale) => {
    const entry = byStaffMap.get(sale.cashier.name) ?? { name: sale.cashier.name, bills: 0, cash: 0, card: 0, transfer: 0, wallet: 0, total: 0 };
    entry.bills += 1;
    entry.wallet = round2(entry.wallet + sale.walletUsed);
    entry.total = round2(entry.total + sale.totalAmount);
    entry.cash = round2(entry.cash + sale.cashPaid);
    entry.card = round2(entry.card + sale.cardPaid);
    entry.transfer = round2(entry.transfer + sale.transferPaid);
    byStaffMap.set(sale.cashier.name, entry);
  });

  const byProductMap = new Map<number, { name: string; units: number; amount: number }>();
  lines.forEach((line) => {
    if (!line.inventoryProduct) return;
    const entry = byProductMap.get(line.inventoryProduct.id) ?? { name: line.inventoryProduct.name, units: 0, amount: 0 };
    entry.units += line.quantity;
    entry.amount = round2(entry.amount + line.finalSellingPrice);
    byProductMap.set(line.inventoryProduct.id, entry);
  });

  // ── Cash book (drawer in/out and bank/owner entries made during the shift) ──
  const cashEntries = entries.map((entry) => ({
    entryNo: entry.entryNo,
    direction: entry.direction,
    category: (entry.direction === "OUT" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES)[entry.category] ?? entry.category,
    source: SOURCE_LABELS[entry.source] ?? entry.source,
    fromDrawer: entry.source === "DRAWER",
    amount: entry.amount,
    party: entry.party,
    note: entry.note,
    reference: entry.reference,
    time: entry.entryDate,
    recordedBy: staff.get(entry.createdById)?.name ?? "—",
    voided: entry.voided,
    voidReason: entry.voidReason,
    voidedBy: entry.voidedById ? staff.get(entry.voidedById)?.name ?? "—" : null,
    automatic: entry.automatic,
  }));
  const live = cashEntries.filter((entry) => !entry.voided && !entry.automatic);
  const drawerIn = round2(live.filter((entry) => entry.fromDrawer && entry.direction === "IN").reduce((sum, entry) => sum + entry.amount, 0));
  const drawerOut = round2(live.filter((entry) => entry.fromDrawer && entry.direction === "OUT").reduce((sum, entry) => sum + entry.amount, 0));
  const expensesAll = round2(live.filter((entry) => entry.direction === "OUT").reduce((sum, entry) => sum + entry.amount, 0));
  // ── Returns & damages: exchanges, refunds, store damage and damaged stock cleared during the shift ──
  const returnRows = await prisma.posReturn.findMany({ where: { shiftId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const returnStaff = await staffNames(returnRows.map((row) => row.createdById));
  const refundRows = returnRows.filter((row) => row.type === "REFUND");
  const refundsCash = round2(refundRows.filter((row) => row.refundMethod === "CASH").reduce((sum, row) => sum + row.refundAmount, 0));
  const refundsWallet = round2(refundRows.filter((row) => row.refundMethod === "WALLET").reduce((sum, row) => sum + row.refundAmount, 0));
  const unitsOf = (type: string) => returnRows.filter((row) => row.type === type).reduce((sum, row) => sum + row.quantity, 0);
  const returns = {
    refunds: new Set(refundRows.map((row) => row.returnNo)).size,
    refundUnits: unitsOf("REFUND"),
    refundsCash,
    refundsWallet,
    refundsTotal: round2(refundsCash + refundsWallet),
    pointsReversed: refundRows.reduce((sum, row) => sum + row.pointsReversed, 0),
    exchangedUnits: unitsOf("EXCHANGE"),
    storeDamagedUnits: unitsOf("STORE_DAMAGE"),
    clearedUnits: unitsOf("DAMAGE_CLEARED"),
    // Cost of bottles that became damaged this shift (exchanged, found damaged, or returned damaged).
    damageCost: round2(returnRows
      .filter((row) => row.type === "EXCHANGE" || row.type === "STORE_DAMAGE" || (row.type === "REFUND" && row.condition === "DAMAGED"))
      .reduce((sum, row) => sum + (row.unitCost ?? 0) * row.quantity, 0)),
    rows: returnRows.map((row) => ({
      returnNo: row.returnNo,
      time: row.createdAt,
      type: row.type,
      what: RETURN_TYPE_LABELS[row.type] ?? row.type,
      product: row.productName,
      quantity: row.quantity,
      condition: row.condition,
      disposal: row.disposal ? RETURN_DISPOSAL_LABELS[row.disposal] ?? row.disposal : null,
      billNo: row.invoiceGroupCode,
      customer: row.customerName,
      refund: row.refundAmount,
      refundMethod: row.refundMethod,
      pointsReversed: row.pointsReversed,
      reason: row.reason,
      note: row.note,
      reference: row.reference,
      by: returnStaff.get(row.createdById)?.name ?? "—",
    })),
  };

  // Change kept in wallets stayed in the drawer, so it is expected there too; cash refunds came out of it.
  const expectedCash = round2(shift.openingFloat + cashSales + walletKept + drawerIn - drawerOut - refundsCash);

  // ── Stock day book: opening + received ± adjusted − sold = closing (per product) ──
  const stockMoves = new Map<number, { received: number; sold: number; adjusted: number; opening: number; returned: number; damaged: number; transferIn: number; transferOut: number }>();
  const emptyMoves = new Map<number, { collected: number; returned: number }>();
  const damagedMoves = new Map<number, { added: number; cleared: number }>();
  movements.forEach((movement) => {
    if (movement.kind === "STOCK") {
      const entry = stockMoves.get(movement.productId) ?? { received: 0, sold: 0, adjusted: 0, opening: 0, returned: 0, damaged: 0, transferIn: 0, transferOut: 0 };
      if (movement.type === "RECEIVED") entry.received += movement.quantity;
      // Between branches (GTN): in from another branch / out to another branch.
      else if (movement.type === "TRANSFER_IN") entry.transferIn += movement.quantity;
      else if (movement.type === "TRANSFER_OUT") entry.transferOut += -movement.quantity;
      else if (movement.type === "SOLD") entry.sold += -movement.quantity;
      else if (movement.type === "OPENING") entry.opening += movement.quantity;
      // Back on the shelf: unopened bottles returned by customers, or damaged ones put back.
      else if (movement.type === "CUSTOMER_RETURN" || movement.type === "RESTORED") entry.returned += movement.quantity;
      // Off the shelf into damaged stock: new bottles given in exchange, or damage found in the store.
      else if (movement.type === "EXCHANGED" || movement.type === "DAMAGED") entry.damaged += -movement.quantity;
      else entry.adjusted += movement.quantity;
      stockMoves.set(movement.productId, entry);
    } else if (movement.kind === "DAMAGED") {
      const entry = damagedMoves.get(movement.productId) ?? { added: 0, cleared: 0 };
      if (movement.quantity > 0) entry.added += movement.quantity;
      else entry.cleared += -movement.quantity;
      damagedMoves.set(movement.productId, entry);
    } else {
      const entry = emptyMoves.get(movement.productId) ?? { collected: 0, returned: 0 };
      if (movement.type === "COLLECTED") entry.collected += movement.quantity;
      if (movement.type === "RETURNED") entry.returned += -movement.quantity;
      emptyMoves.set(movement.productId, entry);
    }
  });
  const stockBook = products.map((product) => {
    const moves = stockMoves.get(product.id) ?? { received: 0, sold: 0, adjusted: 0, opening: 0, returned: 0, damaged: 0, transferIn: 0, transferOut: 0 };
    const closing = product.quantity;
    // New products added during the shift count their opening stock as "received" today.
    const received = moves.received + moves.opening;
    const opening = closing - received - moves.adjusted - moves.returned - moves.transferIn + moves.sold + moves.damaged + moves.transferOut;
    return {
      productId: product.id,
      name: product.name,
      size: product.compatibleWith,
      brand: product.brand.name,
      category: product.category.name,
      opening,
      received,
      sold: moves.sold,
      returned: moves.returned,
      damaged: moves.damaged,
      transferIn: moves.transferIn,
      transferOut: moves.transferOut,
      adjusted: moves.adjusted,
      closing,
    };
  });
  // Damaged bottles kept aside: added this shift, cleared this shift, and on hand now.
  const damagedStock = products
    .map((product) => {
      const moves = damagedMoves.get(product.id) ?? { added: 0, cleared: 0 };
      return { name: [product.name, product.compatibleWith].filter(Boolean).join(" · "), added: moves.added, cleared: moves.cleared, onHand: product.damagedQuantity };
    })
    .filter((row) => row.added || row.cleared || row.onHand);
  const empties = products
    .map((product) => {
      const moves = emptyMoves.get(product.id) ?? { collected: 0, returned: 0 };
      return { name: product.name, collected: moves.collected, returned: moves.returned, onHand: product.emptyBottlesOnHand };
    })
    .filter((row) => row.collected || row.returned || row.onHand);

  // ── Payments: how the takings came in, with every split bill spelled out ──
  const splitSales = sales.filter((sale) => sale.paymentMethod === "SPLIT");
  const payments = {
    rows: [
      { method: "Cash", bills: sales.filter((sale) => sale.paymentMethod === "CASH").length, amount: round2(sales.filter((sale) => sale.paymentMethod === "CASH").reduce((sum, sale) => sum + sale.totalAmount, 0)) },
      { method: "Card", bills: sales.filter((sale) => sale.paymentMethod === "CARD").length, amount: round2(sales.filter((sale) => sale.paymentMethod === "CARD").reduce((sum, sale) => sum + sale.totalAmount, 0)) },
      { method: "Transfer / QR", bills: sales.filter((sale) => sale.paymentMethod === "BANK_TRANSFER" || sale.paymentMethod === "CHEQUE").length, amount: round2(sales.filter((sale) => sale.paymentMethod === "BANK_TRANSFER" || sale.paymentMethod === "CHEQUE").reduce((sum, sale) => sum + sale.totalAmount, 0)) },
      { method: "Split (cash + card / QR)", bills: splitSales.length, amount: round2(splitSales.reduce((sum, sale) => sum + sale.totalAmount, 0)) },
    ],
    /** Wallet part of bills (paid with money kept on earlier bills — not new money today). */
    wallet: { bills: sales.filter((sale) => sale.walletUsed > 0).length, amount: walletUsedTotal },
    splitBills: splitSales.map((sale) => ({
      billNo: sale.invoiceGroupCode, time: sale.createdAt, cashier: sale.cashier.name,
      total: sale.totalAmount, cash: sale.cashPaid, card: sale.cardPaid, transfer: sale.transferPaid,
      reference: sale.paymentReference, change: sale.changeGiven,
    })),
    changeGiven: round2(sales.reduce((sum, sale) => sum + sale.changeGiven, 0)),
  };

  // ── Customer wallets: change kept and wallet money spent during the shift, member by member ──
  const walletRows = await prisma.posWalletTransaction.findMany({
    where: { shiftId },
    orderBy: { createdAt: "asc" },
    include: { customer: { select: { firstName: true, lastName: true, mobileNumber: true } } },
  });
  const walletStaff = await staffNames(walletRows.map((row) => row.createdById));
  const wallet = {
    kept: walletKept,
    used: walletUsedTotal,
    /** Money put in members' wallets as refunds for returned bottles. */
    refunded: refundsWallet,
    rows: walletRows.map((row) => ({
      time: row.createdAt,
      member: [row.customer.firstName, row.customer.lastName].filter(Boolean).join(" "),
      mobile: row.customer.mobileNumber,
      type: row.type,
      amount: row.amount,
      balanceAfter: row.balanceAfter,
      billNo: row.invoiceGroupCode,
      by: walletStaff.get(row.createdById)?.name ?? "—",
    })),
  };

  // ── Stock in & changes: every stock movement other than sales, with where it came from and who did it ──
  const productNames = new Map(products.map((product) => [product.id, [product.name, product.compatibleWith].filter(Boolean).join(" · ")]));
  const moverNames = await staffNames(movements.map((movement) => movement.createdById));
  const MOVE_LABELS: Record<string, string> = {
    "STOCK:OPENING": "New product (opening stock)", "STOCK:RECEIVED": "Stock received", "STOCK:ADJUSTED": "Stock corrected",
    "EMPTIES:RETURNED": "Empties returned to supplier", "EMPTIES:ADJUSTED": "Empties corrected",
    "STOCK:CUSTOMER_RETURN": "Returned by customer (back on shelf)", "STOCK:EXCHANGED": "New bottle given for a damaged one",
    "STOCK:DAMAGED": "Found damaged in store", "STOCK:RESTORED": "Damaged stock put back on shelf",
    "DAMAGED:IN": "Into damaged stock", "DAMAGED:CLEARED": "Damaged stock cleared",
    "STOCK:TRANSFER_IN": "Received from another branch (GTN)", "STOCK:TRANSFER_OUT": "Sent to another branch (GTN)",
  };
  const stockLog = movements
    .filter((movement) => !(movement.kind === "STOCK" && movement.type === "SOLD") && !(movement.kind === "EMPTIES" && movement.type === "COLLECTED"))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((movement) => ({
      time: movement.createdAt,
      product: productNames.get(movement.productId) ?? "Deleted product",
      what: MOVE_LABELS[`${movement.kind}:${movement.type}`] ?? `${movement.kind} ${movement.type}`,
      quantity: movement.quantity,
      reference: movement.reference,
      by: movement.createdById ? moverNames.get(movement.createdById)?.name ?? "—" : "—",
    }));

  // ── Goods received (GRN) and branch transfers (GTN) during the shift ──
  const [grnRows, gtnOut, gtnIn] = await Promise.all([
    prisma.grn.findMany({ where: { shiftId }, orderBy: { createdAt: "asc" }, include: { items: { select: { description: true, acceptedQty: true, rejectedQty: true, rejectReason: true, freeQty: true } } } }),
    prisma.gtn.findMany({ where: { sentShiftId: shiftId }, orderBy: { sentAt: "asc" }, include: { toBranch: { select: { name: true } }, items: { select: { productName: true, sentQty: true } } } }),
    prisma.gtn.findMany({ where: { receivedShiftId: shiftId }, orderBy: { receivedAt: "asc" }, include: { fromBranch: { select: { name: true } }, items: { select: { productName: true, sentQty: true, receivedQty: true, damagedQty: true, missingQty: true } } } }),
  ]);
  const goodsStaff = await staffNames([...grnRows.map((row) => row.receivedById), ...gtnOut.map((row) => row.sentById), ...gtnIn.map((row) => row.receivedById)]);
  const goods = {
    grns: grnRows.map((row) => ({
      grnNo: row.grnNo, time: row.createdAt, supplier: row.supplierName, poNumber: row.poNumber, invoiceNo: row.supplierInvoiceNo,
      invoiceTotal: row.invoiceTotal, totalCost: row.totalCost, accepted: row.acceptedUnits, rejected: row.rejectedUnits,
      free: row.freeUnits, freeValue: row.freeValue,
      items: row.items.map((item) => `${item.acceptedQty}${item.freeQty ? ` + ${item.freeQty} free` : ""} × ${item.description}${item.rejectedQty ? ` (${item.rejectedQty} rejected: ${item.rejectReason ?? ""})` : ""}`).join(", "),
      by: goodsStaff.get(row.receivedById)?.name ?? "—",
    })),
    sent: gtnOut.map((row) => ({
      gtnNo: row.gtnNo, time: row.sentAt, branch: row.toBranch.name, status: row.status, units: row.items.reduce((sum, item) => sum + item.sentQty, 0),
      items: row.items.map((item) => `${item.sentQty} × ${item.productName}`).join(", "), by: goodsStaff.get(row.sentById)?.name ?? "—",
    })),
    received: gtnIn.map((row) => ({
      gtnNo: row.gtnNo, time: row.receivedAt ?? row.sentAt, branch: row.fromBranch.name, units: row.items.reduce((sum, item) => sum + (item.receivedQty ?? 0), 0),
      damaged: row.items.reduce((sum, item) => sum + item.damagedQty, 0), missing: row.items.reduce((sum, item) => sum + item.missingQty, 0),
      items: row.items.map((item) => `${item.receivedQty ?? 0}/${item.sentQty} × ${item.productName}`).join(", "), note: row.receiveNote,
      by: row.receivedById ? goodsStaff.get(row.receivedById)?.name ?? "—" : "—",
    })),
  };

  // ── Shift journal: everything else done while the shift was open (prices, purchase orders, settings, sign-ins…) ──
  // Sales and cash book entries are already listed above, so they're left out here.
  const journalRows = await prisma.activityLog.findMany({
    where: {
      createdAt: { gte: shift.openedAt, lte: shift.closedAt ?? new Date() },
      // This branch's actions, plus company-wide ones (prices, settings…) made meanwhile.
      OR: [{ branchId: shift.branchId }, { branchId: null }],
      NOT: [{ action: "sale.checkout" }, { category: "CASHBOOK" }, { category: "RETURN" }, { category: "GOODS" }],
    },
    orderBy: { createdAt: "asc" },
    take: 300,
    select: { createdAt: true, actorName: true, actorRole: true, category: true, summary: true },
  });
  const journal = journalRows.map((row) => ({ time: row.createdAt, by: row.actorName ?? "—", category: row.category, summary: row.summary }));

  return {
    shift: {
      id: shift.id,
      shiftNo: shift.shiftNo,
      branch: { id: branch.id, code: branch.code, name: branch.name, address: branch.address, phone: branch.phone },
      status: shift.status,
      openedAt: shift.openedAt,
      openedBy: staff.get(shift.openedById)?.name ?? "—",
      openingFloat: shift.openingFloat,
      countedAt: shift.countedAt,
      countedBy: shift.countedById ? staff.get(shift.countedById)?.name ?? "—" : null,
      closedAt: shift.closedAt,
      closedBy: shift.closedById ? staff.get(shift.closedById)?.name ?? "—" : null,
    },
    sales: {
      bills: sales.length,
      units: bills.reduce((sum, bill) => sum + bill.units, 0),
      grossSales,
      emptyDeduction,
      emptiesReturned: sales.reduce((sum, sale) => sum + sale.emptiesReturned, 0),
      discounts,
      pointsRedeemed,
      pointsValue,
      netSales,
      cashSales,
      cardSales,
      transferSales,
      walletUsed: walletUsedTotal,
      walletKept,
      /** Paid back for returned bottles (cash + wallet), and net sales after that. */
      refunds: returns.refundsTotal,
      netAfterReturns: round2(netSales - returns.refundsTotal),
      cardPayments,
      transferPayments,
      loyalty,
      byStaff: [...byStaffMap.values()].sort((a, b) => b.total - a.total),
      byProduct: [...byProductMap.values()].sort((a, b) => b.amount - a.amount),
      /** Hard liquor (ticked on the product; counts toward the bill limit) vs everything else. */
      byType: {
        hardLiquor: { units: lines.filter((line) => line.isHardLiquor).reduce((sum, line) => sum + line.quantity, 0), amount: round2(lines.filter((line) => line.isHardLiquor).reduce((sum, line) => sum + line.finalSellingPrice, 0)) },
        other: { units: lines.filter((line) => !line.isHardLiquor).reduce((sum, line) => sum + line.quantity, 0), amount: round2(lines.filter((line) => !line.isHardLiquor).reduce((sum, line) => sum + line.finalSellingPrice, 0)) },
      },
      billList: bills,
      /** Bills rung up while the till was offline and uploaded later. */
      offlineBills: sales.filter((sale) => sale.soldOffline).length,
    },
    cash: {
      openingFloat: shift.openingFloat,
      cashSales,
      walletKept,
      drawerIn,
      drawerOut,
      refundsCash,
      expectedCash,
      expensesAll,
      entries: cashEntries,
    },
    stockBook,
    empties,
    payments,
    wallet,
    returns,
    damagedStock,
    goods,
    /** How often the cash drawer opened: once per bill with cash, plus every "no sale" open (with its reason). */
    drawer: {
      cashBills: sales.filter((sale) => sale.cashPaid > 0).length,
      noSaleCount: noSaleOpens.length,
      noSale: noSaleOpens,
    },
    stockLog,
    journal,
  };
}

export type ShiftSummary = Awaited<ReturnType<typeof summarizeShift>>;

async function nextShiftNo(db: Prisma.TransactionClient) {
  const count = await db.posShift.count();
  return `SH-${String(count + 1).padStart(5, "0")}`;
}

export async function getCurrentShift(branchId: number) {
  const open = await findOpenShift(prisma, branchId);
  const lastClosed = await prisma.posShift.findFirst({ where: { status: "CLOSED", branchId }, orderBy: { closedAt: "desc" }, select: { floatLeft: true, shiftNo: true, closedAt: true } });
  return { open: open ? { id: open.id, shiftNo: open.shiftNo, openedAt: open.openedAt, openingFloat: open.openingFloat, counted: open.countedAt != null } : null, suggestedFloat: lastClosed?.floatLeft ?? 0, lastClosed };
}

export async function openShift(openingFloat: number, actorId: number, branchId: number) {
  return prisma.$transaction(async (tx) => {
    // One open till per branch; the advisory lock stops two tills opening at once.
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(740303)");
    const open = await findOpenShift(tx, branchId);
    if (open) throw new AppError(`Shift ${open.shiftNo} is already open at this branch — close it first`, 409);
    return tx.posShift.create({ data: { shiftNo: await nextShiftNo(tx), openedById: actorId, openingFloat: round2(openingFloat), branchId } });
  });
}

/**
 * Blind count: the counted cash is saved first; only then is the expected amount returned.
 * A recount is allowed while the shift is open — the first count is kept in the history.
 */
export async function countShift(shiftId: number, counts: Record<string, number>, actorId: number) {
  const shift = await prisma.posShift.findUnique({ where: { id: shiftId } });
  if (!shift) throw AppError.notFound("Shift not found");
  if (shift.status !== "OPEN") throw new AppError("This shift is already closed", 400);

  const clean: Record<string, number> = {};
  DENOMINATIONS.forEach((note) => {
    const quantity = Math.max(0, Math.floor(Number(counts[String(note)] ?? 0)));
    if (quantity) clean[String(note)] = quantity;
  });
  const counted = round2(DENOMINATIONS.reduce((sum, note) => sum + note * (clean[String(note)] ?? 0), 0));
  const summary = await summarizeShift(shiftId);
  const previous = (shift.denominations && typeof shift.denominations === "object" ? shift.denominations : {}) as { history?: unknown[] };
  const history = [...(Array.isArray(previous.history) ? previous.history : []), { total: counted, at: new Date().toISOString(), byId: actorId }];

  await prisma.posShift.update({
    where: { id: shiftId },
    data: {
      countedCash: counted,
      denominations: { counts: clean, history } as Prisma.InputJsonValue,
      countedById: actorId,
      countedAt: new Date(),
      expectedCash: summary.cash.expectedCash,
      cashDifference: round2(counted - summary.cash.expectedCash),
    },
  });
  return {
    countedCash: counted,
    expectedCash: summary.cash.expectedCash,
    difference: round2(counted - summary.cash.expectedCash),
    cardSales: summary.sales.cardSales,
    transferSales: summary.sales.transferSales,
    recounts: history.length - 1,
  };
}

export type CloseShiftDto = {
  floatLeft: number;
  differenceReason?: string;
  cardSlipTotal?: number;
  /** Required when the settlement slip doesn't match; also used for "not settled yet". */
  cardDifferenceReason?: string;
  notes?: string;
  stockCounts?: Array<{ productId: number; counted: number }>;
};

/** Locks the shift: records takings in the cash book and freezes the Z report. */
export async function closeShift(shiftId: number, dto: CloseShiftDto, actorId: number) {
  const shift = await prisma.posShift.findUnique({ where: { id: shiftId } });
  if (!shift) throw AppError.notFound("Shift not found");
  if (shift.status !== "OPEN") throw new AppError("This shift is already closed", 400);
  if (shift.countedCash == null || !shift.countedAt) throw AppError.validation({ count: ["Count the cash in the drawer first"] });

  // Re-check against the latest figures (a sale or expense may have happened after the count).
  const summary = await summarizeShift(shiftId);
  const difference = round2(shift.countedCash - summary.cash.expectedCash);
  if (Math.abs(difference) >= 0.01 && !dto.differenceReason?.trim()) {
    throw AppError.validation({ differenceReason: [`The drawer is ${difference > 0 ? "over" : "short"} by Rs. ${Math.abs(difference).toLocaleString("en-LK", { minimumFractionDigits: 2 })} — give a reason`] });
  }
  if (dto.floatLeft < 0 || dto.floatLeft > shift.countedCash + 0.001) {
    throw AppError.validation({ floatLeft: ["Float left can't be more than the cash counted"] });
  }
  const cardDifference = dto.cardSlipTotal != null ? round2(dto.cardSlipTotal - summary.sales.cardSales) : null;
  if (cardDifference != null && Math.abs(cardDifference) >= 0.01 && !dto.cardDifferenceReason?.trim()) {
    throw AppError.validation({ cardDifferenceReason: [`The card machine total is ${cardDifference > 0 ? "more" : "less"} than the card sales by Rs. ${Math.abs(cardDifference).toLocaleString("en-LK", { minimumFractionDigits: 2 })} — give a reason`] });
  }
  const cardDifferenceReason = dto.cardDifferenceReason?.trim() || null;
  const cashBanked = round2(shift.countedCash - dto.floatLeft);
  const productById = new Map(summary.stockBook.map((row) => [row.productId, row]));
  const stockCount = (dto.stockCounts ?? [])
    .filter((row) => productById.has(row.productId) && Number.isFinite(row.counted))
    .map((row) => {
      const book = productById.get(row.productId)!;
      return { name: book.name, system: book.closing, counted: Math.floor(row.counted), difference: Math.floor(row.counted) - book.closing };
    });

  const closedAt = new Date();
  const report = {
    ...summary,
    shift: { ...summary.shift, status: "CLOSED", closedAt, closedBy: (await staffNames([actorId])).get(actorId)?.name ?? "—" },
    close: {
      countedCash: shift.countedCash,
      denominations: shift.denominations,
      expectedCash: summary.cash.expectedCash,
      difference,
      differenceReason: dto.differenceReason?.trim() || null,
      cardSlipTotal: dto.cardSlipTotal ?? null,
      cardDifference,
      cardDifferenceReason,
      floatLeft: round2(dto.floatLeft),
      cashBanked,
      notes: dto.notes?.trim() || null,
      stockCount,
    },
  };

  return prisma.$transaction(async (tx) => {
    const stillOpen = await tx.posShift.updateMany({
      where: { id: shiftId, status: "OPEN" },
      data: {
        status: "CLOSED",
        closedById: actorId,
        closedAt,
        expectedCash: summary.cash.expectedCash,
        cashDifference: difference,
        differenceReason: dto.differenceReason?.trim() || null,
        cardSlipTotal: dto.cardSlipTotal ?? null,
        cardDifferenceReason,
        floatLeft: round2(dto.floatLeft),
        cashBanked,
        notes: dto.notes?.trim() || null,
        report: report as unknown as Prisma.InputJsonValue,
      },
    });
    if (stillOpen.count !== 1) throw new AppError("This shift was already closed", 409);

    // Takings go into the receipts book automatically.
    const receipts = [
      { category: "SHIFT_TAKINGS", amount: cashBanked, note: `Cash taken from the drawer at close of ${shift.shiftNo} (float left: Rs. ${round2(dto.floatLeft)}) — in the safe until deposited` },
      { category: "CARD_SETTLEMENT", amount: summary.sales.cardSales, note: `Card machine sales in ${shift.shiftNo} (${summary.sales.cardPayments.length} payment${summary.sales.cardPayments.length === 1 ? "" : "s"})${dto.cardSlipTotal != null ? ` · settlement slip Rs. ${dto.cardSlipTotal}` : " · not settled at close"}` },
      { category: "TRANSFER_SALES", amount: summary.sales.transferSales, note: `Bank transfer / QR sales in ${shift.shiftNo} (${summary.sales.transferPayments.length})` },
    ].filter((row) => row.amount > 0);
    let receiptCount = await tx.posCashEntry.count({ where: { direction: "IN" } });
    for (const receipt of receipts) {
      receiptCount += 1;
      await tx.posCashEntry.create({
        data: {
          entryNo: `RCP-${String(receiptCount).padStart(5, "0")}`,
          direction: "IN",
          category: receipt.category,
          amount: receipt.amount,
          // Not in the bank yet: waits in the safe / with the card company until marked as banked.
          source: HOLDING_SOURCE[receipt.category] ?? "SAFE",
          bankStatus: "PENDING",
          note: receipt.note,
          reference: shift.shiftNo,
          shiftId,
          branchId: shift.branchId,
          automatic: true,
          createdById: actorId,
          entryDate: closedAt,
        },
      });
    }
    return { shiftNo: shift.shiftNo, report };
  });
}

export async function listShifts(page: number, limit: number, branchId: number | null) {
  const where = branchId ? { branchId } : {};
  const [shifts, total, branches] = await Promise.all([
    prisma.posShift.findMany({ where, orderBy: { openedAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.posShift.count({ where }),
    prisma.branch.findMany({ select: { id: true, name: true } }),
  ]);
  const branchName = new Map(branches.map((branch) => [branch.id, branch.name]));
  const staff = await staffNames(shifts.flatMap((shift) => [shift.openedById, shift.closedById]));
  return {
    shifts: shifts.map((shift) => {
      const report = shift.report as { sales?: { netSales?: number; bills?: number } } | null;
      return {
        id: shift.id,
        shiftNo: shift.shiftNo,
        status: shift.status,
        branch: shift.branchId ? branchName.get(shift.branchId) ?? null : null,
        openedAt: shift.openedAt,
        openedBy: staff.get(shift.openedById)?.name ?? "—",
        closedAt: shift.closedAt,
        closedBy: shift.closedById ? staff.get(shift.closedById)?.name ?? "—" : null,
        openingFloat: shift.openingFloat,
        netSales: report?.sales?.netSales ?? null,
        bills: report?.sales?.bills ?? null,
        cashDifference: shift.cashDifference,
        cashBanked: shift.cashBanked,
      };
    }),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

/** Closed shifts return their frozen Z report; the open shift returns live figures. */
export async function getShiftReport(shiftId: number, revealCash: boolean) {
  const shift = await prisma.posShift.findUnique({ where: { id: shiftId } });
  if (!shift) throw AppError.notFound("Shift not found");
  if (shift.status === "CLOSED" && shift.report) return { status: "CLOSED", report: shift.report };
  const summary = await summarizeShift(shiftId);
  if (revealCash || shift.countedAt) return { status: "OPEN", report: summary };
  // Blind count: until the drawer is counted, a cashier sees what was sold but no rupee totals
  // (bill totals would let them work out the expected cash before counting).
  return {
    status: "OPEN",
    blind: true,
    report: {
      ...summary,
      cash: { ...summary.cash, cashSales: null, walletKept: null, expectedCash: null, drawerIn: null, drawerOut: null, refundsCash: null },
      // What came back and why stays visible; cash paid back out of the drawer waits for the count.
      returns: {
        ...summary.returns, refundsCash: null, refundsTotal: null,
        rows: summary.returns.rows.map((row) => (row.refundMethod === "CASH" ? { ...row, refund: null } : row)),
      },
      sales: {
        ...summary.sales,
        grossSales: null, emptyDeduction: null, discounts: null, pointsValue: null, netSales: null, cashSales: null, refunds: null, netAfterReturns: null,
        // Card and transfer figures stay visible: they don't reveal the cash in the drawer.
        walletKept: null,
        byStaff: summary.sales.byStaff.map((row) => ({ name: row.name, bills: row.bills, cash: null, card: row.card, transfer: row.transfer, wallet: row.wallet, total: null })),
        byProduct: summary.sales.byProduct.map((row) => ({ name: row.name, units: row.units, amount: null })),
        byType: { hardLiquor: { units: summary.sales.byType.hardLiquor.units, amount: null }, other: { units: summary.sales.byType.other.units, amount: null } },
        billList: summary.sales.billList.map((bill) => ({ ...bill, payment: bill.payment.replace(/\s*[\d][\d,.]*/g, "").replace(/\s+/g, " ").trim(), emptyDeduction: null, discount: null, discountAmount: null, pointsValue: null, total: null })),
        // Who gave discounts and which members used points stay visible; the rupee amounts wait for the count.
        loyalty: {
          ...summary.sales.loyalty,
          discountByStaff: summary.sales.loyalty.discountByStaff.map((row) => ({ ...row, amount: null })),
          rows: summary.sales.loyalty.rows.map((row) => ({ ...row, billBefore: null, discountAmount: null, pointsValue: null, total: null })),
        },
      },
      // Bill counts stay; rupee amounts that would reveal the cash wait for the count.
      payments: {
        rows: summary.payments.rows.map((row) => ({ ...row, amount: row.method === "Card" || row.method === "Transfer / QR" ? row.amount : null })),
        splitBills: summary.payments.splitBills.map((row) => ({ ...row, total: null, cash: null })),
        changeGiven: null,
        wallet: summary.payments.wallet,
      },
      // Change kept in wallets went into the drawer, so its amount waits for the count; names and wallet spending stay visible.
      wallet: { ...summary.wallet, kept: null, rows: summary.wallet.rows.map((row) => (row.type === "CREDIT" ? { ...row, amount: null } : row)) },
    },
  };
}
