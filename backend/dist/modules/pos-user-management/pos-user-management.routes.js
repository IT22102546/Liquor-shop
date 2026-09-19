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
const controller = __importStar(require("./pos-user-management.controller"));
const router = (0, express_1.Router)();
router.use(pos_auth_middleware_1.authenticatePosAdmin);
const sales = (0, pos_auth_middleware_1.authorizePosRoles)("ADMIN", "CASHIER");
const finance = (0, pos_auth_middleware_1.authorizePosRoles)("ADMIN", "ACCOUNTANT");
const management = (0, pos_auth_middleware_1.authorizePosRoles)("ADMIN");
router.get("/meta/provinces", management, controller.getProvinceDistrictMeta);
router.get("/dream-bikes", management, controller.getDreamBikeOptions);
router.get("/leasing-companies", finance, controller.getLeasingCompanies);
router.post("/leasing-companies", finance, controller.createLeasingCompany);
router.patch("/leasing-companies/:companyId", finance, controller.updateLeasingCompany);
router.delete("/leasing-companies/:companyId", finance, controller.deleteLeasingCompany);
router.get("/leasing-companies/:companyId/applications", finance, controller.getLeasingCompanyApplications);
router.get("/purchases", (0, pos_auth_middleware_1.authorizePosRoles)("ADMIN", "CASHIER", "ACCOUNTANT"), controller.getPurchases);
router.post("/checkout", sales, controller.checkoutSale);
router.patch("/purchases/:purchaseId", finance, controller.updatePurchase);
router.get("/invoice-accounts", finance, controller.getInvoiceAccounts);
router.post("/invoice-accounts", finance, controller.createInvoiceAccount);
router.patch("/invoice-accounts/:accountId", finance, controller.updateInvoiceAccount);
router.delete("/invoice-accounts/:accountId", finance, controller.deleteInvoiceAccount);
router.get("/invoice-terms", finance, controller.getInvoiceTerms);
router.post("/invoice-terms", finance, controller.createInvoiceTerm);
router.patch("/invoice-terms/:termId", finance, controller.updateInvoiceTerm);
router.delete("/invoice-terms/:termId", finance, controller.deleteInvoiceTerm);
router.get("/", management, controller.getPosUsers);
router.get("/:id/purchases", finance, controller.getPurchasesByUser);
router.get("/:id", management, controller.getPosUser);
router.post("/", management, controller.createPosUser);
router.patch("/:id", management, controller.updatePosUser);
router.delete("/:id", management, controller.deletePosUser);
router.post("/:id/purchases", management, controller.createPurchase);
router.get("/:id/purchases/:purchaseId/installments", finance, controller.getPurchaseInstallments);
router.post("/:id/purchases/:purchaseId/settle", finance, controller.settlePurchase);
exports.default = router;
