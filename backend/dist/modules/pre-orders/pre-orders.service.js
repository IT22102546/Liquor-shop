"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPublicPreOrders = listPublicPreOrders;
exports.getPublicPreOrder = getPublicPreOrder;
exports.listPreOrders = listPreOrders;
exports.getPreOrder = getPreOrder;
exports.createPreOrder = createPreOrder;
exports.updatePreOrder = updatePreOrder;
exports.deletePreOrder = deletePreOrder;
exports.updatePreOrderPdf = updatePreOrderPdf;
exports.addPreOrderImage = addPreOrderImage;
exports.deletePreOrderImage = deletePreOrderImage;
exports.setPreOrderImagePrimary = setPreOrderImagePrimary;
const prisma_client_1 = require("../../database/prisma.client");
const prisma_1 = require("../../generated/prisma");
const errors_1 = require("../../common/utils/errors");
const preOrderInclude = {
    images: { orderBy: { sortOrder: "asc" } },
};
async function generatePreOrderDisplayId() {
    const latest = await prisma_client_1.prisma.preOrder.findFirst({
        orderBy: { id: "desc" },
        select: { displayId: true },
    });
    const current = latest?.displayId
        ? Number.parseInt(latest.displayId.replace(/^PO-/, ""), 10)
        : 0;
    return `PO-${String(Number.isFinite(current) ? current + 1 : 1).padStart(5, "0")}`;
}
async function createPreOrderWithUniqueDisplayId(data) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const displayId = await generatePreOrderDisplayId();
        try {
            return await prisma_client_1.prisma.preOrder.create({
                data: { ...data, displayId },
                include: preOrderInclude,
            });
        }
        catch (err) {
            if (err instanceof prisma_1.Prisma.PrismaClientKnownRequestError &&
                err.code === "P2002" &&
                String(err.meta?.target ?? "").includes("displayId")) {
                continue;
            }
            throw err;
        }
    }
    throw errors_1.AppError.conflict("Failed to generate a unique pre-order ID");
}
async function listPublicPreOrders(query) {
    const { page, limit, search, status } = query;
    const skip = (page - 1) * limit;
    const where = { isPublished: true };
    if (status)
        where.status = status;
    if (search) {
        where.OR = [
            { brand: { contains: search, mode: "insensitive" } },
            { model: { contains: search, mode: "insensitive" } },
            { cc: { contains: search, mode: "insensitive" } },
            { colour: { contains: search, mode: "insensitive" } },
        ];
    }
    const [preOrders, total] = await Promise.all([
        prisma_client_1.prisma.preOrder.findMany({
            where,
            skip,
            take: limit,
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
            include: preOrderInclude,
        }),
        prisma_client_1.prisma.preOrder.count({ where }),
    ]);
    return {
        data: preOrders,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}
async function getPublicPreOrder(id) {
    const preOrder = await prisma_client_1.prisma.preOrder.findUnique({
        where: { id },
        include: preOrderInclude,
    });
    if (!preOrder || !preOrder.isPublished)
        throw errors_1.AppError.notFound("Pre-order not found");
    return preOrder;
}
async function listPreOrders(query) {
    const { page, limit, search, status } = query;
    const skip = (page - 1) * limit;
    const where = {};
    if (status)
        where.status = status;
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
        prisma_client_1.prisma.preOrder.findMany({
            where,
            skip,
            take: limit,
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
            include: preOrderInclude,
        }),
        prisma_client_1.prisma.preOrder.count({ where }),
    ]);
    return {
        data: preOrders,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}
async function getPreOrder(id) {
    const preOrder = await prisma_client_1.prisma.preOrder.findUnique({
        where: { id },
        include: preOrderInclude,
    });
    if (!preOrder)
        throw errors_1.AppError.notFound("Pre-order not found");
    return preOrder;
}
async function createPreOrder(dto) {
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
async function updatePreOrder(id, dto) {
    await getPreOrder(id);
    return prisma_client_1.prisma.preOrder.update({
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
async function deletePreOrder(id) {
    await getPreOrder(id);
    await prisma_client_1.prisma.preOrder.delete({ where: { id } });
}
async function updatePreOrderPdf(id, pdfUrl) {
    await getPreOrder(id);
    return prisma_client_1.prisma.preOrder.update({
        where: { id },
        data: { pdfUrl },
        include: preOrderInclude,
    });
}
async function addPreOrderImage(preOrderId, url) {
    await getPreOrder(preOrderId);
    const count = await prisma_client_1.prisma.preOrderImage.count({ where: { preOrderId } });
    const isPrimary = count === 0;
    const maxSort = await prisma_client_1.prisma.preOrderImage.aggregate({
        where: { preOrderId },
        _max: { sortOrder: true },
    });
    return prisma_client_1.prisma.preOrderImage.create({
        data: {
            preOrderId,
            url,
            isPrimary,
            sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        },
    });
}
async function deletePreOrderImage(preOrderId, imageId) {
    const image = await prisma_client_1.prisma.preOrderImage.findFirst({
        where: { id: imageId, preOrderId },
    });
    if (!image)
        throw errors_1.AppError.notFound("Image not found");
    await prisma_client_1.prisma.preOrderImage.delete({ where: { id: imageId } });
    if (image.isPrimary) {
        const next = await prisma_client_1.prisma.preOrderImage.findFirst({
            where: { preOrderId },
            orderBy: { sortOrder: "asc" },
        });
        if (next) {
            await prisma_client_1.prisma.preOrderImage.update({
                where: { id: next.id },
                data: { isPrimary: true },
            });
        }
    }
}
async function setPreOrderImagePrimary(preOrderId, imageId) {
    const image = await prisma_client_1.prisma.preOrderImage.findFirst({
        where: { id: imageId, preOrderId },
    });
    if (!image)
        throw errors_1.AppError.notFound("Image not found");
    await prisma_client_1.prisma.preOrderImage.updateMany({
        where: { preOrderId },
        data: { isPrimary: false },
    });
    return prisma_client_1.prisma.preOrderImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
    });
}
