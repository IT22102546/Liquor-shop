"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.generateTokens = generateTokens;
exports.refreshAccessToken = refreshAccessToken;
exports.logoutUser = logoutUser;
exports.getMe = getMe;
const jwt = __importStar(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const env_1 = require("../../config/env");
const prisma_client_1 = require("../../database/prisma.client");
const errors_1 = require("../../common/utils/errors");
async function registerUser(dto) {
    const existingUser = await prisma_client_1.prisma.user.findUnique({
        where: { email: dto.email },
    });
    if (existingUser) {
        throw new errors_1.AppError("User already exists", 400);
    }
    const hashedPassword = await bcryptjs_1.default.hash(dto.password, 10);
    const user = await prisma_client_1.prisma.user.create({
        data: {
            email: dto.email,
            name: dto.name,
            passwordHash: hashedPassword,
            role: dto.role || "CUSTOMER",
        },
    });
    const { passwordHash, ...userWithoutPassword } = user;
    return {
        user: userWithoutPassword,
        tokens: generateTokens(user),
    };
}
async function loginUser(dto) {
    const user = await prisma_client_1.prisma.user.findUnique({
        where: { email: dto.email },
    });
    if (!user) {
        throw new errors_1.AppError("Invalid credentials", 401);
    }
    const isValidPassword = await bcryptjs_1.default.compare(dto.password, user.passwordHash);
    if (!isValidPassword) {
        throw new errors_1.AppError("Invalid credentials", 401);
    }
    const { passwordHash, ...userWithoutPassword } = user;
    return {
        user: userWithoutPassword,
        tokens: generateTokens(user),
    };
}
function generateTokens(user) {
    const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
    };
    const accessToken = jwt.sign(payload, env_1.env.JWT_SECRET, {
        expiresIn: env_1.env.JWT_EXPIRES_IN || "1h",
    });
    const refreshToken = jwt.sign(payload, env_1.env.JWT_REFRESH_SECRET, {
        expiresIn: env_1.env.JWT_REFRESH_EXPIRES_IN || "7d",
    });
    return { accessToken, refreshToken };
}
async function refreshAccessToken(refreshToken) {
    try {
        const decoded = jwt.verify(refreshToken, env_1.env.JWT_REFRESH_SECRET);
        const user = await prisma_client_1.prisma.user.findUnique({
            where: { id: decoded.sub },
        });
        if (!user) {
            throw new errors_1.AppError("User not found", 401);
        }
        return generateTokens(user);
    }
    catch (error) {
        throw new errors_1.AppError("Invalid refresh token", 401);
    }
}
async function logoutUser(userId) {
    return { message: "Logged out successfully" };
}
async function getMe(userId) {
    const user = await prisma_client_1.prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    if (!user) {
        throw new errors_1.AppError("User not found", 404);
    }
    return user;
}
