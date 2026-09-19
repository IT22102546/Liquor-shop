"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function required(key) {
    const value = process.env[key];
    if (!value)
        throw new Error(`Missing required env variable: ${key}`);
    return value;
}
function optional(key, fallback) {
    return process.env[key] ?? fallback;
}
exports.env = {
    NODE_ENV: optional("NODE_ENV", "development"),
    PORT: parseInt(optional("PORT", "5000"), 10),
    DATABASE_URL: required("DATABASE_URL"),
    JWT_SECRET: optional("JWT_SECRET", "change-me-in-production-please"),
    JWT_EXPIRES_IN: optional("JWT_EXPIRES_IN", "1h"),
    POS_JWT_EXPIRES_IN: optional("POS_JWT_EXPIRES_IN", "7d"),
    JWT_REFRESH_SECRET: optional("JWT_REFRESH_SECRET", "refresh-change-me-in-production"),
    JWT_REFRESH_EXPIRES_IN: optional("JWT_REFRESH_EXPIRES_IN", "7d"),
    CORS_ORIGIN: optional("CORS_ORIGIN", "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004"),
    BCRYPT_ROUNDS: parseInt(optional("BCRYPT_ROUNDS", "12"), 10),
};
