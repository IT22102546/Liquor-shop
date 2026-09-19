"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppConfig = void 0;
const config_1 = require("@nestjs/config");
exports.AppConfig = (0, config_1.registerAs)("app", () => ({
    port: parseInt(process.env.PORT ?? "5000", 10),
    environment: process.env.NODE_ENV || "development",
    apiBaseUrl: process.env.API_BASE_URL,
    frontendUrl: process.env.FRONTEND_URL,
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || [],
}));
