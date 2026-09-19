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
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.refresh = refresh;
exports.logout = logout;
exports.me = me;
const errors_1 = require("../../common/utils/errors");
const response_1 = require("../../common/utils/response");
const register_dto_1 = require("./dto/register.dto");
const login_dto_1 = require("./dto/login.dto");
const refresh_dto_1 = require("./dto/refresh.dto");
const authService = __importStar(require("./auth.service"));
async function register(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(register_dto_1.registerSchema, req.body);
        const result = await authService.registerUser(dto);
        return (0, response_1.sendCreated)(res, result);
    }
    catch (err) {
        return next(err);
    }
}
async function login(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(login_dto_1.loginSchema, req.body);
        const result = await authService.loginUser(dto);
        return (0, response_1.sendSuccess)(res, result);
    }
    catch (err) {
        return next(err);
    }
}
async function refresh(req, res, next) {
    try {
        const { refreshToken } = (0, errors_1.validate)(refresh_dto_1.refreshSchema, req.body);
        const result = await authService.refreshAccessToken(refreshToken);
        return (0, response_1.sendSuccess)(res, result);
    }
    catch (err) {
        return next(err);
    }
}
async function logout(req, res, next) {
    try {
        await authService.logoutUser(req.user.id);
        return (0, response_1.sendSuccess)(res, { message: "Logged out successfully" });
    }
    catch (err) {
        return next(err);
    }
}
async function me(req, res, next) {
    try {
        const user = await authService.getMe(req.user.id);
        return (0, response_1.sendSuccess)(res, user);
    }
    catch (err) {
        return next(err);
    }
}
