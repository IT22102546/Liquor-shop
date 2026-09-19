import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";

// ── Public product (liquor catalog) listing, no auth required ────────────────

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
