import { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";
import type { CreateSupplierDto, UpdateSupplierDto } from "./dto/supplier.dto";
import type {
  CreateProductBrandDto,
  UpdateProductBrandDto,
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
  CreateProductDto,
  UpdateProductDto,
  RecordProductSaleDto,
  RestockProductDto,
  ProductQueryDto,
} from "./dto/product.dto";

// ── Utility: generate unique display/code values ────────────────────────────
async function generateSupplierCode(): Promise<string> {
  const latest = await prisma.supplier.findFirst({
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

// partNumber holds the product barcode; a scan must resolve to exactly one product.
async function assertBarcodeAvailable(barcode: string | null | undefined, excludeProductId?: number) {
  const value = barcode?.trim();
  if (!value) return;
  const existing = await prisma.inventoryProduct.findFirst({
    where: {
      partNumber: { equals: value, mode: "insensitive" },
      ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
    },
    select: { name: true, displayId: true },
  });
  if (existing) {
    throw AppError.conflict(`Barcode ${value} is already used by ${existing.name} (${existing.displayId})`);
  }
}

async function assertSupplierExists(supplierId?: number) {
  if (!supplierId) return;
  const supplier = await prisma.supplier.findUnique({
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

// ── Suppliers ─────────────────────────────────────────────────────────────────

export async function listSuppliers() {
  return prisma.supplier.findMany({
    orderBy: [{ name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
}

export async function getSupplier(id: number) {
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!supplier) throw AppError.notFound(`Supplier with id ${id} not found`);
  return supplier;
}

export async function createSupplier(dto: CreateSupplierDto) {
  const normalized = normalizeSupplierInput(dto);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = await generateSupplierCode();
    try {
      return await prisma.supplier.create({
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
        include: { _count: { select: { products: true } } },
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
  return prisma.supplier.update({
    where: { id },
    data: normalizeSupplierInput(dto),
    include: { _count: { select: { products: true } } },
  });
}

export async function deleteSupplier(id: number) {
  await getSupplier(id);
  await prisma.supplier.delete({ where: { id } });
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
  await assertBarcodeAvailable(dto.partNumber);

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
  await assertBarcodeAvailable(dto.partNumber, id);

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

/**
 * Adds received stock to an existing product. Optional batch purchase price / tax are blended
 * into the per-unit cost as a weighted average over the units currently in stock.
 */
export async function restockProduct(id: number, dto: RestockProductDto) {
  const product = await getProduct(id);
  const currentUnits = Math.max(product.quantity, 0);
  const totalUnits = currentUnits + dto.quantity;

  const blendUnitCost = (currentUnitCost: number | null, batchTotal?: number) => {
    if (batchTotal === undefined) return undefined;
    const existingValue = (currentUnitCost ?? 0) * currentUnits;
    return Math.round(((existingValue + batchTotal) / totalUnits) * 100) / 100;
  };
  const purchasePrice = blendUnitCost(product.purchasePrice, dto.purchasePrice);
  const taxPaid = blendUnitCost(product.taxPaid, dto.taxPaid);

  return prisma.inventoryProduct.update({
    where: { id },
    data: {
      quantity: { increment: dto.quantity },
      ...(purchasePrice !== undefined ? { purchasePrice } : {}),
      ...(taxPaid !== undefined ? { taxPaid } : {}),
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
