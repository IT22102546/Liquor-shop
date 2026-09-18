import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { Prisma } from "../generated/prisma";

// Type-safe delegate accessor
type PrismaDelegate = {
  findMany: (args?: any) => Promise<any[]>;
  findFirst: (args?: any) => Promise<any>;
  count: (args?: any) => Promise<number>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  groupBy?: (args: any) => Promise<any[]>;
};

/**
 * Database design patterns and utilities for common operations
 * Addresses schema design issues with reusable, tested patterns
 */
@Injectable()
export class DatabaseUtilsService {
  private readonly logger = new Logger(DatabaseUtilsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get Prisma delegate for a model name (type-safe accessor)
   */
  private getDelegate(model: string): PrismaDelegate {
    const delegate = (this.prisma as any)[model];
    if (!delegate) {
      throw new Error(`Unknown Prisma model: ${model}`);
    }
    return delegate as PrismaDelegate;
  }

  /**
   * PATTERN 1: Soft Delete with Audit
   * Usage: await dbUtils.softDelete('User', userId, deletedByUserId)
   * Note: Uses raw SQL for type safety across all models
   */
  async softDelete<T extends Prisma.ModelName>(
    model: T,
    id: string,
    deletedByUserId?: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      // Convert PascalCase model name to snake_case table name
      const tableName = model
        .replace(/([A-Z])/g, "_$1")
        .toLowerCase()
        .slice(1);

      let result: number;
      if (deletedByUserId) {
        result = await this.prisma.$executeRawUnsafe(
          `UPDATE "${tableName}" SET "deletedAt" = NOW(), "deletedBy" = $1 WHERE id = $2 AND "deletedAt" IS NULL`,
          deletedByUserId,
          id
        );
      } else {
        result = await this.prisma.$executeRawUnsafe(
          `UPDATE "${tableName}" SET "deletedAt" = NOW() WHERE id = $1 AND "deletedAt" IS NULL`,
          id
        );
      }

      if (result > 0) {
        this.logger.debug(
          `Soft deleted ${model} (${id}) by user ${deletedByUserId}`,
          metadata
        );
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Soft delete failed for ${model}:`, error);
      throw error;
    }
  }

  /**
   * PATTERN 2: Batch Soft Delete
   * Usage: await dbUtils.batchSoftDelete('users', [id1, id2], userId)
   */
  async batchSoftDelete<T extends Prisma.ModelName>(
    model: T,
    ids: string[],
    deletedByUserId: string
  ): Promise<number> {
    if (!ids || ids.length === 0) {
      return 0;
    }

    try {
      const result = await this.prisma.$executeRawUnsafe(
        `UPDATE "${model}" SET "deletedAt" = NOW(), "deletedBy" = $1
         WHERE id = ANY($2::text[]) AND "deletedAt" IS NULL`,
        deletedByUserId,
        ids
      );

      this.logger.debug(`Batch soft deleted ${result} records from ${model}`);
      return result;
    } catch (error) {
      this.logger.error(`Batch soft delete failed for ${model}:`, error);
      throw error;
    }
  }

  /**
   * PATTERN 3: Restore Soft Deleted Record
   * Usage: await dbUtils.restoreDeleted('users', userId)
   */
  async restoreDeleted<T extends Prisma.ModelName>(
    model: T,
    id: string
  ): Promise<boolean> {
    try {
      const tableName = model
        .replace(/([A-Z])/g, "_$1")
        .toLowerCase()
        .slice(1);
      const result = await this.prisma.$executeRawUnsafe(
        `UPDATE "${tableName}" SET "deletedAt" = NULL, "deletedBy" = NULL WHERE id = $1`,
        id
      );

      if (result > 0) {
        this.logger.debug(`Restored ${model} (${id})`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Restore failed for ${model}:`, error);
      throw error;
    }
  }

