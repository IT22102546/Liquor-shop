"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticatePosAdmin = authenticatePosAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../../config/env");
const errors_1 = require("../utils/errors");
function authenticatePosAdmin(req, _res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return next(errors_1.AppError.unauthorized("No token provided"));
    }
    const token = header.slice(7);
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
    }
    catch {
        return next(errors_1.AppError.unauthorized("Invalid or expired token"));
    }
    if (typeof decoded !== "object" ||
        decoded === null ||
        decoded.type !== "pos_admin") {
        return next(errors_1.AppError.forbidden("POS admin access required"));
    }
    const p = decoded;
    req.user = { id: p.sub, email: p.email, role: "POS_ADMIN" };
    return next();
}
