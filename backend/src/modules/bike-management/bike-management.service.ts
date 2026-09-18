import { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";
import type {
  CreateBrandDto,
  UpdateBrandDto,
  CreateModelDto,
  UpdateModelDto,
  CreateColorDto,
  UpdateColorDto,
} from "./dto/brand.dto";
import type { CreateSupplierDto, UpdateSupplierDto } from "./dto/supplier.dto";
import type {
  CreateProductBrandDto,
  UpdateProductBrandDto,
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
  CreateProductDto,
  UpdateProductDto,
  RecordProductSaleDto,
  ProductQueryDto,
} from "./dto/product.dto";
import type {
  CreateVehicleDto,
  BulkCreateVehicleDto,
  UpdateVehicleDto,
  VehicleQueryDto,
  RenameFileNoDto,
  DeleteFileNoDto,
  AddExpenseDto,
} from "./dto/vehicle.dto";

// ── Utility: generate unique display ID ───────────────────────────────────────
async function generateDisplayId(): Promise<string> {
  const latest = await prisma.bikeVehicle.findFirst({
    orderBy: { id: "desc" },
    select: { displayId: true },
  });

  const current = latest?.displayId
    ? Number.parseInt(latest.displayId.replace(/^JLR-/, ""), 10)
    : 0;
  return `JLR-${String(Number.isFinite(current) ? current + 1 : 1).padStart(5, "0")}`;
}

async function generateSupplierCode(): Promise<string> {
  const latest = await prisma.bikeSupplier.findFirst({
    orderBy: { id: "desc" },
    select: { code: true },
  });

  const current = latest?.code
    ? Number.parseInt(latest.code.replace(/^SUP-/, ""), 10)
    : 0;
  return `SUP-${String(Number.isFinite(current) ? current + 1 : 1).padStart(5, "0")}`;
}

async function generateProductDisplayId(): Promise<string> {
  const latest = await prisma.inventoryProduct.findFirst({
    orderBy: { id: "desc" },
    select: { displayId: true },
  });

  const current = latest?.displayId
    ? Number.parseInt(latest.displayId.replace(/^PRD-/, ""), 10)
    : 0;
  return `PRD-${String(Number.isFinite(current) ? current + 1 : 1).padStart(5, "0")}`;
}

async function assertSupplierExists(supplierId?: number) {
  if (!supplierId) return;
  const supplier = await prisma.bikeSupplier.findUnique({
    where: { id: supplierId },
  });
  if (!supplier) throw AppError.notFound("Supplier not found");
}

function normalizeSupplierInput(dto: Partial<CreateSupplierDto>) {
  return {
    ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
    ...(dto.contactPerson !== undefined
      ? { contactPerson: dto.contactPerson.trim() || undefined }
      : {}),
    ...(dto.telephone !== undefined
      ? { telephone: dto.telephone.trim() || undefined }
      : {}),
    ...(dto.address !== undefined
      ? { address: dto.address.trim() || undefined }
      : {}),
    ...(dto.fax !== undefined ? { fax: dto.fax.trim() || undefined } : {}),
    ...(dto.email !== undefined
      ? { email: dto.email.trim() || undefined }
      : {}),
    ...(dto.vatRegistrationNo !== undefined
      ? { vatRegistrationNo: dto.vatRegistrationNo.trim() || undefined }
      : {}),
  };
}

// ── Brands ────────────────────────────────────────────────────────────────────

export async function listBrands() {
  return prisma.bikeBrand.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { models: true, vehicles: true } } },
  });
}

export async function getBrand(id: number) {
  const brand = await prisma.bikeBrand.findUnique({
    where: { id },
    include: { models: { orderBy: { name: "asc" } } },
  });
  if (!brand) throw AppError.notFound(`Brand with id ${id} not found`);
  return brand;
}

export async function createBrand(dto: CreateBrandDto) {
  const existing = await prisma.bikeBrand.findUnique({
    where: { name: dto.name },
  });
  if (existing) throw AppError.conflict(`Brand "${dto.name}" already exists`);
  return prisma.bikeBrand.create({ data: { name: dto.name } });
}

export async function updateBrand(id: number, dto: UpdateBrandDto) {
  await getBrand(id);
  if (dto.name) {
    const conflict = await prisma.bikeBrand.findFirst({
      where: { name: dto.name, id: { not: id } },
    });
    if (conflict) throw AppError.conflict(`Brand "${dto.name}" already exists`);
  }
  return prisma.bikeBrand.update({ where: { id }, data: dto });
}

export async function deleteBrand(id: number) {
  await getBrand(id);
  await prisma.bikeBrand.delete({ where: { id } }); // cascades to models + vehicles
}

