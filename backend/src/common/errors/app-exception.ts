import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorCode } from "./error-codes.enum";

/**
 * Custom application exception with structured error information
 */
export class AppException extends HttpException {
  public readonly code: ErrorCode;
  public readonly context?: Record<string, any>;
  public readonly timestamp: string;

  constructor(
    code: ErrorCode,
    message?: string,
    context?: Record<string, any>
  ) {
    // Map error code to HTTP status
    const status = AppException.mapCodeToStatus(code);

    const response = {
      statusCode: status,
      code,
      message: message || AppException.getDefaultMessage(code),
      context,
      timestamp: new Date().toISOString(),
    };

    super(response, status);

    this.code = code;
    this.context = context;
    this.timestamp = response.timestamp;
  }

  private static mapCodeToStatus(code: ErrorCode): HttpStatus {
    const codeStr = code.toString();

    // Authentication/Authorization errors (4xx)
    if (codeStr.includes("UNAUTHORIZED") || codeStr.includes("TOKEN_")) {
      return HttpStatus.UNAUTHORIZED;
    }

    if (codeStr.includes("FORBIDDEN") || codeStr.includes("INSUFFICIENT")) {
      return HttpStatus.FORBIDDEN;
    }

    // Validation errors (400)
    if (
      codeStr.includes("VALIDATION") ||
      codeStr.includes("MISSING") ||
      codeStr.includes("INVALID") ||
      codeStr.includes("FILE") ||
      codeStr.includes("STORAGE")
    ) {
      return HttpStatus.BAD_REQUEST;
    }

    // Conflict errors (409)
    if (codeStr.includes("ALREADY_EXISTS") || codeStr.includes("DUPLICATE")) {
      return HttpStatus.CONFLICT;
    }

    // Not found errors (404)
    if (codeStr.includes("NOT_FOUND")) {
      return HttpStatus.NOT_FOUND;
    }

    // Business rule violations (422)
    if (codeStr.includes("BUSINESS_RULE") || codeStr.includes("CONSTRAINT")) {
      return HttpStatus.UNPROCESSABLE_ENTITY;
    }

    // Server errors (500)
    if (
      codeStr.includes("DATABASE") ||
      codeStr.includes("TRANSACTION") ||
      codeStr.includes("INTERNAL") ||
      codeStr.includes("SERVICE")
    ) {
      return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    // Default
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private static getDefaultMessage(code: ErrorCode): string {
    const messages: Partial<Record<ErrorCode, string>> = {
      // Auth errors
      [ErrorCode.INVALID_CREDENTIALS]: "Invalid credentials provided",
      [ErrorCode.USER_NOT_FOUND]: "User not found",
      [ErrorCode.USER_ALREADY_EXISTS]: "User already exists",
      [ErrorCode.UNAUTHORIZED]: "Unauthorized access",
      [ErrorCode.FORBIDDEN]: "Access forbidden",
      [ErrorCode.TOKEN_EXPIRED]: "Token has expired",
      [ErrorCode.TOKEN_INVALID]: "Invalid token",

      // Hospital errors
      [ErrorCode.HOSPITAL_NOT_FOUND]: "Hospital not found",

      // Child errors
      [ErrorCode.CHILD_NOT_FOUND]: "Child not found",

      // Validation errors
      [ErrorCode.VALIDATION_FAILED]: "Validation failed",
      [ErrorCode.VALIDATION_ERROR]: "Validation error",
      [ErrorCode.MISSING_REQUIRED_FIELD]: "Missing required field",
      [ErrorCode.INVALID_INPUT]: "Invalid input",
      [ErrorCode.INVALID_FILE_TYPE]: "Invalid file type",
      [ErrorCode.FILE_TOO_LARGE]: "File too large",
      [ErrorCode.FILE_NOT_FOUND]: "File not found",
      [ErrorCode.UPLOAD_FAILED]: "Upload failed",
      [ErrorCode.STORAGE_ERROR]: "Storage error",

      // Permission errors
      [ErrorCode.INSUFFICIENT_PERMISSIONS]: "Insufficient permissions",

      // Business rule errors
      [ErrorCode.BUSINESS_RULE_VIOLATION]: "Business rule violation",

      // Resource errors
      [ErrorCode.RESOURCE_NOT_FOUND]: "Resource not found",
      [ErrorCode.CONSTRAINT_VIOLATION]: "Constraint violation",

      // Database errors
      [ErrorCode.DATABASE_ERROR]: "Database error",
      [ErrorCode.DUPLICATE_ENTRY]: "Duplicate entry",
      [ErrorCode.TRANSACTION_FAILED]: "Transaction failed",

      // System errors
      [ErrorCode.INTERNAL_SERVER_ERROR]: "Internal server error",
      [ErrorCode.SERVICE_UNAVAILABLE]: "Service unavailable",
      [ErrorCode.MAINTENANCE_MODE]: "System is in maintenance mode",
    };

    return messages[code] || "An error occurred";
  }

  static badRequest(
    code: ErrorCode = ErrorCode.VALIDATION_FAILED,
    message?: string,
    context?: Record<string, any>
  ): AppException {
    return new AppException(code, message, context);
  }

  static unauthorized(
    message?: string,
    context?: Record<string, any>
  ): AppException {
    return new AppException(ErrorCode.UNAUTHORIZED, message, context);
  }

  static forbidden(
    message?: string,
    context?: Record<string, any>
  ): AppException {
    return new AppException(ErrorCode.FORBIDDEN, message, context);
  }

  static notFound(
    code: ErrorCode = ErrorCode.RESOURCE_NOT_FOUND,
    message?: string,
    context?: Record<string, any>
  ): AppException {
    return new AppException(code, message, context);
  }

  static conflict(
    code: ErrorCode = ErrorCode.DUPLICATE_ENTRY,
    message?: string,
    context?: Record<string, any>
  ): AppException {
    return new AppException(code, message, context);
  }

  static internal(
    code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR,
    message?: string,
    context?: Record<string, any>
  ): AppException {
    return new AppException(code, message, context);
  }
}