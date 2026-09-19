"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContactRequest = createContactRequest;
exports.listContactRequests = listContactRequests;
exports.getContactRequest = getContactRequest;
exports.updateContactRequest = updateContactRequest;
exports.deleteContactRequest = deleteContactRequest;
exports.getContactRequestStats = getContactRequestStats;
const prisma_client_1 = require("../../database/prisma.client");
const prisma_1 = require("../../generated/prisma");
const errors_1 = require("../../common/utils/errors");
async function generateDisplayId() {
    const latest = await prisma_client_1.prisma.contactRequest.findFirst({
        orderBy: { id: "desc" },
        select: { displayId: true },
    });
    const current = latest?.displayId
        ? Number.parseInt(latest.displayId.replace(/^CR-/, ""), 10)
        : 0;
    return `CR-${String(Number.isFinite(current) ? current + 1 : 1).padStart(5, "0")}`;
}
async function createWithUniqueDisplayId(data) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const displayId = await generateDisplayId();
        try {
            return await prisma_client_1.prisma.contactRequest.create({
                data: { ...data, displayId },
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
    throw new errors_1.AppError("Failed to generate unique display ID", 500);
}
async function createContactRequest(dto) {
    return createWithUniqueDisplayId({
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim() ?? null,
        city: dto.city?.trim() ?? null,
        interests: dto.interests?.trim() ?? "",
        message: dto.message?.trim() ?? null,
    });
}
async function listContactRequests(opts) {
    const { page, limit, search, status } = opts;
    const skip = (page - 1) * limit;
    const where = {
        ...(status ? { status } : {}),
        ...(search
            ? {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { email: { contains: search, mode: "insensitive" } },
                    { phone: { contains: search, mode: "insensitive" } },
                    { displayId: { contains: search, mode: "insensitive" } },
                ],
            }
            : {}),
    };
    const [data, total] = await Promise.all([
        prisma_client_1.prisma.contactRequest.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma_client_1.prisma.contactRequest.count({ where }),
    ]);
    return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}
async function getContactRequest(id) {
    const record = await prisma_client_1.prisma.contactRequest.findUnique({ where: { id } });
    if (!record)
        throw new errors_1.AppError("Contact request not found", 404);
    return record;
}
async function updateContactRequest(id, dto) {
    const exists = await prisma_client_1.prisma.contactRequest.findUnique({ where: { id } });
    if (!exists)
        throw new errors_1.AppError("Contact request not found", 404);
    const allowed = ["new", "contacted", "closed"];
    if (dto.status && !allowed.includes(dto.status)) {
        throw new errors_1.AppError(`Invalid status. Allowed: ${allowed.join(", ")}`, 400);
    }
    return prisma_client_1.prisma.contactRequest.update({
        where: { id },
        data: {
            ...(dto.status !== undefined ? { status: dto.status } : {}),
            ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
    });
}
async function deleteContactRequest(id) {
    const exists = await prisma_client_1.prisma.contactRequest.findUnique({ where: { id } });
    if (!exists)
        throw new errors_1.AppError("Contact request not found", 404);
    await prisma_client_1.prisma.contactRequest.delete({ where: { id } });
}
async function getContactRequestStats() {
    const [total, newCount, contacted, closed] = await Promise.all([
        prisma_client_1.prisma.contactRequest.count(),
        prisma_client_1.prisma.contactRequest.count({ where: { status: "new" } }),
        prisma_client_1.prisma.contactRequest.count({ where: { status: "contacted" } }),
        prisma_client_1.prisma.contactRequest.count({ where: { status: "closed" } }),
    ]);
    return { total, new: newCount, contacted, closed };
}
