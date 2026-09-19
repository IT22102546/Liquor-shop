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
exports.listByCategory = listByCategory;
exports.getById = getById;
const zod_1 = require("zod");
const exportVehiclesService = __importStar(require("./export-vehicles.service"));
const listSchema = zod_1.z.object({
    page: zod_1.z.string().optional().default("1"),
    limit: zod_1.z.string().optional().default("200"),
    search: zod_1.z.string().optional(),
});
const VALID_CATEGORIES = [
    "AUTOMOBILE",
    "HEAVY_MACHINERY",
];
async function listByCategory(req, res, next) {
    try {
        const rawCategory = (req.params.category ?? "")
            .toUpperCase()
            .replace(/-/g, "_");
        if (!VALID_CATEGORIES.includes(rawCategory)) {
            res.status(400).json({ error: "Invalid category" });
            return;
        }
        const query = listSchema.parse(req.query);
        const page = parseInt(query.page);
        const limit = Math.min(parseInt(query.limit), 200);
        const result = await exportVehiclesService.listPublicExportVehicles({
            page: isNaN(page) ? 1 : page,
            limit: isNaN(limit) ? 200 : limit,
            category: rawCategory,
            search: query.search,
        });
        res.status(200).json(result);
    }
    catch (err) {
        next(err);
    }
}
async function getById(req, res, next) {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id))
            throw new Error("Invalid ID");
        const vehicle = await exportVehiclesService.getPublicExportVehicleById(id);
        res.status(200).json(vehicle);
    }
    catch (err) {
        next(err);
    }
}
