import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";
import type {
  CreateBikeDto,
  UpdateBikeDto,
  BikeQueryDto,
} from "./dto/bike.dto";

// ── Public vehicle listing (reads from bike_vehicles, no auth required) ───────

const publicVehicleInclude = {
  brand: { select: { id: true, name: true } },
  model: { select: { id: true, name: true } },
  images: { orderBy: { sortOrder: "asc" as const } },
} as const;

export async function listPublicVehicles(query: {
  page: number;
  limit: number;
  search?: string;
}) {
  const { page, limit, search } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { status: "available" };
  if (search) {
    where["OR"] = [
      { brand: { name: { contains: search, mode: "insensitive" } } },
      { model: { name: { contains: search, mode: "insensitive" } } },
      { colour: { contains: search, mode: "insensitive" } },
    ];
  }

  const [vehicles, total] = await Promise.all([
    prisma.bikeVehicle.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: publicVehicleInclude,
    }),
    prisma.bikeVehicle.count({ where }),
  ]);

  return {
    vehicles,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getPublicVehicle(id: number) {
  const vehicle = await prisma.bikeVehicle.findUnique({
    where: { id },
    include: publicVehicleInclude,
  });
  if (!vehicle || vehicle.status !== "available")
    throw AppError.notFound("Bike not found");
  return vehicle;
}

// ── Public product (spare parts) listing ─────────────────────────────────────

const publicProductInclude = {
  brand: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  images: { orderBy: { sortOrder: "asc" as const } },
} as const;

export async function listPublicProducts(query: {
  page: number;
  limit: number;
  search?: string;
}) {
  const { page, limit, search } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (search) {
    where["OR"] = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { brand: { name: { contains: search, mode: "insensitive" } } },
      { category: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [products, total] = await Promise.all([
    prisma.inventoryProduct.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ categoryId: "asc" }, { brandId: "asc" }, { name: "asc" }],
      include: publicProductInclude,
    }),
    prisma.inventoryProduct.count({ where }),
  ]);

  return {
    products,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getPublicProduct(id: number) {
  const product = await prisma.inventoryProduct.findUnique({
    where: { id },
    include: publicProductInclude,
  });
  if (!product) throw AppError.notFound("Product not found");
  return product;
}

export async function listBikes(query: BikeQueryDto) {
  const { page, limit, brand, inStock } = query;
  const skip = (page - 1) * limit;

  const where = {
    ...(brand
      ? { brand: { contains: brand, mode: "insensitive" as const } }
      : {}),
    ...(inStock !== undefined ? { inStock: inStock === "true" } : {}),
  };

  const [bikes, total] = await Promise.all([
    prisma.bike.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.bike.count({ where }),
  ]);

  return {
    bikes,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getBike(id: number) {
  const bike = await prisma.bike.findUnique({ where: { id } });
  if (!bike) throw AppError.notFound(`Bike with id ${id} not found`);
  return bike;
}

export async function createBike(dto: CreateBikeDto) {
  return prisma.bike.create({ data: dto });
}

export async function updateBike(id: number, dto: UpdateBikeDto) {
  await getBike(id); // ensure exists
  return prisma.bike.update({ where: { id }, data: dto });
}

export async function deleteBike(id: number) {
  await getBike(id); // ensure exists
  await prisma.bike.delete({ where: { id } });
}