// ── Models ────────────────────────────────────────────────────────────────────

export async function listModels(brandId: number) {
  await getBrand(brandId);
  return prisma.bikeModel.findMany({
    where: { brandId },
    orderBy: { name: "asc" },
    include: { _count: { select: { vehicles: true } } },
  });
}

export async function listAllModels() {
  return prisma.bikeModel.findMany({
    orderBy: { name: "asc" },
    include: {
      brand: { select: { id: true, name: true } },
      _count: { select: { vehicles: true } },
    },
  });
}

export async function getModel(id: number) {
  const model = await prisma.bikeModel.findUnique({ where: { id } });
  if (!model) throw AppError.notFound(`Model with id ${id} not found`);
  return model;
}

export async function createModel(brandId: number, dto: CreateModelDto) {
  await getBrand(brandId);
  const existing = await prisma.bikeModel.findUnique({
    where: { name_brandId: { name: dto.name, brandId } },
  });
  if (existing)
    throw AppError.conflict(
      `Model "${dto.name}" already exists for this brand`,
    );
  return prisma.bikeModel.create({
    data: {
      name: dto.name,
      brandId,
      lowStockThreshold: dto.lowStockThreshold ?? 0,
    },
  });
}

export async function updateModel(id: number, dto: UpdateModelDto) {
  const model = await getModel(id);
  if (dto.name) {
    const conflict = await prisma.bikeModel.findFirst({
      where: { name: dto.name, brandId: model.brandId, id: { not: id } },
    });
    if (conflict)
      throw AppError.conflict(
        `Model "${dto.name}" already exists for this brand`,
      );
  }

  return prisma.bikeModel.update({
    where: { id },
    data: {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.lowStockThreshold !== undefined
        ? { lowStockThreshold: dto.lowStockThreshold ?? 0 }
        : {}),
    },
  });
}

export async function deleteModel(id: number) {
  await getModel(id);
  await prisma.bikeModel.delete({ where: { id } }); // cascades to vehicles
}

// ── Colors ────────────────────────────────────────────────────────────────────

export async function listColors() {
  return prisma.bikeColor.findMany({ orderBy: { name: "asc" } });
}

export async function createColor(dto: CreateColorDto) {
  const existing = await prisma.bikeColor.findUnique({
    where: { name: dto.name },
  });
  if (existing) throw AppError.conflict(`Color "${dto.name}" already exists`);
  return prisma.bikeColor.create({ data: { name: dto.name } });
}

export async function updateColor(id: number, dto: UpdateColorDto) {
  const color = await prisma.bikeColor.findUnique({ where: { id } });
  if (!color) throw AppError.notFound("Color not found");
  if (dto.name) {
    const conflict = await prisma.bikeColor.findFirst({
      where: { name: dto.name, id: { not: id } },
    });
    if (conflict) throw AppError.conflict(`Color "${dto.name}" already exists`);
  }
  return prisma.bikeColor.update({ where: { id }, data: dto });
}

export async function deleteColor(id: number) {
  const color = await prisma.bikeColor.findUnique({ where: { id } });
  if (!color) throw AppError.notFound("Color not found");
  await prisma.bikeColor.delete({ where: { id } });
}

// ── Suppliers ─────────────────────────────────────────────────────────────────

export async function listSuppliers() {
  return prisma.bikeSupplier.findMany({
    orderBy: [{ name: "asc" }],
    include: { _count: { select: { vehicles: true, products: true } } },
  });
}

export async function getSupplier(id: number) {
  const supplier = await prisma.bikeSupplier.findUnique({
    where: { id },
    include: { _count: { select: { vehicles: true, products: true } } },
  });
  if (!supplier) throw AppError.notFound(`Supplier with id ${id} not found`);
  return supplier;
}

export async function createSupplier(dto: CreateSupplierDto) {
  const normalized = normalizeSupplierInput(dto);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = await generateSupplierCode();
    try {
      return await prisma.bikeSupplier.create({
        data: {
          name: dto.name.trim(),
          contactPerson: normalized.contactPerson,
          telephone: normalized.telephone,
          address: normalized.address,
          fax: normalized.fax,
          email: normalized.email,
          vatRegistrationNo: normalized.vatRegistrationNo,
          code,
        },
        include: { _count: { select: { vehicles: true, products: true } } },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }

  throw AppError.conflict("Failed to generate a unique supplier code");
}

export async function updateSupplier(id: number, dto: UpdateSupplierDto) {
  await getSupplier(id);
  return prisma.bikeSupplier.update({
    where: { id },
    data: normalizeSupplierInput(dto),
    include: { _count: { select: { vehicles: true, products: true } } },
  });
}

export async function deleteSupplier(id: number) {
  await getSupplier(id);
  await prisma.bikeSupplier.delete({ where: { id } });
}

// ── Inventory Products ───────────────────────────────────────────────────────

const productInclude = {
  brand: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true, code: true } },
  expenses: { orderBy: { createdAt: "desc" as const } },
  images: { orderBy: { sortOrder: "asc" as const } },
} as const;

