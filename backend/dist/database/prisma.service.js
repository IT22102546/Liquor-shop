"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PrismaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const prisma_1 = require("../generated/prisma");
const getLogConfig = () => {
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction) {
        return ["warn", "error"];
    }
    if (process.env.PRISMA_QUERY_LOG === "true") {
        return ["query", "info", "warn", "error"];
    }
    return ["info", "warn", "error"];
};
const getDatasourceConfig = () => ({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});
let PrismaService = PrismaService_1 = class PrismaService extends prisma_1.PrismaClient {
    logger = new common_1.Logger(PrismaService_1.name);
    constructor() {
        super({
            log: getLogConfig(),
            ...getDatasourceConfig(),
        });
        const SOFT_DELETE_MODELS = new Set([
            "User",
            "Subject",
            "Class",
            "Enrollment",
            "Exam",
            "Invoice",
            "GradeBook",
            "StudentProgress",
            "ChatMessage",
            "Question",
            "Announcement",
            "Notification",
        ]);
        this.$use(async (params, next) => {
            if ((params.action === "findMany" ||
                params.action === "findFirst" ||
                params.action === "count" ||
                params.action === "aggregate" ||
                params.action === "groupBy") &&
                SOFT_DELETE_MODELS.has(params.model)) {
                params.args = params.args || {};
                const withDeleted = params.args.__withDeleted === true;
                if (!withDeleted) {
                    params.args.where = params.args.where || {};
                    if (params.args.where.deletedAt === undefined) {
                        params.args.where.deletedAt = null;
                    }
                }
                if ("__withDeleted" in params.args) {
                    delete params.args.__withDeleted;
                }
            }
            if (SOFT_DELETE_MODELS.has(params.model)) {
                if (params.action === "delete") {
                    params.action = "update";
                    params.args["data"] = { deletedAt: new Date() };
                }
                if (params.action === "deleteMany") {
                    params.action = "updateMany";
                    params.args["data"] = { deletedAt: new Date() };
                }
            }
            return next(params);
        });
    }
    async onModuleInit() {
        this.logger.log("Connecting to database...");
        await this.$connect();
        this.logger.log("Database connected successfully");
    }
    async onModuleDestroy() {
        this.logger.log("Disconnecting from database...");
        await this.$disconnect();
        this.logger.log("Database disconnected");
    }
    async healthCheck() {
        try {
            await this.$queryRaw `SELECT 1`;
            return true;
        }
        catch {
            return false;
        }
    }
    async softDelete(model, where) {
        return this[model].update({
            where,
            data: {
                deletedAt: new Date(),
            },
        });
    }
    async paginate(model, args, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const take = limit;
        const [data, total] = await Promise.all([
            this[model].findMany({
                ...args,
                skip,
                take,
            }),
            this[model].count({
                where: args.where,
            }),
        ]);
        return {
            data,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
                hasNext: page * limit < total,
                hasPrev: page > 1,
            },
        };
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = PrismaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], PrismaService);
