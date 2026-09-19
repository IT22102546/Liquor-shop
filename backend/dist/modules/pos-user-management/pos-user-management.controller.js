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
exports.getProvinceDistrictMeta = getProvinceDistrictMeta;
exports.getPosUsers = getPosUsers;
exports.getPosUser = getPosUser;
exports.createPosUser = createPosUser;
exports.updatePosUser = updatePosUser;
exports.deletePosUser = deletePosUser;
exports.createPurchase = createPurchase;
exports.checkoutSale = checkoutSale;
exports.getPurchases = getPurchases;
exports.getPurchasesByUser = getPurchasesByUser;
exports.settlePurchase = settlePurchase;
exports.getPurchaseInstallments = getPurchaseInstallments;
exports.updatePurchase = updatePurchase;
exports.getInvoiceAccounts = getInvoiceAccounts;
exports.createInvoiceAccount = createInvoiceAccount;
exports.updateInvoiceAccount = updateInvoiceAccount;
exports.deleteInvoiceAccount = deleteInvoiceAccount;
exports.getInvoiceTerms = getInvoiceTerms;
exports.createInvoiceTerm = createInvoiceTerm;
exports.updateInvoiceTerm = updateInvoiceTerm;
exports.deleteInvoiceTerm = deleteInvoiceTerm;
const response_1 = require("../../common/utils/response");
const errors_1 = require("../../common/utils/errors");
const pos_user_dto_1 = require("./dto/pos-user.dto");
const service = __importStar(require("./pos-user-management.service"));
function parsePositiveIntParam(paramName, raw) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw errors_1.AppError.validation({
            [paramName]: [`${paramName} must be a positive integer`],
        });
    }
    return parsed;
}
async function getProvinceDistrictMeta(_req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, service.getProvinceDistrictMeta());
    }
    catch (error) {
        return next(error);
    }
}
async function getPosUsers(req, res, next) {
    try {
        const query = (0, errors_1.validate)(pos_user_dto_1.posUserQuerySchema, req.query);
        return (0, response_1.sendSuccess)(res, await service.listPosUsers(query));
    }
    catch (error) {
        return next(error);
    }
}
async function getPosUser(req, res, next) {
    try {
        const id = parsePositiveIntParam("id", req.params.id);
        return (0, response_1.sendSuccess)(res, await service.getPosUser(id));
    }
    catch (error) {
        return next(error);
    }
}
async function createPosUser(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(pos_user_dto_1.createPosUserSchema, req.body);
        return (0, response_1.sendCreated)(res, await service.createPosUser(dto));
    }
    catch (error) {
        return next(error);
    }
}
async function updatePosUser(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(pos_user_dto_1.updatePosUserSchema, req.body);
        const id = parsePositiveIntParam("id", req.params.id);
        return (0, response_1.sendSuccess)(res, await service.updatePosUser(id, dto));
    }
    catch (error) {
        return next(error);
    }
}
async function deletePosUser(req, res, next) {
    try {
        const id = parsePositiveIntParam("id", req.params.id);
        await service.deletePosUser(id);
        return (0, response_1.sendSuccess)(res, { message: "User deleted" });
    }
    catch (error) {
        return next(error);
    }
}
async function createPurchase(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(pos_user_dto_1.createPurchaseSchema, req.body);
        const id = parsePositiveIntParam("id", req.params.id);
        const data = await service.createPurchase(id, dto);
        return (0, response_1.sendCreated)(res, data);
    }
    catch (error) {
        return next(error);
    }
}
async function checkoutSale(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(pos_user_dto_1.checkoutSaleSchema, req.body);
        const cashierId = req.user.id;
        return (0, response_1.sendCreated)(res, await service.checkoutSale(dto, cashierId));
    }
    catch (error) {
        return next(error);
    }
}
async function getPurchases(req, res, next) {
    try {
        const query = (0, errors_1.validate)(pos_user_dto_1.purchaseQuerySchema, req.query);
        return (0, response_1.sendSuccess)(res, await service.listPurchases(query));
    }
    catch (error) {
        return next(error);
    }
}
async function getPurchasesByUser(req, res, next) {
    try {
        const query = (0, errors_1.validate)(pos_user_dto_1.purchaseQuerySchema, req.query);
        const id = parsePositiveIntParam("id", req.params.id);
        return (0, response_1.sendSuccess)(res, await service.listPurchasesByUser(id, query));
    }
    catch (error) {
        return next(error);
    }
}
async function settlePurchase(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(pos_user_dto_1.settlePurchaseSchema, req.body);
        const id = parsePositiveIntParam("id", req.params.id);
        const purchaseId = parsePositiveIntParam("purchaseId", req.params.purchaseId);
        return (0, response_1.sendSuccess)(res, await service.settlePurchase(id, purchaseId, dto));
    }
    catch (error) {
        return next(error);
    }
}
async function getPurchaseInstallments(req, res, next) {
    try {
        const purchaseId = parsePositiveIntParam("purchaseId", req.params.purchaseId);
        return (0, response_1.sendSuccess)(res, await service.getPurchaseInstallments(purchaseId));
    }
    catch (error) {
        return next(error);
    }
}
async function updatePurchase(req, res, next) {
    try {
        const purchaseId = parsePositiveIntParam("purchaseId", req.params.purchaseId);
        const dto = (0, errors_1.validate)(pos_user_dto_1.updatePurchaseSchema, req.body);
        return (0, response_1.sendSuccess)(res, await service.updatePurchase(purchaseId, dto));
    }
    catch (error) {
        return next(error);
    }
}
async function getInvoiceAccounts(_req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.listInvoiceAccounts());
    }
    catch (error) {
        return next(error);
    }
}
async function createInvoiceAccount(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(pos_user_dto_1.createInvoiceAccountSchema, req.body);
        return (0, response_1.sendCreated)(res, await service.createInvoiceAccount(dto));
    }
    catch (error) {
        return next(error);
    }
}
async function updateInvoiceAccount(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(pos_user_dto_1.updateInvoiceAccountSchema, req.body);
        const accountId = parsePositiveIntParam("accountId", req.params.accountId);
        return (0, response_1.sendSuccess)(res, await service.updateInvoiceAccount(accountId, dto));
    }
    catch (error) {
        return next(error);
    }
}
async function deleteInvoiceAccount(req, res, next) {
    try {
        const accountId = parsePositiveIntParam("accountId", req.params.accountId);
        await service.deleteInvoiceAccount(accountId);
        return (0, response_1.sendSuccess)(res, { message: "Invoice account deleted" });
    }
    catch (error) {
        return next(error);
    }
}
async function getInvoiceTerms(_req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.listInvoiceTerms());
    }
    catch (error) {
        return next(error);
    }
}
async function createInvoiceTerm(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(pos_user_dto_1.createInvoiceTermSchema, req.body);
        return (0, response_1.sendCreated)(res, await service.createInvoiceTerm(dto));
    }
    catch (error) {
        return next(error);
    }
}
async function updateInvoiceTerm(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(pos_user_dto_1.updateInvoiceTermSchema, req.body);
        const termId = parsePositiveIntParam("termId", req.params.termId);
        return (0, response_1.sendSuccess)(res, await service.updateInvoiceTerm(termId, dto));
    }
    catch (error) {
        return next(error);
    }
}
async function deleteInvoiceTerm(req, res, next) {
    try {
        const termId = parsePositiveIntParam("termId", req.params.termId);
        await service.deleteInvoiceTerm(termId);
        return (0, response_1.sendSuccess)(res, { message: "Invoice term deleted" });
    }
    catch (error) {
        return next(error);
    }
}
