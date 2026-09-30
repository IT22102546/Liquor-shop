/**
 * Sending a bill safely on a weak connection.
 *
 * Every bill gets its own reference (clientRef) made here, before it is sent. The server saves a
 * bill once per reference and answers a repeated request with the first result, so the till can
 * retry freely: a bill whose reply was lost is never saved twice.
 *
 * Until the server confirms a bill, its reference and contents are kept in this browser
 * ("pending"). Pressing Complete sale again with the same order reuses the reference; a different
 * order first asks the server whether the pending one was saved.
 */
import { API_URL } from "./constants";

const KEY = "pos_pending_bill";
/** Waits before each try: the first goes at once, then a little longer each time (≈ 30 s in all). */
const RETRY_DELAYS = [0, 1500, 3000, 5000, 8000, 12000];
const ATTEMPT_TIMEOUT_MS = 20000;

export type PendingBill = { ref: string; billNo?: string; body: string; adminId: number; at: number };

export type SendResult<T> =
  | { kind: "saved"; data: T }
  | { kind: "refused"; status: number; message: string }
  | { kind: "signed-out" }
  | { kind: "unreachable" };

export function newBillRef() {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch { /* fall through */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadPendingBill(adminId: number): PendingBill | null {
  try {
    const pending = JSON.parse(localStorage.getItem(KEY) ?? "null") as PendingBill | null;
    return pending && pending.adminId === adminId && typeof pending.ref === "string" ? pending : null;
  } catch {
    return null;
  }
}

export function savePendingBill(pending: PendingBill) {
  try { localStorage.setItem(KEY, JSON.stringify(pending)); } catch { /* storage blocked: retries still work in this page */ }
}

export function clearPendingBill() {
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = ATTEMPT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

const firstMessage = (payload: { message?: string; errors?: unknown } | null, fallback: string) => {
  const errors = payload?.errors as { fieldErrors?: Record<string, string[]> } & Record<string, unknown> | undefined;
  const fromFields = errors?.fieldErrors ? Object.values(errors.fieldErrors)[0]?.[0] : undefined;
  const fromMap = errors && !errors.fieldErrors ? (Object.values(errors)[0] as string[] | undefined)?.[0] : undefined;
  return fromFields ?? fromMap ?? payload?.message ?? fallback;
};

/**
 * Sends the bill, retrying when the connection drops, times out or the server is briefly down.
 * A clear answer from the server (saved, or refused with a reason) ends it at once.
 */
export async function sendBill<T>(
  token: string,
  body: Record<string, unknown>,
  onRetry: (attempt: number) => void,
  options: { delays?: number[]; timeoutMs?: number } = {},
): Promise<SendResult<T>> {
  for (const [index, delay] of (options.delays ?? RETRY_DELAYS).entries()) {
    if (delay) await sleep(delay);
    if (index > 0) onRetry(index + 1);
    try {
      const response = await fetchWithTimeout(`${API_URL}/api/pos/user-management/checkout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, options.timeoutMs);
      if (response.status === 401) return { kind: "signed-out" };
      // Server busy or restarting: try again. Anything else is the server's real answer.
      if (response.status >= 500 || response.status === 408 || response.status === 429) continue;
      const payload = (await response.json().catch(() => null)) as { data?: T; message?: string; errors?: unknown } | null;
      if (response.ok && payload?.data) return { kind: "saved", data: payload.data };
      if (!response.ok) return { kind: "refused", status: response.status, message: firstMessage(payload, "Checkout failed") };
    } catch {
      // No connection or timed out: try again.
    }
  }
  return { kind: "unreachable" };
}

/** Asks the server whether a pending bill was saved. */
export async function checkPendingBill<T>(token: string, ref: string): Promise<{ kind: "saved"; data: T } | { kind: "not-saved" } | { kind: "unknown" }> {
  try {
    const response = await fetchWithTimeout(`${API_URL}/api/pos/user-management/checkout/${encodeURIComponent(ref)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 404) return { kind: "not-saved" };
    if (!response.ok) return { kind: "unknown" };
    const payload = (await response.json().catch(() => null)) as { data?: T } | null;
    return payload?.data ? { kind: "saved", data: payload.data } : { kind: "unknown" };
  } catch {
    return { kind: "unknown" };
  }
}
