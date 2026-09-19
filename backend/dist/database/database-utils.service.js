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
var DatabaseUtilsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseUtilsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("./prisma.service");
let DatabaseUtilsService = DatabaseUtilsService_1 = class DatabaseUtilsService {
    prisma;
    logger = new common_1.Logger(DatabaseUtilsService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    getDelegate(model) {
        const delegate = this.prisma[model];
        if (!delegate) {
            throw new Error(`Unknown Prisma model: ${model}`);
        }
        return delegate;
    }
    async softDelete(model, id, deletedByUserId, metadata) {
        try {
            const tableName = model
                .replace(/([A-Z])/g, "_$1")
                .toLowerCase()
                .slice(1);
            let result;
            if (deletedByUserId) {
                result = await this.prisma.$executeRawUnsafe(`UPDATE "${tableName}" SET "deletedAt" = NOW(), "deletedBy" = $1 WHERE id = $2 AND "deletedAt" IS NULL`, deletedByUserId, id);
            }
            else {
                result = await this.prisma.$executeRawUnsafe(`UPDATE "${tableName}" SET "deletedAt" = NOW() WHERE id = $1 AND "deletedAt" IS NULL`, id);
            }
            if (result > 0) {
                this.logger.debug(`Soft deleted ${model} (${id}) by user ${deletedByUserId}`, metadata);
                return true;
            }
            return false;
        }
        catch (error) {
            this.logger.error(`Soft delete failed for ${model}:`, error);
            throw error;
        }
    }
    async batchSoftDelete(model, ids, deletedByUserId) {
        if (!ids || ids.length === 0) {
            return 0;
        }
        try {
            const result = await this.prisma.$executeRawUnsafe(`UPDATE "${model}" SET "deletedAt" = NOW(), "deletedBy" = $1
         WHERE id = ANY($2::text[]) AND "deletedAt" IS NULL`, deletedByUserId, ids);
            this.logger.debug(`Batch soft deleted ${result} records from ${model}`);
            return result;
        }
        catch (error) {
            this.logger.error(`Batch soft delete failed for ${model}:`, error);
            throw error;
        }
    }
    async restoreDeleted(model, id) {
        try {
            const tableName = model
                .replace(/([A-Z])/g, "_$1")
                .toLowerCase()
                .slice(1);
            const result = await this.prisma.$executeRawUnsafe(`UPDATE "${tableName}" SET "deletedAt" = NULL, "deletedBy" = NULL WHERE id = $1`, id);
            if (result > 0) {
                this.logger.debug(`Restored ${model} (${id})`);
                return true;
            }
            return false;
        }
        catch (error) {
            this.logger.error(`Restore failed for ${model}:`, error);
            throw error;
        }
    }
    async findPaginated(model, args, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const delegate = this.getDelegate(model);
        try {
            const [data, total] = await Promise.all([
                delegate.findMany({
                    ...args,
                    skip,
                    take: limit,
                }),
                delegate.count({
                    where: args.where,
                }),
            ]);
            return {
                data,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            };
        }
        catch (error) {
            this.logger.error(`Paginated query failed for ${model}:`, error);
            throw error;
        }
    }
    buildOptimalIncludes(model, requestedFields = []) {
        const includeMap = {
            exam: {
                questions: {
                    select: { id: true, question: true, options: true, points: true },
                },
                attempts: {
                    select: {
                        id: true,
                        studentId: true,
                        totalScore: true,
                        status: true,
                        student: { select: { id: true, firstName: true, lastName: true } },
                    },
                },
                rankings: {
                    select: { studentId: true, islandRank: true, percentage: true },
                },
                class: { select: { id: true, name: true } },
            },
            class: {
                teacher: { select: { id: true, firstName: true, lastName: true } },
                subject: { select: { id: true, name: true } },
                enrollments: {
                    select: {
                        id: true,
                        studentId: true,
                        status: true,
                    },
                },
            },
            user: {
                enrollments: {
                    select: { id: true, classId: true, status: true },
                },
                examAttempts: {
                    select: { id: true, examId: true, totalScore: true },
                },
                studentProfile: true,
            },
        };
        if (!requestedFields || requestedFields.length === 0) {
            return {};
        }
        const includes = {};
        const modelIncludes = includeMap[model] || {};
        requestedFields.forEach((field) => {
            if (modelIncludes[field]) {
                includes[field] = modelIncludes[field];
            }
        });
        return includes;
    }
    async bulkUpsert(model, data, uniqueKeys = ["id"]) {
        let created = 0;
        let updated = 0;
        const delegate = this.getDelegate(model);
        try {
            for (const item of data) {
                const where = uniqueKeys.reduce((acc, key) => {
                    acc[key] = item[key];
                    return acc;
                }, {});
                const existing = await delegate.findFirst({ where });
                if (existing) {
                    await delegate.update({
                        where,
                        data: item,
                    });
                    updated++;
                }
                else {
                    await delegate.create({ data: item });
                    created++;
                }
            }
            this.logger.debug(`Bulk upsert: ${created} created, ${updated} updated`);
            return { created, updated };
        }
        catch (error) {
            this.logger.error(`Bulk upsert failed for ${model}:`, error);
            throw error;
        }
    }
    async transaction(callback) {
        try {
            return await this.prisma.$transaction(async (prisma) => callback(prisma), {
                maxWait: 5000,
                timeout: 30000,
            });
        }
        catch (error) {
            this.logger.error("Transaction failed:", error);
            throw error;
        }
    }
    async getAggregatedStats(model, where, aggregations = ["count"]) {
        const delegate = this.getDelegate(model);
        const statsQuery = {
            where,
            _avg: aggregations.includes("avg") ? { totalMarks: true } : undefined,
            _max: aggregations.includes("max") ? { totalMarks: true } : undefined,
            _min: aggregations.includes("min") ? { totalMarks: true } : undefined,
            _count: aggregations.includes("count") ? true : undefined,
        };
        try {
            if (delegate.groupBy) {
                const stats = await delegate.groupBy(statsQuery);
                return stats[0] || {};
            }
            return {};
        }
        catch (error) {
            this.logger.error(`Aggregation failed for ${model}:`, error);
            throw error;
        }
    }
    async batchUpdate(model, updates, updatedByUserId) {
        let count = 0;
        const delegate = this.getDelegate(model);
        try {
            for (const update of updates) {
                const { id, ...data } = update;
                const updateData = updatedByUserId
                    ? { ...data, updatedAt: new Date(), updatedBy: updatedByUserId }
                    : { ...data, updatedAt: new Date() };
                const result = await delegate.update({
                    where: { id },
                    data: updateData,
                });
                if (result) {
                    count++;
                }
            }
            this.logger.debug(`Batch updated ${count} records in ${model}`);
            return count;
        }
        catch (error) {
            this.logger.error(`Batch update failed for ${model}:`, error);
            throw error;
        }
    }
    validateQueryComplexity(query, maxDepth = 3, currentDepth = 0) {
        if (currentDepth > maxDepth) {
            return {
                valid: false,
                reason: `Query depth exceeds maximum allowed (${maxDepth})`,
            };
        }
        if (query.include) {
            const includeKeys = Object.keys(query.include);
            if (includeKeys.length > 10) {
                return {
                    valid: false,
                    reason: "Too many included relations (max 10)",
                };
            }
            for (const key of includeKeys) {
                const nested = query.include[key];
                if (typeof nested === "object" && nested !== true) {
                    const validation = this.validateQueryComplexity(nested, maxDepth, currentDepth + 1);
                    if (!validation.valid) {
                        return validation;
                    }
                }
            }
        }
        return { valid: true };
    }
    async findOrphanedRecords(parentTable, childTable, foreignKeyColumn) {
        try {
            const orphaned = await this.prisma.$queryRawUnsafe(`SELECT c.* FROM "${childTable}" c
         JOIN "${parentTable}" p ON c."${foreignKeyColumn}" = p.id
         WHERE p."deletedAt" IS NOT NULL AND c."deletedAt" IS NULL
         LIMIT 1000`);
            if (orphaned && orphaned.length > 0) {
                this.logger.warn(`Found ${orphaned.length} orphaned records in ${childTable}`);
            }
            return orphaned || [];
        }
        catch (error) {
            this.logger.error("Orphaned records check failed:", error);
            return [];
        }
    }
    async incrementalSeed(model, data, uniqueFields) {
        let created = 0;
        let skipped = 0;
        const delegate = this.getDelegate(model);
        try {
            for (const item of data) {
                const where = uniqueFields.reduce((acc, field) => {
                    acc[field] = item[field];
                    return acc;
                }, {});
                const exists = await delegate.findFirst({ where });
                if (!exists) {
                    await delegate.create({ data: item });
                    created++;
                }
                else {
                    skipped++;
                }
            }
            this.logger.log(`Incremental seed complete: ${created} created, ${skipped} skipped`);
            return { created, skipped };
        }
        catch (error) {
            this.logger.error("Incremental seed failed:", error);
            throw error;
        }
    }
    async checkSchemaHealth() {
        const issues = [];
        try {
            const orphanedEnrollments = await this.findOrphanedRecords("Class", "Enrollment", "classId");
            if (orphanedEnrollments.length > 0) {
                issues.push(`Found ${orphanedEnrollments.length} orphaned enrollments`);
            }
            const orphanedAttempts = await this.findOrphanedRecords("Exam", "ExamAttempt", "examId");
            if (orphanedAttempts.length > 0) {
                issues.push(`Found ${orphanedAttempts.length} orphaned exam attempts`);
            }
            return {
                healthy: issues.length === 0,
                issues,
                timestamp: new Date(),
            };
        }
        catch (error) {
            this.logger.error("Schema health check failed:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                healthy: false,
                issues: ["Schema health check failed: " + errorMessage],
                timestamp: new Date(),
            };
        }
    }
};
exports.DatabaseUtilsService = DatabaseUtilsService;
exports.DatabaseUtilsService = DatabaseUtilsService = DatabaseUtilsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DatabaseUtilsService);
