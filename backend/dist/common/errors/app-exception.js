"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppException = void 0;
const common_1 = require("@nestjs/common");
const error_codes_enum_1 = require("./error-codes.enum");
class AppException extends common_1.HttpException {
    code;
    context;
    timestamp;
    constructor(code, message, context) {
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
    static mapCodeToStatus(code) {
        const codeStr = code.toString();
        if (codeStr.includes("UNAUTHORIZED") || codeStr.includes("TOKEN_")) {
            return common_1.HttpStatus.UNAUTHORIZED;
        }
        if (codeStr.includes("FORBIDDEN") || codeStr.includes("INSUFFICIENT")) {
            return common_1.HttpStatus.FORBIDDEN;
        }
        if (codeStr.includes("VALIDATION") ||
            codeStr.includes("MISSING") ||
            codeStr.includes("INVALID") ||
            codeStr.includes("FILE") ||
            codeStr.includes("STORAGE")) {
            return common_1.HttpStatus.BAD_REQUEST;
        }
        if (codeStr.includes("ALREADY_EXISTS") || codeStr.includes("DUPLICATE")) {
            return common_1.HttpStatus.CONFLICT;
        }
        if (codeStr.includes("NOT_FOUND")) {
            return common_1.HttpStatus.NOT_FOUND;
        }
        if (codeStr.includes("BUSINESS_RULE") || codeStr.includes("CONSTRAINT")) {
            return common_1.HttpStatus.UNPROCESSABLE_ENTITY;
        }
        if (codeStr.includes("DATABASE") ||
            codeStr.includes("TRANSACTION") ||
            codeStr.includes("INTERNAL") ||
            codeStr.includes("SERVICE")) {
            return common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        }
        return common_1.HttpStatus.INTERNAL_SERVER_ERROR;
    }
    static getDefaultMessage(code) {
        const messages = {
            [error_codes_enum_1.ErrorCode.INVALID_CREDENTIALS]: "Invalid credentials provided",
            [error_codes_enum_1.ErrorCode.USER_NOT_FOUND]: "User not found",
            [error_codes_enum_1.ErrorCode.USER_ALREADY_EXISTS]: "User already exists",
            [error_codes_enum_1.ErrorCode.UNAUTHORIZED]: "Unauthorized access",
            [error_codes_enum_1.ErrorCode.FORBIDDEN]: "Access forbidden",
            [error_codes_enum_1.ErrorCode.TOKEN_EXPIRED]: "Token has expired",
            [error_codes_enum_1.ErrorCode.TOKEN_INVALID]: "Invalid token",
            [error_codes_enum_1.ErrorCode.HOSPITAL_NOT_FOUND]: "Hospital not found",
            [error_codes_enum_1.ErrorCode.CHILD_NOT_FOUND]: "Child not found",
            [error_codes_enum_1.ErrorCode.VALIDATION_FAILED]: "Validation failed",
            [error_codes_enum_1.ErrorCode.VALIDATION_ERROR]: "Validation error",
            [error_codes_enum_1.ErrorCode.MISSING_REQUIRED_FIELD]: "Missing required field",
            [error_codes_enum_1.ErrorCode.INVALID_INPUT]: "Invalid input",
            [error_codes_enum_1.ErrorCode.INVALID_FILE_TYPE]: "Invalid file type",
            [error_codes_enum_1.ErrorCode.FILE_TOO_LARGE]: "File too large",
            [error_codes_enum_1.ErrorCode.FILE_NOT_FOUND]: "File not found",
            [error_codes_enum_1.ErrorCode.UPLOAD_FAILED]: "Upload failed",
            [error_codes_enum_1.ErrorCode.STORAGE_ERROR]: "Storage error",
            [error_codes_enum_1.ErrorCode.INSUFFICIENT_PERMISSIONS]: "Insufficient permissions",
            [error_codes_enum_1.ErrorCode.BUSINESS_RULE_VIOLATION]: "Business rule violation",
            [error_codes_enum_1.ErrorCode.RESOURCE_NOT_FOUND]: "Resource not found",
            [error_codes_enum_1.ErrorCode.CONSTRAINT_VIOLATION]: "Constraint violation",
            [error_codes_enum_1.ErrorCode.DATABASE_ERROR]: "Database error",
            [error_codes_enum_1.ErrorCode.DUPLICATE_ENTRY]: "Duplicate entry",
            [error_codes_enum_1.ErrorCode.TRANSACTION_FAILED]: "Transaction failed",
            [error_codes_enum_1.ErrorCode.INTERNAL_SERVER_ERROR]: "Internal server error",
            [error_codes_enum_1.ErrorCode.SERVICE_UNAVAILABLE]: "Service unavailable",
            [error_codes_enum_1.ErrorCode.MAINTENANCE_MODE]: "System is in maintenance mode",
        };
        return messages[code] || "An error occurred";
    }
    static badRequest(code = error_codes_enum_1.ErrorCode.VALIDATION_FAILED, message, context) {
        return new AppException(code, message, context);
    }
    static unauthorized(message, context) {
        return new AppException(error_codes_enum_1.ErrorCode.UNAUTHORIZED, message, context);
    }
    static forbidden(message, context) {
        return new AppException(error_codes_enum_1.ErrorCode.FORBIDDEN, message, context);
    }
    static notFound(code = error_codes_enum_1.ErrorCode.RESOURCE_NOT_FOUND, message, context) {
        return new AppException(code, message, context);
    }
    static conflict(code = error_codes_enum_1.ErrorCode.DUPLICATE_ENTRY, message, context) {
        return new AppException(code, message, context);
    }
    static internal(code = error_codes_enum_1.ErrorCode.INTERNAL_SERVER_ERROR, message, context) {
        return new AppException(code, message, context);
    }
}
exports.AppException = AppException;
