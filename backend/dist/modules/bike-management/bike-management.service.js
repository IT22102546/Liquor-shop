"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listBrands = listBrands;
exports.getBrand = getBrand;
exports.createBrand = createBrand;
exports.updateBrand = updateBrand;
exports.deleteBrand = deleteBrand;
exports.listModels = listModels;
exports.listAllModels = listAllModels;
exports.getModel = getModel;
exports.createModel = createModel;
exports.updateModel = updateModel;
exports.deleteModel = deleteModel;
exports.listColors = listColors;
exports.createColor = createColor;
exports.updateColor = updateColor;
exports.deleteColor = deleteColor;
exports.listSuppliers = listSuppliers;
exports.getSupplier = getSupplier;
exports.createSupplier = createSupplier;
exports.updateSupplier = updateSupplier;
exports.deleteSupplier = deleteSupplier;
exports.listProductBrands = listProductBrands;
exports.createProductBrand = createProductBrand;
exports.updateProductBrand = updateProductBrand;
exports.deleteProductBrand = deleteProductBrand;
exports.listProductCategories = listProductCategories;
exports.createProductCategory = createProductCategory;
exports.updateProductCategory = updateProductCategory;
exports.deleteProductCategory = deleteProductCategory;
exports.listProducts = listProducts;
exports.getInventoryHealth = getInventoryHealth;
exports.getProduct = getProduct;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.recordProductSale = recordProductSale;
exports.deleteProduct = deleteProduct;
exports.vehicleSummary = vehicleSummary;
exports.listVehicles = listVehicles;
exports.getVehicle = getVehicle;
exports.createVehicle = createVehicle;
exports.bulkCreateVehicles = bulkCreateVehicles;
exports.updateVehicle = updateVehicle;
exports.deleteVehicle = deleteVehicle;
exports.listFileNos = listFileNos;
exports.renameFileNo = renameFileNo;
exports.deleteFileNo = deleteFileNo;
exports.addExpense = addExpense;
exports.listExpenses = listExpenses;
exports.deleteExpense = deleteExpense;
exports.addVehicleImages = addVehicleImages;
exports.listVehicleImages = listVehicleImages;
exports.deleteVehicleImage = deleteVehicleImage;
exports.setPrimaryImage = setPrimaryImage;
exports.addProductImages = addProductImages;
exports.listProductImages = listProductImages;
exports.deleteProductImage = deleteProductImage;
exports.setPrimaryProductImage = setPrimaryProductImage;
const prisma_1 = require("../../generated/prisma");
const prisma_client_1 = require("../../database/prisma.client");
const errors_1 = require("../../common/utils/errors");
async function generateDisplayId() {
    const latest = await prisma_client_1.prisma.bikeVehicle.findFirst({
        orderBy: { id: "desc" },
        select: { displayId: true },
    });
    const current = latest?.displayId
        ? Number.parseInt(latest.displayId.replace(/^JLR-/, ""), 10)
        : 0;
    return `JLR-${String(Number.isFinite(current) ? current + 1 : 1).padStart(5, "0")}`;
}
async function generateSupplierCode() {
    const latest = await prisma_client_1.prisma.bikeSupplier.findFirst({
        orderBy: { id: "desc" },
        select: { code: true },
    });
    const current = latest?.code
        ? Number.parseInt(latest.code.replace(/^SUP-/, ""), 10)
        : 0;
    return `SUP-${String(Number.isFinite(current) ? current + 1 : 1).padStart(5, "0")}`;
}
async function generateProductDisplayId() {
    const latest = await prisma_client_1.prisma.inventoryProduct.findFirst({
        orderBy: { id: "desc" },
        select: { displayId: true },
    });
    const current = latest?.displayId
        ? Number.parseInt(latest.displayId.replace(/^PRD-/, ""), 10)
        : 0;
    return `PRD-${String(Number.isFinite(current) ? current + 1 : 1).padStart(5, "0")}`;
}
async function assertSupplierExists(supplierId) {
    if (!supplierId)
        return;
    const supplier = await prisma_client_1.prisma.bikeSupplier.findUnique({
        where: { id: supplierId },
    });
    if (!supplier)
        throw errors_1.AppError.notFound("Supplier not found");
}
function normalizeSupplierInput(dto) {
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
async function listBrands() {
    return prisma_client_1.prisma.bikeBrand.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { models: true, vehicles: true } } },
    });
}
async function getBrand(id) {
    const brand = await prisma_client_1.prisma.bikeBrand.findUnique({
        where: { id },
        include: { models: { orderBy: { name: "asc" } } },
    });
    if (!brand)
        throw errors_1.AppError.notFound(`Brand with id ${id} not found`);
    return brand;
}
async function createBrand(dto) {
    const existing = await prisma_client_1.prisma.bikeBrand.findUnique({
        where: { name: dto.name },
    });
    if (existing)
        throw errors_1.AppError.conflict(`Brand "${dto.name}" already exists`);
    return prisma_client_1.prisma.bikeBrand.create({ data: { name: dto.name } });
}
async function updateBrand(id, dto) {
    await getBrand(id);
    if (dto.name) {
        const conflict = await prisma_client_1.prisma.bikeBrand.findFirst({
            where: { name: dto.name, id: { not: id } },
        });
        if (conflict)
            throw errors_1.AppError.conflict(`Brand "${dto.name}" already exists`);
    }
    return prisma_client_1.prisma.bikeBrand.update({ where: { id }, data: dto });
}
async function deleteBrand(id) {
    await getBrand(id);
    await prisma_client_1.prisma.bikeBrand.delete({ where: { id } });
}
async function listModels(brandId) {
    await getBrand(brandId);
    return prisma_client_1.prisma.bikeModel.findMany({
        where: { brandId },
        orderBy: { name: "asc" },
        include: { _count: { select: { vehicles: true } } },
    });
}
async function listAllModels() {
    return prisma_client_1.prisma.bikeModel.findMany({
        orderBy: { name: "asc" },
        include: {
            brand: { select: { id: true, name: true } },
            _count: { select: { vehicles: true } },
        },
    });
}
async function getModel(id) {
    const model = await prisma_client_1.prisma.bikeModel.findUnique({ where: { id } });
    if (!model)
        throw errors_1.AppError.notFound(`Model with id ${id} not found`);
    return model;
}
async function createModel(brandId, dto) {
    await getBrand(brandId);
    const existing = await prisma_client_1.prisma.bikeModel.findUnique({
        where: { name_brandId: { name: dto.name, brandId } },
    });
    if (existing)
        throw errors_1.AppError.conflict(`Model "${dto.name}" already exists for this brand`);
    return prisma_client_1.prisma.bikeModel.create({
        data: {
            name: dto.name,
            brandId,
            lowStockThreshold: dto.lowStockThreshold ?? 0,
        },
    });
}
async function updateModel(id, dto) {
    const model = await getModel(id);
    if (dto.name) {
        const conflict = await prisma_client_1.prisma.bikeModel.findFirst({
            where: { name: dto.name, brandId: model.brandId, id: { not: id } },
        });
        if (conflict)
            throw errors_1.AppError.conflict(`Model "${dto.name}" already exists for this brand`);
    }
    return prisma_client_1.prisma.bikeModel.update({
        where: { id },
        data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.lowStockThreshold !== undefined
                ? { lowStockThreshold: dto.lowStockThreshold ?? 0 }
                : {}),
        },
    });
}
async function deleteModel(id) {
    await getModel(id);
    await prisma_client_1.prisma.bikeModel.delete({ where: { id } });
}
async function listColors() {
    return prisma_client_1.prisma.bikeColor.findMany({ orderBy: { name: "asc" } });
}
async function createColor(dto) {
    const existing = await prisma_client_1.prisma.bikeColor.findUnique({
        where: { name: dto.name },
    });
    if (existing)
        throw errors_1.AppError.conflict(`Color "${dto.name}" already exists`);
    return prisma_client_1.prisma.bikeColor.create({ data: { name: dto.name } });
}
async function updateColor(id, dto) {
    const color = await prisma_client_1.prisma.bikeColor.findUnique({ where: { id } });
    if (!color)
        throw errors_1.AppError.notFound("Color not found");
    if (dto.name) {
        const conflict = await prisma_client_1.prisma.bikeColor.findFirst({
            where: { name: dto.name, id: { not: id } },
        });
        if (conflict)
            throw errors_1.AppError.conflict(`Color "${dto.name}" already exists`);
    }
    return prisma_client_1.prisma.bikeColor.update({ where: { id }, data: dto });
}
async function deleteColor(id) {
    const color = await prisma_client_1.prisma.bikeColor.findUnique({ where: { id } });
    if (!color)
        throw errors_1.AppError.notFound("Color not found");
    await prisma_client_1.prisma.bikeColor.delete({ where: { id } });
}
async function listSuppliers() {
    return prisma_client_1.prisma.bikeSupplier.findMany({
        orderBy: [{ name: "asc" }],
        include: { _count: { select: { vehicles: true, products: true } } },
    });
}
async function getSupplier(id) {
    const supplier = await prisma_client_1.prisma.bikeSupplier.findUnique({
        where: { id },
        include: { _count: { select: { vehicles: true, products: true } } },
    });
    if (!supplier)
        throw errors_1.AppError.notFound(`Supplier with id ${id} not found`);
    return supplier;
}
async function createSupplier(dto) {
    const normalized = normalizeSupplierInput(dto);
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = await generateSupplierCode();
        try {
            return await prisma_client_1.prisma.bikeSupplier.create({
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
        }
        catch (error) {
            if (error instanceof prisma_1.Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002") {
                continue;
            }
            throw error;
        }
    }
    throw errors_1.AppError.conflict("Failed to generate a unique supplier code");
}
async function updateSupplier(id, dto) {
    await getSupplier(id);
    return prisma_client_1.prisma.bikeSupplier.update({
        where: { id },
        data: normalizeSupplierInput(dto),
        include: { _count: { select: { vehicles: true, products: true } } },
    });
}
async function deleteSupplier(id) {
    await getSupplier(id);
    await prisma_client_1.prisma.bikeSupplier.delete({ where: { id } });
}
const productInclude = {
    brand: { select: { id: true, name: true } },
    category: { select: { id: true, name: true } },
    supplier: { select: { id: true, name: true, code: true } },
    expenses: { orderBy: { createdAt: "desc" } },
    images: { orderBy: { sortOrder: "asc" } },
};
function normalizeProductDescription(description, descriptionPoints) {
    const normalizedPoints = (descriptionPoints ?? [])
        .map((point) => point.trim())
        .filter(Boolean);
    if (normalizedPoints.length > 0) {
        return normalizedPoints.map((point) => `• ${point}`).join("\n");
    }
    const fallback = description?.trim();
    return fallback || undefined;
}
function normalizeProductExpenses(expenses) {
    return (expenses ?? [])
        .map((expense) => ({
        description: expense.description.trim(),
        amount: Number(expense.amount),
    }))
        .filter((expense) => expense.description &&
        Number.isFinite(expense.amount) &&
        expense.amount >= 0);
}
function getSafePerItemCount(count) {
    if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) {
        return 1;
    }
    return Math.max(Math.floor(count), 1);
}
function divideTotalAmountPerItem(amount, count) {
    if (amount === undefined || !Number.isFinite(amount)) {
        return undefined;
    }
    const safeCount = getSafePerItemCount(count);
    return Math.round((amount / safeCount) * 100) / 100;
}
function normalizeProductExpensesForCount(expenses, count) {
    return normalizeProductExpenses(expenses).map((expense) => ({
        ...expense,
        amount: divideTotalAmountPerItem(expense.amount, count) ?? 0,
    }));
}
async function createProductWithUniqueDisplayId(data) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const displayId = await generateProductDisplayId();
        try {
            return await prisma_client_1.prisma.inventoryProduct.create({
                data: { ...data, displayId },
                include: productInclude,
            });
        }
        catch (error) {
            if (error instanceof prisma_1.Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002" &&
                String(error.meta?.target ?? "").includes("displayId")) {
                continue;
            }
            throw error;
        }
    }
    throw errors_1.AppError.conflict("Failed to generate a unique product ID");
}
async function listProductBrands() {
    return prisma_client_1.prisma.inventoryBrand.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { products: true } } },
    });
}
async function createProductBrand(dto) {
    const name = dto.name.trim();
    const existing = await prisma_client_1.prisma.inventoryBrand.findUnique({ where: { name } });
    if (existing)
        throw errors_1.AppError.conflict(`Product brand "${name}" already exists`);
    return prisma_client_1.prisma.inventoryBrand.create({
        data: { name },
        include: { _count: { select: { products: true } } },
    });
}
async function updateProductBrand(id, dto) {
    const brand = await prisma_client_1.prisma.inventoryBrand.findUnique({ where: { id } });
    if (!brand)
        throw errors_1.AppError.notFound("Product brand not found");
    const name = dto.name?.trim();
    if (name) {
        const conflict = await prisma_client_1.prisma.inventoryBrand.findFirst({
            where: { name, id: { not: id } },
        });
        if (conflict)
            throw errors_1.AppError.conflict(`Product brand "${name}" already exists`);
    }
    return prisma_client_1.prisma.inventoryBrand.update({
        where: { id },
        data: name ? { name } : {},
        include: { _count: { select: { products: true } } },
    });
}
async function deleteProductBrand(id) {
    const brand = await prisma_client_1.prisma.inventoryBrand.findUnique({ where: { id } });
    if (!brand)
        throw errors_1.AppError.notFound("Product brand not found");
    await prisma_client_1.prisma.inventoryBrand.delete({ where: { id } });
}
async function listProductCategories() {
    return prisma_client_1.prisma.inventoryCategory.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { products: true } } },
    });
}
async function createProductCategory(dto) {
    const name = dto.name.trim();
    const existing = await prisma_client_1.prisma.inventoryCategory.findUnique({
        where: { name },
    });
    if (existing)
        throw errors_1.AppError.conflict(`Product category "${name}" already exists`);
    return prisma_client_1.prisma.inventoryCategory.create({
        data: { name },
        include: { _count: { select: { products: true } } },
    });
}
async function updateProductCategory(id, dto) {
    const category = await prisma_client_1.prisma.inventoryCategory.findUnique({ where: { id } });
    if (!category)
        throw errors_1.AppError.notFound("Product category not found");
    const name = dto.name?.trim();
    if (name) {
        const conflict = await prisma_client_1.prisma.inventoryCategory.findFirst({
            where: { name, id: { not: id } },
        });
        if (conflict)
            throw errors_1.AppError.conflict(`Product category "${name}" already exists`);
    }
    return prisma_client_1.prisma.inventoryCategory.update({
        where: { id },
        data: name ? { name } : {},
        include: { _count: { select: { products: true } } },
    });
}
async function deleteProductCategory(id) {
    const category = await prisma_client_1.prisma.inventoryCategory.findUnique({ where: { id } });
    if (!category)
        throw errors_1.AppError.notFound("Product category not found");
    await prisma_client_1.prisma.inventoryCategory.delete({ where: { id } });
}
async function listProducts(query) {
    const { page, limit, brandId, categoryId, supplierId, soldOnly, search } = query;
    const skip = (page - 1) * limit;
    const where = {
        ...(brandId ? { brandId } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(supplierId ? { supplierId } : {}),
        ...(soldOnly ? { soldQuantity: { gt: 0 } } : {}),
        ...(search
            ? {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { displayId: { contains: search, mode: "insensitive" } },
                    { partNumber: { contains: search, mode: "insensitive" } },
                    {
                        compatibleWith: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                    { description: { contains: search, mode: "insensitive" } },
                    {
                        brand: {
                            is: {
                                name: { contains: search, mode: "insensitive" },
                            },
                        },
                    },
                    {
                        category: {
                            is: {
                                name: { contains: search, mode: "insensitive" },
                            },
                        },
                    },
                    {
                        supplier: {
                            is: {
                                name: { contains: search, mode: "insensitive" },
                            },
                        },
                    },
                ],
            }
            : {}),
    };
    const [products, total] = await Promise.all([
        prisma_client_1.prisma.inventoryProduct.findMany({
            where,
            skip,
            take: limit,
            orderBy: soldOnly
                ? [{ lastSoldAt: "desc" }, { updatedAt: "desc" }]
                : [{ categoryId: "asc" }, { brandId: "asc" }, { name: "asc" }],
            include: productInclude,
        }),
        prisma_client_1.prisma.inventoryProduct.count({ where }),
    ]);
    return {
        products,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
}
async function getInventoryHealth() {
    const products = await prisma_client_1.prisma.inventoryProduct.findMany({
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
        }
        else {
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
async function getProduct(id) {
    const product = await prisma_client_1.prisma.inventoryProduct.findUnique({
        where: { id },
        include: productInclude,
    });
    if (!product)
        throw errors_1.AppError.notFound(`Product with id ${id} not found`);
    return product;
}
async function createProduct(dto) {
    const brand = await prisma_client_1.prisma.inventoryBrand.findUnique({
        where: { id: dto.brandId },
    });
    if (!brand)
        throw errors_1.AppError.notFound("Product brand not found");
    const category = await prisma_client_1.prisma.inventoryCategory.findUnique({
        where: { id: dto.categoryId },
    });
    if (!category)
        throw errors_1.AppError.notFound("Product category not found");
    await assertSupplierExists(dto.supplierId);
    const pricingUnitCount = getSafePerItemCount(dto.quantity);
    const expenses = normalizeProductExpensesForCount(dto.expenses, pricingUnitCount);
    const description = normalizeProductDescription(dto.description, dto.descriptionPoints);
    return createProductWithUniqueDisplayId({
        brandId: dto.brandId,
        categoryId: dto.categoryId,
        supplierId: dto.supplierId,
        name: dto.name.trim(),
        partNumber: dto.partNumber?.trim() || null,
        compatibleWith: dto.compatibleWith?.trim() || null,
        quantity: dto.quantity ?? 0,
        lowStockThreshold: dto.lowStockThreshold ?? 0,
        purchasePrice: divideTotalAmountPerItem(dto.purchasePrice, pricingUnitCount),
        taxPaid: divideTotalAmountPerItem(dto.taxPaid, pricingUnitCount),
        sellingPrice: dto.sellingPrice,
        description,
        additionalExpenses: expenses.length > 0
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
async function updateProduct(id, dto) {
    const existingProduct = await getProduct(id);
    if (dto.brandId) {
        const brand = await prisma_client_1.prisma.inventoryBrand.findUnique({
            where: { id: dto.brandId },
        });
        if (!brand)
            throw errors_1.AppError.notFound("Product brand not found");
    }
    if (dto.categoryId) {
        const category = await prisma_client_1.prisma.inventoryCategory.findUnique({
            where: { id: dto.categoryId },
        });
        if (!category)
            throw errors_1.AppError.notFound("Product category not found");
    }
    const supplierId = dto.supplierId === null ? undefined : dto.supplierId;
    await assertSupplierExists(supplierId);
    const pricingUnitCount = getSafePerItemCount((dto.quantity ?? existingProduct.quantity) +
        (existingProduct.soldQuantity ?? 0));
    const expenses = dto.expenses !== undefined
        ? normalizeProductExpensesForCount(dto.expenses, pricingUnitCount)
        : undefined;
    const description = dto.description !== undefined || dto.descriptionPoints !== undefined
        ? normalizeProductDescription(dto.description, dto.descriptionPoints)
        : undefined;
    return prisma_client_1.prisma.inventoryProduct.update({
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
                    purchasePrice: divideTotalAmountPerItem(dto.purchasePrice, pricingUnitCount),
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
                    additionalExpenses: expenses.reduce((sum, expense) => sum + expense.amount, 0),
                    expenses: {
                        deleteMany: {},
                        ...(expenses.length > 0 ? { create: expenses } : {}),
                    },
                }
                : dto.additionalExpenses !== undefined
                    ? {
                        additionalExpenses: divideTotalAmountPerItem(dto.additionalExpenses, pricingUnitCount),
                    }
                    : {}),
        },
        include: productInclude,
    });
}
async function recordProductSale(id, dto) {
    const product = await getProduct(id);
    if (dto.quantity > product.quantity) {
        throw new errors_1.AppError(`Only ${product.quantity} items are available in stock`, 400);
    }
    return prisma_client_1.prisma.inventoryProduct.update({
        where: { id },
        data: {
            quantity: { decrement: dto.quantity },
            soldQuantity: { increment: dto.quantity },
            lastSoldAt: new Date(),
        },
        include: productInclude,
    });
}
async function deleteProduct(id) {
    await getProduct(id);
    await prisma_client_1.prisma.inventoryProduct.delete({ where: { id } });
}
const vehicleInclude = {
    brand: { select: { id: true, name: true } },
    model: { select: { id: true, name: true, lowStockThreshold: true } },
    supplier: { select: { id: true, name: true, code: true } },
    expenses: { orderBy: { createdAt: "desc" } },
    images: { orderBy: { sortOrder: "asc" } },
};
async function createVehicleWithUniqueDisplayId(data) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const displayId = await generateDisplayId();
        try {
            return await prisma_client_1.prisma.bikeVehicle.create({
                data: { ...data, displayId },
                include: vehicleInclude,
            });
        }
        catch (error) {
            if (error instanceof prisma_1.Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002" &&
                String(error.meta?.target ?? "").includes("displayId")) {
                continue;
            }
            throw error;
        }
    }
    throw errors_1.AppError.conflict("Failed to generate a unique bike ID");
}
async function vehicleSummary(status) {
    const where = status ? { status } : undefined;
    const vehicles = await prisma_client_1.prisma.bikeVehicle.findMany({
        where,
        include: vehicleInclude,
        orderBy: [{ brandId: "asc" }, { modelId: "asc" }, { createdAt: "desc" }],
    });
    const groups = new Map();
    for (const v of vehicles) {
        const key = `${v.brandId}_${v.modelId}`;
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key).push(v);
    }
    return Array.from(groups.entries()).map(([, items]) => {
        const availableCount = items.filter((vehicle) => vehicle.status === "available").length;
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
async function listVehicles(query) {
    const { page, limit, brandId, modelId, colour, year, fileNo, registerNo, chassisNo, status, search, } = query;
    const skip = (page - 1) * limit;
    const where = {
        ...(brandId ? { brandId } : {}),
        ...(modelId ? { modelId } : {}),
        ...(colour
            ? { colour: { contains: colour, mode: "insensitive" } }
            : {}),
        ...(year ? { year } : {}),
        ...(fileNo
            ? { fileNo: { contains: fileNo, mode: "insensitive" } }
            : {}),
        ...(registerNo
            ? { registerNo: { contains: registerNo, mode: "insensitive" } }
            : {}),
        ...(chassisNo
            ? { chassisNo: { contains: chassisNo, mode: "insensitive" } }
            : {}),
        ...(status ? { status } : {}),
        ...(search
            ? {
                OR: [
                    { chassisNo: { contains: search, mode: "insensitive" } },
                    { engineNo: { contains: search, mode: "insensitive" } },
                    { registerNo: { contains: search, mode: "insensitive" } },
                    { displayId: { contains: search, mode: "insensitive" } },
                    { colour: { contains: search, mode: "insensitive" } },
                    { fileNo: { contains: search, mode: "insensitive" } },
                ],
            }
            : {}),
    };
    const [vehicles, total] = await Promise.all([
        prisma_client_1.prisma.bikeVehicle.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: vehicleInclude,
        }),
        prisma_client_1.prisma.bikeVehicle.count({ where }),
    ]);
    return {
        vehicles,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
}
async function getVehicle(id) {
    const vehicle = await prisma_client_1.prisma.bikeVehicle.findUnique({
        where: { id },
        include: vehicleInclude,
    });
    if (!vehicle)
        throw errors_1.AppError.notFound(`Vehicle with id ${id} not found`);
    return vehicle;
}
function splitAmountAcrossCount(amount, count) {
    if (amount === undefined || !Number.isFinite(amount)) {
        return Array.from({ length: count }, () => undefined);
    }
    const totalCents = Math.round(amount * 100);
    const baseCents = Math.floor(totalCents / count);
    const remainder = totalCents % count;
    return Array.from({ length: count }, (_, index) => (baseCents + (index < remainder ? 1 : 0)) / 100);
}
async function createVehicle(dto) {
    const model = await prisma_client_1.prisma.bikeModel.findUnique({
        where: { id: dto.modelId },
    });
    if (!model)
        throw errors_1.AppError.notFound("Model not found");
    if (model.brandId !== dto.brandId)
        throw errors_1.AppError.validation("Model does not belong to the selected brand");
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
    };
    return createVehicleWithUniqueDisplayId(createData);
}
async function bulkCreateVehicles(dto) {
    const model = await prisma_client_1.prisma.bikeModel.findUnique({
        where: { id: dto.modelId },
    });
    if (!model)
        throw errors_1.AppError.notFound("Model not found");
    if (model.brandId !== dto.brandId)
        throw errors_1.AppError.validation("Model does not belong to the selected brand");
    await assertSupplierExists(dto.supplierId);
    const perBikePurchasePrices = splitAmountAcrossCount(dto.purchasePrice, dto.count);
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
        };
        const vehicle = await createVehicleWithUniqueDisplayId(createData);
        created.push(vehicle);
    }
    return created;
}
async function updateVehicle(id, dto) {
    const existing = await getVehicle(id);
    const brandId = dto.brandId ?? existing.brandId;
    const modelId = dto.modelId ?? existing.modelId;
    const supplierId = dto.supplierId === undefined
        ? existing.supplier
            ? existing.supplier.id
            : undefined
        : (dto.supplierId ?? undefined);
    if (dto.modelId || dto.brandId) {
        const model = await prisma_client_1.prisma.bikeModel.findUnique({ where: { id: modelId } });
        if (!model)
            throw errors_1.AppError.notFound("Model not found");
        if (model.brandId !== brandId)
            throw errors_1.AppError.validation("Model does not belong to the selected brand");
    }
    await assertSupplierExists(supplierId);
    const data = { ...dto };
    if (dto.status === "sold" && existing.status !== "sold")
        data.soldAt = new Date();
    if (dto.status === "available")
        data.soldAt = null;
    return prisma_client_1.prisma.bikeVehicle.update({
        where: { id },
        data,
        include: vehicleInclude,
    });
}
async function deleteVehicle(id) {
    await getVehicle(id);
    await prisma_client_1.prisma.bikeVehicle.delete({ where: { id } });
}
async function listFileNos() {
    const rows = await prisma_client_1.prisma.bikeVehicle.findMany({
        where: { fileNo: { not: null } },
        select: { fileNo: true },
        distinct: ["fileNo"],
        orderBy: { fileNo: "asc" },
    });
    return rows.map((r) => r.fileNo).filter(Boolean);
}
async function renameFileNo(dto) {
    if (dto.oldFileNo === dto.newFileNo)
        return { updated: 0 };
    const sourceCount = await prisma_client_1.prisma.bikeVehicle.count({
        where: { fileNo: dto.oldFileNo },
    });
    if (sourceCount === 0)
        throw errors_1.AppError.notFound(`File number \"${dto.oldFileNo}\" not found`);
    const targetCount = await prisma_client_1.prisma.bikeVehicle.count({
        where: { fileNo: dto.newFileNo },
    });
    if (targetCount > 0)
        throw errors_1.AppError.conflict(`File number \"${dto.newFileNo}\" already exists`);
    const result = await prisma_client_1.prisma.bikeVehicle.updateMany({
        where: { fileNo: dto.oldFileNo },
        data: { fileNo: dto.newFileNo },
    });
    return { updated: result.count };
}
async function deleteFileNo(dto) {
    const sourceCount = await prisma_client_1.prisma.bikeVehicle.count({
        where: { fileNo: dto.fileNo },
    });
    if (sourceCount === 0)
        throw errors_1.AppError.notFound(`File number \"${dto.fileNo}\" not found`);
    const result = await prisma_client_1.prisma.bikeVehicle.updateMany({
        where: { fileNo: dto.fileNo },
        data: { fileNo: null },
    });
    return { updated: result.count };
}
async function addExpense(vehicleId, dto) {
    await getVehicle(vehicleId);
    return prisma_client_1.prisma.bikeVehicleExpense.create({
        data: { vehicleId, description: dto.description, amount: dto.amount },
    });
}
async function listExpenses(vehicleId) {
    await getVehicle(vehicleId);
    const expenses = await prisma_client_1.prisma.bikeVehicleExpense.findMany({
        where: { vehicleId },
        orderBy: { createdAt: "desc" },
    });
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    return { expenses, total };
}
async function deleteExpense(vehicleId, expenseId) {
    const expense = await prisma_client_1.prisma.bikeVehicleExpense.findFirst({
        where: { id: expenseId, vehicleId },
    });
    if (!expense)
        throw errors_1.AppError.notFound("Expense not found");
    await prisma_client_1.prisma.bikeVehicleExpense.delete({ where: { id: expenseId } });
}
async function addVehicleImages(vehicleId, files) {
    await getVehicle(vehicleId);
    const existingCount = await prisma_client_1.prisma.bikeVehicleImage.count({
        where: { vehicleId },
    });
    if (existingCount + files.length > 6) {
        throw errors_1.AppError.validation(`Maximum 6 images allowed. This vehicle already has ${existingCount}.`);
    }
    const images = [];
    for (let i = 0; i < files.length; i++) {
        const sortOrder = existingCount + i;
        const img = await prisma_client_1.prisma.bikeVehicleImage.create({
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
async function listVehicleImages(vehicleId) {
    await getVehicle(vehicleId);
    return prisma_client_1.prisma.bikeVehicleImage.findMany({
        where: { vehicleId },
        orderBy: { sortOrder: "asc" },
    });
}
async function deleteVehicleImage(vehicleId, imageId) {
    const image = await prisma_client_1.prisma.bikeVehicleImage.findFirst({
        where: { id: imageId, vehicleId },
    });
    if (!image)
        throw errors_1.AppError.notFound("Image not found");
    await prisma_client_1.prisma.bikeVehicleImage.delete({ where: { id: imageId } });
    if (image.isPrimary) {
        const next = await prisma_client_1.prisma.bikeVehicleImage.findFirst({
            where: { vehicleId },
            orderBy: { sortOrder: "asc" },
        });
        if (next) {
            await prisma_client_1.prisma.bikeVehicleImage.update({
                where: { id: next.id },
                data: { isPrimary: true },
            });
        }
    }
    return image;
}
async function setPrimaryImage(vehicleId, imageId) {
    const image = await prisma_client_1.prisma.bikeVehicleImage.findFirst({
        where: { id: imageId, vehicleId },
    });
    if (!image)
        throw errors_1.AppError.notFound("Image not found");
    await prisma_client_1.prisma.bikeVehicleImage.updateMany({
        where: { vehicleId },
        data: { isPrimary: false },
    });
    await prisma_client_1.prisma.bikeVehicleImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
    });
    return prisma_client_1.prisma.bikeVehicleImage.findMany({
        where: { vehicleId },
        orderBy: { sortOrder: "asc" },
    });
}
async function addProductImages(productId, files) {
    await getProduct(productId);
    const existingCount = await prisma_client_1.prisma.inventoryProductImage.count({
        where: { productId },
    });
    if (existingCount + files.length > 3) {
        throw errors_1.AppError.validation(`Maximum 3 images allowed. This product already has ${existingCount}.`);
    }
    const images = [];
    for (let i = 0; i < files.length; i++) {
        const sortOrder = existingCount + i;
        const image = await prisma_client_1.prisma.inventoryProductImage.create({
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
async function listProductImages(productId) {
    await getProduct(productId);
    return prisma_client_1.prisma.inventoryProductImage.findMany({
        where: { productId },
        orderBy: { sortOrder: "asc" },
    });
}
async function deleteProductImage(productId, imageId) {
    const image = await prisma_client_1.prisma.inventoryProductImage.findFirst({
        where: { id: imageId, productId },
    });
    if (!image)
        throw errors_1.AppError.notFound("Image not found");
    await prisma_client_1.prisma.inventoryProductImage.delete({ where: { id: imageId } });
    if (image.isPrimary) {
        const next = await prisma_client_1.prisma.inventoryProductImage.findFirst({
            where: { productId },
            orderBy: { sortOrder: "asc" },
        });
        if (next) {
            await prisma_client_1.prisma.inventoryProductImage.update({
                where: { id: next.id },
                data: { isPrimary: true },
            });
        }
    }
    return image;
}
async function setPrimaryProductImage(productId, imageId) {
    const image = await prisma_client_1.prisma.inventoryProductImage.findFirst({
        where: { id: imageId, productId },
    });
    if (!image)
        throw errors_1.AppError.notFound("Image not found");
    await prisma_client_1.prisma.inventoryProductImage.updateMany({
        where: { productId },
        data: { isPrimary: false },
    });
    await prisma_client_1.prisma.inventoryProductImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
    });
    return prisma_client_1.prisma.inventoryProductImage.findMany({
        where: { productId },
        orderBy: { sortOrder: "asc" },
    });
}
