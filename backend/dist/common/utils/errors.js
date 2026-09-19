"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.validate = validate;
class AppError extends Error {
    message;
    statusCode;
    errors;
    constructor(message, statusCode = 400, errors) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.errors = errors;
        this.name = "AppError";
    }
    static unauthorized(message = "Unauthorized") {
        return new AppError(message, 401);
    }
    static forbidden(message = "Forbidden") {
        return new AppError(message, 403);
    }
    static notFound(message = "Not found") {
        return new AppError(message, 404);
    }
    static conflict(message = "Conflict") {
        return new AppError(message, 409);
    }
    static validation(errors) {
        return new AppError("Validation failed", 422, errors);
    }
}
exports.AppError = AppError;
function validate(schema, data) {
    const result = schema.safeParse(data);
    if (!result.success) {
        throw AppError.validation(result.error.flatten());
    }
    return result.data;
}
