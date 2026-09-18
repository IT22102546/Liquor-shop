/**
 * Soft Delete Middleware for Prisma
 *
 * Automatically filters out soft-deleted records (deletedAt !== null)
 * for all findMany, findFirst, findUnique, and count operations.
 *
 * Usage:
 * - Apply this middleware in main.ts or prisma.service.ts
 * - To include deleted records, use: prisma.model.findMany({ where: { deletedAt: { not: null } } })
 * - To see all records: Use raw queries or add a bypass parameter
 */

import { Prisma } from "../../generated/prisma";

/**
 * Models that support soft delete (have deletedAt field)
 */
const SOFT_DELETE_MODELS = [
  "User",
  "Class",
  "Enrollment",
  "Exam",
  "ExamAttempt",
  "Publication",
  "CourseMaterial",
  "Payment",
  "TransferRequest",
  "Announcement",
  "Notification",
];

/**
 * Check if model supports soft delete
 */
function supportsSoftDelete(modelName: string): boolean {
  return SOFT_DELETE_MODELS.includes(modelName);
}

/**
 * Soft delete middleware
 */
export function createSoftDeleteMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    const { model, action } = params;

    if (!model || !supportsSoftDelete(model)) {
      return next(params);
    }

    // Handle different query types
    switch (action) {
      case "findUnique":
      case "findFirst": {
        // Modify params to exclude soft deleted
        params.action = "findFirst";
        params.args.where = {
          ...params.args.where,
          deletedAt: null,
        };
        break;
      }

      case "findMany": {
        // Only add filter if deletedAt is not already specified
        if (!params.args.where?.deletedAt) {
          params.args.where = {
            ...params.args.where,
            deletedAt: null,
          };
        }
        break;
      }

      case "count": {
        // Only add filter if deletedAt is not already specified
        if (!params.args.where?.deletedAt) {
          params.args.where = {
            ...params.args.where,
            deletedAt: null,
          };
        }
        break;
      }

      case "update": {
        // Find first non-deleted record
        params.action = "updateMany";
        params.args.where = {
          ...params.args.where,
          deletedAt: null,
        };
        break;
      }

      case "updateMany": {
        // Only update non-deleted records
        if (!params.args.where?.deletedAt) {
          params.args.where = {
            ...params.args.where,
            deletedAt: null,
          };
        }
        break;
      }

      case "delete": {
        // Convert hard delete to soft delete
        params.action = "update";
        params.args.data = {
          deletedAt: new Date(),
        };
        break;
      }

      case "deleteMany": {
        // Convert hard delete to soft delete
        params.action = "updateMany";
        if (!params.args.data) {
          params.args.data = {};
        }
        params.args.data.deletedAt = new Date();
        break;
      }
    }

    return next(params);
  };
}

/**
 * Bypass soft delete middleware for specific operations
 *
 * Use this when you need to query including deleted records
 *
 * Example:
 * ```typescript
 * // Include deleted records
 * await prisma.user.findMany({
 *   where: {
 *     deletedAt: { not: null }, // This will bypass the middleware filter
 *   },
 * });
 *
 * // Get only deleted records
 * await prisma.user.findMany({
 *   where: {
 *     deletedAt: { not: null },
 *   },
 * });
 * ```
 */
export function bypassSoftDelete<T>(where: T): T {
  return {
    ...where,
    // Add explicit deletedAt condition to bypass middleware
    OR: [{ deletedAt: null }, { deletedAt: { not: null } }],
  } as T;
}
