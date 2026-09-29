import type { NextFunction, Request, Response } from "express";
import { getSettings } from "../settings/settings.service";
import { prisma } from "../../database/prisma.client";
import { describePosChange } from "./activity-describe";
import { logActivity, requestMeta } from "./activity-log.service";
import { branchOfUser } from "../branches/branch-context";

// Sign-in/out are logged explicitly by the pos-auth controller (with failed attempts too).
const SKIP_PATHS = new Set(["/auth/login", "/auth/logout"]);

/** Loads the record a request is about to change, so the log can show Before → After. */
async function snapshotBefore(method: string, path: string): Promise<Record<string, unknown> | undefined> {
  // Purchase orders: the order as it was (so failed emails and edits can name it).
  const po = /^\/purchase-orders\/(\d+)(?:\/(?:send|receive|cancel))?$/.exec(path);
  if (po && method !== "GET") return (await prisma.purchaseOrder.findUnique({ where: { id: Number(po[1]) }, include: { supplier: { select: { name: true } } } })) ?? undefined;
  // Shop settings: the values before the change, for an old → new list.
  if (path === "/settings" && method === "PATCH") return (await getSettings()) as unknown as Record<string, unknown>;
  if (method === "POST" && !/\/(images|restock|empties|sell)/.test(path)) return undefined;
  let match = /^\/inventory-management\/products\/(\d+)/.exec(path);
  if (match) {
    return (await prisma.inventoryProduct.findUnique({
      where: { id: Number(match[1]) },
      include: { brand: { select: { name: true } }, category: { select: { name: true } }, supplier: { select: { name: true } } },
    })) ?? undefined;
  }
  if (method === "POST") return undefined;
  match = /^\/inventory-management\/product-brands\/(\d+)$/.exec(path);
  if (match) return (await prisma.inventoryBrand.findUnique({ where: { id: Number(match[1]) } })) ?? undefined;
  match = /^\/inventory-management\/product-categories\/(\d+)$/.exec(path);
  if (match) return (await prisma.inventoryCategory.findUnique({ where: { id: Number(match[1]) } })) ?? undefined;
  match = /^\/inventory-management\/suppliers\/(\d+)$/.exec(path);
  if (match) return (await prisma.supplier.findUnique({ where: { id: Number(match[1]) } })) ?? undefined;
  match = /^\/purchase-orders\/(\d+)$/.exec(path);
  if (match) return (await prisma.purchaseOrder.findUnique({ where: { id: Number(match[1]) }, include: { supplier: { select: { name: true } } } })) ?? undefined;
  match = /^\/auth\/staff\/(\d+)$/.exec(path);
  if (match) {
    return (await prisma.posAdmin.findUnique({
      where: { id: Number(match[1]) },
      select: { name: true, email: true, role: true, isActive: true },
    })) ?? undefined;
  }
  return undefined;
}

/**
 * Mounted on /api/pos: records every successful change (POST/PATCH/PUT/DELETE) made through the POS,
 * with who made it, in plain language. The entry is written after the response is sent, and a
 * logging problem never breaks the sale or change itself.
 */
export async function recordPosActivity(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "OPTIONS" || req.method === "HEAD") return next();
  const path = req.path;
  if (SKIP_PATHS.has(path)) return next();

  const before = await snapshotBefore(req.method, path).catch(() => undefined);

  let responseBody: unknown;
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on("finish", () => {
    const user = (req as unknown as { user?: { id?: number; email?: string; role?: string } }).user;
    // Successful changes are logged; so are signed-in users trying something their role may not do.
    const denied = res.statusCode === 403 && Boolean(user);
    // A failed purchase order email is recorded too (the attempt matters, not only successes).
    const failedEmail = res.statusCode >= 500 && /^\/purchase-orders\/\d+\/send$/.test(path);
    if (res.statusCode >= 400 && !denied && !failedEmail) return;
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    let described;
    try {
      described = describePosChange(req.method, path, body, denied ? undefined : responseBody, before);
    } catch {
      described = { action: "other.change", category: "OTHER" as const, summary: "Made a change" };
    }
    if (denied) {
      described = {
        ...described,
        action: `${described.action}.denied`,
        summary: `Blocked — no permission to do this: ${described.summary}`,
        details: { facts: [{ label: "Result", value: "Not allowed for this role — nothing was changed" }] },
      };
    }
    // Which branch it happened at: the actor's branch, except company-wide changes (catalogue, prices, settings…).
    const companyWide = /^\/(settings|inventory-management\/(product-brands|product-categories|suppliers|products\/bulk-price)|branches|auth\/staff|user-management\/(?!checkout))/.test(path);
    void (async () => {
      const branchId = user?.id && !companyWide ? (await branchOfUser(user.id).catch(() => null))?.id ?? null : null;
      await logActivity({
      ...described,
      branchId,
      details: described.details,
      actorId: user?.id ?? null,
      actorEmail: user?.email ?? null,
      actorRole: user?.role ?? null,
      ...requestMeta(req),
      });
    })();
  });

  next();
}
