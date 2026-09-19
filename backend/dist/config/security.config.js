"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityConfig = void 0;
const config_1 = require("@nestjs/config");
exports.SecurityConfig = (0, config_1.registerAs)("security", () => {
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret ||
        sessionSecret.includes("CHANGE_ME") ||
        sessionSecret.length < 32) {
        throw new Error("SESSION_SECRET must be set, at least 32 characters long, and not contain placeholder text. " +
            "Generate one using: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    }
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);
    if (isNaN(saltRounds) || saltRounds < 10 || saltRounds > 15) {
        throw new Error("BCRYPT_SALT_ROUNDS must be a number between 10 and 15");
    }
    return {
        bcryptSaltRounds: saltRounds,
        sessionSecret,
    };
});
