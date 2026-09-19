"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.authorize = authorize;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../../config/env");
const errors_1 = require("../utils/errors");
function authenticate(req, _res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return next(errors_1.AppError.unauthorized("No token provided"));
    }
    const token = header.split(" ")[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        req.user = {
            id: decoded.sub,
            email: decoded.email,
            role: decoded.role,
        };
        return next();
    }
    catch (error) {
        return next(errors_1.AppError.unauthorized("Invalid or expired token"));
    }
}
function authorize(...roles) {
    return (req, _res, next) => {
        if (!req.user)
            return next(errors_1.AppError.unauthorized());
        if (!roles.includes(req.user.role))
            return next(errors_1.AppError.forbidden());
        return next();
    };
}
