import { Prisma } from "../../generated/prisma";
import { AppException } from "./app-exception";
import { ErrorCode } from "./error-codes.enum";

export function mapPrismaError(error: unknown): AppException {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (error.code === "P2002") {
      const target = error.meta?.target as string[] | undefined;
      const field = target?.[0] || "field";
      const message = `A record with this ${field} already exists.`;
      return AppException.conflict(ErrorCode.DUPLICATE_ENTRY, message, {
        field,
        constraint: "unique",
      });
    }

    // Foreign key constraint violation
    if (error.code === "P2003") {
      return AppException.conflict(
        ErrorCode.CONSTRAINT_VIOLATION,
        "This operation violates a foreign key constraint.",
        { meta: error.meta }
      );
    }

    // Record not found
    if (error.code === "P2025") {
      return AppException.notFound(
        ErrorCode.RESOURCE_NOT_FOUND,
        "Record not found.",
        { meta: error.meta }
      );
    }

    // Database error
    return AppException.internal(ErrorCode.DATABASE_ERROR, error.message, {
      code: error.code,
      meta: error.meta,
    });
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return AppException.badRequest(
      ErrorCode.VALIDATION_ERROR,
      "Invalid data provided to database."
    );
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return AppException.internal(
      ErrorCode.TRANSACTION_FAILED,
      "Database connection failed.",
      {
        errorCode: error.errorCode,
      }
    );
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return AppException.internal(
      ErrorCode.DATABASE_ERROR,
      "A critical database engine error occurred.",
      { message: error.message }
    );
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return AppException.internal(
      ErrorCode.DATABASE_ERROR,
      "An unknown database error occurred.",
      { message: error.message }
    );
  }

  // Generic error
  if (error instanceof Error) {
    return AppException.internal(
      ErrorCode.INTERNAL_SERVER_ERROR,
      error.message
    );
  }

  return AppException.internal(
    ErrorCode.INTERNAL_SERVER_ERROR,
    "An unexpected error occurred."
  );
}