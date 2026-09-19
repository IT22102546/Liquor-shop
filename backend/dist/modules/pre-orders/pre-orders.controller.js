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
exports.listPublicPreOrders = listPublicPreOrders;
exports.getPublicPreOrder = getPublicPreOrder;
exports.listPreOrders = listPreOrders;
exports.getPreOrder = getPreOrder;
exports.createPreOrder = createPreOrder;
exports.updatePreOrder = updatePreOrder;
exports.deletePreOrder = deletePreOrder;
exports.uploadPreOrderPdf = uploadPreOrderPdf;
exports.uploadPreOrderImage = uploadPreOrderImage;
exports.deletePreOrderImage = deletePreOrderImage;
exports.setPreOrderImagePrimary = setPreOrderImagePrimary;
const zod_1 = require("zod");
const svc = __importStar(require("./pre-orders.service"));
const listSchema = zod_1.z.object({
    page: zod_1.z.string().optional().default("1"),
    limit: zod_1.z.string().optional().default("100"),
    search: zod_1.z.string().optional(),
    status: zod_1.z.string().optional(),
});
const createSchema = zod_1.z.object({
    brand: zod_1.z.string().trim().min(1).max(100),
    model: zod_1.z.string().trim().min(1).max(100),
    year: zod_1.z.number().int().min(1900).max(2100).optional(),
    cc: zod_1.z.string().trim().max(50).optional(),
    colour: zod_1.z.string().trim().max(100).optional(),
    price: zod_1.z.number().min(0).optional(),
    depositRequired: zod_1.z.string().trim().max(100).optional(),
    expectedArrival: zod_1.z.string().trim().max(100).optional(),
    status: zod_1.z.enum(["pre-order", "in-stock"]).optional(),
    description: zod_1.z.string().trim().max(2000).optional(),
    isPublished: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().optional(),
});
const updateSchema = createSchema.partial();
async function listPublicPreOrders(req, res, next) {
    try {
        const query = listSchema.parse(req.query);
        const page = Math.max(1, parseInt(query.page));
        const limit = Math.min(200, Math.max(1, parseInt(query.limit)));
        const result = await svc.listPublicPreOrders({
            page: isNaN(page) ? 1 : page,
            limit: isNaN(limit) ? 100 : limit,
            search: query.search,
            status: query.status,
        });
        res.status(200).json(result);
    }
    catch (err) {
        next(err);
    }
}
async function getPublicPreOrder(req, res, next) {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id))
            throw new Error("Invalid ID");
        const preOrder = await svc.getPublicPreOrder(id);
        res.status(200).json(preOrder);
    }
    catch (err) {
        next(err);
    }
}
async function listPreOrders(req, res, next) {
    try {
        const query = listSchema.parse(req.query);
        const page = Math.max(1, parseInt(query.page));
        const limit = Math.min(200, Math.max(1, parseInt(query.limit)));
        const result = await svc.listPreOrders({
            page: isNaN(page) ? 1 : page,
            limit: isNaN(limit) ? 100 : limit,
            search: query.search,
            status: query.status,
        });
        res.status(200).json(result);
    }
    catch (err) {
        next(err);
    }
}
async function getPreOrder(req, res, next) {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id))
            throw new Error("Invalid ID");
        const preOrder = await svc.getPreOrder(id);
        res.status(200).json(preOrder);
    }
    catch (err) {
        next(err);
    }
}
async function createPreOrder(req, res, next) {
    try {
        const dto = createSchema.parse(req.body);
        const preOrder = await svc.createPreOrder(dto);
        res.status(201).json(preOrder);
    }
    catch (err) {
        next(err);
    }
}
async function updatePreOrder(req, res, next) {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id))
            throw new Error("Invalid ID");
        const dto = updateSchema.parse(req.body);
        const preOrder = await svc.updatePreOrder(id, dto);
        res.status(200).json(preOrder);
    }
    catch (err) {
        next(err);
    }
}
async function deletePreOrder(req, res, next) {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id))
            throw new Error("Invalid ID");
        await svc.deletePreOrder(id);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
}
async function uploadPreOrderPdf(req, res, next) {
    try {
        const preOrderId = parseInt(req.params.preOrderId);
        if (isNaN(preOrderId))
            throw new Error("Invalid ID");
        const file = req.file;
        if (!file)
            throw new Error("No file uploaded");
        const url = `/uploads/pre-orders/${file.filename}`;
        const updated = await svc.updatePreOrderPdf(preOrderId, url);
        res.status(200).json(updated);
    }
    catch (err) {
        next(err);
    }
}
async function uploadPreOrderImage(req, res, next) {
    try {
        const preOrderId = parseInt(req.params.preOrderId);
        if (isNaN(preOrderId))
            throw new Error("Invalid ID");
        const file = req.file;
        if (!file)
            throw new Error("No file uploaded");
        const url = `/uploads/pre-orders/${file.filename}`;
        const image = await svc.addPreOrderImage(preOrderId, url);
        res.status(201).json(image);
    }
    catch (err) {
        next(err);
    }
}
async function deletePreOrderImage(req, res, next) {
    try {
        const preOrderId = parseInt(req.params.preOrderId);
        const imageId = parseInt(req.params.imageId);
        if (isNaN(preOrderId) || isNaN(imageId))
            throw new Error("Invalid ID");
        await svc.deletePreOrderImage(preOrderId, imageId);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
}
async function setPreOrderImagePrimary(req, res, next) {
    try {
        const preOrderId = parseInt(req.params.preOrderId);
        const imageId = parseInt(req.params.imageId);
        if (isNaN(preOrderId) || isNaN(imageId))
            throw new Error("Invalid ID");
        const image = await svc.setPreOrderImagePrimary(preOrderId, imageId);
        res.status(200).json(image);
    }
    catch (err) {
        next(err);
    }
}
