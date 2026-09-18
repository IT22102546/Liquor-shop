import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";
import type { ExportVehicleCategory } from "../../generated/prisma";

const publicInclude = {
  images: { orderBy: { sortOrder: "asc" as const } },
} as const;

export async function listPublicExportVehicles(query: {
  page: number;
  limit: number;
  category: ExportVehicleCategory;
  search?: string;
}) {
  const { page, limit, category, search } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { status: "available", category };
  if (search) {
    where["OR"] = [
      { brand: { contains: search, mode: "insensitive" } },
      { model: { contains: search, mode: "insensitive" } },
    ];
  }

  const [vehicles, total] = await Promise.all([
    prisma.exportVehicle.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: publicInclude,
    }),
    prisma.exportVehicle.count({ where }),
  ]);

  return {
    vehicles,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getPublicExportVehicleById(id: number) {
  const vehicle = await prisma.exportVehicle.findUnique({
    where: { id },
    include: publicInclude,
  });
  if (!vehicle || vehicle.status !== "available")
    throw AppError.notFound("Vehicle not found");
  return vehicle;
}
