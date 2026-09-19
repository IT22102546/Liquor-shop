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
exports.login = login;
exports.me = me;
exports.listStaff = listStaff;
exports.createStaff = createStaff;
exports.updateStaff = updateStaff;
const errors_1 = require("../../common/utils/errors");
const response_1 = require("../../common/utils/response");
const pos_login_dto_1 = require("./dto/pos-login.dto");
const pos_staff_dto_1 = require("./dto/pos-staff.dto");
const posAuthService = __importStar(require("./pos-auth.service"));
async function login(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(pos_login_dto_1.posLoginSchema, req.body);
        const result = await posAuthService.loginPosAdmin(dto);
        return (0, response_1.sendSuccess)(res, result);
    }
    catch (error) {
        return next(error);
    }
}
async function me(req, res, next) {
    try {
        const admin = await posAuthService.getPosAdminFromToken(req.headers.authorization);
        return (0, response_1.sendSuccess)(res, admin);
    }
    catch (error) {
        return next(error);
    }
}
async function listStaff(_req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await posAuthService.listPosStaff());
    }
    catch (error) {
        return next(error);
    }
}
async function createStaff(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await posAuthService.createPosStaff((0, errors_1.validate)(pos_staff_dto_1.createPosStaffSchema, req.body)));
    }
    catch (error) {
        return next(error);
    }
}
async function updateStaff(req, res, next) {
    try {
        const currentAdminId = req.user.id;
        return (0, response_1.sendSuccess)(res, await posAuthService.updatePosStaff(Number(req.params.id), currentAdminId, (0, errors_1.validate)(pos_staff_dto_1.updatePosStaffSchema, req.body)));
    }
    catch (error) {
        return next(error);
    }
}
