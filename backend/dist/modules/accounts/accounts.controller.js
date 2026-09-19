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
exports.getAccounts = getAccounts;
exports.createAccount = createAccount;
exports.updateAccount = updateAccount;
exports.toggleAccount = toggleAccount;
exports.getPurchasesForReceipt = getPurchasesForReceipt;
exports.getReceipts = getReceipts;
exports.getReceipt = getReceipt;
exports.createReceipt = createReceipt;
exports.updateReceipt = updateReceipt;
exports.voidReceipt = voidReceipt;
exports.bounceReceipt = bounceReceipt;
exports.clearCheque = clearCheque;
exports.getInvoicePayments = getInvoicePayments;
exports.generateReceiptFromPayment = generateReceiptFromPayment;
exports.getDeposits = getDeposits;
exports.getDeposit = getDeposit;
exports.createDeposit = createDeposit;
exports.reverseDeposit = reverseDeposit;
exports.getVouchers = getVouchers;
exports.getVoucher = getVoucher;
exports.createVoucher = createVoucher;
exports.updateVoucher = updateVoucher;
exports.voidVoucher = voidVoucher;
exports.getLedger = getLedger;
exports.getAccountBalance = getAccountBalance;
const response_1 = require("../../common/utils/response");
const errors_1 = require("../../common/utils/errors");
const account_dto_1 = require("./dto/account.dto");
const service = __importStar(require("./accounts.service"));
function parseId(raw, name = "id") {
    const value = Array.isArray(raw) ? raw[0] : raw;
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) {
        throw errors_1.AppError.validation({ [name]: [`${name} must be a positive integer`] });
    }
    return n;
}
function getAdminId(req) {
    return req.user.id;
}
async function getAccounts(_req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.listAccounts());
    }
    catch (e) {
        return next(e);
    }
}
async function createAccount(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(account_dto_1.createAccountSchema, req.body);
        return (0, response_1.sendCreated)(res, await service.createAccount(dto));
    }
    catch (e) {
        return next(e);
    }
}
async function updateAccount(req, res, next) {
    try {
        const id = parseId(req.params.id);
        const dto = (0, errors_1.validate)(account_dto_1.updateAccountSchema, req.body);
        return (0, response_1.sendSuccess)(res, await service.updateAccount(id, dto));
    }
    catch (e) {
        return next(e);
    }
}
async function toggleAccount(req, res, next) {
    try {
        const id = parseId(req.params.id);
        return (0, response_1.sendSuccess)(res, await service.toggleAccountActive(id));
    }
    catch (e) {
        return next(e);
    }
}
async function getPurchasesForReceipt(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(account_dto_1.invoiceQueueQuerySchema, req.query);
        return (0, response_1.sendSuccess)(res, await service.listPurchasesForReceipt(dto));
    }
    catch (e) {
        return next(e);
    }
}
async function getReceipts(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(account_dto_1.receiptQuerySchema, req.query);
        return (0, response_1.sendSuccess)(res, await service.listReceipts(dto));
    }
    catch (e) {
        return next(e);
    }
}
async function getReceipt(req, res, next) {
    try {
        const id = parseId(req.params.id);
        return (0, response_1.sendSuccess)(res, await service.getReceiptById(id));
    }
    catch (e) {
        return next(e);
    }
}
async function createReceipt(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(account_dto_1.createReceiptSchema, req.body);
        return (0, response_1.sendCreated)(res, await service.createReceipt(dto, getAdminId(req)));
    }
    catch (e) {
        return next(e);
    }
}
async function updateReceipt(req, res, next) {
    try {
        const id = parseId(req.params.id);
        const dto = (0, errors_1.validate)(account_dto_1.updateReceiptSchema, req.body);
        return (0, response_1.sendSuccess)(res, await service.updateReceipt(id, dto, getAdminId(req)));
    }
    catch (e) {
        return next(e);
    }
}
async function voidReceipt(req, res, next) {
    try {
        const id = parseId(req.params.id);
        return (0, response_1.sendSuccess)(res, await service.voidReceipt(id, getAdminId(req)));
    }
    catch (e) {
        return next(e);
    }
}
async function bounceReceipt(req, res, next) {
    try {
        const id = parseId(req.params.id);
        return (0, response_1.sendSuccess)(res, await service.bounceReceipt(id, getAdminId(req)));
    }
    catch (e) {
        return next(e);
    }
}
async function clearCheque(req, res, next) {
    try {
        const id = parseId(req.params.id);
        return (0, response_1.sendSuccess)(res, await service.clearCheque(id));
    }
    catch (e) {
        return next(e);
    }
}
async function getInvoicePayments(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(account_dto_1.invoicePaymentQuerySchema, req.query);
        return (0, response_1.sendSuccess)(res, await service.listInvoicePayments(dto));
    }
    catch (e) {
        return next(e);
    }
}
async function generateReceiptFromPayment(req, res, next) {
    try {
        const id = parseId(req.params.id);
        const dto = (0, errors_1.validate)(account_dto_1.generateReceiptFromPaymentSchema, req.body);
        return (0, response_1.sendCreated)(res, await service.generateReceiptFromPayment(id, dto, getAdminId(req)));
    }
    catch (e) {
        return next(e);
    }
}
async function getDeposits(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(account_dto_1.depositQuerySchema, req.query);
        return (0, response_1.sendSuccess)(res, await service.listDeposits(dto));
    }
    catch (e) {
        return next(e);
    }
}
async function getDeposit(req, res, next) {
    try {
        const id = parseId(req.params.id);
        return (0, response_1.sendSuccess)(res, await service.getDeposit(id));
    }
    catch (e) {
        return next(e);
    }
}
async function createDeposit(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(account_dto_1.createDepositSchema, req.body);
        return (0, response_1.sendCreated)(res, await service.createDeposit(dto, getAdminId(req)));
    }
    catch (e) {
        return next(e);
    }
}
async function reverseDeposit(req, res, next) {
    try {
        const id = parseId(req.params.id);
        return (0, response_1.sendSuccess)(res, await service.reverseDeposit(id, getAdminId(req)));
    }
    catch (e) {
        return next(e);
    }
}
async function getVouchers(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(account_dto_1.voucherQuerySchema, req.query);
        return (0, response_1.sendSuccess)(res, await service.listVouchers(dto));
    }
    catch (e) {
        return next(e);
    }
}
async function getVoucher(req, res, next) {
    try {
        const id = parseId(req.params.id);
        return (0, response_1.sendSuccess)(res, await service.getVoucherById(id));
    }
    catch (e) {
        return next(e);
    }
}
async function createVoucher(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(account_dto_1.createVoucherSchema, req.body);
        return (0, response_1.sendCreated)(res, await service.createVoucher(dto, getAdminId(req)));
    }
    catch (e) {
        return next(e);
    }
}
async function updateVoucher(req, res, next) {
    try {
        const id = parseId(req.params.id);
        const dto = (0, errors_1.validate)(account_dto_1.updateVoucherSchema, req.body);
        return (0, response_1.sendSuccess)(res, await service.updateVoucher(id, dto, getAdminId(req)));
    }
    catch (e) {
        return next(e);
    }
}
async function voidVoucher(req, res, next) {
    try {
        const id = parseId(req.params.id);
        return (0, response_1.sendSuccess)(res, await service.voidVoucher(id, getAdminId(req)));
    }
    catch (e) {
        return next(e);
    }
}
async function getLedger(req, res, next) {
    try {
        const dto = (0, errors_1.validate)(account_dto_1.ledgerQuerySchema, req.query);
        return (0, response_1.sendSuccess)(res, await service.getLedger(dto));
    }
    catch (e) {
        return next(e);
    }
}
async function getAccountBalance(req, res, next) {
    try {
        const id = parseId(req.params.id);
        return (0, response_1.sendSuccess)(res, await service.getAccountBalance(id));
    }
    catch (e) {
        return next(e);
    }
}
