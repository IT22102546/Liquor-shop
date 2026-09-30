/**
 * Selling without a connection.
 *
 * When a bill can't reach the server, the till keeps it here (in this browser) and the sale goes
 * ahead: receipt printed, drawer opened, stock on screen reduced. Each bill already carries its own
 * reference and bill number (see safeCheckout.ts), so uploading it later — even more than once —
 * saves it exactly once, with the time it was really sold.
 *
 * Bills are uploaded by <OfflineSync/> (dashboard layout) as soon as the connection is back, by the
 * staff member who rang them up. A bill the server refuses stays listed with the reason.
 */
import { sendBill } from "./safeCheckout";

const KEY = "pos_offline_bills";
const EVENT = "pos-offline-bills";

export type OfflineBill = {
  ref: string;
  billNo: string;
  soldAt: string;
  adminId: number;
  cashierName: string;
  total: number;
  items: string;
  /** Exactly what is sent to checkout (includes clientRef, billNo and offline.soldAt). */
  body: Record<string, unknown>;
  /** Set when the server refused it (the reason), cleared when it uploads. */
  problem?: string;
};

export function loadOfflineBills(): OfflineBill[] {
  try {
    const bills = JSON.parse(localStorage.getItem(KEY) ?? "[]") as OfflineBill[];
    return Array.isArray(bills) ? bills : [];
  } catch {
    return [];
  }
}

function saveOfflineBills(bills: OfflineBill[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(bills));
  } catch {
    /* storage full or blocked — the caller still has the bill in memory */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Saves a bill sold offline. Returns false if this browser can't store it. */
export function addOfflineBill(bill: OfflineBill) {
  const bills = loadOfflineBills().filter((row) => row.ref !== bill.ref);
  bills.push(bill);
  saveOfflineBills(bills);
  return loadOfflineBills().some((row) => row.ref === bill.ref);
}

export function onOfflineBillsChange(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/** A bill number like the server's, made on the till so it can be printed straight away. */
export function newBillNo() {
  return `POS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "0")}`;
}

let uploading = false;

/**
 * Uploads this staff member's offline bills, oldest first. Stops at the first sign the connection
 * is still down. Returns how many were saved.
 */
export async function uploadOfflineBills(token: string, adminId: number): Promise<{ saved: number; stillOffline: boolean }> {
  if (uploading) return { saved: 0, stillOffline: false };
  uploading = true;
  let saved = 0;
  try {
    const mine = loadOfflineBills().filter((bill) => bill.adminId === adminId).sort((a, b) => a.soldAt.localeCompare(b.soldAt));
    for (const bill of mine) {
      const result = await sendBill(token, bill.body, () => undefined, { delays: [0], timeoutMs: 15000 });
      if (result.kind === "unreachable" || result.kind === "signed-out") return { saved, stillOffline: result.kind === "unreachable" };
      const rest = loadOfflineBills();
      if (result.kind === "saved") {
        saveOfflineBills(rest.filter((row) => row.ref !== bill.ref));
        saved += 1;
      } else {
        saveOfflineBills(rest.map((row) => (row.ref === bill.ref ? { ...row, problem: result.message } : row)));
      }
    }
    return { saved, stillOffline: false };
  } finally {
    uploading = false;
  }
}
