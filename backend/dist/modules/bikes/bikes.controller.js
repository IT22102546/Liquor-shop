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
exports.listPublicVehicles = listPublicVehicles;
exports.getPublicVehicleById = getPublicVehicleById;
exports.listPublicProducts = listPublicProducts;
exports.getPublicProductById = getPublicProductById;
exports.listBikes = listBikes;
exports.getBike = getBike;
exports.createBike = createBike;
exports.updateBike = updateBike;
exports.deleteBike = deleteBike;
const zod_1 = require("zod");
const bikesService = __importStar(require("./bikes.service"));
const listPublicVehiclesSchema = zod_1.z.object({
    page: zod_1.z.string().optional().default("1"),
    limit: zod_1.z.string().optional().default("200"),
    search: zod_1.z.string().optional(),
});
async function listPublicVehicles(req, res, next) {
    try {
        const query = listPublicVehiclesSchema.parse(req.query);
        const page = parseInt(query.page);
        const limit = Math.min(parseInt(query.limit), 200);
        const result = await bikesService.listPublicVehicles({
            page: isNaN(page) ? 1 : page,
            limit: isNaN(limit) ? 200 : limit,
            search: query.search,
        });
        res.status(200).json(result);
    }
    catch (err) {
        next(err);
    }
}
async function getPublicVehicleById(req, res, next) {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id))
            throw new Error("Invalid ID");
        const vehicle = await bikesService.getPublicVehicle(id);
        res.status(200).json(vehicle);
    }
    catch (err) {
        next(err);
    }
}
const listPublicProductsSchema = zod_1.z.object({
    page: zod_1.z.string().optional().default("1"),
    limit: zod_1.z.string().optional().default("200"),
    search: zod_1.z.string().optional(),
});
async function listPublicProducts(req, res, next) {
    try {
        const query = listPublicProductsSchema.parse(req.query);
        const page = parseInt(query.page);
        const limit = Math.min(parseInt(query.limit), 200);
        const result = await bikesService.listPublicProducts({
            page: isNaN(page) ? 1 : page,
            limit: isNaN(limit) ? 200 : limit,
            search: query.search,
        });
        res.status(200).json(result);
    }
    catch (err) {
        next(err);
    }
}
async function getPublicProductById(req, res, next) {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id))
            throw new Error("Invalid ID");
        const product = await bikesService.getPublicProduct(id);
        res.status(200).json(product);
    }
    catch (err) {
        next(err);
    }
}
const listBikesSchema = zod_1.z.object({
    page: zod_1.z.string().optional().default("1"),
    limit: zod_1.z.string().optional().default("10"),
    brand: zod_1.z.string().optional(),
    inStock: zod_1.z.enum(["true", "false"]).optional(),
});
const createBikeSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    brand: zod_1.z.string().min(1),
    price: zod_1.z.number().positive(),
    model: zod_1.z.string().optional(),
    year: zod_1.z
        .number()
        .int()
        .min(1900)
        .max(new Date().getFullYear() + 1)
        .optional(),
    inStock: zod_1.z.boolean().default(true),
});
const updateBikeSchema = createBikeSchema.partial();
async function listBikes(req, res, next) {
    try {
        const query = listBikesSchema.parse(req.query);
        const page = parseInt(query.page);
        const limit = parseInt(query.limit);
        const result = await bikesService.listBikes({
            page: isNaN(page) ? 1 : page,
            limit: isNaN(limit) ? 10 : limit,
            brand: query.brand,
            inStock: query.inStock,
        });
        res.status(200).json(result);
    }
    catch (err) {
        next(err);
    }
}
async function getBike(req, res, next) {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            throw new Error("Invalid ID");
        }
        const bike = await bikesService.getBike(id);
        res.status(200).json(bike);
    }
    catch (err) {
        next(err);
    }
}
async function createBike(req, res, next) {
    try {
        const dto = createBikeSchema.parse(req.body);
        const bike = await bikesService.createBike(dto);
        res.status(201).json(bike);
    }
    catch (err) {
        next(err);
    }
}
async function updateBike(req, res, next) {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            throw new Error("Invalid ID");
        }
        const dto = updateBikeSchema.parse(req.body);
        const bike = await bikesService.updateBike(id, dto);
        res.status(200).json(bike);
    }
    catch (err) {
        next(err);
    }
}
async function deleteBike(req, res, next) {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            throw new Error("Invalid ID");
        }
        await bikesService.deleteBike(id);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
}
