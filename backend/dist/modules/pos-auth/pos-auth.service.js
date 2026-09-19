"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginPosAdmin = loginPosAdmin;
exports.getPosAdminFromToken = getPosAdminFromToken;
exports.listPosStaff = listPosStaff;
exports.createPosStaff = createPosStaff;
exports.updatePosStaff = updatePosStaff;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_client_1 = require("../../database/prisma.client");
const env_1 = require("../../config/env");
const errors_1 = require("../../common/utils/errors");
function generatePosAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_SECRET, {
        expiresIn: env_1.env.POS_JWT_EXPIRES_IN,
    });
}
function verifyPosAccessToken(token) {
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
    }
    catch {
        throw errors_1.AppError.unauthorized("Invalid or expired POS token");
    }
    if (typeof decoded !== "object" ||
        decoded === null ||
        !("sub" in decoded) ||
        !("email" in decoded) ||
        !("role" in decoded) ||
        !("type" in decoded) ||
        typeof decoded.sub !== "number" ||
        typeof decoded.email !== "string" ||
        !["ADMIN", "CASHIER", "INVENTORY_MANAGER", "ACCOUNTANT"].includes(String(decoded.role)) ||
        decoded.type !== "pos_admin") {
        throw errors_1.AppError.unauthorized("Invalid token type");
    }
    return decoded;
}
async function loginPosAdmin(dto) {
    const admin = await prisma_client_1.prisma.posAdmin.findUnique({ where: { email: dto.email } });
    if (!admin || !admin.isActive) {
        throw errors_1.AppError.unauthorized("Invalid email or password");
    }
    const isValid = await bcryptjs_1.default.compare(dto.password, admin.passwordHash);
    if (!isValid) {
        throw errors_1.AppError.unauthorized("Invalid email or password");
    }
    const accessToken = generatePosAccessToken({
        sub: admin.id,
        email: admin.email,
        role: admin.role,
        type: "pos_admin",
    });
    await prisma_client_1.prisma.posAdmin.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
    });
    return {
        accessToken,
        admin: {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            lastLoginAt: admin.lastLoginAt,
        },
    };
}
async function getPosAdminFromToken(authHeader) {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw errors_1.AppError.unauthorized("Authorization header is required");
    }
    const token = authHeader.slice("Bearer ".length);
    const payload = verifyPosAccessToken(token);
    const admin = await prisma_client_1.prisma.posAdmin.findUnique({ where: { id: payload.sub } });
    if (!admin || !admin.isActive) {
        throw errors_1.AppError.unauthorized("POS admin not found or inactive");
    }
    return {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        lastLoginAt: admin.lastLoginAt,
    };
}
const staffSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    isActive: true,
    lastLoginAt: true,
    createdAt: true,
};
function listPosStaff() {
    return prisma_client_1.prisma.posAdmin.findMany({
        select: staffSelect,
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
}
async function createPosStaff(dto) {
    const existing = await prisma_client_1.prisma.posAdmin.findUnique({ where: { email: dto.email } });
    if (existing)
        throw errors_1.AppError.conflict("A staff account with this email already exists");
    return prisma_client_1.prisma.posAdmin.create({
        data: {
            name: dto.name,
            email: dto.email,
            role: dto.role,
            passwordHash: await bcryptjs_1.default.hash(dto.password, 12),
        },
        select: staffSelect,
    });
}
async function updatePosStaff(id, currentAdminId, dto) {
    const existing = await prisma_client_1.prisma.posAdmin.findUnique({ where: { id } });
    if (!existing)
        throw errors_1.AppError.notFound("Staff account not found");
    if (id === currentAdminId && (dto.isActive === false || (dto.role && dto.role !== "ADMIN"))) {
        throw new errors_1.AppError("You cannot remove your own administrator access", 400);
    }
    if (dto.email && dto.email !== existing.email) {
        const duplicate = await prisma_client_1.prisma.posAdmin.findUnique({ where: { email: dto.email } });
        if (duplicate)
            throw errors_1.AppError.conflict("A staff account with this email already exists");
    }
    return prisma_client_1.prisma.posAdmin.update({
        where: { id },
        data: {
            name: dto.name,
            email: dto.email,
            role: dto.role,
            isActive: dto.isActive,
            ...(dto.password ? { passwordHash: await bcryptjs_1.default.hash(dto.password, 12) } : {}),
        },
        select: staffSelect,
    });
}
