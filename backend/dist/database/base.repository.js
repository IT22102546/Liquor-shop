"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = void 0;
class BaseRepository {
    prisma;
    modelName;
    constructor(prisma, modelName) {
        this.prisma = prisma;
        this.modelName = modelName;
    }
    async findMany(args = {}) {
        return this.prisma[this.modelName].findMany(args);
    }
    async findManyWithDeleted(args = {}) {
        return this.prisma[this.modelName].findMany({
            ...args,
            __withDeleted: true,
        });
    }
    async findFirst(args = {}) {
        return this.prisma[this.modelName].findFirst(args);
    }
    async findFirstWithDeleted(args = {}) {
        return this.prisma[this.modelName].findFirst({
            ...args,
            __withDeleted: true,
        });
    }
    async findUnique(args) {
        return this.prisma[this.modelName].findUnique(args);
    }
    async count(args = {}) {
        return this.prisma[this.modelName].count(args);
    }
    async countWithDeleted(args = {}) {
        return this.prisma[this.modelName].count({
            ...args,
            __withDeleted: true,
        });
    }
    async create(args) {
        return this.prisma[this.modelName].create(args);
    }
    async update(args) {
        return this.prisma[this.modelName].update(args);
    }
    async updateMany(args) {
        return this.prisma[this.modelName].updateMany(args);
    }
    async softDelete(where, deletedBy) {
        return this.prisma[this.modelName].update({
            where,
            data: {
                deletedAt: new Date(),
                ...(deletedBy ? { deletedBy } : {}),
            },
        });
    }
    async softDeleteMany(where, deletedBy) {
        return this.prisma[this.modelName].updateMany({
            where,
            data: {
                deletedAt: new Date(),
                ...(deletedBy ? { deletedBy } : {}),
            },
        });
    }
    async restore(where) {
        return this.prisma[this.modelName].update({
            where,
            data: {
                deletedAt: null,
                deletedBy: null,
            },
        });
    }
    async hardDelete(where) {
        const model = this.prisma[this.modelName];
        return model.delete({ where });
    }
    async paginate(args = {}, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const take = limit;
        const [data, total] = await Promise.all([
            this.findMany({
                ...args,
                skip,
                take,
            }),
            this.count({
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
    async exists(where) {
        const count = await this.count({ where });
        return count > 0;
    }
    async upsert(args) {
        return this.prisma[this.modelName].upsert(args);
    }
}
exports.BaseRepository = BaseRepository;
