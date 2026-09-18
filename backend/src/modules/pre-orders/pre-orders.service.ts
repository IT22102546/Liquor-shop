import { prisma } from "../../database/prisma.client";
import { Prisma } from "../../generated/prisma";
import { AppError } from "../../common/utils/errors";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CreatePreOrderDto {
  brand: string;
  model: string;
  year?: number;
  cc?: string;
  colour?: string;
  price?: number;
  depositRequired?: string;
  expectedArrival?: string;
  status?: string;
  description?: string;
  isPublished?: boolean;
  sortOrder?: number;
}

export type UpdatePreOrderDto = Partial<CreatePreOrderDto>;

// ── Includes ───────────────────────────────────────────────────────────────

const preOrderInclude = {
  images: { orderBy: { sortOrder: "asc" as const } },
} as const;

// ── Display ID ─────────────────────────────────────────────────────────────

async function generatePreOrderDisplayId(): Promise<string> {
  const latest = await prisma.preOrder.findFirst({
    orderBy: { id: "desc" },
    select: { displayId: true },
  });
  const current = latest?.displayId
    ? Number.parseInt(latest.displayId.replace(/^PO-/, ""), 10)
    : 0;
  return `PO-${String(Number.isFinite(current) ? current + 1 : 1).padStart(5, "0")}`;
}

async function createPreOrderWithUniqueDisplayId(
  data: Record<string, unknown>,
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const displayId = await generatePreOrderDisplayId();
    try {
      return await prisma.preOrder.create({
        data: { ...data, displayId } as never,
        include: preOrderInclude,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        String(err.meta?.target ?? "").includes("displayId")
      ) {
        continue;
      }
      throw err;
    }
  }
  throw AppError.conflict("Failed to generate a unique pre-order ID");
}

// ── Public ─────────────────────────────────────────────────────────────────

export async function listPublicPreOrders(query: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}) {
  const { page, limit, search, status } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.PreOrderWhereInput = { isPublished: true };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { brand: { contains: search, mode: "insensitive" } },
      { model: { contains: search, mode: "insensitive" } },
      { cc: { contains: search, mode: "insensitive" } },
      { colour: { contains: search, mode: "insensitive" } },
    ];
  }

  const [preOrders, total] = await Promise.all([
    prisma.preOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: preOrderInclude,
    }),
    prisma.preOrder.count({ where }),
  ]);

  return {
    data: preOrders,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getPublicPreOrder(id: number) {
  const preOrder = await prisma.preOrder.findUnique({
    where: { id },
    include: preOrderInclude,
  });
  if (!preOrder || !preOrder.isPublished)
    throw AppError.notFound("Pre-order not found");
  return preOrder;
}

// ── POS Management ─────────────────────────────────────────────────────────

export async function listPreOrders(query: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}) {
  const { page, limit, search, status } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.PreOrderWhereInput = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { brand: { contains: search, mode: "insensitive" } },
      { model: { contains: search, mode: "insensitive" } },
      { displayId: { contains: search, mode: "insensitive" } },
      { cc: { contains: search, mode: "insensitive" } },
      { colour: { contains: search, mode: "insensitive" } },
    ];
  }

  const [preOrders, total] = await Promise.all([
    prisma.preOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: preOrderInclude,
    }),
    prisma.preOrder.count({ where }),
  ]);

  return {
    data: preOrders,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getPreOrder(id: number) {
  const preOrder = await prisma.preOrder.findUnique({
    where: { id },
    include: preOrderInclude,
  });
  if (!preOrder) throw AppError.notFound("Pre-order not found");
  return preOrder;
}

export async function createPreOrder(dto: CreatePreOrderDto) {
  return createPreOrderWithUniqueDisplayId({
    brand: dto.brand.trim(),
    model: dto.model.trim(),
    year: dto.year ?? null,
    cc: dto.cc?.trim() || null,
    colour: dto.colour?.trim() || null,
    price: dto.price ?? null,
    depositRequired: dto.depositRequired?.trim() || null,
    expectedArrival: dto.expectedArrival?.trim() || null,
    status: dto.status ?? "pre-order",
    description: dto.description?.trim() || null,
    isPublished: dto.isPublished ?? true,
    sortOrder: dto.sortOrder ?? 0,
  });
}

export async function updatePreOrder(id: number, dto: UpdatePreOrderDto) {
  await getPreOrder(id);
  return prisma.preOrder.update({
    where: { id },
    data: {
      ...(dto.brand !== undefined ? { brand: dto.brand.trim() } : {}),
      ...(dto.model !== undefined ? { model: dto.model.trim() } : {}),
      ...(dto.year !== undefined ? { year: dto.year } : {}),
      ...(dto.cc !== undefined ? { cc: dto.cc?.trim() || null } : {}),
      ...(dto.colour !== undefined
        ? { colour: dto.colour?.trim() || null }
        : {}),
      ...(dto.price !== undefined ? { price: dto.price } : {}),
      ...(dto.depositRequired !== undefined
        ? { depositRequired: dto.depositRequired?.trim() || null }
        : {}),
      ...(dto.expectedArrival !== undefined
        ? { expectedArrival: dto.expectedArrival?.trim() || null }
        : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description?.trim() || null }
        : {}),
      ...(dto.isPublished !== undefined
        ? { isPublished: dto.isPublished }
        : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    },
    include: preOrderInclude,
  });
}

export async function deletePreOrder(id: number) {
  await getPreOrder(id);
  await prisma.preOrder.delete({ where: { id } });
}

// ── PDF ────────────────────────────────────────────────────────────────────

export async function updatePreOrderPdf(id: number, pdfUrl: string) {
  await getPreOrder(id);
  return prisma.preOrder.update({
    where: { id },
    data: { pdfUrl },
    include: preOrderInclude,
  });
}

// ── Images ─────────────────────────────────────────────────────────────────

export async function addPreOrderImage(preOrderId: number, url: string) {
  await getPreOrder(preOrderId);

  const count = await prisma.preOrderImage.count({ where: { preOrderId } });
  const isPrimary = count === 0;
  const maxSort = await prisma.preOrderImage.aggregate({
    where: { preOrderId },
    _max: { sortOrder: true },
  });

  return prisma.preOrderImage.create({
    data: {
      preOrderId,
      url,
      isPrimary,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });
}

export async function deletePreOrderImage(preOrderId: number, imageId: number) {
  const image = await prisma.preOrderImage.findFirst({
    where: { id: imageId, preOrderId },
  });
  if (!image) throw AppError.notFound("Image not found");

  await prisma.preOrderImage.delete({ where: { id: imageId } });

  // If the deleted image was primary, promote the next one
  if (image.isPrimary) {
    const next = await prisma.preOrderImage.findFirst({
      where: { preOrderId },
      orderBy: { sortOrder: "asc" },
    });
    if (next) {
      await prisma.preOrderImage.update({
        where: { id: next.id },
        data: { isPrimary: true },
      });
    }
  }
}

export async function setPreOrderImagePrimary(
  preOrderId: number,
  imageId: number,
) {
  const image = await prisma.preOrderImage.findFirst({
    where: { id: imageId, preOrderId },
  });
  if (!image) throw AppError.notFound("Image not found");

  await prisma.preOrderImage.updateMany({
    where: { preOrderId },
    data: { isPrimary: false },
  });
  return prisma.preOrderImage.update({
    where: { id: imageId },
    data: { isPrimary: true },
  });
}
