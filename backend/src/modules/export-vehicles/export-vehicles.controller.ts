import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as exportVehiclesService from "./export-vehicles.service";
import type { ExportVehicleCategory } from "../../generated/prisma";

const listSchema = z.object({
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("200"),
  search: z.string().optional(),
});

const VALID_CATEGORIES: ExportVehicleCategory[] = [
  "AUTOMOBILE",
  "HEAVY_MACHINERY",
];

export async function listByCategory(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const rawCategory = ((req.params.category as string) ?? "")
      .toUpperCase()
      .replace(/-/g, "_") as ExportVehicleCategory;

    if (!VALID_CATEGORIES.includes(rawCategory)) {
      res.status(400).json({ error: "Invalid category" });
      return;
    }

    const query = listSchema.parse(req.query);
    const page = parseInt(query.page);
    const limit = Math.min(parseInt(query.limit), 200);

    const result = await exportVehiclesService.listPublicExportVehicles({
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? 200 : limit,
      category: rawCategory,
      search: query.search,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) throw new Error("Invalid ID");
    const vehicle = await exportVehiclesService.getPublicExportVehicleById(id);
    res.status(200).json(vehicle);
  } catch (err) {
    next(err);
  }
}