  /**
   * PATTERN 4: Paginated Query Helper
   * Prevents N+1 problems with proper select/include strategies
   * Usage: const result = await dbUtils.findPaginated('user',
   *   { where: { role: 'STUDENT' }, include: { enrollments: true } },
   *   page, limit
   * )
   */
  async findPaginated(
    model: string,
    args: any,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
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
    } catch (error) {
      this.logger.error(`Paginated query failed for ${model}:`, error);
      throw error;
    }
  }

  /**
   * PATTERN 5: Prevent N+1 Queries - Smart Include Builder
   * Automatically builds optimal include strategy based on requested fields
   * Usage: const includes = dbUtils.buildOptimalIncludes('exam',
   *   ['questions', 'attempts.student', 'rankings']
   * )
   */
  buildOptimalIncludes(
    model: string,
    requestedFields: string[] = []
  ): Record<string, any> {
    const includeMap: Record<string, Record<string, any>> = {
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

    const includes: Record<string, any> = {};
    const modelIncludes = includeMap[model] || {};

    requestedFields.forEach((field) => {
      if (modelIncludes[field]) {
        includes[field] = modelIncludes[field];
      }
    });

    return includes;
  }

  /**
   * PATTERN 6: Bulk Upsert with Change Tracking
   * Usage: await dbUtils.bulkUpsert('subject', subjectsData, ['code'])
   */
  async bulkUpsert(
    model: string,
    data: any[],
    uniqueKeys: string[] = ["id"]
  ): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    const delegate = this.getDelegate(model);

    try {
      for (const item of data) {
        const where: Record<string, any> = uniqueKeys.reduce(
          (acc: Record<string, any>, key) => {
            acc[key] = item[key];
            return acc;
          },
          {}
        );

        const existing = await delegate.findFirst({ where });

        if (existing) {
          await delegate.update({
            where,
            data: item,
          });
          updated++;
        } else {
          await delegate.create({ data: item });
          created++;
        }
      }

      this.logger.debug(`Bulk upsert: ${created} created, ${updated} updated`);
      return { created, updated };
    } catch (error) {
      this.logger.error(`Bulk upsert failed for ${model}:`, error);
      throw error;
    }
  }

  /**
   * PATTERN 7: Atomic Transaction with Rollback
   * Usage: await dbUtils.transaction(async (prisma) => {
   *   const user = await prisma.user.create(...);
   *   const enrollment = await prisma.enrollment.create(...);
   *   return { user, enrollment };
   * })
   */
  async transaction<T>(
    callback: (prisma: PrismaService) => Promise<T>
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(
        async (prisma) => callback(prisma as any),
        {
          maxWait: 5000,
          timeout: 30000,
        }
      );
    } catch (error) {
      this.logger.error("Transaction failed:", error);
      throw error;
    }
  }

  /**
   * PATTERN 8: Aggregation without N+1
   * Usage: const stats = await dbUtils.getAggregatedStats('exam',
   *   { where: { status: 'PUBLISHED' } },
   *   ['avg', 'max', 'min', 'count']
   * )
   */
  async getAggregatedStats(
    model: string,
    where: Record<string, any>,
    aggregations: ("avg" | "max" | "min" | "count" | "sum")[] = ["count"]
  ): Promise<Record<string, any>> {
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
    } catch (error) {
      this.logger.error(`Aggregation failed for ${model}:`, error);
      throw error;
    }
  }

  /**
   * PATTERN 9: Batch Update with Validation
   * Usage: await dbUtils.batchUpdate('enrollment',
   *   [{ id: '1', status: 'COMPLETED' }],
   *   updatedByUserId
   * )
   */
  async batchUpdate(
    model: string,
    updates: Array<{ id: string; [key: string]: any }>,
    updatedByUserId?: string
  ): Promise<number> {
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
    } catch (error) {
      this.logger.error(`Batch update failed for ${model}:`, error);
      throw error;
    }
  }

  /**
   * PATTERN 10: Query Complexity Protection
   * Prevents heavy queries by limiting depth and width
   * Usage: const validation = dbUtils.validateQueryComplexity(
   *   { include: { very: { deep: { nested: { field: true } } } } },
   *   maxDepth
   * )
   */
  validateQueryComplexity(
    query: any,
    maxDepth: number = 3,
    currentDepth: number = 0
  ): { valid: boolean; reason?: string } {
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
          const validation = this.validateQueryComplexity(
            nested,
            maxDepth,
            currentDepth + 1
          );
          if (!validation.valid) {
            return validation;
          }
        }
      }
    }

    return { valid: true };
  }

  /**
   * PATTERN 11: Orphaned Records Detection
   * Finds soft-deleted parents with active children
   * Usage: const orphaned = await dbUtils.findOrphanedRecords(
   *   'Class', 'Enrollment', 'classId'
   * )
   */
  async findOrphanedRecords(
    parentTable: string,
    childTable: string,
    foreignKeyColumn: string
  ): Promise<any[]> {
    try {
      const orphaned = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT c.* FROM "${childTable}" c
         JOIN "${parentTable}" p ON c."${foreignKeyColumn}" = p.id
         WHERE p."deletedAt" IS NOT NULL AND c."deletedAt" IS NULL
         LIMIT 1000`
      );

      if (orphaned && orphaned.length > 0) {
        this.logger.warn(
          `Found ${orphaned.length} orphaned records in ${childTable}`
        );
      }

      return orphaned || [];
    } catch (error) {
      this.logger.error("Orphaned records check failed:", error);
      return [];
    }
  }

  /**
   * PATTERN 12: Incremental Seeding Helper
   * Only creates records that don't exist (prevents duplicates)
   * Usage: await dbUtils.incrementalSeed('subject', subjects, ['code'])
   */
  async incrementalSeed(
    model: string,
    data: any[],
    uniqueFields: string[]
  ): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    const delegate = this.getDelegate(model);

    try {
      for (const item of data) {
        const where: Record<string, any> = uniqueFields.reduce(
          (acc: Record<string, any>, field) => {
            acc[field] = item[field];
            return acc;
          },
          {}
        );

        const exists = await delegate.findFirst({ where });

        if (!exists) {
          await delegate.create({ data: item });
          created++;
        } else {
          skipped++;
        }
      }

      this.logger.log(
        `Incremental seed complete: ${created} created, ${skipped} skipped`
      );
      return { created, skipped };
    } catch (error) {
      this.logger.error("Incremental seed failed:", error);
      throw error;
    }
  }

  /**
   * PATTERN 13: Schema Health Check
   * Validates referential integrity and soft delete consistency
   */
  async checkSchemaHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    timestamp: Date;
  }> {
    const issues: string[] = [];

    try {
      // Check for orphaned enrollments
      const orphanedEnrollments = await this.findOrphanedRecords(
        "Class",
        "Enrollment",
        "classId"
      );
      if (orphanedEnrollments.length > 0) {
        issues.push(`Found ${orphanedEnrollments.length} orphaned enrollments`);
      }

      // Check for orphaned exam attempts
      const orphanedAttempts = await this.findOrphanedRecords(
        "Exam",
        "ExamAttempt",
        "examId"
      );
      if (orphanedAttempts.length > 0) {
        issues.push(`Found ${orphanedAttempts.length} orphaned exam attempts`);
      }

      return {
        healthy: issues.length === 0,
        issues,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error("Schema health check failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        healthy: false,
        issues: ["Schema health check failed: " + errorMessage],
        timestamp: new Date(),
      };
    }
  }
}
