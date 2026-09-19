"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPublicExportVehicles = listPublicExportVehicles;
exports.getPublicExportVehicleById = getPublicExportVehicleById;
const prisma_client_1 = require("../../database/prisma.client");
const errors_1 = require("../../common/utils/errors");
const publicInclude = {
    images: { orderBy: { sortOrder: "asc" } },
};
async function listPublicExportVehicles(query) {
    const { page, limit, category, search } = query;
    const skip = (page - 1) * limit;
    const where = { status: "available", category };
    if (search) {
        where["OR"] = [
            { brand: { contains: search, mode: "insensitive" } },
            { model: { contains: search, mode: "insensitive" } },
        ];
    }
    const [vehicles, total] = await Promise.all([
        prisma_client_1.prisma.exportVehicle.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: publicInclude,
        }),
        prisma_client_1.prisma.exportVehicle.count({ where }),
    ]);
    return {
        vehicles,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
}
async function getPublicExportVehicleById(id) {
    const vehicle = await prisma_client_1.prisma.exportVehicle.findUnique({
        where: { id },
        include: publicInclude,
    });
    if (!vehicle || vehicle.status !== "available")
        throw errors_1.AppError.notFound("Vehicle not found");
    return vehicle;
}
