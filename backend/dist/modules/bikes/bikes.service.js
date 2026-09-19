"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPublicProducts = listPublicProducts;
exports.getPublicProduct = getPublicProduct;
const prisma_client_1 = require("../../database/prisma.client");
const errors_1 = require("../../common/utils/errors");
const publicProductInclude = {
    brand: { select: { id: true, name: true } },
    category: { select: { id: true, name: true } },
    images: { orderBy: { sortOrder: "asc" } },
};
async function listPublicProducts(query) {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;
    const where = {};
    if (search) {
        where["OR"] = [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { brand: { name: { contains: search, mode: "insensitive" } } },
            { category: { name: { contains: search, mode: "insensitive" } } },
        ];
    }
    const [products, total] = await Promise.all([
        prisma_client_1.prisma.inventoryProduct.findMany({
            where,
            skip,
            take: limit,
            orderBy: [{ categoryId: "asc" }, { brandId: "asc" }, { name: "asc" }],
            include: publicProductInclude,
        }),
        prisma_client_1.prisma.inventoryProduct.count({ where }),
    ]);
    return {
        products,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
}
async function getPublicProduct(id) {
    const product = await prisma_client_1.prisma.inventoryProduct.findUnique({
        where: { id },
        include: publicProductInclude,
    });
    if (!product)
        throw errors_1.AppError.notFound("Product not found");
    return product;
}
