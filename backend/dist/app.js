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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const env_1 = require("./config/env");
const error_middleware_1 = require("./common/middleware/error.middleware");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const bikes_routes_1 = __importDefault(require("./modules/bikes/bikes.routes"));
const pos_auth_routes_1 = __importDefault(require("./modules/pos-auth/pos-auth.routes"));
const inventory_management_routes_1 = __importDefault(require("./modules/inventory-management/inventory-management.routes"));
const pos_user_management_routes_1 = __importDefault(require("./modules/pos-user-management/pos-user-management.routes"));
const contact_requests_routes_1 = __importStar(require("./modules/contact-requests/contact-requests.routes"));
const accounts_routes_1 = __importDefault(require("./modules/accounts/accounts.routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: env_1.env.CORS_ORIGIN.split(",").map((o) => o.trim()),
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
const backendRoot = process.cwd().endsWith("backend")
    ? process.cwd()
    : path_1.default.join(process.cwd(), "apps", "backend");
const uploadsPath = path_1.default.join(backendRoot, "uploads");
console.log("[static] Serving uploads from:", uploadsPath);
app.use("/uploads", express_1.default.static(uploadsPath));
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
app.use("/api/auth", auth_routes_1.default);
app.use("/api/bikes", bikes_routes_1.default);
app.use("/api/pos/auth", pos_auth_routes_1.default);
app.use("/api/pos/inventory-management", inventory_management_routes_1.default);
app.use("/api/pos/user-management", pos_user_management_routes_1.default);
app.use("/api/contact-requests", contact_requests_routes_1.publicContactRequestsRouter);
app.use("/api/pos/contact-requests", contact_requests_routes_1.default);
app.use("/api/pos/accounts", accounts_routes_1.default);
app.use(error_middleware_1.notFoundHandler);
app.use(error_middleware_1.errorHandler);
exports.default = app;