function normalizeProductDescription(
  description?: string,
  descriptionPoints?: string[],
) {
  const normalizedPoints = (descriptionPoints ?? [])
    .map((point) => point.trim())
    .filter(Boolean);
  if (normalizedPoints.length > 0) {
    return normalizedPoints.map((point) => `• ${point}`).join("\n");
  }
  const fallback = description?.trim();
  return fallback || undefined;
}

function normalizeProductExpenses(
  expenses?: { description: string; amount: number }[],
) {
  return (expenses ?? [])
    .map((expense) => ({
      description: expense.description.trim(),
      amount: Number(expense.amount),
    }))
    .filter(
      (expense) =>
        expense.description &&
        Number.isFinite(expense.amount) &&
        expense.amount >= 0,
    );
}

function getSafePerItemCount(count: number | undefined) {
  if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) {
    return 1;
  }
  return Math.max(Math.floor(count), 1);
}

function divideTotalAmountPerItem(
  amount: number | undefined,
  count: number | undefined,
) {
  if (amount === undefined || !Number.isFinite(amount)) {
    return undefined;
  }

  const safeCount = getSafePerItemCount(count);
  return Math.round((amount / safeCount) * 100) / 100;
}

function normalizeProductExpensesForCount(
  expenses: { description: string; amount: number }[] | undefined,
  count: number | undefined,
) {
  return normalizeProductExpenses(expenses).map((expense) => ({
    ...expense,
    amount: divideTotalAmountPerItem(expense.amount, count) ?? 0,
  }));
}

async function createProductWithUniqueDisplayId(data: Record<string, unknown>) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const displayId = await generateProductDisplayId();
    try {
      return await prisma.inventoryProduct.create({
        data: { ...data, displayId } as never,
        include: productInclude,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        String(error.meta?.target ?? "").includes("displayId")
      ) {
        continue;
      }
      throw error;
    }
  }

  throw AppError.conflict("Failed to generate a unique product ID");
}

