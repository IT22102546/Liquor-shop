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
exports.submitContactRequest = submitContactRequest;
exports.listContactRequests = listContactRequests;
exports.getContactRequest = getContactRequest;
exports.updateContactRequest = updateContactRequest;
exports.deleteContactRequest = deleteContactRequest;
exports.getContactRequestStats = getContactRequestStats;
const zod_1 = require("zod");
const svc = __importStar(require("./contact-requests.service"));
const createSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(200),
    email: zod_1.z.string().trim().email().max(200),
    phone: zod_1.z.string().trim().max(50).optional(),
    city: zod_1.z.string().trim().max(100).optional(),
    interests: zod_1.z.string().trim().max(500).optional(),
    message: zod_1.z.string().trim().max(2000).optional(),
});
const listSchema = zod_1.z.object({
    page: zod_1.z.string().optional().default("1"),
    limit: zod_1.z.string().optional().default("50"),
    search: zod_1.z.string().optional(),
    status: zod_1.z.string().optional(),
});
const updateSchema = zod_1.z.object({
    status: zod_1.z.enum(["new", "contacted", "closed"]).optional(),
    notes: zod_1.z.string().trim().max(2000).optional(),
});
async function submitContactRequest(req, res, next) {
    try {
        const dto = createSchema.parse(req.body);
        const record = await svc.createContactRequest(dto);
        res.status(201).json(record);
    }
    catch (err) {
        next(err);
    }
}
async function listContactRequests(req, res, next) {
    try {
        const query = listSchema.parse(req.query);
        const page = Math.max(1, parseInt(query.page));
        const limit = Math.min(200, Math.max(1, parseInt(query.limit)));
        const result = await svc.listContactRequests({
            page: isNaN(page) ? 1 : page,
            limit: isNaN(limit) ? 50 : limit,
            search: query.search,
            status: query.status,
        });
        res.status(200).json(result);
    }
    catch (err) {
        next(err);
    }
}
async function getContactRequest(req, res, next) {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id))
            throw new Error("Invalid ID");
        const record = await svc.getContactRequest(id);
        res.status(200).json(record);
    }
    catch (err) {
        next(err);
    }
}
async function updateContactRequest(req, res, next) {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id))
            throw new Error("Invalid ID");
        const dto = updateSchema.parse(req.body);
        const record = await svc.updateContactRequest(id, dto);
        res.status(200).json(record);
    }
    catch (err) {
        next(err);
    }
}
async function deleteContactRequest(req, res, next) {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id))
            throw new Error("Invalid ID");
        await svc.deleteContactRequest(id);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
}
async function getContactRequestStats(_req, res, next) {
    try {
        const stats = await svc.getContactRequestStats();
        res.status(200).json(stats);
    }
    catch (err) {
        next(err);
    }
}
