import { Router } from "express";
import { authenticatePosAdmin, authorizePosRoles } from "../../common/middleware/pos-auth.middleware";
import * as controller from "./pos-user-management.controller";

const router = Router();
router.use(authenticatePosAdmin);

const sales = authorizePosRoles("ADMIN", "CASHIER");
const finance = authorizePosRoles("ADMIN", "ACCOUNTANT");
const management = authorizePosRoles("ADMIN");

router.get("/meta/provinces", management, controller.getProvinceDistrictMeta);
router.get("/dream-bikes", management, controller.getDreamBikeOptions);
router.get("/leasing-companies", finance, controller.getLeasingCompanies);
router.post("/leasing-companies", finance, controller.createLeasingCompany);
router.patch("/leasing-companies/:companyId", finance, controller.updateLeasingCompany);
router.delete("/leasing-companies/:companyId", finance, controller.deleteLeasingCompany);
router.get("/leasing-companies/:companyId/applications", finance, controller.getLeasingCompanyApplications);
router.get("/purchases", authorizePosRoles("ADMIN", "CASHIER", "ACCOUNTANT"), controller.getPurchases);
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

export default router;
