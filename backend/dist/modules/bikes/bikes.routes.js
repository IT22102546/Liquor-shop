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
const bikesController = __importStar(require("./bikes.controller"));
const auth_middleware_1 = require("../../common/middleware/auth.middleware");
const auth_middleware_2 = require("../../common/middleware/auth.middleware");
const router = (0, express_1.Router)();
router.get("/vehicles", bikesController.listPublicVehicles);
router.get("/vehicles/:id", bikesController.getPublicVehicleById);
router.get("/products", bikesController.listPublicProducts);
router.get("/products/:id", bikesController.getPublicProductById);
router.get("/", bikesController.listBikes);
router.get("/:id", bikesController.getBike);
router.post("/", auth_middleware_1.authenticate, (0, auth_middleware_2.authorize)("ADMIN", "STAFF"), bikesController.createBike);
router.patch("/:id", auth_middleware_1.authenticate, (0, auth_middleware_2.authorize)("ADMIN", "STAFF"), bikesController.updateBike);
router.delete("/:id", auth_middleware_1.authenticate, (0, auth_middleware_2.authorize)("ADMIN"), bikesController.deleteBike);
exports.default = router;
