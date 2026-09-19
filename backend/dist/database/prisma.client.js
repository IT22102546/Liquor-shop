"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const prisma_1 = require("../generated/prisma");
const env_1 = require("../config/env");
exports.prisma = global.__prisma ??
    new prisma_1.PrismaClient({
        log: env_1.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
    });
if (env_1.env.NODE_ENV !== "production") {
    global.__prisma = exports.prisma;
}
