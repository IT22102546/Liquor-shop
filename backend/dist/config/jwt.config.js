"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtConfig = void 0;
const config_1 = require("@nestjs/config");
exports.JwtConfig = (0, config_1.registerAs)("jwt", () => {
    const secret = process.env.JWT_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!secret || secret.includes("CHANGE_ME") || secret.length < 32) {
        throw new Error("JWT_SECRET must be set, at least 32 characters long, and not contain placeholder text. " +
            "Generate one using: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    }
    if (!refreshSecret ||
        refreshSecret.includes("CHANGE_ME") ||
        refreshSecret.length < 32) {
        throw new Error("JWT_REFRESH_SECRET must be set, at least 32 characters long, and not contain placeholder text. " +
            "Generate one using: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    }
    return {
        secret,
        expiresIn: process.env.JWT_EXPIRES_IN || "1h",
        refreshSecret,
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
        issuer: process.env.JWT_ISSUER || "jlracing-platform",
        audience: process.env.JWT_AUDIENCE || "jlracing-app",
    };
});
