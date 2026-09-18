import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as svc from "./contact-requests.service";

// ── Schemas ────────────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(50).optional(),
  city: z.string().trim().max(100).optional(),
  interests: z.string().trim().max(500).optional(),
  message: z.string().trim().max(2000).optional(),
});

const listSchema = z.object({
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("50"),
  search: z.string().optional(),
  status: z.string().optional(),
});

const updateSchema = z.object({
  status: z.enum(["new", "contacted", "closed"]).optional(),
  notes: z.string().trim().max(2000).optional(),
});

// ── Public: submit contact form ────────────────────────────────────────────

export async function submitContactRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const dto = createSchema.parse(req.body);
    const record = await svc.createContactRequest(dto);
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
}

// ── POS Admin controllers ──────────────────────────────────────────────────

export async function listContactRequests(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = listSchema.parse(req.query);
    const page = Math.max(1, parseInt(query.page));
    const limit = Math.min(200, Math.max(1, parseInt(query.limit)));
    const result = await svc.listContactRequests({
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? 50 : limit,
      search: query.search,
      status: query.status,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getContactRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) throw new Error("Invalid ID");
    const record = await svc.getContactRequest(id);
    res.status(200).json(record);
  } catch (err) {
    next(err);
  }
}

export async function updateContactRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) throw new Error("Invalid ID");
    const dto = updateSchema.parse(req.body);
    const record = await svc.updateContactRequest(id, dto);
    res.status(200).json(record);
  } catch (err) {
    next(err);
  }
}

export async function deleteContactRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) throw new Error("Invalid ID");
    await svc.deleteContactRequest(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getContactRequestStats(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const stats = await svc.getContactRequestStats();
    res.status(200).json(stats);
  } catch (err) {
    next(err);
  }
}
