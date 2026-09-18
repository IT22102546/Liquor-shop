import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { Prisma, PrismaClient } from "../generated/prisma";

// Environment-based logging configuration
const getLogConfig = (): Prisma.LogLevel[] => {
  const isProduction = process.env.NODE_ENV === "production";
  // In production: only warnings and errors
  // In development: include info (but not queries by default for performance)
  if (isProduction) {
    return ["warn", "error"];
  }
  // Enable query logging only if explicitly requested in dev
  if (process.env.PRISMA_QUERY_LOG === "true") {
    return ["query", "info", "warn", "error"];
  }
  return ["info", "warn", "error"];
};

// Connection pool configuration for better performance
const getDatasourceConfig = () => ({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: getLogConfig(),
      ...getDatasourceConfig(),
    });

    // Soft-delete query middleware: by default exclude deleted records for specific models
    // These are all models in the schema that have a deletedAt field
    const SOFT_DELETE_MODELS = new Set<string>([
      "User",
      "Subject",
      "Class",
      "Enrollment",
      "Exam",
      // "Payment", // ❌ Payment model does NOT have deletedAt field - removed from soft-delete
      "Invoice",
      "GradeBook",
      "StudentProgress",
      "ChatMessage",
      "Question",
      "Announcement",
      "Notification",
    ]);

    this.$use(async (params, next) => {
      // READ paths: enforce deletedAt: null unless explicitly overridden by a custom flag
      if (
        (params.action === "findMany" ||
          params.action === "findFirst" ||
          params.action === "count" ||
          params.action === "aggregate" ||
          params.action === "groupBy") &&
        SOFT_DELETE_MODELS.has(params.model!)
      ) {
        params.args = params.args || {};
        const withDeleted = params.args.__withDeleted === true;
        if (!withDeleted) {
          params.args.where = params.args.where || {};
          if (params.args.where.deletedAt === undefined) {
            params.args.where.deletedAt = null;
          }
        }
        // Clean custom flag if present to avoid Prisma errors
        if ("__withDeleted" in params.args) {
          delete params.args.__withDeleted;
        }
      }

      // DELETE paths: convert delete to soft-delete where applicable
      if (SOFT_DELETE_MODELS.has(params.model!)) {
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

  // Health check method for monitoring
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  // Helper method for soft deletes (if needed)
  async softDelete(model: string, where: any) {
    return (this as any)[model].update({
      where,
      data: {
        deletedAt: new Date(),
      },
    });
  }

  // Helper method for pagination
  async paginate(
    model: string,
    args: any,
    page: number = 1,
    limit: number = 10
  ) {
    const skip = (page - 1) * limit;
    const take = limit;

    const [data, total] = await Promise.all([
      (this as any)[model].findMany({
        ...args,
        skip,
        take,
      }),
      (this as any)[model].count({
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
}
