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
const express_1 = require("express");
const pos_auth_middleware_1 = require("../../common/middleware/pos-auth.middleware");
const controller = __importStar(require("./accounts.controller"));
const router = (0, express_1.Router)();
router.use(pos_auth_middleware_1.authenticatePosAdmin);
router.use((0, pos_auth_middleware_1.authorizePosRoles)("ADMIN", "ACCOUNTANT"));
router.get("/chart", controller.getAccounts);
router.post("/chart", controller.createAccount);
router.patch("/chart/:id", controller.updateAccount);
router.post("/chart/:id/toggle", controller.toggleAccount);
router.get("/chart/:id/balance", controller.getAccountBalance);
router.get("/receipts/invoices", controller.getPurchasesForReceipt);
router.get("/receipts", controller.getReceipts);
router.get("/receipts/:id", controller.getReceipt);
router.post("/receipts", controller.createReceipt);
router.patch("/receipts/:id", controller.updateReceipt);
router.post("/receipts/:id/void", controller.voidReceipt);
router.post("/receipts/:id/bounce", controller.bounceReceipt);
router.post("/receipts/:id/clear", controller.clearCheque);
router.get("/payments", controller.getInvoicePayments);
router.post("/payments/:id/generate-receipt", controller.generateReceiptFromPayment);
router.get("/deposits", controller.getDeposits);
router.post("/deposits", controller.createDeposit);
router.get("/deposits/:id", controller.getDeposit);
router.post("/deposits/:id/reverse", controller.reverseDeposit);
router.get("/vouchers", controller.getVouchers);
router.get("/vouchers/:id", controller.getVoucher);
router.post("/vouchers", controller.createVoucher);
router.patch("/vouchers/:id", controller.updateVoucher);
router.post("/vouchers/:id/void", controller.voidVoucher);
router.get("/ledger", controller.getLedger);
exports.default = router;