export async function listProductBrands() {
  return prisma.inventoryBrand.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

export async function createProductBrand(dto: CreateProductBrandDto) {
  const name = dto.name.trim();
  const existing = await prisma.inventoryBrand.findUnique({ where: { name } });
  if (existing)
    throw AppError.conflict(`Product brand "${name}" already exists`);
  return prisma.inventoryBrand.create({
    data: { name },
    include: { _count: { select: { products: true } } },
  });
}

export async function updateProductBrand(
  id: number,
  dto: UpdateProductBrandDto,
) {
  const brand = await prisma.inventoryBrand.findUnique({ where: { id } });
  if (!brand) throw AppError.notFound("Product brand not found");
  const name = dto.name?.trim();
  if (name) {
    const conflict = await prisma.inventoryBrand.findFirst({
      where: { name, id: { not: id } },
    });
    if (conflict)
      throw AppError.conflict(`Product brand "${name}" already exists`);
  }
  return prisma.inventoryBrand.update({
    where: { id },
    data: name ? { name } : {},
    include: { _count: { select: { products: true } } },
  });
}

export async function deleteProductBrand(id: number) {
  const brand = await prisma.inventoryBrand.findUnique({ where: { id } });
  if (!brand) throw AppError.notFound("Product brand not found");
  await prisma.inventoryBrand.delete({ where: { id } });
}

export async function listProductCategories() {
  return prisma.inventoryCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

export async function createProductCategory(dto: CreateProductCategoryDto) {
  const name = dto.name.trim();
  const existing = await prisma.inventoryCategory.findUnique({
    where: { name },
  });
  if (existing)
    throw AppError.conflict(`Product category "${name}" already exists`);
  return prisma.inventoryCategory.create({
    data: { name },
    include: { _count: { select: { products: true } } },
  });
}

export async function updateProductCategory(
  id: number,
  dto: UpdateProductCategoryDto,
) {
  const category = await prisma.inventoryCategory.findUnique({ where: { id } });
  if (!category) throw AppError.notFound("Product category not found");
  const name = dto.name?.trim();
  if (name) {
    const conflict = await prisma.inventoryCategory.findFirst({
      where: { name, id: { not: id } },
    });
    if (conflict)
      throw AppError.conflict(`Product category "${name}" already exists`);
  }
  return prisma.inventoryCategory.update({
    where: { id },
    data: name ? { name } : {},
    include: { _count: { select: { products: true } } },
  });
}

export async function deleteProductCategory(id: number) {
  const category = await prisma.inventoryCategory.findUnique({ where: { id } });
  if (!category) throw AppError.notFound("Product category not found");
  await prisma.inventoryCategory.delete({ where: { id } });
}

export async function listProducts(query: ProductQueryDto) {
  const { page, limit, brandId, categoryId, supplierId, soldOnly, search } =
    query;
  const skip = (page - 1) * limit;

  const where = {
    ...(brandId ? { brandId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(supplierId ? { supplierId } : {}),
    ...(soldOnly ? { soldQuantity: { gt: 0 } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { displayId: { contains: search, mode: "insensitive" as const } },
            { partNumber: { contains: search, mode: "insensitive" as const } },
            {
              compatibleWith: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            { description: { contains: search, mode: "insensitive" as const } },
            {
              brand: {
                is: {
                  name: { contains: search, mode: "insensitive" as const },
                },
              },
            },
            {
              category: {
                is: {
                  name: { contains: search, mode: "insensitive" as const },
                },
              },
            },
            {
              supplier: {
                is: {
                  name: { contains: search, mode: "insensitive" as const },
                },
              },
            },
          ],
        }
      : {}),
  };

  const [products, total] = await Promise.all([
    prisma.inventoryProduct.findMany({
      where,
      skip,
      take: limit,
      orderBy: soldOnly
        ? [{ lastSoldAt: "desc" }, { updatedAt: "desc" }]
        : [{ categoryId: "asc" }, { brandId: "asc" }, { name: "asc" }],
      include: productInclude,
    }),
    prisma.inventoryProduct.count({ where }),
  ]);

  return {
    products,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getInventoryHealth() {
  const products = await prisma.inventoryProduct.findMany({
    select: { quantity: true, lowStockThreshold: true },
  });

  let inStock = 0;
  let lowStock = 0;
  let outOfStock = 0;

  for (const product of products) {
    if (product.quantity <= 0) {
      outOfStock += 1;
      continue;
    }

    const threshold = product.lowStockThreshold ?? 0;
    if (threshold > 0 && product.quantity <= threshold) {
      lowStock += 1;
    } else {
      inStock += 1;
    }
  }

  return {
    totalProducts: products.length,
    inStock,
    lowStock,
    outOfStock,
  };
}

export async function getProduct(id: number) {
  const product = await prisma.inventoryProduct.findUnique({
    where: { id },
    include: productInclude,
  });
  if (!product) throw AppError.notFound(`Product with id ${id} not found`);
  return product;
}

export async function createProduct(dto: CreateProductDto) {
  const brand = await prisma.inventoryBrand.findUnique({
    where: { id: dto.brandId },
  });
  if (!brand) throw AppError.notFound("Product brand not found");
  const category = await prisma.inventoryCategory.findUnique({
    where: { id: dto.categoryId },
  });
  if (!category) throw AppError.notFound("Product category not found");
  await assertSupplierExists(dto.supplierId);

  const pricingUnitCount = getSafePerItemCount(dto.quantity);
  const expenses = normalizeProductExpensesForCount(
    dto.expenses,
    pricingUnitCount,
  );
  const description = normalizeProductDescription(
    dto.description,
    dto.descriptionPoints,
  );

  return createProductWithUniqueDisplayId({
    brandId: dto.brandId,
    categoryId: dto.categoryId,
    supplierId: dto.supplierId,
    name: dto.name.trim(),
    partNumber: dto.partNumber?.trim() || null,
    compatibleWith: dto.compatibleWith?.trim() || null,
    quantity: dto.quantity ?? 0,
    lowStockThreshold: dto.lowStockThreshold ?? 0,
    purchasePrice: divideTotalAmountPerItem(
      dto.purchasePrice,
      pricingUnitCount,
    ),
    taxPaid: divideTotalAmountPerItem(dto.taxPaid, pricingUnitCount),
    sellingPrice: dto.sellingPrice,
    description,
    additionalExpenses:
      expenses.length > 0
        ? expenses.reduce((sum, expense) => sum + expense.amount, 0)
        : divideTotalAmountPerItem(dto.additionalExpenses, pricingUnitCount),
    ...(expenses.length > 0
      ? {
          expenses: {
            create: expenses,
          },
        }
      : {}),
  });
}

export async function updateProduct(id: number, dto: UpdateProductDto) {
  const existingProduct = await getProduct(id);
  if (dto.brandId) {
    const brand = await prisma.inventoryBrand.findUnique({
      where: { id: dto.brandId },
    });
    if (!brand) throw AppError.notFound("Product brand not found");
  }
  if (dto.categoryId) {
    const category = await prisma.inventoryCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw AppError.notFound("Product category not found");
  }
  const supplierId = dto.supplierId === null ? undefined : dto.supplierId;
  await assertSupplierExists(supplierId);

  const pricingUnitCount = getSafePerItemCount(
    (dto.quantity ?? existingProduct.quantity) +
      (existingProduct.soldQuantity ?? 0),
  );
  const expenses =
    dto.expenses !== undefined
      ? normalizeProductExpensesForCount(dto.expenses, pricingUnitCount)
      : undefined;
  const description =
    dto.description !== undefined || dto.descriptionPoints !== undefined
      ? normalizeProductDescription(dto.description, dto.descriptionPoints)
      : undefined;

  return prisma.inventoryProduct.update({
    where: { id },
    data: {
      ...(dto.brandId !== undefined ? { brandId: dto.brandId } : {}),
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.partNumber !== undefined
        ? { partNumber: dto.partNumber?.trim() || null }
        : {}),
      ...(dto.compatibleWith !== undefined
        ? { compatibleWith: dto.compatibleWith?.trim() || null }
        : {}),
      ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
      ...(dto.lowStockThreshold !== undefined
        ? { lowStockThreshold: dto.lowStockThreshold ?? 0 }
        : {}),
      ...(dto.purchasePrice !== undefined
        ? {
            purchasePrice: divideTotalAmountPerItem(
              dto.purchasePrice,
              pricingUnitCount,
            ),
          }
        : {}),
      ...(dto.taxPaid !== undefined
        ? { taxPaid: divideTotalAmountPerItem(dto.taxPaid, pricingUnitCount) }
        : {}),
      ...(dto.sellingPrice !== undefined
        ? { sellingPrice: dto.sellingPrice }
        : {}),
      ...(description !== undefined
        ? { description: description || null }
        : {}),
      ...(dto.supplierId === null
        ? { supplierId: null }
        : dto.supplierId !== undefined
          ? { supplierId: dto.supplierId }
          : {}),
      ...(expenses !== undefined
        ? {
            additionalExpenses: expenses.reduce(
              (sum, expense) => sum + expense.amount,
              0,
            ),
            expenses: {
              deleteMany: {},
              ...(expenses.length > 0 ? { create: expenses } : {}),
            },
          }
        : dto.additionalExpenses !== undefined
          ? {
              additionalExpenses: divideTotalAmountPerItem(
                dto.additionalExpenses,
                pricingUnitCount,
              ),
            }
          : {}),
    },
    include: productInclude,
  });
}

export async function recordProductSale(id: number, dto: RecordProductSaleDto) {
  const product = await getProduct(id);
  if (dto.quantity > product.quantity) {
    throw new AppError(
      `Only ${product.quantity} items are available in stock`,
      400,
    );
  }

  return prisma.inventoryProduct.update({
    where: { id },
    data: {
      quantity: { decrement: dto.quantity },
      soldQuantity: { increment: dto.quantity },
      lastSoldAt: new Date(),
    },
    include: productInclude,
  });
}

export async function deleteProduct(id: number) {
  await getProduct(id);
  await prisma.inventoryProduct.delete({ where: { id } });
}

// ── Vehicles ──────────────────────────────────────────────────────────────────

const vehicleInclude = {
  brand: { select: { id: true, name: true } },
  model: { select: { id: true, name: true, lowStockThreshold: true } },
  supplier: { select: { id: true, name: true, code: true } },
  expenses: { orderBy: { createdAt: "desc" as const } },
  images: { orderBy: { sortOrder: "asc" as const } },
} as const;

async function createVehicleWithUniqueDisplayId(data: Record<string, unknown>) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const displayId = await generateDisplayId();
    try {
      return await prisma.bikeVehicle.create({
        data: { ...data, displayId } as never,
        include: vehicleInclude,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        String(error.meta?.target ?? "").includes("displayId")
      ) {
        continue;
      }
      throw error;
    }
  }

  throw AppError.conflict("Failed to generate a unique bike ID");
}

/** Grouped summary: one row per brand+model combination with stock count */
export async function vehicleSummary(status?: string) {
  const where = status ? { status } : undefined;
  const vehicles = await prisma.bikeVehicle.findMany({
    where,
    include: vehicleInclude,
    orderBy: [{ brandId: "asc" }, { modelId: "asc" }, { createdAt: "desc" }],
  });

  // Group by brandId + modelId
  type GroupKey = string;
  const groups = new Map<GroupKey, typeof vehicles>();
  for (const v of vehicles) {
    const key: GroupKey = `${v.brandId}_${v.modelId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(v);
  }

  return Array.from(groups.entries()).map(([, items]) => {
    const availableCount = items.filter(
      (vehicle) => vehicle.status === "available",
    ).length;
    const lowStockThreshold = items[0].model.lowStockThreshold ?? 0;

    return {
      brandId: items[0].brandId,
      brandName: items[0].brand.name,
      modelId: items[0].modelId,
      modelName: items[0].model.name,
      lowStockThreshold,
      isLowStock: lowStockThreshold > 0 && availableCount <= lowStockThreshold,
      count: items.length,
      vehicles: items,
    };
  });
}

export async function listVehicles(query: VehicleQueryDto) {
  const {
    page,
    limit,
    brandId,
    modelId,
    colour,
    year,
    fileNo,
    registerNo,
    chassisNo,
    status,
    search,
  } = query;
  const skip = (page - 1) * limit;

  const where = {
    ...(brandId ? { brandId } : {}),
    ...(modelId ? { modelId } : {}),
    ...(colour
      ? { colour: { contains: colour, mode: "insensitive" as const } }
      : {}),
    ...(year ? { year } : {}),
    ...(fileNo
      ? { fileNo: { contains: fileNo, mode: "insensitive" as const } }
      : {}),
    ...(registerNo
      ? { registerNo: { contains: registerNo, mode: "insensitive" as const } }
      : {}),
    ...(chassisNo
      ? { chassisNo: { contains: chassisNo, mode: "insensitive" as const } }
      : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { chassisNo: { contains: search, mode: "insensitive" as const } },
            { engineNo: { contains: search, mode: "insensitive" as const } },
            { registerNo: { contains: search, mode: "insensitive" as const } },
            { displayId: { contains: search, mode: "insensitive" as const } },
            { colour: { contains: search, mode: "insensitive" as const } },
            { fileNo: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [vehicles, total] = await Promise.all([
    prisma.bikeVehicle.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: vehicleInclude,
    }),
    prisma.bikeVehicle.count({ where }),
  ]);

  return {
    vehicles,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getVehicle(id: number) {
  const vehicle = await prisma.bikeVehicle.findUnique({
    where: { id },
    include: vehicleInclude,
  });
  if (!vehicle) throw AppError.notFound(`Vehicle with id ${id} not found`);
  return vehicle;
}

function splitAmountAcrossCount(amount: number | undefined, count: number) {
  if (amount === undefined || !Number.isFinite(amount)) {
    return Array.from({ length: count }, () => undefined as number | undefined);
  }

  const totalCents = Math.round(amount * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents % count;

  return Array.from(
    { length: count },
    (_, index) => (baseCents + (index < remainder ? 1 : 0)) / 100,
  );
}

export async function createVehicle(dto: CreateVehicleDto) {
  const model = await prisma.bikeModel.findUnique({
    where: { id: dto.modelId },
  });
  if (!model) throw AppError.notFound("Model not found");
  if (model.brandId !== dto.brandId)
    throw AppError.validation("Model does not belong to the selected brand");
  await assertSupplierExists(dto.supplierId);

  const { expenses, ...rest } = dto;
  const createData = {
    ...rest,
    status: dto.status ?? "available",
    condition: dto.condition ?? "brandnew",
    mileage: dto.mileage ?? 0,
    registrationType: dto.registrationType ?? "unregistered",
    ...(expenses && expenses.length > 0
      ? { expenses: { create: expenses } }
      : {}),
  } as Record<string, unknown>;

  return createVehicleWithUniqueDisplayId(createData);
}

export async function bulkCreateVehicles(dto: BulkCreateVehicleDto) {
  const model = await prisma.bikeModel.findUnique({
    where: { id: dto.modelId },
  });
  if (!model) throw AppError.notFound("Model not found");
  if (model.brandId !== dto.brandId)
    throw AppError.validation("Model does not belong to the selected brand");
  await assertSupplierExists(dto.supplierId);

  const perBikePurchasePrices = splitAmountAcrossCount(
    dto.purchasePrice,
    dto.count,
  );
  const perBikeTaxAmounts = splitAmountAcrossCount(dto.taxAmount, dto.count);
  const normalizedExpenses = (dto.expenses ?? [])
    .map((expense) => ({
      description: expense.description.trim(),
      perBikeAmounts: splitAmountAcrossCount(Number(expense.amount), dto.count),
    }))
    .filter((expense) => expense.description);

  const created = [];
  for (let i = 0; i < dto.count; i++) {
    const perBikeExpenses = normalizedExpenses.map((expense) => ({
      description: expense.description,
      amount: expense.perBikeAmounts[i] ?? 0,
    }));

    const createData = {
      brandId: dto.brandId,
      modelId: dto.modelId,
      supplierId: dto.supplierId,
      colour: dto.colour,
      engineCapacityCc: dto.engineCapacityCc,
      condition: dto.condition ?? "brandnew",
      mileage: dto.mileage ?? 0,
      year: dto.year,
      registrationType: dto.registrationType ?? "unregistered",
      purchasePrice: perBikePurchasePrices[i],
      taxAmount: perBikeTaxAmounts[i],
      sellingPrice: dto.sellingPrice,
      status: "available",
      ...(perBikeExpenses.length > 0
        ? { expenses: { create: perBikeExpenses } }
        : {}),
    } as Record<string, unknown>;

    const vehicle = await createVehicleWithUniqueDisplayId(createData);
    created.push(vehicle);
  }
  return created;
}

export async function updateVehicle(id: number, dto: UpdateVehicleDto) {
  const existing = await getVehicle(id);
  const brandId = dto.brandId ?? existing.brandId;
  const modelId = dto.modelId ?? existing.modelId;
  const supplierId =
    dto.supplierId === undefined
      ? existing.supplier
        ? existing.supplier.id
        : undefined
      : (dto.supplierId ?? undefined);

  if (dto.modelId || dto.brandId) {
    const model = await prisma.bikeModel.findUnique({ where: { id: modelId } });
    if (!model) throw AppError.notFound("Model not found");
    if (model.brandId !== brandId)
      throw AppError.validation("Model does not belong to the selected brand");
  }

  await assertSupplierExists(supplierId);

  const data: Record<string, unknown> = { ...dto };
  if (dto.status === "sold" && existing.status !== "sold")
    data.soldAt = new Date();
  if (dto.status === "available") data.soldAt = null;

  return prisma.bikeVehicle.update({
    where: { id },
    data,
    include: vehicleInclude,
  });
}

export async function deleteVehicle(id: number) {
  await getVehicle(id);
  await prisma.bikeVehicle.delete({ where: { id } });
}

/** Distinct file numbers already in use — for autocomplete */
export async function listFileNos() {
  const rows = await prisma.bikeVehicle.findMany({
    where: { fileNo: { not: null } },
    select: { fileNo: true },
    distinct: ["fileNo"],
    orderBy: { fileNo: "asc" },
  });
  return rows.map((r) => r.fileNo).filter(Boolean) as string[];
}

export async function renameFileNo(dto: RenameFileNoDto) {
  if (dto.oldFileNo === dto.newFileNo) return { updated: 0 };

  const sourceCount = await prisma.bikeVehicle.count({
    where: { fileNo: dto.oldFileNo },
  });
  if (sourceCount === 0)
    throw AppError.notFound(`File number \"${dto.oldFileNo}\" not found`);

  const targetCount = await prisma.bikeVehicle.count({
    where: { fileNo: dto.newFileNo },
  });
  if (targetCount > 0)
    throw AppError.conflict(`File number \"${dto.newFileNo}\" already exists`);

  const result = await prisma.bikeVehicle.updateMany({
    where: { fileNo: dto.oldFileNo },
    data: { fileNo: dto.newFileNo },
  });

  return { updated: result.count };
}

export async function deleteFileNo(dto: DeleteFileNoDto) {
  const sourceCount = await prisma.bikeVehicle.count({
    where: { fileNo: dto.fileNo },
  });
  if (sourceCount === 0)
    throw AppError.notFound(`File number \"${dto.fileNo}\" not found`);

  const result = await prisma.bikeVehicle.updateMany({
    where: { fileNo: dto.fileNo },
    data: { fileNo: null },
  });

  return { updated: result.count };
}

// ── Vehicle Expenses ──────────────────────────────────────────────────────────

export async function addExpense(vehicleId: number, dto: AddExpenseDto) {
  await getVehicle(vehicleId);
  return prisma.bikeVehicleExpense.create({
    data: { vehicleId, description: dto.description, amount: dto.amount },
  });
}

export async function listExpenses(vehicleId: number) {
  await getVehicle(vehicleId);
  const expenses = await prisma.bikeVehicleExpense.findMany({
    where: { vehicleId },
    orderBy: { createdAt: "desc" },
  });
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  return { expenses, total };
}

export async function deleteExpense(vehicleId: number, expenseId: number) {
  const expense = await prisma.bikeVehicleExpense.findFirst({
    where: { id: expenseId, vehicleId },
  });
  if (!expense) throw AppError.notFound("Expense not found");
  await prisma.bikeVehicleExpense.delete({ where: { id: expenseId } });
}

// ── Vehicle Images ────────────────────────────────────────────────────────────

export async function addVehicleImages(
  vehicleId: number,
  files: { filename: string }[],
) {
  await getVehicle(vehicleId);

  const existingCount = await prisma.bikeVehicleImage.count({
    where: { vehicleId },
  });
  if (existingCount + files.length > 6) {
    throw AppError.validation(
      `Maximum 6 images allowed. This vehicle already has ${existingCount}.`,
    );
  }

  const images = [];
  for (let i = 0; i < files.length; i++) {
    const sortOrder = existingCount + i;
    const img = await prisma.bikeVehicleImage.create({
      data: {
        vehicleId,
        url: `/uploads/bikes/${files[i].filename}`,
        isPrimary: existingCount === 0 && i === 0,
        sortOrder,
      },
    });
    images.push(img);
  }
  return images;
}

export async function listVehicleImages(vehicleId: number) {
  await getVehicle(vehicleId);
  return prisma.bikeVehicleImage.findMany({
    where: { vehicleId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function deleteVehicleImage(vehicleId: number, imageId: number) {
  const image = await prisma.bikeVehicleImage.findFirst({
    where: { id: imageId, vehicleId },
  });
  if (!image) throw AppError.notFound("Image not found");

  await prisma.bikeVehicleImage.delete({ where: { id: imageId } });

  // If deleted image was primary, promote the next one
  if (image.isPrimary) {
    const next = await prisma.bikeVehicleImage.findFirst({
      where: { vehicleId },
      orderBy: { sortOrder: "asc" },
    });
    if (next) {
      await prisma.bikeVehicleImage.update({
        where: { id: next.id },
        data: { isPrimary: true },
      });
    }
  }

  return image;
}

export async function setPrimaryImage(vehicleId: number, imageId: number) {
  const image = await prisma.bikeVehicleImage.findFirst({
    where: { id: imageId, vehicleId },
  });
  if (!image) throw AppError.notFound("Image not found");

  await prisma.bikeVehicleImage.updateMany({
    where: { vehicleId },
    data: { isPrimary: false },
  });
  await prisma.bikeVehicleImage.update({
    where: { id: imageId },
    data: { isPrimary: true },
  });
  return prisma.bikeVehicleImage.findMany({
    where: { vehicleId },
    orderBy: { sortOrder: "asc" },
  });
}

// ── Product Images ───────────────────────────────────────────────────────────

export async function addProductImages(
  productId: number,
  files: { filename: string }[],
) {
  await getProduct(productId);

  const existingCount = await prisma.inventoryProductImage.count({
    where: { productId },
  });
  if (existingCount + files.length > 3) {
    throw AppError.validation(
      `Maximum 3 images allowed. This product already has ${existingCount}.`,
    );
  }

  const images = [];
  for (let i = 0; i < files.length; i++) {
    const sortOrder = existingCount + i;
    const image = await prisma.inventoryProductImage.create({
      data: {
        productId,
        url: `/uploads/products/${files[i].filename}`,
        isPrimary: existingCount === 0 && i === 0,
        sortOrder,
      },
    });
    images.push(image);
  }
  return images;
}

export async function listProductImages(productId: number) {
  await getProduct(productId);
  return prisma.inventoryProductImage.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function deleteProductImage(productId: number, imageId: number) {
  const image = await prisma.inventoryProductImage.findFirst({
    where: { id: imageId, productId },
  });
  if (!image) throw AppError.notFound("Image not found");

  await prisma.inventoryProductImage.delete({ where: { id: imageId } });

  if (image.isPrimary) {
    const next = await prisma.inventoryProductImage.findFirst({
      where: { productId },
      orderBy: { sortOrder: "asc" },
    });
    if (next) {
      await prisma.inventoryProductImage.update({
        where: { id: next.id },
        data: { isPrimary: true },
      });
    }
  }

  return image;
}

export async function setPrimaryProductImage(
  productId: number,
  imageId: number,
) {
  const image = await prisma.inventoryProductImage.findFirst({
    where: { id: imageId, productId },
  });
  if (!image) throw AppError.notFound("Image not found");

  await prisma.inventoryProductImage.updateMany({
    where: { productId },
    data: { isPrimary: false },
  });
  await prisma.inventoryProductImage.update({
    where: { id: imageId },
    data: { isPrimary: true },
  });
  return prisma.inventoryProductImage.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
  });
}
