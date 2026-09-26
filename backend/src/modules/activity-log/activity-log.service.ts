import type { Request } from "express";
import { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";

export type ActivityCategory = "AUTH" | "SALE" | "STOCK" | "PRODUCT" | "STAFF" | "ACCOUNTS" | "CUSTOMER" | "OTHER";

export type ActivityEntry = {
  actorId?: number | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  category: ActivityCategory;
  summary: string;
  entityType?: string | null;
  entityId?: string | number | null;
  details?: object;
  ipAddress?: string | null;
  userAgent?: string | null;
};

const SENSITIVE_KEY = /pass(word)?|token|secret|hash/i;
const MAX_DETAILS_CHARS = 4000;

/** Removes passwords/tokens (at any depth) so they never reach the log. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[hidden]" : redact(item, depth + 1),
    ]),
  );
}

function boundedDetails(details?: object) {
  if (!details) return undefined;
  const json = JSON.stringify(redact(details));
  if (json.length <= MAX_DETAILS_CHARS) return JSON.parse(json) as Prisma.InputJsonValue;
  return { truncated: true, preview: json.slice(0, MAX_DETAILS_CHARS) } as Prisma.InputJsonValue;
}

export function requestMeta(req: Request) {
  return {
    ipAddress: (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.ip || null,
    userAgent: req.headers["user-agent"]?.slice(0, 300) ?? null,
  };
}

/**
 * Writes one log entry. Never throws: a logging problem must not fail the sale or change
 * that is being recorded, so errors are reported to the server console instead.
 */
export async function logActivity(entry: ActivityEntry) {
  try {
    let actorName = entry.actorName ?? null;
    if (!actorName && entry.actorId) {
      const actor = await prisma.posAdmin.findUnique({ where: { id: entry.actorId }, select: { name: true } });
      actorName = actor?.name ?? null;
    }
    await prisma.activityLog.create({
      data: {
        actorId: entry.actorId ?? null,
        actorName,
        actorEmail: entry.actorEmail ?? null,
        actorRole: entry.actorRole ?? null,
        action: entry.action,
        category: entry.category,
        summary: entry.summary.slice(0, 500),
        entityType: entry.entityType ?? null,
        entityId: entry.entityId != null ? String(entry.entityId) : null,
        details: boundedDetails(entry.details),
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("[activity-log] Failed to record activity:", entry.action, error);
  }
}

export type ActivityLogQuery = {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  actorId?: number;
  from?: string;
  to?: string;
};

export async function listActivityLogs(query: ActivityLogQuery) {
  const search = query.search?.trim();
  const where: Prisma.ActivityLogWhereInput = {
    ...(query.category ? { category: query.category } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(`${query.from}T00:00:00`) } : {}),
            ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999`) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { summary: { contains: search, mode: "insensitive" } },
            { actorName: { contains: search, mode: "insensitive" } },
            { actorEmail: { contains: search, mode: "insensitive" } },
            { action: { contains: search, mode: "insensitive" } },
            { entityId: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return {
    logs,
    pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) },
  };
}
