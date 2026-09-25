import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as bikesService from "./bikes.service";

const listPublicProductsSchema = z.object({
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("200"),
  search: z.string().optional(),
});

export async function listPublicProducts(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = listPublicProductsSchema.parse(req.query);
    const page = parseInt(query.page);
    const limit = Math.min(parseInt(query.limit), 200);
    const result = await bikesService.listPublicProducts({
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? 200 : limit,
      search: query.search,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getPublicProductById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) throw new Error("Invalid ID");
    const product = await bikesService.getPublicProduct(id);
    res.status(200).json(product);
  } catch (err) {
    next(err);
  }
}
