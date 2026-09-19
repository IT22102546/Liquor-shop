"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPublicVehicles = listPublicVehicles;
exports.getPublicVehicle = getPublicVehicle;
exports.listPublicProducts = listPublicProducts;
exports.getPublicProduct = getPublicProduct;
exports.listBikes = listBikes;
exports.getBike = getBike;
exports.createBike = createBike;
exports.updateBike = updateBike;
exports.deleteBike = deleteBike;
const prisma_client_1 = require("../../database/prisma.client");
const errors_1 = require("../../common/utils/errors");
const publicVehicleInclude = {
    brand: { select: { id: true, name: true } },
    model: { select: { id: true, name: true } },
    images: { orderBy: { sortOrder: "asc" } },
};
async function listPublicVehicles(query) {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;
    const where = { status: "available" };
    if (search) {
        where["OR"] = [
            { brand: { name: { contains: search, mode: "insensitive" } } },
            { model: { name: { contains: search, mode: "insensitive" } } },
            { colour: { contains: search, mode: "insensitive" } },
        ];
    }
    const [vehicles, total] = await Promise.all([
        prisma_client_1.prisma.bikeVehicle.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: publicVehicleInclude,
        }),
        prisma_client_1.prisma.bikeVehicle.count({ where }),
    ]);
    return {
        vehicles,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
}
async function getPublicVehicle(id) {
    const vehicle = await prisma_client_1.prisma.bikeVehicle.findUnique({
        where: { id },
        include: publicVehicleInclude,
    });
    if (!vehicle || vehicle.status !== "available")
        throw errors_1.AppError.notFound("Bike not found");
    return vehicle;
}
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
async function listBikes(query) {
    const { page, limit, brand, inStock } = query;
    const skip = (page - 1) * limit;
    const where = {
        ...(brand
            ? { brand: { contains: brand, mode: "insensitive" } }
            : {}),
        ...(inStock !== undefined ? { inStock: inStock === "true" } : {}),
    };
    const [bikes, total] = await Promise.all([
        prisma_client_1.prisma.bike.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
        }),
        prisma_client_1.prisma.bike.count({ where }),
    ]);
    return {
        bikes,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
}
async function getBike(id) {
    const bike = await prisma_client_1.prisma.bike.findUnique({ where: { id } });
    if (!bike)
        throw errors_1.AppError.notFound(`Bike with id ${id} not found`);
    return bike;
}
async function createBike(dto) {
    return prisma_client_1.prisma.bike.create({ data: dto });
}
async function updateBike(id, dto) {
    await getBike(id);
    return prisma_client_1.prisma.bike.update({ where: { id }, data: dto });
}
async function deleteBike(id) {
    await getBike(id);
    await prisma_client_1.prisma.bike.delete({ where: { id } });
}
