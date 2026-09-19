"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapPrismaError = mapPrismaError;
const prisma_1 = require("../../generated/prisma");
const app_exception_1 = require("./app-exception");
const error_codes_enum_1 = require("./error-codes.enum");
function mapPrismaError(error) {
    if (error instanceof prisma_1.Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
            const target = error.meta?.target;
            const field = target?.[0] || "field";
            const message = `A record with this ${field} already exists.`;
            return app_exception_1.AppException.conflict(error_codes_enum_1.ErrorCode.DUPLICATE_ENTRY, message, {
                field,
                constraint: "unique",
            });
        }
        if (error.code === "P2003") {
            return app_exception_1.AppException.conflict(error_codes_enum_1.ErrorCode.CONSTRAINT_VIOLATION, "This operation violates a foreign key constraint.", { meta: error.meta });
        }
        if (error.code === "P2025") {
            return app_exception_1.AppException.notFound(error_codes_enum_1.ErrorCode.RESOURCE_NOT_FOUND, "Record not found.", { meta: error.meta });
        }
        return app_exception_1.AppException.internal(error_codes_enum_1.ErrorCode.DATABASE_ERROR, error.message, {
            code: error.code,
            meta: error.meta,
        });
    }
    if (error instanceof prisma_1.Prisma.PrismaClientValidationError) {
        return app_exception_1.AppException.badRequest(error_codes_enum_1.ErrorCode.VALIDATION_ERROR, "Invalid data provided to database.");
    }
    if (error instanceof prisma_1.Prisma.PrismaClientInitializationError) {
        return app_exception_1.AppException.internal(error_codes_enum_1.ErrorCode.TRANSACTION_FAILED, "Database connection failed.", {
            errorCode: error.errorCode,
        });
    }
    if (error instanceof prisma_1.Prisma.PrismaClientRustPanicError) {
        return app_exception_1.AppException.internal(error_codes_enum_1.ErrorCode.DATABASE_ERROR, "A critical database engine error occurred.", { message: error.message });
    }
    if (error instanceof prisma_1.Prisma.PrismaClientUnknownRequestError) {
        return app_exception_1.AppException.internal(error_codes_enum_1.ErrorCode.DATABASE_ERROR, "An unknown database error occurred.", { message: error.message });
    }
    if (error instanceof Error) {
        return app_exception_1.AppException.internal(error_codes_enum_1.ErrorCode.INTERNAL_SERVER_ERROR, error.message);
    }
    return app_exception_1.AppException.internal(error_codes_enum_1.ErrorCode.INTERNAL_SERVER_ERROR, "An unexpected error occurred.");
}
