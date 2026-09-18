import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as svc from "./pre-orders.service";

// ── Schemas ────────────────────────────────────────────────────────────────

const listSchema = z.object({
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("100"),
  search: z.string().optional(),
  status: z.string().optional(),
});

const createSchema = z.object({
  brand: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  year: z.number().int().min(1900).max(2100).optional(),
  cc: z.string().trim().max(50).optional(),
  colour: z.string().trim().max(100).optional(),
  price: z.number().min(0).optional(),
  depositRequired: z.string().trim().max(100).optional(),
  expectedArrival: z.string().trim().max(100).optional(),
  status: z.enum(["pre-order", "in-stock"]).optional(),
  description: z.string().trim().max(2000).optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const updateSchema = createSchema.partial();

// ── Public controllers ─────────────────────────────────────────────────────

export async function listPublicPreOrders(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = listSchema.parse(req.query);
    const page = Math.max(1, parseInt(query.page));
    const limit = Math.min(200, Math.max(1, parseInt(query.limit)));
    const result = await svc.listPublicPreOrders({
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? 100 : limit,
      search: query.search,
      status: query.status,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getPublicPreOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) throw new Error("Invalid ID");
    const preOrder = await svc.getPublicPreOrder(id);
    res.status(200).json(preOrder);
  } catch (err) {
    next(err);
  }
}

// ── POS Management controllers ─────────────────────────────────────────────

export async function listPreOrders(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = listSchema.parse(req.query);
    const page = Math.max(1, parseInt(query.page));
    const limit = Math.min(200, Math.max(1, parseInt(query.limit)));
    const result = await svc.listPreOrders({
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? 100 : limit,
      search: query.search,
      status: query.status,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getPreOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) throw new Error("Invalid ID");
    const preOrder = await svc.getPreOrder(id);
    res.status(200).json(preOrder);
  } catch (err) {
    next(err);
  }
}

export async function createPreOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const dto = createSchema.parse(req.body);
    const preOrder = await svc.createPreOrder(dto);
    res.status(201).json(preOrder);
  } catch (err) {
    next(err);
  }
}

export async function updatePreOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) throw new Error("Invalid ID");
    const dto = updateSchema.parse(req.body);
    const preOrder = await svc.updatePreOrder(id, dto);
    res.status(200).json(preOrder);
  } catch (err) {
    next(err);
  }
}

export async function deletePreOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) throw new Error("Invalid ID");
    await svc.deletePreOrder(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ── PDF controller ─────────────────────────────────────────────────────────

export async function uploadPreOrderPdf(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const preOrderId = parseInt(req.params.preOrderId as string);
    if (isNaN(preOrderId)) throw new Error("Invalid ID");
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) throw new Error("No file uploaded");
    const url = `/uploads/pre-orders/${file.filename}`;
    const updated = await svc.updatePreOrderPdf(preOrderId, url);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

// ── Image controllers ──────────────────────────────────────────────────────

export async function uploadPreOrderImage(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const preOrderId = parseInt(req.params.preOrderId as string);
    if (isNaN(preOrderId)) throw new Error("Invalid ID");
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) throw new Error("No file uploaded");
    const url = `/uploads/pre-orders/${file.filename}`;
    const image = await svc.addPreOrderImage(preOrderId, url);
    res.status(201).json(image);
  } catch (err) {
    next(err);
  }
}

export async function deletePreOrderImage(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const preOrderId = parseInt(req.params.preOrderId as string);
    const imageId = parseInt(req.params.imageId as string);
    if (isNaN(preOrderId) || isNaN(imageId)) throw new Error("Invalid ID");
    await svc.deletePreOrderImage(preOrderId, imageId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function setPreOrderImagePrimary(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const preOrderId = parseInt(req.params.preOrderId as string);
    const imageId = parseInt(req.params.imageId as string);
    if (isNaN(preOrderId) || isNaN(imageId)) throw new Error("Invalid ID");
    const image = await svc.setPreOrderImagePrimary(preOrderId, imageId);
    res.status(200).json(image);
  } catch (err) {
    next(err);
  }
}
